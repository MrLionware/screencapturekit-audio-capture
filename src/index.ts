/**
 * ScreenCaptureKit Audio Capture SDK
 * High-level TypeScript SDK for capturing audio from macOS applications
 *
 * @packageDocumentation
 */

// Core capture functionality
export { AudioCapture, AudioStream } from './capture';

// Multi-process service architecture
export { AudioCaptureServer, AudioCaptureClient } from './service';
export type { ServerOptions, CaptureSession, ClientOptions, RemoteAudioSample } from './service';

// Utilities
export { STTConverter, ScreenCaptureKit } from './utils';

// Errors
export { AudioCaptureError, ErrorCode, ErrorCodes } from './errors';

// Types
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

// Default export for convenience
export { AudioCapture as default } from './capture';
