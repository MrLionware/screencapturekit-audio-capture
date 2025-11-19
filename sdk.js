/**
 * High-level SDK wrapper for ScreenCaptureKit Audio Capture
 * Provides an event-based, developer-friendly API
 */

const { ScreenCaptureKit } = require('./index');
const EventEmitter = require('events');
const { Readable, Transform } = require('stream');

/**
 * Custom error class with machine-readable error codes
 */
class AudioCaptureError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AudioCaptureError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error codes for machine-readable error handling
 */
const ErrorCodes = {
  PERMISSION_DENIED: 'ERR_PERMISSION_DENIED',
  APP_NOT_FOUND: 'ERR_APP_NOT_FOUND',
  INVALID_ARGUMENT: 'ERR_INVALID_ARGUMENT',
  ALREADY_CAPTURING: 'ERR_ALREADY_CAPTURING',
  CAPTURE_FAILED: 'ERR_CAPTURE_FAILED',
  PROCESS_NOT_FOUND: 'ERR_PROCESS_NOT_FOUND',
};

/**
 * Readable stream for audio capture
 * Provides a stream-based alternative to the EventEmitter API
 */
class AudioStream extends Readable {
  /**
   * Create a new AudioStream
   * @param {AudioCapture} capture - The AudioCapture instance to use
   * @param {string|number} appIdentifier - Application name, bundle ID, or process ID
   * @param {Object} options - Stream and capture options
   * @param {number} options.minVolume - Minimum RMS volume threshold (0.0 to 1.0)
   * @param {string} options.format - Audio format: 'float32' (default) or 'int16'
   * @param {boolean} options.objectMode - Enable object mode to receive full sample objects instead of just raw audio data
   * @private
   */
  constructor(capture, appIdentifier, options = {}) {
    // Extract objectMode option, default to false for backward compatibility
    const { objectMode = false, ...captureOptions } = options;

    super({
      objectMode,
      highWaterMark: objectMode ? 16 : 16384 // 16 objects or 16KB of data
    });

    this._capture = capture;
    this._appIdentifier = appIdentifier;
    this._captureOptions = captureOptions;
    this._objectMode = objectMode;
    this._started = false;
    this._audioHandler = null;
    this._errorHandler = null;
    this._stopHandler = null;
  }

  /**
   * Internal method called when stream starts flowing
   * @private
   */
  _read() {
    // Start capture on first read if not already started
    if (!this._started) {
      this._started = true;

      // Set up event handlers
      this._audioHandler = (sample) => {
        // Push sample data to the stream
        // In object mode, push the entire sample object
        // In normal mode, push just the raw audio buffer
        const data = this._objectMode ? sample : sample.data;

        if (!this.push(data)) {
          // Backpressure - stream buffer is full
          // In a more sophisticated implementation, we might pause the capture here
        }
      };

      this._errorHandler = (error) => {
        // Emit error and destroy the stream
        this.destroy(error);
      };

      this._stopHandler = () => {
        // Capture stopped externally, end the stream
        this.push(null);
      };

      // Attach event handlers
      this._capture.on('audio', this._audioHandler);
      this._capture.on('error', this._errorHandler);
      this._capture.on('stop', this._stopHandler);

      // Start the capture
      const success = this._capture.startCapture(this._appIdentifier, this._captureOptions);

      if (!success) {
        // If startCapture returns false, an error event will be emitted
        // which will trigger _errorHandler and destroy the stream
        return;
      }
    }
  }

  /**
   * Internal method called when stream is being destroyed
   * @private
   */
  _destroy(error, callback) {
    // Clean up event listeners
    if (this._audioHandler) {
      this._capture.removeListener('audio', this._audioHandler);
      this._capture.removeListener('error', this._errorHandler);
      this._capture.removeListener('stop', this._stopHandler);
      this._audioHandler = null;
      this._errorHandler = null;
      this._stopHandler = null;
    }

    // Stop capture if it's still running
    if (this._capture.isCapturing()) {
      this._capture.stopCapture();
    }

    callback(error);
  }

  /**
   * Get information about the current capture
   * @returns {Object|null} Current capture info or null if not capturing
   */
  getCurrentCapture() {
    return this._capture.getCurrentCapture();
  }

  /**
   * Stop the stream and underlying capture
   */
  stop() {
    this.push(null); // Signal end of stream
  }
}

/**
 * Transform stream for converting audio to STT-ready format
 * Handles common conversions: Float32 to Int16, stereo to mono, resampling
 */
