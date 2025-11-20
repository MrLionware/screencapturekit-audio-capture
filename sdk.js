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
      const monoView = new Int16Array(mono.buffer, mono.byteOffset, frameCount);
      for (let i = 0; i < frameCount; i++) {
        monoView[i] = Math.floor((stereo[i * 2] + stereo[i * 2 + 1]) / 2);
      }
    } else {
      const stereo = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
      const monoView = new Float32Array(mono.buffer, mono.byteOffset, frameCount);
      
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
    this._currentTarget = null;
    this.captureOptions = {
      minVolume: 0,
      format: 'float32',
    };

    // Activity tracking for smart app filtering/sorting
    this._audioActivityCache = new Map(); // PID -> { lastSeen, avgRMS, sampleCount }
    this._activityTrackingEnabled = false;
    this._activityDecayMs = 30000; // Remove apps from cache after 30s of inactivity
  }

  /**
   * Get all available applications
   * @param {Object} options - Filter options
   * @param {boolean} [options.includeEmpty=false] - Include apps with empty applicationName (default: false)
   * @returns {Array<{processId: number, bundleIdentifier: string, applicationName: string}>}
   */
  getApplications(options = {}) {
    const { includeEmpty = false } = options;
    const apps = this.captureKit.getAvailableApps();

    // Filter out apps with empty names by default (helper processes, background services)
    if (!includeEmpty) {
      return apps.filter(app =>
        app.applicationName &&
        app.applicationName.trim().length > 0 &&
        app.bundleIdentifier &&
        app.bundleIdentifier.trim().length > 0
      );
    }

    return apps;
  }

  /**
   * Get capturable windows exposed by ScreenCaptureKit
   * @param {Object} options - Filter options
   * @param {boolean} [options.onScreenOnly=false] - Only include windows currently on screen
   * @param {boolean} [options.requireTitle=false] - Exclude untitled/hidden windows
   * @param {number} [options.processId] - Filter by owning process ID
   * @returns {WindowInfo[]} Array of window information objects
   */
  getWindows(options = {}) {
    this._assertNativeMethod('getAvailableWindows', 'Window enumeration');
    const windows = this.captureKit.getAvailableWindows() || [];
    const {
      onScreenOnly = false,
      requireTitle = false,
      processId
    } = options;

    return windows.filter((window) => {
      if (onScreenOnly && !window.onScreen) {
        return false;
      }
      if (requireTitle && (!window.title || window.title.trim().length === 0)) {
        return false;
      }
      if (typeof processId === 'number' && window.owningProcessId !== processId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get displays that can be captured
   * @returns {DisplayInfo[]} Array of display information objects
   */
  getDisplays() {
    this._assertNativeMethod('getAvailableDisplays', 'Display enumeration');
    return this.captureKit.getAvailableDisplays() || [];
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
   * @param {boolean} [options.includeSystemApps=false] - If true, returns all apps (same as getApplications())
   * @param {boolean} [options.includeEmpty=false] - Include apps with empty applicationName
   * @param {boolean} [options.sortByActivity=false] - Sort by recent audio activity (requires enableActivityTracking())
   * @returns {Array<{processId: number, bundleIdentifier: string, applicationName: string}>}
   */
  getAudioApps(options = {}) {
    const { includeSystemApps = false, includeEmpty = false, sortByActivity = false } = options;
    const apps = this.getApplications({ includeEmpty });

    let filtered;

    // If includeSystemApps is true, return all apps
    if (includeSystemApps) {
      filtered = apps;
    } else {
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

      filtered = apps.filter(app => {
        const name = app.applicationName;
        return !excludePatterns.some(pattern => pattern.test(name));
      });

      // If filtering resulted in empty array, provide helpful guidance
      if (filtered.length === 0 && apps.length > 0) {
        // Add a helpful property to indicate fallback is available
        filtered._hint = 'No audio apps found after filtering. Try getAudioApps({ includeSystemApps: true }) or getApplications() to see all apps.';
      }
    }

    // Sort by recent audio activity if requested and tracking is enabled
    if (sortByActivity && this._activityTrackingEnabled) {
      const now = Date.now();
      // Clean up stale entries
      for (const [pid, activity] of this._audioActivityCache.entries()) {
        if (now - activity.lastSeen > this._activityDecayMs) {
          this._audioActivityCache.delete(pid);
        }
      }

      // Sort by last seen time (most recent first)
      filtered.sort((a, b) => {
        const aActivity = this._audioActivityCache.get(a.processId);
        const bActivity = this._audioActivityCache.get(b.processId);
        const aTime = aActivity ? aActivity.lastSeen : 0;
        const bTime = bActivity ? bActivity.lastSeen : 0;
        return bTime - aTime;
      });
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

    // Get app list once
    const apps = audioOnly ? this.getAudioApps() : this.getApplications();

    // If no identifiers provided or empty array, return first audio app
    if (!identifiers || (Array.isArray(identifiers) && identifiers.length === 0)) {
      if (apps.length > 0) {
        return apps[0];
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

    // Try each identifier in order
    let hasValidIdentifier = false;
    for (const identifier of identifierList) {
      let app = null;

      if (typeof identifier === 'number') {
        hasValidIdentifier = true;
        // Try as PID
        app = apps.find(a => a.processId === identifier);
      } else if (typeof identifier === 'string') {
        // Skip empty or whitespace-only strings
        const search = identifier.toLowerCase().trim();
        if (search.length === 0) {
          continue;
        }

        hasValidIdentifier = true;

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

    // If no valid identifiers were provided (all empty/whitespace), return first app
    if (!hasValidIdentifier && apps.length > 0) {
      return apps[0];
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
   * Enable background tracking of audio activity
   * Tracks which apps are producing audio for smarter filtering and sorting
   * @param {Object} options - Tracking options
   * @param {number} [options.decayMs=30000] - Remove apps from cache after this many ms of inactivity (default: 30s)
   * @returns {void}
   * @example
   * capture.enableActivityTracking();
   *
   * // Later, get apps sorted by recent activity
   * const apps = capture.getAudioApps({ sortByActivity: true });
   * // Apps that recently produced audio appear first
   */
  enableActivityTracking(options = {}) {
    const { decayMs = 30000 } = options;
    this._activityTrackingEnabled = true;
    this._activityDecayMs = decayMs;
  }

  /**
   * Disable activity tracking and clear the cache
   * @returns {void}
   */
  disableActivityTracking() {
    this._activityTrackingEnabled = false;
    this._audioActivityCache.clear();
  }

  /**
   * Get activity tracking status and statistics
   * @returns {Object} Activity tracking info
   * @returns {boolean} return.enabled - Whether tracking is enabled
   * @returns {number} return.trackedApps - Number of apps currently in cache
   * @returns {Array} return.recentApps - Recently active apps with metadata
   */
  getActivityInfo() {
    const now = Date.now();
    const recentApps = [];

    for (const [pid, activity] of this._audioActivityCache.entries()) {
      const age = now - activity.lastSeen;
      if (age < this._activityDecayMs) {
        recentApps.push({
          processId: pid,
          lastSeen: activity.lastSeen,
          ageMs: age,
          avgRMS: activity.avgRMS,
          sampleCount: activity.sampleCount
        });
      }
    }

    // Sort by most recent first
    recentApps.sort((a, b) => a.ageMs - b.ageMs);

    return {
      enabled: this._activityTrackingEnabled,
      trackedApps: recentApps.length,
      recentApps
    };
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

    const snapshot = this._createTargetSnapshot();

    return {
      capturing: true,
      processId: snapshot ? snapshot.processId : null,
      app: snapshot ? snapshot.app : null,
      targetType: snapshot ? snapshot.targetType : 'application',
      window: snapshot ? snapshot.window : null,
      display: snapshot ? snapshot.display : null,
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

    const target = {
      type: 'application',
      processId,
      app: appInfo,
      window: null,
      display: null,
      failureMessage: 'Failed to start capture',
      failureDetails: {
        processId,
        app: appInfo,
        suggestion: 'The application may not have visible windows or may not support audio capture.'
      }
    };

    const nativeStarter = (nativeConfig, callback) => this.captureKit.startCapture(processId, nativeConfig, callback);
    return this._startNativeCapture(target, options, nativeStarter);
  }

  /**
   * Start capture for a specific window ID
   * @param {number} windowId - Window identifier from getWindows()
   * @param {Object} options - Capture options (same as startCapture)
   * @returns {boolean} true if capture started successfully
   */
  captureWindow(windowId, options = {}) {
    this._assertNativeMethod('startCaptureForWindow', 'Window capture');
    if (typeof windowId !== 'number') {
      throw new AudioCaptureError(
        'windowId must be a number.',
        ErrorCodes.INVALID_ARGUMENT,
        { receivedType: typeof windowId, expectedTypes: ['number'] }
      );
    }

    const windowInfo = this.getWindows().find((window) => window.windowId === windowId);
    if (!windowInfo) {
      throw new AudioCaptureError(
        `Window with ID ${windowId} not found. Call getWindows() to list available windows.`,
        ErrorCodes.INVALID_ARGUMENT,
        { windowId }
      );
    }

    const owningProcessId = typeof windowInfo.owningProcessId === 'number' ? windowInfo.owningProcessId : null;
    const owningApp = owningProcessId ? this.getApplicationByPid(owningProcessId) : null;

    const target = {
      type: 'window',
      processId: owningProcessId,
      app: owningApp,
      window: windowInfo,
      display: null,
      failureMessage: 'Failed to start window capture',
      failureDetails: {
        windowId,
        owningProcessId
      }
    };

    const nativeStarter = (nativeConfig, callback) => this.captureKit.startCaptureForWindow(windowId, nativeConfig, callback);
    return this._startNativeCapture(target, options, nativeStarter);
  }

  /**
   * Start capture for a display
   * @param {number} displayId - Display identifier from getDisplays()
   * @param {Object} options - Capture options (same as startCapture)
   * @returns {boolean} true if capture started successfully
   */
  captureDisplay(displayId, options = {}) {
    this._assertNativeMethod('startCaptureForDisplay', 'Display capture');
    if (typeof displayId !== 'number') {
      throw new AudioCaptureError(
        'displayId must be a number.',
        ErrorCodes.INVALID_ARGUMENT,
        { receivedType: typeof displayId, expectedTypes: ['number'] }
      );
    }

    const displayInfo = this.getDisplays().find((display) => display.displayId === displayId);
    if (!displayInfo) {
      throw new AudioCaptureError(
        `Display with ID ${displayId} not found. Call getDisplays() to list available displays.`,
        ErrorCodes.INVALID_ARGUMENT,
        { displayId }
      );
    }

    const target = {
      type: 'display',
      processId: null,
      app: null,
      window: null,
      display: displayInfo,
      failureMessage: 'Failed to start display capture',
      failureDetails: {
        displayId
      }
    };

    const nativeStarter = (nativeConfig, callback) => this.captureKit.startCaptureForDisplay(displayId, nativeConfig, callback);
    return this._startNativeCapture(target, options, nativeStarter);
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
    const snapshot = this._createTargetSnapshot();
    this.currentProcessId = null;
    this.currentAppInfo = null;
    this._currentTarget = null;

    /**
     * Stop event
     * @event AudioCapture#stop
     * @type {CaptureInfo}
     * @property {('application'|'window'|'display')} targetType - Target type that was being captured
     * @property {number|null} processId - Process ID (null for display capture)
     * @property {Object|null} app - Application info with applicationName, bundleIdentifier, and processId
     * @property {Object|null} window - Window metadata when applicable
     * @property {Object|null} display - Display metadata when applicable
     */
    this.emit('stop', snapshot || {
      processId: null,
      app: null,
      window: null,
      display: null,
      targetType: 'unknown'
    });
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
    if (!this.capturing) {
      return null;
    }

    return this._createTargetSnapshot();
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
    let validSamples = 0;
    for (let i = 0; i < floatView.length; i++) {
      const sample = floatView[i];
      // Filter out NaN and extreme values
      if (!isNaN(sample) && isFinite(sample)) {
        // Clamp to reasonable audio range [-10, 10]
        const clamped = Math.max(-10, Math.min(10, sample));
        sum += clamped * clamped;
        validSamples++;
      }
    }
    if (validSamples === 0) return 0;
    return Math.sqrt(sum / validSamples);
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
      const sample = floatView[i];
      // Filter out NaN and extreme values
      if (!isNaN(sample) && isFinite(sample)) {
        // Clamp to reasonable audio range
        const clamped = Math.max(-10, Math.min(10, sample));
        const abs = Math.abs(clamped);
        if (abs > peak) peak = abs;
      }
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

  _buildNativeConfig(options = {}) {
    return {
      sampleRate: options.sampleRate || 48000,
      channels: options.channels || 2,
      bufferSize: options.bufferSize,
      excludeCursor: options.excludeCursor !== undefined ? options.excludeCursor : true,
    };
  }

  _startNativeCapture(target, options, startInvoker) {
    if (this.capturing) {
      const error = new AudioCaptureError(
        'Already capturing. Stop current capture first.',
        ErrorCodes.ALREADY_CAPTURING,
        {
          currentProcessId: this.currentProcessId,
          currentApp: this.currentAppInfo,
          currentTarget: this._createTargetSnapshot()
        }
      );
      this.emit('error', error);
      throw error;
    }

    this.captureOptions = {
      minVolume: options.minVolume || 0,
      format: options.format || 'float32',
    };

    const nativeConfig = this._buildNativeConfig(options);
    const processIdForActivity = typeof target.processId === 'number' ? target.processId : null;

    const success = startInvoker(nativeConfig, (sample) => this._handleNativeSample(sample, processIdForActivity));

    if (success) {
      this.capturing = true;
      this.currentProcessId = processIdForActivity;
      this.currentAppInfo = target.app || (processIdForActivity ? this.getApplicationByPid(processIdForActivity) : null);
      this._currentTarget = {
        processId: this.currentProcessId,
        app: this.currentAppInfo,
        window: this._cloneWindowInfo(target.window),
        display: this._cloneDisplayInfo(target.display),
        targetType: target.type || 'application'
      };

      /**
       * Start event
       * @event AudioCapture#start
       * @type {CaptureInfo}
       */
      this.emit('start', this._createTargetSnapshot());
    } else {
      const error = new AudioCaptureError(
        target.failureMessage || 'Failed to start capture',
        ErrorCodes.CAPTURE_FAILED,
        target.failureDetails || {}
      );
      this.emit('error', error);
      throw error;
    }

    return success;
  }

  _handleNativeSample(sample, processIdForActivity = null) {
    const rms = this._calculateRMS(sample.data);
    const peak = this._calculatePeak(sample.data);

    if (rms < this.captureOptions.minVolume) {
      return;
    }

    let audioData = sample.data;
    let actualFormat = 'float32';

    if (this.captureOptions.format === 'int16') {
      audioData = this._convertToInt16(sample.data);
      actualFormat = 'int16';
    }

    const bytesPerSample = 4;
    const totalSamples = sample.data.length / bytesPerSample;
    const framesCount = totalSamples / sample.channelCount;
    const durationMs = (framesCount / sample.sampleRate) * 1000;

    const enhancedSample = {
      data: audioData,
      sampleRate: sample.sampleRate,
      channels: sample.channelCount,
      timestamp: sample.timestamp,
      format: actualFormat,
      sampleCount: totalSamples,
      framesCount,
      durationMs,
      rms,
      peak,
    };

    this.emit('audio', enhancedSample);

    if (this._activityTrackingEnabled && typeof processIdForActivity === 'number') {
      const now = Date.now();
      const existing = this._audioActivityCache.get(processIdForActivity);

      if (existing) {
        const alpha = 0.1;
        existing.avgRMS = existing.avgRMS * (1 - alpha) + rms * alpha;
        existing.lastSeen = now;
        existing.sampleCount++;
      } else {
        this._audioActivityCache.set(processIdForActivity, {
          lastSeen: now,
          avgRMS: rms,
          sampleCount: 1
        });
      }
    }
  }

  _createTargetSnapshot(target = this._currentTarget) {
    if (!target) {
      return null;
    }

    return {
      processId: typeof target.processId === 'number' ? target.processId : null,
      app: this._cloneAppInfo(target.app),
      window: this._cloneWindowInfo(target.window),
      display: this._cloneDisplayInfo(target.display),
      targetType: target.targetType || 'application'
    };
  }

  _cloneAppInfo(app) {
    if (!app) return null;
    return { ...app };
  }

  _cloneWindowInfo(window) {
    if (!window) return null;
    return {
      ...window,
      frame: window.frame ? { ...window.frame } : null
    };
  }

  _cloneDisplayInfo(display) {
    if (!display) return null;
    return {
      ...display,
      frame: display.frame ? { ...display.frame } : null
    };
  }

  _assertNativeMethod(methodName, featureDescription) {
    if (!this.captureKit || typeof this.captureKit[methodName] !== 'function') {
      throw new AudioCaptureError(
        `${featureDescription} requires a rebuilt native addon. Reinstall or run \"npm install\" to compile the latest bindings.`,
        ErrorCodes.CAPTURE_FAILED,
        { missingMethod: methodName }
      );
    }
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
