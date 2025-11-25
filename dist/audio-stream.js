"use strict";
/**
 * AudioStream - Readable stream for audio capture
 * Provides a stream-based alternative to the EventEmitter API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStream = void 0;
const stream_1 = require("stream");
/**
 * Readable stream for audio capture
 * Provides a stream-based alternative to the EventEmitter API
 */
class AudioStream extends stream_1.Readable {
    /**
     * Create a new AudioStream
     * @param capture - The AudioCapture instance to use
     * @param appIdentifier - Application name, bundle ID, or process ID
     * @param options - Stream and capture options
     * @internal
     */
    constructor(capture, appIdentifier, options = {}) {
        // Extract objectMode option, default to false for backward compatibility
        const { objectMode = false, ...captureOptions } = options;
        super({
            objectMode,
            highWaterMark: objectMode ? 16 : 16384, // 16 objects or 16KB of data
        });
        this._started = false;
        this._stopped = false;
        this._audioHandler = null;
        this._errorHandler = null;
        this._stopHandler = null;
        this._capture = capture;
        this._appIdentifier = appIdentifier;
        this._captureOptions = captureOptions;
        this._objectMode = objectMode;
    }
    /**
     * Internal method called when stream starts flowing
     * @internal
     */
    _read() {
        // Start capture on first read if not already started
        if (!this._started) {
            this._started = true;
            // Set up event handlers
            this._audioHandler = (sample) => {
                // Ignore late events after stream ended/stopped
                if (this.readableEnded || this.destroyed || this._stopped) {
                    return;
                }
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
                if (this.readableEnded || this.destroyed || this._stopped) {
                    return;
                }
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
     * @internal
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
     * @returns Current capture info or null if not capturing
     */
    getCurrentCapture() {
        return this._capture.getCurrentCapture();
    }
    /**
     * Stop the stream and underlying capture
     */
    stop() {
        if (this._stopped) {
            return;
        }
        this._stopped = true;
        // Detach handlers early to avoid pushing after EOF
        if (this._audioHandler) {
            this._capture.removeListener('audio', this._audioHandler);
            this._capture.removeListener('error', this._errorHandler);
            this._capture.removeListener('stop', this._stopHandler);
            this._audioHandler = null;
            this._errorHandler = null;
            this._stopHandler = null;
        }
        if (this._capture.isCapturing()) {
            this._capture.stopCapture();
        }
        this.push(null); // Signal end of stream
    }
}
exports.AudioStream = AudioStream;
//# sourceMappingURL=audio-stream.js.map