class STTConverter extends Transform {
  /**
   * Create a new STTConverter
   * @param {Object} options - Conversion options
   * @param {string} [options.format='int16'] - Output format ('int16' or 'float32')
   * @param {number} [options.channels=1] - Output channels (1 = mono, 2 = stereo)
   * @param {boolean} [options.objectMode=false] - Pass through full sample objects with converted data
   * @private
   */
  constructor(options = {}) {
    const { format = 'int16', channels = 1, objectMode = false } = options;

    super({ objectMode });

    this.targetFormat = format;
    this.targetChannels = channels;
    this._objectMode = objectMode;
  }

  /**
   * Convert Float32 buffer to Int16
   * @private
   */
  _convertToInt16(buffer) {
    const float32 = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    const int16 = new Int16Array(float32.length);

    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    return Buffer.from(int16.buffer);
  }

  /**
   * Convert stereo to mono by averaging channels
   * @private
   */
  _stereoToMono(buffer, format) {
    const bytesPerSample = format === 'int16' ? 2 : 4;
    const frameCount = buffer.length / bytesPerSample / 2; // 2 channels
    const mono = Buffer.allocUnsafe(frameCount * bytesPerSample);

    if (format === 'int16') {
      const stereo = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
      const monoView = new Int16Array(mono.buffer);
      for (let i = 0; i < frameCount; i++) {
        monoView[i] = Math.floor((stereo[i * 2] + stereo[i * 2 + 1]) / 2);
      }
    } else {
      const stereo = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
      const monoView = new Float32Array(mono.buffer);
      for (let i = 0; i < frameCount; i++) {
        monoView[i] = (stereo[i * 2] + stereo[i * 2 + 1]) / 2;
      }
    }

    return mono;
  }

