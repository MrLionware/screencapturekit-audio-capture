// Type definitions for screencapturekit-audio-addon
// Project: ScreenCaptureKit Audio Capture for Node.js
// Definitions by: Claude Code

/// <reference types="node" />

declare module 'screencapturekit-audio-addon' {
  import { EventEmitter } from 'events';

  /**
   * Information about a running application
   */
  export interface AppInfo {
    /** Process ID of the application */
    processId: number;
    /** Bundle identifier (e.g., "com.spotify.client") */
    bundleIdentifier: string;
    /** Human-readable application name */
    applicationName: string;
  }

  /**
   * Audio sample data from the native addon
   */
  export interface AudioSample {
    /** Buffer containing Float32 PCM audio samples */
    data: Buffer;
    /** Sample rate in Hz (typically 48000) */
    sampleRate: number;
    /** Number of audio channels (typically 2 for stereo) */
    channelCount: number;
    /** Timestamp in seconds */
    timestamp: number;
  }

  /**
   * Enhanced audio sample with computed properties
   */
  export interface EnhancedAudioSample {
    /** Buffer containing audio samples (Float32 or Int16 depending on format) */
    data: Buffer;
    /** Sample rate in Hz */
    sampleRate: number;
    /** Number of audio channels */
    channels: number;
    /** Timestamp in seconds */
    timestamp: number;
    /** Audio format ('float32' or 'int16') */
    format: 'float32' | 'int16';
    /** Total number of samples in buffer */
    sampleCount: number;
    /** Duration of the audio chunk in milliseconds */
    durationMs: number;
    /** RMS (Root Mean Square) volume level (0.0 to 1.0) */
    rms: number;
    /** Peak volume level (0.0 to 1.0) */
    peak: number;
  }

  /**
   * Options for starting audio capture
   */
  export interface CaptureOptions {
    /** Minimum RMS volume threshold (0.0 to 1.0). Only emit audio events when volume exceeds this level */
    minVolume?: number;
    /** Audio format: 'float32' (default) or 'int16' */
    format?: 'float32' | 'int16';
  }

  /**
   * Callback function for receiving audio samples
   */
  export type AudioCallback = (sample: AudioSample) => void;

  /**
   * Native ScreenCaptureKit binding (low-level API)
   */
  export class ScreenCaptureKit {
    /**
     * Create a new ScreenCaptureKit instance
     */
    constructor();

    /**
     * Get list of all capturable applications
     * @returns Array of application information
     */
    getAvailableApps(): AppInfo[];

    /**
     * Start capturing audio from a specific application
     * @param processId - Process ID of the target application
     * @param callback - Callback function invoked for each audio sample
     * @returns true if capture started successfully, false otherwise
     */
    startCapture(processId: number, callback: AudioCallback): boolean;

    /**
     * Stop the current audio capture session
     */
    stopCapture(): void;

    /**
     * Check if currently capturing audio
     * @returns true if capturing, false otherwise
     */
    isCapturing(): boolean;
  }

  /**
   * Current capture information
   */
  export interface CaptureInfo {
    /** Process ID being captured */
    processId: number;
    /** Application info (may be null if app terminated) */
    app: AppInfo | null;
  }

  /**
   * High-level SDK wrapper with event-based API
   */
  export class AudioCapture extends EventEmitter {
    /**
     * Create a new AudioCapture instance
     */
    constructor();

    /**
     * Get all available applications that can be captured
     * @returns Array of application information
     */
    getApplications(): AppInfo[];

    /**
     * Find an application by name or bundle identifier
     * @param identifier - Application name or bundle ID (case-insensitive, partial match)
     * @returns Application info if found, null otherwise
     */
    findApplication(identifier: string): AppInfo | null;

    /**
     * Find an application by name (case-insensitive search)
     * @param name - Application name to search for
     * @returns Application info if found, null otherwise
     */
    findByName(name: string): AppInfo | null;

    /**
     * Get only applications likely to produce audio
     * Filters out system apps and utilities that typically don't have audio
     * @returns Array of application information
     */
    getAudioApps(): AppInfo[];

    /**
     * Get application information by process ID
     * @param processId - Process ID
     * @returns Application info if found, null otherwise
     */
    getApplicationByPid(processId: number): AppInfo | null;

    /**
     * Start capturing audio from an application
     * @param appIdentifier - Application name, bundle ID, or process ID
     * @param options - Capture options
     * @returns true if capture started successfully
     *
     * @fires start
     * @fires audio
     * @fires error
     */
    startCapture(appIdentifier: string | number, options?: CaptureOptions): boolean;

    /**
     * Stop the current capture session
     * @fires stop
     */
    stopCapture(): void;

    /**
     * Check if currently capturing
     * @returns true if capturing, false otherwise
     */
    isCapturing(): boolean;

    /**
     * Get information about the current capture
     * @returns Current capture info or null if not capturing
     */
    getCurrentCapture(): CaptureInfo | null;

    /**
     * Convert Buffer to Float32Array for easier audio processing
     * @param buffer - Buffer containing Float32 PCM audio samples
     * @returns Float32Array view of the buffer
     */
    static bufferToFloat32Array(buffer: Buffer): Float32Array;

    /**
     * Convert RMS value to decibels
     * @param rms - RMS value (0.0 to 1.0)
     * @returns Decibel level (-Infinity to 0)
     */
    static rmsToDb(rms: number): number;

    /**
     * Convert peak value to decibels
     * @param peak - Peak value (0.0 to 1.0)
     * @returns Decibel level (-Infinity to 0)
     */
    static peakToDb(peak: number): number;

    /**
     * Calculate decibel level from audio samples
     * @param samples - Float32 audio sample buffer
     * @param method - Calculation method: 'rms' or 'peak'
     * @returns Decibel level
     */
    static calculateDb(samples: Buffer, method?: 'rms' | 'peak'): number;

    // Event emitter methods
    on(event: 'start', listener: (info: CaptureInfo) => void): this;
    on(event: 'audio', listener: (sample: EnhancedAudioSample) => void): this;
    on(event: 'stop', listener: (info: { processId: number }) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;

    once(event: 'start', listener: (info: CaptureInfo) => void): this;
    once(event: 'audio', listener: (sample: EnhancedAudioSample) => void): this;
    once(event: 'stop', listener: (info: { processId: number }) => void): this;
    once(event: 'error', listener: (error: Error) => void): this;

    emit(event: 'start', info: CaptureInfo): boolean;
    emit(event: 'audio', sample: EnhancedAudioSample): boolean;
    emit(event: 'stop', info: { processId: number }): boolean;
    emit(event: 'error', error: Error): boolean;
  }

  // Default export is AudioCapture class
  export default AudioCapture;
}
