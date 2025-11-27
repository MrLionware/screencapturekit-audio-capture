/**
 * Core module - Shared types, errors, and lifecycle management
 * 
 * This module contains cross-cutting concerns used throughout the SDK:
 * - Type definitions for all public APIs
 * - Error classes and error codes
 * - Resource lifecycle and cleanup utilities
 */

// Error handling
export { AudioCaptureError, ErrorCode, ErrorCodes } from './errors';

// Type definitions
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
  CaptureTarget,
  NativeCaptureStarter,
  MultiAppIdentifier,
  MultiAppCaptureOptions,
  MultiWindowIdentifier,
  MultiWindowCaptureOptions,
  MultiDisplayIdentifier,
  MultiDisplayCaptureOptions,
} from './types';

// Cleanup utilities
export { cleanupAll, getActiveInstanceCount, installGracefulShutdown } from './cleanup';
export type { CleanupResult } from './cleanup';