  _transform(chunk, encoding, callback) {
    try {
      // Handle both object mode (full sample) and buffer mode
      const sample = this._objectMode ? chunk : {
        data: chunk,
        format: 'float32',
        channels: 2 // Assume stereo if not in object mode
      };

      let data = sample.data;
      let currentFormat = sample.format || 'float32';
      let currentChannels = sample.channels || 2;

      // Convert format if needed
      if (currentFormat === 'float32' && this.targetFormat === 'int16') {
        data = this._convertToInt16(data);
        currentFormat = 'int16';
      }

      // Convert channels if needed
      if (currentChannels === 2 && this.targetChannels === 1) {
        data = this._stereoToMono(data, currentFormat);
        currentChannels = 1;
      }

      // Output based on mode
      if (this._objectMode) {
        // Pass through modified sample object
        this.push({
          ...sample,
          data,
          format: currentFormat,
          channels: currentChannels
        });
      } else {
        // Just push the converted buffer
        this.push(data);
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }
}

class AudioCapture extends EventEmitter {
  constructor() {
    super();
    this.captureKit = new ScreenCaptureKit();
    this.capturing = false;
    this.currentProcessId = null;
    this.currentAppInfo = null;
  }

  /**
   * Get all available applications
   * @returns {Array<{processId: number, bundleIdentifier: string, applicationName: string}>}
   */
  getApplications() {
    return this.captureKit.getAvailableApps();
  }

  /**
   * Find application by name or bundle identifier
   * @param {string} identifier - Application name or bundle ID (case-insensitive, partial match)
   * @returns {Object|null} Application info or null if not found
   */
  findApplication(identifier) {
    const apps = this.getApplications();
    const search = identifier.toLowerCase();
    return apps.find(app =>
      app.applicationName.toLowerCase().includes(search) ||
      app.bundleIdentifier.toLowerCase().includes(search)
    );
  }

  /**
   * Find application by name (case-insensitive search)
   * @param {string} name - Application name to search for
   * @returns {Object|null} Application info or null if not found
   */
  findByName(name) {
    return this.findApplication(name);
  }

  /**
   * Get only applications likely to produce audio
   * Filters out system apps and utilities that typically don't have audio
   * @param {Object} options - Filter options
   * @param {boolean} options.includeSystemApps - If true, returns all apps (same as getApplications())
   * @returns {Array<{processId: number, bundleIdentifier: string, applicationName: string}>}
   */
  getAudioApps(options = {}) {
    const apps = this.getApplications();

    // If includeSystemApps is true, return all apps
    if (options.includeSystemApps) {
      return apps;
    }

    // Common system/utility apps that typically don't have audio
    const excludePatterns = [
      /^finder$/i,
      /^system/i,
      /preferences$/i,
      /settings$/i,
      /^activity monitor$/i,
      /^console$/i,
      /^terminal$/i,
      /^iterm/i,
      /^ssh/i,
      /^keychain/i,
      /^calculator$/i,
      /^notes$/i,
      /^reminders$/i,
      /^calendar$/i,
      /^contacts$/i,
      /^mail$/i,
      /^messages$/i,
      /^preview$/i,
      /^textEdit$/i,
      /^font book$/i,
    ];

    const filtered = apps.filter(app => {
      const name = app.applicationName;
      return !excludePatterns.some(pattern => pattern.test(name));
    });

    // If filtering resulted in empty array, provide helpful guidance
    if (filtered.length === 0 && apps.length > 0) {
      // Add a helpful property to indicate fallback is available
      filtered._hint = 'No audio apps found after filtering. Try getAudioApps({ includeSystemApps: true }) or getApplications() to see all apps.';
    }

    return filtered;
  }

  /**
   * Get application by process ID
   * @param {number} processId - Process ID
   * @returns {Object|null} Application info or null if not found
   */
  getApplicationByPid(processId) {
    const apps = this.getApplications();
    return apps.find(app => app.processId === processId);
  }

  /**
   * Smart app selection with fallback strategies
   * Tries multiple methods to find an app: exact name, PID, bundle ID, partial match, audio apps
   * @param {string|number|string[]} identifiers - App identifier(s) to try in order
   * @param {Object} options - Selection options
   * @param {boolean} [options.audioOnly=true] - Only search audio apps (excludes system apps)
   * @param {boolean} [options.throwOnNotFound=false] - Throw error if no app found (default: return null)
   * @returns {Object|null} Application info or null if not found (unless throwOnNotFound is true)
   * @throws {AudioCaptureError} If throwOnNotFound is true and no app found
   * @example
   * // Try multiple apps in order
   * const app = capture.selectApp(['Spotify', 'Music', 'Safari']);
   *
   * // Try PID or name
   * const app = capture.selectApp(12345) || capture.selectApp('Spotify');
   *
   * // Get first audio app if none specified
   * const app = capture.selectApp();
   */
  selectApp(identifiers = null, options = {}) {
    const { audioOnly = true, throwOnNotFound = false } = options;

    // If no identifiers provided, return first audio app
    if (!identifiers) {
      const audioApps = audioOnly ? this.getAudioApps() : this.getApplications();
      if (audioApps.length > 0) {
        return audioApps[0];
      }

      if (throwOnNotFound) {
        throw new AudioCaptureError(
          'No applications available',
          ErrorCodes.APP_NOT_FOUND,
          { suggestion: 'Check screen recording permissions' }
        );
      }
      return null;
    }

    // Normalize to array
    const identifierList = Array.isArray(identifiers) ? identifiers : [identifiers];

    // Get app list once
    const apps = audioOnly ? this.getAudioApps() : this.getApplications();

    // Try each identifier in order
    for (const identifier of identifierList) {
      let app = null;

      if (typeof identifier === 'number') {
        // Try as PID
        app = apps.find(a => a.processId === identifier);
      } else if (typeof identifier === 'string') {
        const search = identifier.toLowerCase();

        // Try exact name match first
        app = apps.find(a => a.applicationName.toLowerCase() === search);

        // Try exact bundle ID match
        if (!app) {
          app = apps.find(a => a.bundleIdentifier.toLowerCase() === search);
        }

        // Try partial name match
        if (!app) {
          app = apps.find(a => a.applicationName.toLowerCase().includes(search));
        }

        // Try partial bundle ID match
        if (!app) {
          app = apps.find(a => a.bundleIdentifier.toLowerCase().includes(search));
        }
      }

      // Return first match
      if (app) {
        return app;
      }
    }

    // No app found
    if (throwOnNotFound) {
      const identifierStr = Array.isArray(identifiers) ? identifiers.join(', ') : identifiers;
      throw new AudioCaptureError(
        `No application found matching: ${identifierStr}`,
        ErrorCodes.APP_NOT_FOUND,
        {
          requestedIdentifiers: identifierList,
          availableApps: apps.map(a => a.applicationName),
          suggestion: `Try one of: ${apps.slice(0, 5).map(a => a.applicationName).join(', ')}`
        }
      );
    }

    return null;
  }

  /**
   * Verify screen recording permissions
   * Proactively checks if the app has necessary permissions before attempting capture
   * @static
   * @returns {Object} Permission status object
   * @returns {boolean} return.granted - Whether permission is granted
   * @returns {string} return.message - Human-readable status message
   * @returns {string} [return.remediation] - Instructions to fix permission issues
   * @example
   * const status = AudioCapture.verifyPermissions();
   * if (!status.granted) {
   *   console.error(status.message);
   *   console.log(status.remediation);
   * }
   */
  static verifyPermissions() {
    const capture = new AudioCapture();
    const apps = capture.getApplications();

    if (apps.length === 0) {
      return {
        granted: false,
        message: 'Screen Recording permission is not granted or no applications are available.',
        remediation:
          'To fix this:\n' +
          '1. Open System Preferences → Privacy & Security → Screen Recording\n' +
          '2. Add your terminal app (Terminal.app, iTerm2, VS Code, etc.)\n' +
          '3. Toggle it ON\n' +
          '4. Restart your terminal completely for changes to take effect'
      };
    }

    return {
      granted: true,
      message: `Screen Recording permission granted. Found ${apps.length} available application(s).`,
      availableApps: apps.length
    };
  }

  /**
   * Get detailed status of current capture session
   * @returns {Object|null} Status object or null if not capturing
   * @returns {boolean} return.capturing - Whether currently capturing
   * @returns {number} return.processId - Process ID being captured
   * @returns {Object} return.app - Application info (name, bundle ID, PID)
   * @returns {Object} return.config - Current capture configuration
   * @example
   * const status = capture.getStatus();
   * if (status) {
   *   console.log(`Capturing from: ${status.app.applicationName}`);
   *   console.log(`Format: ${status.config.format}, Channels: ${status.config.channels}`);
   * }
   */
  getStatus() {
    if (!this.capturing) {
      return null;
    }

    return {
      capturing: true,
      processId: this.currentProcessId,
      app: this.currentAppInfo,
      config: {
        minVolume: this.captureOptions.minVolume,
        format: this.captureOptions.format,
        // Note: Native config (sampleRate, channels, bufferSize) is not stored
        // after startCapture, only the JS-level options
      }
    };
  }

  /**
   * Start capturing audio from an application
   * @param {string|number|Array<string|number>} appIdentifier - Application name, bundle ID, process ID, or array of identifiers
   * @param {Object} options - Capture options
   * @param {number} options.minVolume - Minimum RMS volume threshold (0.0 to 1.0). Only emit audio events when volume exceeds this level
   * @param {string} options.format - Audio format: 'float32' (default) or 'int16'
   * @param {number} options.sampleRate - Sample rate in Hz (e.g., 44100, 48000). Default: 48000
   * @param {number} options.channels - Number of audio channels: 1 (mono) or 2 (stereo). Default: 2
   * @param {number} options.bufferSize - Buffer size for audio processing. Smaller values = lower latency but higher CPU usage
   * @param {boolean} options.excludeCursor - Exclude cursor from capture (for future video features). Default: true
   * @returns {boolean} true if capture started successfully
   * @throws {AudioCaptureError} Throws structured error with code and details if capture fails
   *
   * @fires AudioCapture#start
   * @fires AudioCapture#audio
   * @fires AudioCapture#error
   *
   * @example
   * // Basic usage
   * capture.startCapture('Spotify');
   *
   * // With error handling
   * try {
   *   capture.startCapture('Spotify', { minVolume: 0.01 });
   * } catch (err) {
   *   if (err.code === ErrorCodes.APP_NOT_FOUND) {
   *     console.log('Available apps:', err.details.availableApps);
   *   }
   * }
   *
   * // Custom configuration
   * capture.startCapture('Spotify', { sampleRate: 44100, channels: 1, format: 'int16' });
   */
  startCapture(appIdentifier, options = {}) {
    if (this.capturing) {
      const error = new AudioCaptureError(
        'Already capturing. Stop current capture first.',
        ErrorCodes.ALREADY_CAPTURING,
        { currentProcessId: this.currentProcessId, currentApp: this.currentAppInfo }
      );
      this.emit('error', error);
      throw error;
    }

    // Store options for use in callback (JavaScript-level processing)
    this.captureOptions = {
      minVolume: options.minVolume || 0,
      format: options.format || 'float32',
    };

    // Prepare native configuration options
    const nativeConfig = {
      sampleRate: options.sampleRate || 48000,
      channels: options.channels || 2,
      bufferSize: options.bufferSize,
      excludeCursor: options.excludeCursor !== undefined ? options.excludeCursor : true,
    };

    let processId;
    let appInfo;

    if (typeof appIdentifier === 'string') {
      appInfo = this.findApplication(appIdentifier);
      if (!appInfo) {
        const apps = this.getApplications();
        let error;
        if (apps.length === 0) {
          error = new AudioCaptureError(
            'No applications available. This may be a permissions issue.\n' +
            'Please ensure Screen Recording permission is granted in:\n' +
            'System Preferences → Privacy & Security → Screen Recording',
            ErrorCodes.PERMISSION_DENIED,
            {
              suggestion: 'Grant Screen Recording permission in System Preferences → Privacy & Security → Screen Recording',
              availableApps: []
            }
          );
        } else {
          error = new AudioCaptureError(
            `Application "${appIdentifier}" not found.`,
            ErrorCodes.APP_NOT_FOUND,
            {
              requestedApp: appIdentifier,
              availableApps: apps.map(a => a.applicationName),
              suggestion: `Try one of: ${apps.slice(0, 5).map(a => a.applicationName).join(', ')}${apps.length > 5 ? '...' : ''}`
            }
          );
        }
        this.emit('error', error);
        throw error;
      }
      processId = appInfo.processId;
    } else if (typeof appIdentifier === 'number') {
      processId = appIdentifier;
      appInfo = this.getApplicationByPid(processId);
      if (!appInfo) {
        const error = new AudioCaptureError(
          `No application found with process ID ${processId}.`,
          ErrorCodes.PROCESS_NOT_FOUND,
          {
            requestedPid: processId,
            suggestion: 'The application may have terminated or may not be capturable.'
          }
        );
        this.emit('error', error);
        throw error;
      }
    } else {
      const error = new AudioCaptureError(
        'Invalid appIdentifier. Must be string or number.',
        ErrorCodes.INVALID_ARGUMENT,
        {
          receivedType: typeof appIdentifier,
          expectedTypes: ['string', 'number']
        }
      );
      this.emit('error', error);
      throw error;
    }

    const success = this.captureKit.startCapture(processId, nativeConfig, (sample) => {
      // Enhance sample with computed properties
      const rms = this._calculateRMS(sample.data);
      const peak = this._calculatePeak(sample.data);

      // Apply volume threshold filter
      if (rms < this.captureOptions.minVolume) {
        return; // Skip this sample if below threshold
      }

      let audioData = sample.data;
      let actualFormat = 'float32'; // Native layer always provides Float32

      // Apply format conversion if requested
      if (this.captureOptions.format === 'int16') {
        audioData = this._convertToInt16(sample.data);
        actualFormat = 'int16'; // Format changed after conversion
      }

      // Calculate actual sample count (original data is always Float32 from native layer)
      const bytesPerSample = 4; // Float32 = 4 bytes
      const totalSamples = sample.data.length / bytesPerSample;
      const framesCount = totalSamples / sample.channelCount;
      const durationMs = (framesCount / sample.sampleRate) * 1000;

      const enhancedSample = {
        data: audioData,
        sampleRate: sample.sampleRate,
        channels: sample.channelCount,
        timestamp: sample.timestamp,
        format: actualFormat, // Report actual format of the data, not requested format
        // Computed properties
        sampleCount: totalSamples, // Total number of sample values (not bytes)
        framesCount: framesCount,  // Number of frames (samples per channel)
        durationMs: durationMs,
        rms: rms,
        peak: peak,
      };

      /**
       * Audio event
       * @event AudioCapture#audio
       * @type {object}
       * @property {Buffer} data - Audio samples (Float32 or Int16 depending on format option)
       * @property {number} sampleRate - Sample rate in Hz
       * @property {number} channels - Number of channels
       * @property {number} timestamp - Timestamp in seconds
       * @property {string} format - Audio format ('float32' or 'int16')
       * @property {number} sampleCount - Total number of sample values across all channels
       * @property {number} framesCount - Number of frames (sample values per channel)
       * @property {number} durationMs - Duration in milliseconds
       * @property {number} rms - RMS volume (0.0 to 1.0)
       * @property {number} peak - Peak volume (0.0 to 1.0)
       */
      this.emit('audio', enhancedSample);
    });

    if (success) {
      this.capturing = true;
      this.currentProcessId = processId;
      this.currentAppInfo = appInfo;

      /**
       * Start event
       * @event AudioCapture#start
       * @type {object}
       * @property {number} processId - Process ID being captured
       * @property {Object} app - Application info with applicationName, bundleIdentifier, and processId
       */
      this.emit('start', { processId, app: appInfo });
    } else {
      const error = new AudioCaptureError(
        'Failed to start capture',
        ErrorCodes.CAPTURE_FAILED,
        {
          processId: processId,
          app: appInfo,
          suggestion: 'The application may not have visible windows or may not support audio capture.'
        }
      );
      this.emit('error', error);
      throw error;
    }

    return success;
  }

  /**
   * Stop the current capture session
   * @fires AudioCapture#stop
   */
  stopCapture() {
    if (!this.capturing) {
      return;
    }

    this.captureKit.stopCapture();
    this.capturing = false;
    const processId = this.currentProcessId;
    const appInfo = this.currentAppInfo;
    this.currentProcessId = null;
    this.currentAppInfo = null;

    /**
     * Stop event
     * @event AudioCapture#stop
     * @type {object}
     * @property {number} processId - Process ID that was being captured
     * @property {Object} app - Application info with applicationName, bundleIdentifier, and processId
     */
    this.emit('stop', { processId, app: appInfo });
  }

  /**
   * Check if currently capturing
   * @returns {boolean}
   */
  isCapturing() {
    // Use internal state for consistent synchronous behavior
    // The native layer state is managed through startCapture/stopCapture calls
    return this.capturing;
  }

  /**
   * Get current capture info
   * @returns {Object|null} Current capture info or null if not capturing
   */
  getCurrentCapture() {
    if (!this.capturing || !this.currentProcessId) {
      return null;
    }

    return {
      processId: this.currentProcessId,
      app: this.getApplicationByPid(this.currentProcessId),
    };
  }

  /**
   * Create a readable stream for audio capture
   * Provides a stream-based alternative to the event-based API
   * @param {string|number} appIdentifier - Application name, bundle ID, or process ID
   * @param {Object} options - Stream and capture options
   * @param {number} options.minVolume - Minimum RMS volume threshold (0.0 to 1.0)
   * @param {string} options.format - Audio format: 'float32' (default) or 'int16'
   * @param {boolean} options.objectMode - Enable object mode to receive full sample objects instead of just raw audio data (default: false)
   * @returns {AudioStream} Readable stream that emits audio data
   *
   * @example
   * // Stream raw audio buffers
   * const audioStream = capture.createAudioStream('Spotify');
   * audioStream.pipe(myProcessor);
   *
   * @example
   * // Stream full sample objects (with metadata)
   * const audioStream = capture.createAudioStream('Spotify', { objectMode: true });
   * audioStream.on('data', (sample) => {
   *   console.log(`Sample rate: ${sample.sampleRate}, RMS: ${sample.rms}`);
   * });
   *
   * @example
   * // Use with pipeline for error handling
   * const { pipeline } = require('stream');
   * const fs = require('fs');
   * const audioStream = capture.createAudioStream('Spotify', { format: 'int16' });
   * pipeline(audioStream, myProcessor, fs.createWriteStream('output.raw'), (err) => {
   *   if (err) console.error('Pipeline failed:', err);
   * });
   */
  createAudioStream(appIdentifier, options = {}) {
    return new AudioStream(this, appIdentifier, options);
  }

  /**
   * Create a pre-configured stream for Speech-to-Text (STT) engines
   * Automatically converts to Int16 mono format - the most common STT input format
   * @param {string|number|string[]} appIdentifier - App name, PID, bundle ID, or array to try in order
   * @param {Object} options - STT stream options
   * @param {string} [options.format='int16'] - Output format ('int16' or 'float32')
   * @param {number} [options.channels=1] - Output channels (1 = mono, 2 = stereo)
   * @param {number} [options.minVolume] - Minimum RMS volume threshold
   * @param {number} [options.sampleRate=16000] - Target sample rate (Note: actual resampling not yet implemented, this is informational)
   * @param {boolean} [options.objectMode=false] - If true, stream emits sample objects with metadata
   * @param {boolean} [options.autoSelect=true] - If true, automatically selects first available audio app when identifier not found
   * @returns {STTConverter} Transform stream ready to pipe to STT engine
   * @example
   * // Basic usage - auto-converts to Int16 mono
   * const sttStream = capture.createSTTStream('Safari');
   * sttStream.pipe(yourSTTEngine);
   *
   * // With fallback apps
   * const sttStream = capture.createSTTStream(['Zoom', 'Safari', 'Chrome']);
   *
   * // Pipe directly to writable stream
   * const { pipeline } = require('stream');
   * pipeline(
   *   capture.createSTTStream('Spotify'),
   *   yourSTTWritableStream,
   *   (err) => console.error(err)
   * );
   */
  createSTTStream(appIdentifier, options = {}) {
    const {
      format = 'int16',
      channels = 1,
      minVolume,
      objectMode = false,
      autoSelect = true,
      ...captureOptions
    } = options;

    // Try to select app using smart selection
    let app = null;
    if (appIdentifier) {
      app = this.selectApp(appIdentifier, { audioOnly: true, throwOnNotFound: false });
    }

    // Auto-select if not found and autoSelect is true
    if (!app && autoSelect) {
      app = this.selectApp(null, { audioOnly: true, throwOnNotFound: false });
    }

    // If still no app, throw error
    if (!app) {
      throw new AudioCaptureError(
        'No application found for STT stream',
        ErrorCodes.APP_NOT_FOUND,
        {
          requestedApp: appIdentifier,
          suggestion: 'Start an audio application or check screen recording permissions'
        }
      );
    }

    // Create audio stream with appropriate settings
    const audioStream = this.createAudioStream(app.processId, {
      ...captureOptions,
      format: 'float32', // Always get float32 from source
      objectMode: true,  // Need metadata for conversion
      minVolume
    });

    // Create STT converter
    const converter = new STTConverter({ format, channels, objectMode });

    // Pipe audio stream through converter
    audioStream.pipe(converter);

    // Forward errors
    audioStream.on('error', (err) => converter.destroy(err));

    // Add stop method to converter for convenience
    converter.stop = () => audioStream.stop();

    // Add app info to converter
    converter.app = app;

    return converter;
  }

  /**
   * Calculate RMS (Root Mean Square) volume level
   * @private
   * @param {Buffer} samples - Float32 audio samples
   * @returns {number} RMS value (0.0 to 1.0)
   */
  _calculateRMS(samples) {
    if (samples.length === 0) return 0;

    const floatView = new Float32Array(
      samples.buffer,
      samples.byteOffset,
      samples.length / 4
    );

    let sum = 0;
    for (let i = 0; i < floatView.length; i++) {
      sum += floatView[i] * floatView[i];
    }
    return Math.sqrt(sum / floatView.length);
  }

  /**
   * Calculate peak volume level
   * @private
   * @param {Buffer} samples - Float32 audio samples
   * @returns {number} Peak value (0.0 to 1.0)
   */
  _calculatePeak(samples) {
    if (samples.length === 0) return 0;

    const floatView = new Float32Array(
      samples.buffer,
      samples.byteOffset,
      samples.length / 4
    );

    let peak = 0;
    for (let i = 0; i < floatView.length; i++) {
      const abs = Math.abs(floatView[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  /**
   * Convert Float32 audio samples to Int16 format
   * @private
   * @param {Buffer} samples - Float32 audio samples
   * @returns {Buffer} Int16 audio samples
   */
  _convertToInt16(samples) {
    const floatView = new Float32Array(
      samples.buffer,
      samples.byteOffset,
      samples.length / 4
    );

    const int16Buffer = Buffer.allocUnsafe(floatView.length * 2);
    const int16View = new Int16Array(
      int16Buffer.buffer,
      int16Buffer.byteOffset,
      floatView.length
    );

    for (let i = 0; i < floatView.length; i++) {
      // Clamp to [-1.0, 1.0] and convert to Int16 range [-32768, 32767]
      const clamped = Math.max(-1.0, Math.min(1.0, floatView[i]));
      int16View[i] = Math.round(clamped * 32767);
    }

    return int16Buffer;
  }

  /**
   * Convert Buffer to Float32Array for easier audio processing
   * @static
   * @param {Buffer} buffer - Buffer containing Float32 PCM audio samples
   * @returns {Float32Array} Float32Array view of the buffer
   * @example
   * const float32 = AudioCapture.bufferToFloat32Array(sample.data);
   * console.log(`Got ${float32.length} samples`);
   */
  static bufferToFloat32Array(buffer) {
    return new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / 4
    );
  }

  /**
   * Convert RMS to decibels
   * @static
   * @param {number} rms - RMS value (0.0 to 1.0)
   * @returns {number} dB level (-Infinity to 0)
   */
  static rmsToDb(rms) {
    if (rms <= 0) return -Infinity;
    return 20 * Math.log10(rms);
  }

  /**
   * Convert peak to decibels
   * @static
   * @param {number} peak - Peak value (0.0 to 1.0)
   * @returns {number} dB level (-Infinity to 0)
   */
  static peakToDb(peak) {
    if (peak <= 0) return -Infinity;
    return 20 * Math.log10(peak);
  }

  /**
   * Calculate decibels from audio samples
   * @static
   * @param {Buffer} samples - Float32 audio samples
   * @param {string} method - 'rms' or 'peak'
   * @returns {number} dB level
   */
  static calculateDb(samples, method = 'rms') {
    const floatView = new Float32Array(
      samples.buffer,
      samples.byteOffset,
      samples.length / 4
    );

    if (method === 'peak') {
      let peak = 0;
      for (let i = 0; i < floatView.length; i++) {
        const abs = Math.abs(floatView[i]);
        if (abs > peak) peak = abs;
      }
      return AudioCapture.peakToDb(peak);
    } else {
      // RMS
      let sum = 0;
      for (let i = 0; i < floatView.length; i++) {
        sum += floatView[i] * floatView[i];
      }
      const rms = Math.sqrt(sum / floatView.length);
      return AudioCapture.rmsToDb(rms);
    }
  }

  /**
   * Create a WAV file from PCM audio data
   * @static
   * @param {Buffer} buffer - PCM audio data (Float32 or Int16)
   * @param {Object} options - WAV file options
   * @param {number} options.sampleRate - Sample rate in Hz (e.g., 48000)
   * @param {number} options.channels - Number of channels (e.g., 2 for stereo)
   * @param {string} [options.format='float32'] - Audio format: 'float32' or 'int16'
   * @returns {Buffer} Complete WAV file that can be written to disk
   * @example
   * const fs = require('fs');
   *
   * capture.on('audio', (sample) => {
   *   const wav = AudioCapture.writeWav(sample.data, {
   *     sampleRate: sample.sampleRate,
   *     channels: sample.channels,
   *     format: sample.format
   *   });
   *   fs.writeFileSync('output.wav', wav);
   * });
   */
  static writeWav(buffer, options) {
    const { sampleRate, channels, format = 'float32' } = options;

    // Validate required options
    if (!sampleRate || !channels) {
      throw new Error('sampleRate and channels are required options');
    }

    if (format !== 'float32' && format !== 'int16') {
      throw new Error('format must be "float32" or "int16"');
    }

    // Calculate WAV format parameters
    const isFloat = format === 'float32';
    const audioFormat = isFloat ? 3 : 1; // 3 = IEEE Float, 1 = PCM
    const bitsPerSample = isFloat ? 32 : 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    // Data size
    const dataSize = buffer.length;
    const fileSize = 36 + dataSize; // 36 bytes of headers + data

    // Create buffer for complete WAV file
    const wavBuffer = Buffer.allocUnsafe(44 + dataSize);
    let offset = 0;

    // Helper to write strings
    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        wavBuffer[offset++] = str.charCodeAt(i);
      }
    };

    // Helper to write 32-bit little-endian integer
    const writeUInt32LE = (value) => {
      wavBuffer.writeUInt32LE(value, offset);
      offset += 4;
    };

    // Helper to write 16-bit little-endian integer
    const writeUInt16LE = (value) => {
      wavBuffer.writeUInt16LE(value, offset);
      offset += 2;
    };

    // RIFF header
    writeString('RIFF');
    writeUInt32LE(fileSize);
    writeString('WAVE');

    // fmt chunk
    writeString('fmt ');
    writeUInt32LE(16); // fmt chunk size
    writeUInt16LE(audioFormat); // audio format (1=PCM, 3=IEEE Float)
    writeUInt16LE(channels); // number of channels
    writeUInt32LE(sampleRate); // sample rate
    writeUInt32LE(byteRate); // byte rate
    writeUInt16LE(blockAlign); // block align
    writeUInt16LE(bitsPerSample); // bits per sample

    // data chunk
    writeString('data');
    writeUInt32LE(dataSize);

    // Copy audio data
    buffer.copy(wavBuffer, offset);

    return wavBuffer;
  }
}

// Export both the wrapper class and the raw native binding
module.exports = AudioCapture;
module.exports.AudioCapture = AudioCapture;
module.exports.AudioStream = AudioStream;
module.exports.STTConverter = STTConverter;
module.exports.ScreenCaptureKit = ScreenCaptureKit;
module.exports.AudioCaptureError = AudioCaptureError;
module.exports.ErrorCodes = ErrorCodes;
