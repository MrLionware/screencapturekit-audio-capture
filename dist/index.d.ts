/**
 * ScreenCaptureKit Audio Capture SDK
 * High-level TypeScript SDK for capturing audio from macOS applications
 *
 * @packageDocumentation
 */
export { AudioCapture, AudioStream } from './capture';
export { AudioCaptureServer, AudioCaptureClient } from './service';
export type { ServerOptions, CaptureSession, ClientOptions, RemoteAudioSample } from './service';
export { STTConverter, ScreenCaptureKit } from './utils';
export { AudioCaptureError, ErrorCode, ErrorCodes } from './errors';
export type { ApplicationInfo, WindowInfo, WindowFrame, DisplayInfo, AudioFormat, AudioSample, NativeAudioSample, CaptureTargetType, CaptureInfo, CaptureOptions, NativeCaptureConfig, GetApplicationsOptions, GetWindowsOptions, GetAudioAppsOptions, SelectAppOptions, ActivityTrackingOptions, ProcessActivityInfo, ActivityInfo, PermissionStatus, CaptureStatus, AudioStreamOptions, STTStreamOptions, WavOptions, AppIdentifier, } from './types';
export { AudioCapture as default } from './capture';
//# sourceMappingURL=index.d.ts.map