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

// Core: Errors, Types, and Cleanup (re-exported from core/)
export { AudioCaptureError, ErrorCode, ErrorCodes } from './core/errors';
export { cleanupAll, getActiveInstanceCount, installGracefulShutdown } from './core/cleanup';
export type { CleanupResult } from './core/cleanup';

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
  MultiAppCaptureOptions,
  MultiWindowCaptureOptions,
  MultiDisplayCaptureOptions,
} from './core/types';

// Default export for convenience
export { AudioCapture as default } from './capture';
