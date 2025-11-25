/**
 * AudioCapture - High-level SDK wrapper for ScreenCaptureKit Audio Capture
 * Provides an event-based, developer-friendly API
 */
import { EventEmitter } from 'events';
import { AudioStream } from './audio-stream';
import { STTConverter } from './stt-converter';
import type { ApplicationInfo, WindowInfo, DisplayInfo, CaptureInfo, CaptureOptions, GetApplicationsOptions, GetWindowsOptions, GetAudioAppsOptions, SelectAppOptions, ActivityTrackingOptions, ActivityInfo, PermissionStatus, CaptureStatus, AudioStreamOptions, STTStreamOptions, WavOptions, AppIdentifier } from './types';
/**
 * Main AudioCapture class
 * High-level API for capturing audio from macOS applications
 */
export declare class AudioCapture extends EventEmitter {
    private readonly captureKit;
    private capturing;
    private currentProcessId;
    private currentAppInfo;
    private _currentTarget;
    private captureOptions;
    private readonly _audioActivityCache;
    private _activityTrackingEnabled;
    private _activityDecayMs;
    /**
     * Create a new AudioCapture instance
     */
    constructor();
    /**
     * Get all available applications
     * @param options - Filter options
     * @returns Array of application information
     */
    getApplications(options?: GetApplicationsOptions): ApplicationInfo[];
    /**
     * Get capturable windows exposed by ScreenCaptureKit
     * @param options - Filter options
     * @returns Array of window information objects
     */
    getWindows(options?: GetWindowsOptions): WindowInfo[];
    /**
     * Get displays that can be captured
     * @returns Array of display information objects
     */
    getDisplays(): DisplayInfo[];
    /**
     * Find application by name or bundle identifier
     * @param identifier - Application name or bundle ID (case-insensitive, partial match)
     * @returns Application info or null if not found
     */
    findApplication(identifier: string): ApplicationInfo | null;
    /**
     * Find application by name (case-insensitive search)
     * @param name - Application name to search for
     * @returns Application info or null if not found
     */
    findByName(name: string): ApplicationInfo | null;
    /**
     * Get only applications likely to produce audio
     * Filters out system apps and utilities that typically don't have audio
     * @param options - Filter options
     * @returns Array of audio-capable applications
     */
    getAudioApps(options?: GetAudioAppsOptions): ApplicationInfo[];
    /**
     * Internal helper to filter/sort an app list down to likely audio sources
     * @internal
     */
    private _filterAudioAppList;
    /**
     * Get application by process ID
     * @param processId - Process ID
     * @returns Application info or null if not found
     */
    getApplicationByPid(processId: number): ApplicationInfo | null;
    /**
     * Smart app selection with fallback strategies
     * Tries multiple methods to find an app: exact name, PID, bundle ID, partial match, audio apps
     * @param identifiers - App identifier(s) to try in order
     * @param options - Selection options
     * @returns Application info or null if not found (unless throwOnNotFound is true)
     * @throws {AudioCaptureError} If throwOnNotFound is true and no app found
     */
    selectApp(identifiers?: AppIdentifier | null, options?: SelectAppOptions): ApplicationInfo | null;
    /**
     * Enable background tracking of audio activity
     * Tracks which apps are producing audio for smarter filtering and sorting
     * @param options - Tracking options
     */
    enableActivityTracking(options?: ActivityTrackingOptions): void;
    /**
     * Disable activity tracking and clear the cache
     */
    disableActivityTracking(): void;
    /**
     * Get activity tracking status and statistics
     * @returns Activity tracking info
     */
    getActivityInfo(): ActivityInfo;
    /**
     * Verify screen recording permissions
     * Proactively checks if the app has necessary permissions before attempting capture
     * @returns Permission status object
     */
    static verifyPermissions(): PermissionStatus;
    /**
     * Get detailed status of current capture session
     * @returns Status object or null if not capturing
     */
    getStatus(): CaptureStatus | null;
    /**
     * Start capturing audio from an application
     * @param appIdentifier - Application name, bundle ID, process ID, or array of identifiers
     * @param options - Capture options
     * @returns true if capture started successfully
     * @throws {AudioCaptureError} Throws structured error with code and details if capture fails
     * @fires AudioCapture#start
     * @fires AudioCapture#audio
     * @fires AudioCapture#error
     */
    startCapture(appIdentifier: AppIdentifier, options?: CaptureOptions): boolean;
    /**
     * Start capture for a specific window ID
     * @param windowId - Window identifier from getWindows()
     * @param options - Capture options (same as startCapture)
     * @returns true if capture started successfully
     */
    captureWindow(windowId: number, options?: CaptureOptions): boolean;
    /**
     * Start capture for a display
     * @param displayId - Display identifier from getDisplays()
     * @param options - Capture options (same as startCapture)
     * @returns true if capture started successfully
     */
    captureDisplay(displayId: number, options?: CaptureOptions): boolean;
    /**
     * Stop the current capture session
     * @fires AudioCapture#stop
     */
    stopCapture(): void;
    /**
     * Check if currently capturing
     * @returns true if currently capturing
     */
    isCapturing(): boolean;
    /**
     * Get current capture info
     * @returns Current capture info or null if not capturing
     */
    getCurrentCapture(): CaptureInfo | null;
    /**
     * Create a readable stream for audio capture
     * Provides a stream-based alternative to the event-based API
     * @param appIdentifier - Application name, bundle ID, or process ID
     * @param options - Stream and capture options
     * @returns Readable stream that emits audio data
     */
    createAudioStream(appIdentifier: AppIdentifier, options?: AudioStreamOptions): AudioStream;
    /**
     * Create a pre-configured stream for Speech-to-Text (STT) engines
     * Automatically converts to Int16 mono format - the most common STT input format
     * @param appIdentifier - App name, PID, bundle ID, or array to try in order
     * @param options - STT stream options
     * @returns Transform stream ready to pipe to STT engine
     */
    createSTTStream(appIdentifier: AppIdentifier, options?: STTStreamOptions): STTConverter;
    /**
     * Convert Buffer to Float32Array for easier audio processing
     * @param buffer - Buffer containing Float32 PCM audio samples
     * @returns Float32Array view of the buffer
     */
    static bufferToFloat32Array(buffer: Buffer): Float32Array;
    /**
     * Convert RMS to decibels
     * @param rms - RMS value (0.0 to 1.0)
     * @returns dB level (-Infinity to 0)
     */
    static rmsToDb(rms: number): number;
    /**
     * Convert peak to decibels
     * @param peak - Peak value (0.0 to 1.0)
     * @returns dB level (-Infinity to 0)
     */
    static peakToDb(peak: number): number;
    /**
     * Calculate decibels from audio samples
     * @param samples - Float32 audio samples
     * @param method - 'rms' or 'peak'
     * @returns dB level
     */
    static calculateDb(samples: Buffer, method?: 'rms' | 'peak'): number;
    /**
     * Create a WAV file from PCM audio data
     * @param buffer - PCM audio data (Float32 or Int16)
     * @param options - WAV file options
     * @returns Complete WAV file that can be written to disk
     */
    static writeWav(buffer: Buffer, options: WavOptions): Buffer;
    /**
     * Build native capture configuration
     * @internal
     */
    private _buildNativeConfig;
    /**
     * Start native capture with unified logic
     * @internal
     */
    private _startNativeCapture;
    /**
     * Handle native audio sample
     * @internal
     */
    private _handleNativeSample;
    /**
     * Calculate RMS (Root Mean Square) volume level
     * @internal
     */
    private _calculateRMS;
    /**
     * Calculate peak volume level
     * @internal
     */
    private _calculatePeak;
    /**
     * Convert Float32 audio samples to Int16 format
     * @internal
     */
    private _convertToInt16;
    /**
     * Create a snapshot of the current target
     * @internal
     */
    private _createTargetSnapshot;
    /**
     * Clone app info
     * @internal
     */
    private _cloneAppInfo;
    /**
     * Clone window info
     * @internal
     */
    private _cloneWindowInfo;
    /**
     * Clone display info
     * @internal
     */
    private _cloneDisplayInfo;
    /**
     * Assert that a native method exists
     * @internal
     */
    private _assertNativeMethod;
}
//# sourceMappingURL=audio-capture.d.ts.map