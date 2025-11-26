/**
 * AudioStream - Readable stream for audio capture
 * Provides a stream-based alternative to the EventEmitter API
 */
import { Readable } from 'stream';
import type { AudioCapture } from './audio-capture';
import type { AppIdentifier, CaptureInfo, AudioStreamOptions } from '../types';
/**
 * Readable stream for audio capture
 * Provides a stream-based alternative to the EventEmitter API
 */
export declare class AudioStream extends Readable {
    private readonly _capture;
    private readonly _appIdentifier;
    private readonly _captureOptions;
    private readonly _objectMode;
    private _started;
    private _stopped;
    private _audioHandler;
    private _errorHandler;
    private _stopHandler;
    /**
     * Create a new AudioStream
     * @param capture - The AudioCapture instance to use
     * @param appIdentifier - Application name, bundle ID, or process ID
     * @param options - Stream and capture options
     * @internal
     */
    constructor(capture: AudioCapture, appIdentifier: AppIdentifier, options?: AudioStreamOptions);
    /**
     * Internal method called when stream starts flowing
     * @internal
     */
    _read(): void;
    /**
     * Internal method called when stream is being destroyed
     * @internal
     */
    _destroy(error: Error | null, callback: (error: Error | null) => void): void;
    /**
     * Get information about the current capture
     * @returns Current capture info or null if not capturing
     */
    getCurrentCapture(): CaptureInfo | null;
    /**
     * Stop the stream and underlying capture
     */
    stop(): void;
}
//# sourceMappingURL=audio-stream.d.ts.map