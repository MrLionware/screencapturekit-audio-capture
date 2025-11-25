/**
 * ScreenCaptureKit Audio Capture SDK
 * High-level TypeScript SDK for capturing audio from macOS applications
 *
 * @packageDocumentation
 */

// Export main classes
export { AudioCapture } from './audio-capture';
export { AudioStream } from './audio-stream';
export { STTConverter } from './stt-converter';

// Export errors
export { AudioCaptureError, ErrorCode, ErrorCodes } from './errors';

// Export all types
export type {
  ApplicationInfo,
  WindowInfo,
  WindowFrame,
  DisplayInfo,
  AudioFormat,
  AudioSample,
  NativeAudioSample,
  CaptureTargetType,
  CaptureInfo,
  CaptureOptions,
  NativeCaptureConfig,
  GetApplicationsOptions,
  GetWindowsOptions,
  GetAudioAppsOptions,
  SelectAppOptions,
  ActivityTrackingOptions,
  ProcessActivityInfo,
  ActivityInfo,
  PermissionStatus,
  CaptureStatus,
  AudioStreamOptions,
  STTStreamOptions,
  WavOptions,
  AppIdentifier,
} from './types';

// Export native binding
export { ScreenCaptureKit } from './native';

// Default export for convenience
export { AudioCapture as default } from './audio-capture';
