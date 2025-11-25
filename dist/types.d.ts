/**
 * Type definitions for ScreenCaptureKit Audio Capture SDK
 * Comprehensive types for all public and internal APIs
 */
/**
 * Application information from ScreenCaptureKit
 */
export interface ApplicationInfo {
    readonly processId: number;
    readonly bundleIdentifier: string;
    readonly applicationName: string;
}
/**
 * Window frame geometry
 */
export interface WindowFrame {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
/**
 * Window information from ScreenCaptureKit
 */
export interface WindowInfo {
    readonly windowId: number;
    readonly title: string;
    readonly owningProcessId: number;
    readonly onScreen: boolean;
    readonly frame: WindowFrame | null;
    readonly layer?: number;
    readonly active?: boolean;
    readonly owningApplicationName?: string;
    readonly owningBundleIdentifier?: string;
}
/**
 * Display information from ScreenCaptureKit
 */
export interface DisplayInfo {
    readonly displayId: number;
    readonly width: number;
    readonly height: number;
    readonly frame: WindowFrame | null;
    readonly isMainDisplay?: boolean;
}
/**
 * Audio sample format
 */
export type AudioFormat = 'float32' | 'int16';
/**
 * Audio sample data emitted by capture events
 */
export interface AudioSample {
    readonly data: Buffer;
    readonly sampleRate: number;
    readonly channels: number;
    readonly timestamp: number;
    readonly format: AudioFormat;
    readonly sampleCount: number;
    readonly framesCount: number;
    readonly durationMs: number;
    readonly rms: number;
    readonly peak: number;
}
/**
 * Native audio sample from the capture kit (before enhancement)
 */
export interface NativeAudioSample {
    readonly data: Buffer;
    readonly sampleRate: number;
    readonly channelCount: number;
    readonly timestamp: number;
}
/**
 * Capture target type
 */
export type CaptureTargetType = 'application' | 'window' | 'display';
/**
 * Capture target information
 */
export interface CaptureInfo {
    readonly targetType: CaptureTargetType;
    readonly processId: number | null;
    readonly app: ApplicationInfo | null;
    readonly window: WindowInfo | null;
    readonly display: DisplayInfo | null;
}
/**
 * Options for starting audio capture
 */
export interface CaptureOptions {
    /**
     * Minimum RMS volume threshold (0.0 to 1.0)
     * Only emit audio events when volume exceeds this level
     * @default 0
     */
    readonly minVolume?: number;
    /**
     * Audio format: 'float32' or 'int16'
     * @default 'float32'
     */
    readonly format?: AudioFormat;
    /**
     * Sample rate in Hz (e.g., 44100, 48000)
     * @default 48000
     */
    readonly sampleRate?: number;
    /**
     * Number of audio channels: 1 (mono) or 2 (stereo)
     * @default 2
     */
    readonly channels?: 1 | 2;
    /**
     * Buffer size for audio processing
     * Smaller values = lower latency but higher CPU usage
     */
    readonly bufferSize?: number;
    /**
     * Exclude cursor from capture (for future video features)
     * @default true
     */
    readonly excludeCursor?: boolean;
}
/**
 * Native capture configuration
 */
export interface NativeCaptureConfig {
    readonly sampleRate: number;
    readonly channels: number;
    readonly bufferSize?: number;
    readonly excludeCursor: boolean;
}
/**
 * Options for getApplications
 */
export interface GetApplicationsOptions {
    /**
     * Include apps with empty applicationName
     * @default false
     */
    readonly includeEmpty?: boolean;
}
/**
 * Options for getWindows
 */
export interface GetWindowsOptions {
    /**
     * Only include windows currently on screen
     * @default false
     */
    readonly onScreenOnly?: boolean;
    /**
     * Exclude untitled/hidden windows
     * @default false
     */
    readonly requireTitle?: boolean;
    /**
     * Filter by owning process ID
     */
    readonly processId?: number;
}
/**
 * Options for getAudioApps
 */
export interface GetAudioAppsOptions {
    /**
     * If true, returns all apps (same as getApplications())
     * @default false
     */
    readonly includeSystemApps?: boolean;
    /**
     * Include apps with empty applicationName
     * @default false
     */
    readonly includeEmpty?: boolean;
    /**
     * Sort by recent audio activity (requires enableActivityTracking())
     * @default false
     */
    readonly sortByActivity?: boolean;
    /**
     * Use a prefetched app list instead of calling getApplications()
     */
    readonly appList?: ApplicationInfo[];
}
/**
 * Options for selectApp
 */
export interface SelectAppOptions {
    /**
     * Only search audio apps (excludes system apps)
     * @default true
     */
    readonly audioOnly?: boolean;
    /**
     * Prefetched app list to reuse
     */
    readonly appList?: ApplicationInfo[];
    /**
     * Return the first available app if no identifier matches
     * @default false
     */
    readonly fallbackToFirst?: boolean;
    /**
     * Sort using recent audio activity
     * @default false
     */
    readonly sortByActivity?: boolean;
    /**
     * Throw error if no app found
     * @default false
     */
    readonly throwOnNotFound?: boolean;
}
/**
 * Options for enableActivityTracking
 */
export interface ActivityTrackingOptions {
    /**
     * Remove apps from cache after this many ms of inactivity
     * @default 30000
     */
    readonly decayMs?: number;
}
/**
 * Activity information for a process
 */
export interface ProcessActivityInfo {
    readonly processId: number;
    readonly lastSeen: number;
    readonly ageMs: number;
    readonly avgRMS: number;
    readonly sampleCount: number;
}
/**
 * Activity tracking status
 */
export interface ActivityInfo {
    readonly enabled: boolean;
    readonly trackedApps: number;
    readonly recentApps: readonly ProcessActivityInfo[];
}
/**
 * Permission verification result
 */
export interface PermissionStatus {
    readonly granted: boolean;
    readonly message: string;
    readonly remediation?: string;
    readonly availableApps?: number;
    readonly apps?: ApplicationInfo[];
}
/**
 * Capture status information
 */
export interface CaptureStatus {
    readonly capturing: boolean;
    readonly processId: number | null;
    readonly app: ApplicationInfo | null;
    readonly targetType: CaptureTargetType;
    readonly window: WindowInfo | null;
    readonly display: DisplayInfo | null;
    readonly config: {
        readonly minVolume: number;
        readonly format: AudioFormat;
    };
}
/**
 * Options for createAudioStream
 */
export interface AudioStreamOptions extends CaptureOptions {
    /**
     * Enable object mode to receive full sample objects instead of just raw audio data
     * @default false
     */
    readonly objectMode?: boolean;
}
/**
 * Options for createSTTStream
 */
export interface STTStreamOptions extends CaptureOptions {
    /**
     * Output format ('int16' or 'float32')
     * @default 'int16'
     */
    readonly format?: AudioFormat;
    /**
     * Output channels (1 = mono, 2 = stereo)
     * @default 1
     */
    readonly channels?: 1 | 2;
    /**
     * If true, stream emits sample objects with metadata
     * @default false
     */
    readonly objectMode?: boolean;
    /**
     * If true, automatically selects first available audio app when identifier not found
     * @default true
     */
    readonly autoSelect?: boolean;
}
/**
 * Options for WAV file creation
 */
export interface WavOptions {
    readonly sampleRate: number;
    readonly channels: number;
    readonly format?: AudioFormat;
}
/**
 * Internal capture target structure
 */
export interface CaptureTarget {
    readonly type: CaptureTargetType;
    readonly processId: number | null;
    readonly app: ApplicationInfo | null;
    readonly window: WindowInfo | null;
    readonly display: DisplayInfo | null;
    readonly failureMessage: string;
    readonly failureDetails: Record<string, unknown>;
}
/**
 * Native capture starter function type
 */
export type NativeCaptureStarter = (config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void) => boolean;
/**
 * App identifier types
 */
export type AppIdentifier = string | number | ApplicationInfo | (string | number)[];
//# sourceMappingURL=types.d.ts.map