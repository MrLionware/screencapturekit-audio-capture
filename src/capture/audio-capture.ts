/**
 * AudioCapture - High-level SDK wrapper for ScreenCaptureKit Audio Capture
 * Provides an event-based, developer-friendly API
 */

import { EventEmitter } from 'events';
import { AudioStream } from './audio-stream';
import { STTConverter } from '../utils/stt-converter';
import { AudioCaptureError, ErrorCode } from '../core/errors';
import type {
  ApplicationInfo,
  WindowInfo,
  DisplayInfo,
  AudioSample,
  NativeAudioSample,
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
  CaptureTarget,
  NativeCaptureStarter,
  AppIdentifier,
  AudioFormat,
  MultiAppCaptureOptions,
  MultiAppIdentifier,
  MultiWindowCaptureOptions,
  MultiWindowIdentifier,
  MultiDisplayCaptureOptions,
  MultiDisplayIdentifier,
  CaptureTargetType,
} from '../core/types';

/**
 * Native ScreenCaptureKit binding interface
 */
interface ScreenCaptureKit {
  getAvailableApps(): ApplicationInfo[];
  getAvailableWindows?(): WindowInfo[];
  getAvailableDisplays?(): DisplayInfo[];
  startCapture(
    processId: number,
    config: NativeCaptureConfig,
    callback: (sample: NativeAudioSample) => void
  ): boolean;
  startCaptureMultiApp?(
    processIds: number[],
    config: NativeCaptureConfig,
    callback: (sample: NativeAudioSample) => void
  ): boolean;
  startCaptureForWindow?(
    windowId: number,
    config: NativeCaptureConfig,
    callback: (sample: NativeAudioSample) => void
  ): boolean;
  startCaptureMultiWindow?(
    windowIds: number[],
    config: NativeCaptureConfig,
    callback: (sample: NativeAudioSample) => void
  ): boolean;
  startCaptureForDisplay?(
    displayId: number,
    config: NativeCaptureConfig,
    callback: (sample: NativeAudioSample) => void
  ): boolean;
  startCaptureMultiDisplay?(
    displayIds: number[],
    config: NativeCaptureConfig,
    callback: (sample: NativeAudioSample) => void
  ): boolean;
  stopCapture(): void;
}

/**
 * Internal activity tracking data
 */
interface ActivityCache {
  lastSeen: number;
  avgRMS: number;
  sampleCount: number;
}

/**
 * Internal capture options storage
 */
interface InternalCaptureOptions {
  minVolume: number;
  format: AudioFormat;
}

/**
 * Internal target tracking
 */
interface InternalTarget {
  processId: number | null;
  app: ApplicationInfo | null;
  apps?: ApplicationInfo[];
  window: WindowInfo | null;
  display: DisplayInfo | null;
  targetType: CaptureTargetType;
}

// ==================== Global Instance Tracking ====================

/** Set of all active AudioCapture instances for cleanup */
const activeInstances = new Set<AudioCapture>();

/** Symbol to mark that exit handlers have been installed (survives module reloads) */
const EXIT_HANDLERS_KEY = Symbol.for('screencapturekit.audio-capture.exitHandlers');

/** Whether cleanup is in progress (prevents recursive cleanup) */
let cleanupInProgress = false;

/**
 * Install process exit handlers for graceful cleanup
 * Called automatically on first AudioCapture instantiation
 * Uses a process-level symbol to prevent duplicate handlers across module reloads
 */
function installExitHandlers(): void {
  // Check process-level flag to prevent duplicate handlers across module reloads
  if ((process as any)[EXIT_HANDLERS_KEY]) return;
  (process as any)[EXIT_HANDLERS_KEY] = true;

  const cleanup = (signal?: string): void => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    // Stop all active captures
    for (const instance of activeInstances) {
      try {
        if (instance.isCapturing()) {
          instance.stopCapture();
        }
      } catch {
        // Ignore errors during cleanup
      }
    }
    activeInstances.clear();

    // Reset flag so new instances can be tracked
    cleanupInProgress = false;

    // For SIGINT/SIGTERM, allow process to exit naturally after cleanup
    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      process.exit(0);
    }
  };

  // Handle Ctrl+C and kill signals
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  // Handle normal process exit
  process.on('beforeExit', () => cleanup());

  // Handle uncaught exceptions - cleanup but don't swallow the error
  process.on('uncaughtException', (error) => {
    cleanup();
    throw error;
  });
}

/**
 * Main AudioCapture class
 * High-level API for capturing audio from macOS applications
 */
export class AudioCapture extends EventEmitter {
  private readonly captureKit: ScreenCaptureKit;
  private capturing: boolean = false;
  private currentProcessId: number | null = null;
  private currentAppInfo: ApplicationInfo | null = null;
  private _currentTarget: InternalTarget | null = null;
  private captureOptions: InternalCaptureOptions = {
    minVolume: 0,
    format: 'float32',
  };

  // Activity tracking for smart app filtering/sorting
  private readonly _audioActivityCache: Map<number, ActivityCache> = new Map();
  private _activityTrackingEnabled: boolean = false;
  private _activityDecayMs: number = 30000; // Remove apps from cache after 30s of inactivity

  /** Whether this instance has been disposed */
  private _disposed: boolean = false;

  /**
   * Create a new AudioCapture instance
   */
  constructor() {
    super();
    // Import the native binding
    const { ScreenCaptureKit: NativeScreenCaptureKit } = require('../utils/native-loader');
    this.captureKit = new NativeScreenCaptureKit();

    // Track this instance for cleanup
    activeInstances.add(this);

    // Install exit handlers on first instantiation
    installExitHandlers();
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Dispose of this AudioCapture instance and release all resources.
   * Stops any active capture, removes event listeners, and marks the instance as disposed.
   * This method is idempotent - calling it multiple times is safe.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    // Stop any active capture
    if (this.capturing) {
      try {
        this.stopCapture();
      } catch {
        // Ignore errors during dispose
      }
    }

    // Clear activity tracking
    this._audioActivityCache.clear();

    // Remove from global tracking
    activeInstances.delete(this);

    // Remove all event listeners
    this.removeAllListeners();
  }

  /**
   * Check if this instance has been disposed
   * @returns true if dispose() has been called
   */
  isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Throw if this instance has been disposed
   * @internal
   */
  private _assertNotDisposed(): void {
    if (this._disposed) {
      throw new AudioCaptureError(
        'This AudioCapture instance has been disposed and cannot be used',
        ErrorCode.CAPTURE_FAILED,
        { disposed: true }
      );
    }
  }

  /**
   * Clean up all active AudioCapture instances.
   * Useful for cleanup in tests or when shutting down an application.
   * @returns Number of instances that were cleaned up
   */
  static cleanupAll(): number {
    const count = activeInstances.size;
    for (const instance of activeInstances) {
      try {
        instance.dispose();
      } catch {
        // Ignore errors during cleanup
      }
    }
    activeInstances.clear();
    return count;
  }

  /**
   * Get the count of active AudioCapture instances
   * @returns Number of active instances
   */
  static getActiveInstanceCount(): number {
    return activeInstances.size;
  }

  // ==================== Application Discovery ====================

  /**
   * Get all available applications
   * @param options - Filter options
   * @returns Array of application information
   */
  getApplications(options: GetApplicationsOptions = {}): ApplicationInfo[] {
    const { includeEmpty = false } = options;
    const apps = this.captureKit.getAvailableApps();

    // Filter out apps with empty names by default (helper processes, background services)
    if (!includeEmpty) {
      return apps.filter(
        (app) =>
          app.applicationName &&
          app.applicationName.trim().length > 0 &&
          app.bundleIdentifier &&
          app.bundleIdentifier.trim().length > 0
      );
    }

    return apps;
  }

  /**
   * Get capturable windows exposed by ScreenCaptureKit
   * @param options - Filter options
   * @returns Array of window information objects
   */
  getWindows(options: GetWindowsOptions = {}): WindowInfo[] {
    this._assertNativeMethod('getAvailableWindows', 'Window enumeration');
    const windows = this.captureKit.getAvailableWindows!() || [];
    const { onScreenOnly = false, requireTitle = false, processId } = options;

    return windows.filter((window) => {
      if (onScreenOnly && !window.onScreen) {
        return false;
      }
      if (requireTitle && (!window.title || window.title.trim().length === 0)) {
        return false;
      }
      if (typeof processId === 'number' && window.owningProcessId !== processId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get displays that can be captured
   * @returns Array of display information objects
   */
  getDisplays(): DisplayInfo[] {
    this._assertNativeMethod('getAvailableDisplays', 'Display enumeration');
    return this.captureKit.getAvailableDisplays!() || [];
  }

  /**
   * Find application by name or bundle identifier
   * @param identifier - Application name or bundle ID (case-insensitive, partial match)
   * @returns Application info or null if not found
   */
  findApplication(identifier: string): ApplicationInfo | null {
    const apps = this.getApplications();
    const search = identifier.toLowerCase();
    return (
      apps.find(
        (app) =>
          app.applicationName.toLowerCase().includes(search) ||
          app.bundleIdentifier.toLowerCase().includes(search)
      ) || null
    );
  }

  /**
   * Find application by name (case-insensitive search)
   * @param name - Application name to search for
   * @returns Application info or null if not found
   */
  findByName(name: string): ApplicationInfo | null {
    return this.findApplication(name);
  }

  /**
   * Get only applications likely to produce audio
   * Filters out system apps and utilities that typically don't have audio
   * @param options - Filter options
   * @returns Array of audio-capable applications
   */
  getAudioApps(options: GetAudioAppsOptions = {}): ApplicationInfo[] {
    const { includeSystemApps = false, includeEmpty = false, sortByActivity = false, appList = null } = options;
    const apps = Array.isArray(appList) ? appList : this.getApplications({ includeEmpty });
    return this._filterAudioAppList(apps, { includeSystemApps, includeEmpty, sortByActivity });
  }

  /**
   * Internal helper to filter/sort an app list down to likely audio sources
   * @internal
   */
  private _filterAudioAppList(
    apps: ApplicationInfo[],
    options: { includeSystemApps: boolean; includeEmpty: boolean; sortByActivity: boolean }
  ): ApplicationInfo[] {
    const { includeSystemApps, includeEmpty, sortByActivity } = options;

    if (!Array.isArray(apps)) {
      return [];
    }

    let filtered = includeEmpty
      ? [...apps]
      : apps.filter(
          (app) =>
            app &&
            app.applicationName &&
            app.applicationName.trim().length > 0 &&
            app.bundleIdentifier &&
            app.bundleIdentifier.trim().length > 0
        );

    if (!includeSystemApps) {
      const excludePatterns = [
        /^finder$/i,
        /^system/i,
        /preferences$/i,
        /settings$/i,
        /^activity monitor$/i,
        /^console$/i,
        /^terminal$/i,
        /^iterm/i,
        /^ssh/i,
        /^keychain/i,
        /^calculator$/i,
        /^notes$/i,
        /^reminders$/i,
        /^calendar$/i,
        /^contacts$/i,
        /^mail$/i,
        /^messages$/i,
        /^preview$/i,
        /^textEdit$/i,
        /^font book$/i,
      ];

      filtered = filtered.filter((app) => {
        const name = app.applicationName || '';
        const bundleId = app.bundleIdentifier || '';

        if (excludePatterns.some((pattern) => pattern.test(name))) {
          return false;
        }

        // Exclude helper/background processes that typically aren't audio sources
        if (bundleId.includes('AutoFill')) return false;
        if (bundleId.includes('.Helper')) return false;
        if (bundleId.includes('PlatformSupport')) return false;
        if (bundleId.includes('.xpc.')) return false; // XPC services
        if (name.toLowerCase().includes('autofill')) return false;
        if (name.includes('(') && name.includes(')')) {
          // Filter out processes with parentheses like "Service Name (Parent App)"
          // These are typically helper processes, not the main app
          return false;
        }

        return true;
      });
    }

    if (!includeSystemApps && filtered.length === 0 && apps.length > 0) {
      // Add hint for debugging - matches JS SDK behavior
      (filtered as any)._hint =
        'No audio apps found after filtering. Try getAudioApps({ includeSystemApps: true }) or getApplications() to see all apps.';
    }

    if (sortByActivity && this._activityTrackingEnabled) {
      const now = Date.now();
      for (const [pid, activity] of this._audioActivityCache.entries()) {
        if (now - activity.lastSeen > this._activityDecayMs) {
          this._audioActivityCache.delete(pid);
        }
      }

      filtered.sort((a, b) => {
        const aActivity = this._audioActivityCache.get(a.processId);
        const bActivity = this._audioActivityCache.get(b.processId);
        const aTime = aActivity ? aActivity.lastSeen : 0;
        const bTime = bActivity ? bActivity.lastSeen : 0;
        return bTime - aTime;
      });
    }

    return filtered;
  }

  /**
   * Get application by process ID
   * @param processId - Process ID
   * @returns Application info or null if not found
   */
  getApplicationByPid(processId: number): ApplicationInfo | null {
    const apps = this.getApplications();
    return apps.find((app) => app.processId === processId) || null;
  }

  /**
   * Smart app selection with fallback strategies
   * Tries multiple methods to find an app: exact name, PID, bundle ID, partial match, audio apps
   * @param identifiers - App identifier(s) to try in order
   * @param options - Selection options
   * @returns Application info or null if not found (unless throwOnNotFound is true)
   * @throws {AudioCaptureError} If throwOnNotFound is true and no app found
   */
  selectApp(identifiers: AppIdentifier | null = null, options: SelectAppOptions = {}): ApplicationInfo | null {
    const {
      audioOnly = true,
      throwOnNotFound = false,
      appList = null,
      fallbackToFirst = false,
      sortByActivity = false,
    } = options;

    let apps: ApplicationInfo[];
    if (Array.isArray(appList)) {
      apps = audioOnly
        ? this._filterAudioAppList(appList, { includeSystemApps: false, includeEmpty: false, sortByActivity })
        : [...appList];
    } else {
      apps = audioOnly ? this.getAudioApps({ sortByActivity }) : this.getApplications();
    }

    // If no identifiers provided or empty array, return first audio app
    if (!identifiers || (Array.isArray(identifiers) && identifiers.length === 0)) {
      if (apps.length > 0) {
        return apps[0];
      }

      if (throwOnNotFound) {
        throw new AudioCaptureError(
          'No applications available',
          ErrorCode.APP_NOT_FOUND,
          { suggestion: 'Check screen recording permissions' }
        );
      }
      return null;
    }

    // Normalize to array
    const identifierList = Array.isArray(identifiers) ? identifiers : [identifiers];

    // Try each identifier in order
    let hasValidIdentifier = false;
    for (const identifier of identifierList) {
      let app: ApplicationInfo | null = null;

      if (typeof identifier === 'number') {
        hasValidIdentifier = true;
        // Try as PID
        app = apps.find((a) => a.processId === identifier) || null;
      } else if (typeof identifier === 'string') {
        // Skip empty or whitespace-only strings
        const search = identifier.toLowerCase().trim();
        if (search.length === 0) {
          continue;
        }

        hasValidIdentifier = true;

        // Try exact name match first
        app = apps.find((a) => a.applicationName.toLowerCase() === search) || null;

        // Try exact bundle ID match
        if (!app) {
          app = apps.find((a) => a.bundleIdentifier.toLowerCase() === search) || null;
        }

        // Try partial name match
        if (!app) {
          app = apps.find((a) => a.applicationName.toLowerCase().includes(search)) || null;
        }

        // Try partial bundle ID match
        if (!app) {
          app = apps.find((a) => a.bundleIdentifier.toLowerCase().includes(search)) || null;
        }
      } else if (typeof identifier === 'object' && identifier !== null && 'processId' in identifier) {
        // Handle ApplicationInfo objects
        hasValidIdentifier = true;
        app = apps.find((a) => a.processId === (identifier as ApplicationInfo).processId) || null;
      }

      // Return first match
      if (app) {
        return app;
      }
    }

    // If no valid identifiers were provided (all empty/whitespace), return first app
    if (!hasValidIdentifier && apps.length > 0) {
      return apps[0];
    }

    if (fallbackToFirst && apps.length > 0) {
      return apps[0];
    }

    // No app found
    if (throwOnNotFound) {
      throw AudioCaptureError.appNotFound(identifiers, apps.map((a) => a.applicationName));
    }

    return null;
  }

  // ==================== Activity Tracking ====================

  /**
   * Enable background tracking of audio activity
   * Tracks which apps are producing audio for smarter filtering and sorting
   * @param options - Tracking options
   */
  enableActivityTracking(options: ActivityTrackingOptions = {}): void {
    const { decayMs = 30000 } = options;
    this._activityTrackingEnabled = true;
    this._activityDecayMs = decayMs;
  }

  /**
   * Disable activity tracking and clear the cache
   */
  disableActivityTracking(): void {
    this._activityTrackingEnabled = false;
    this._audioActivityCache.clear();
  }

  /**
   * Get activity tracking status and statistics
   * @returns Activity tracking info
   */
  getActivityInfo(): ActivityInfo {
    const now = Date.now();
    const recentApps: ProcessActivityInfo[] = [];

    for (const [pid, activity] of this._audioActivityCache.entries()) {
      const age = now - activity.lastSeen;
      if (age < this._activityDecayMs) {
        recentApps.push({
          processId: pid,
          lastSeen: activity.lastSeen,
          ageMs: age,
          avgRMS: activity.avgRMS,
          sampleCount: activity.sampleCount,
        });
      }
    }

    // Sort by most recent first
    recentApps.sort((a, b) => a.ageMs - b.ageMs);

    return {
      enabled: this._activityTrackingEnabled,
      trackedApps: recentApps.length,
      recentApps,
    };
  }

  // ==================== Permissions ====================

  /**
   * Verify screen recording permissions
   * Proactively checks if the app has necessary permissions before attempting capture
   * @returns Permission status object
   */
  static verifyPermissions(): PermissionStatus {
    const capture = new AudioCapture();
    const apps = capture.getApplications();

    if (apps.length === 0) {
      return {
        granted: false,
        message: 'Screen Recording permission is not granted or no applications are available.',
        remediation:
          'To fix this:\n' +
          '1. Open System Preferences → Privacy & Security → Screen Recording\n' +
          '2. Add your terminal app (Terminal.app, iTerm2, VS Code, etc.)\n' +
          '3. Toggle it ON\n' +
          '4. Restart your terminal completely for changes to take effect',
      };
    }

    return {
      granted: true,
      message: `Screen Recording permission granted. Found ${apps.length} available application(s).`,
      availableApps: apps.length,
      apps: apps, // Return the apps list so callers can reuse it
    };
  }

  // ==================== Capture Control ====================

  /**
   * Get detailed status of current capture session
   * @returns Status object or null if not capturing
   */
  getStatus(): CaptureStatus | null {
    if (!this.capturing) {
      return null;
    }

    const snapshot = this._createTargetSnapshot();

    return {
      capturing: true,
      processId: snapshot ? snapshot.processId : null,
      app: snapshot ? snapshot.app : null,
      targetType: snapshot ? snapshot.targetType : 'application',
      window: snapshot ? snapshot.window : null,
      display: snapshot ? snapshot.display : null,
      config: {
        minVolume: this.captureOptions.minVolume,
        format: this.captureOptions.format,
      },
    };
  }

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
  startCapture(appIdentifier: AppIdentifier, options: CaptureOptions = {}): boolean {
    this._assertNotDisposed();
    let processId: number;
    let appInfo: ApplicationInfo;

    if (typeof appIdentifier === 'string') {
      const found = this.findApplication(appIdentifier);
      if (!found) {
        const apps = this.getApplications();
        const error =
          apps.length === 0
            ? AudioCaptureError.permissionDenied(0)
            : AudioCaptureError.appNotFound(appIdentifier, apps.map((a) => a.applicationName));
        this.emit('error', error);
        throw error;
      }
      appInfo = found;
      processId = appInfo.processId;
    } else if (typeof appIdentifier === 'number') {
      processId = appIdentifier;
      const found = this.getApplicationByPid(processId);
      if (!found) {
        const error = AudioCaptureError.processNotFound(processId);
        this.emit('error', error);
        throw error;
      }
      appInfo = found;
    } else if (typeof appIdentifier === 'object' && appIdentifier !== null && 'processId' in appIdentifier) {
      // Allow passing an app object directly (e.g., from getApplications())
      processId = appIdentifier.processId;
      appInfo = appIdentifier;
    } else {
      const error = AudioCaptureError.invalidArgument(
        'Invalid appIdentifier. Must be string, number, or app object with processId.',
        {
          receivedType: typeof appIdentifier,
          expectedTypes: ['string', 'number', 'object with processId'],
        }
      );
      this.emit('error', error);
      throw error;
    }

    const target: CaptureTarget = {
      type: 'application',
      processId,
      app: appInfo,
      window: null,
      display: null,
      failureMessage: 'Failed to start capture',
      failureDetails: {
        processId,
        app: appInfo,
        suggestion: 'The application may not have visible windows or may not support audio capture.',
      },
    };

    const nativeStarter: NativeCaptureStarter = (nativeConfig, callback) =>
      this.captureKit.startCapture(processId, nativeConfig, callback);
    return this._startNativeCapture(target, options, nativeStarter);
  }

  /**
   * Start capture for a specific window ID
   * @param windowId - Window identifier from getWindows()
   * @param options - Capture options (same as startCapture)
   * @returns true if capture started successfully
   */
  captureWindow(windowId: number, options: CaptureOptions = {}): boolean {
    this._assertNotDisposed();
    this._assertNativeMethod('startCaptureForWindow', 'Window capture');
    if (typeof windowId !== 'number') {
      throw AudioCaptureError.invalidArgument('windowId must be a number.', {
        receivedType: typeof windowId,
        expectedTypes: ['number'],
      });
    }

    const windowInfo = this.getWindows().find((window) => window.windowId === windowId);
    if (!windowInfo) {
      throw AudioCaptureError.invalidArgument(
        `Window with ID ${windowId} not found. Call getWindows() to list available windows.`,
        { windowId }
      );
    }

    const owningProcessId = typeof windowInfo.owningProcessId === 'number' ? windowInfo.owningProcessId : null;
    const owningApp = owningProcessId ? this.getApplicationByPid(owningProcessId) : null;

    const target: CaptureTarget = {
      type: 'window',
      processId: owningProcessId,
      app: owningApp,
      window: windowInfo,
      display: null,
      failureMessage: 'Failed to start window capture',
      failureDetails: {
        windowId,
        owningProcessId,
      },
    };

    const nativeStarter: NativeCaptureStarter = (nativeConfig, callback) =>
      this.captureKit.startCaptureForWindow!(windowId, nativeConfig, callback);
    return this._startNativeCapture(target, options, nativeStarter);
  }

  /**
   * Start capture for a display
   * @param displayId - Display identifier from getDisplays()
   * @param options - Capture options (same as startCapture)
   * @returns true if capture started successfully
   */
  captureDisplay(displayId: number, options: CaptureOptions = {}): boolean {
    this._assertNotDisposed();
    this._assertNativeMethod('startCaptureForDisplay', 'Display capture');
    if (typeof displayId !== 'number') {
      throw AudioCaptureError.invalidArgument('displayId must be a number.', {
        receivedType: typeof displayId,
        expectedTypes: ['number'],
      });
    }

    const displayInfo = this.getDisplays().find((display) => display.displayId === displayId);
    if (!displayInfo) {
      throw AudioCaptureError.invalidArgument(
        `Display with ID ${displayId} not found. Call getDisplays() to list available displays.`,
        { displayId }
      );
    }

    const target: CaptureTarget = {
      type: 'display',
      processId: null,
      app: null,
      window: null,
      display: displayInfo,
      failureMessage: 'Failed to start display capture',
      failureDetails: {
        displayId,
      },
    };

    const nativeStarter: NativeCaptureStarter = (nativeConfig, callback) =>
      this.captureKit.startCaptureForDisplay!(displayId, nativeConfig, callback);
    return this._startNativeCapture(target, options, nativeStarter);
  }

  /**
   * Start capturing audio from multiple applications simultaneously
   * Useful for recording game + Discord, Zoom + Music, etc.
   * @param appIdentifiers - Array of app names, bundle IDs, process IDs, or ApplicationInfo objects
   * @param options - Capture options
   * @returns true if capture started successfully
   * @throws {AudioCaptureError} Throws structured error with code and details if capture fails
   * @fires AudioCapture#start
   * @fires AudioCapture#audio
   * @fires AudioCapture#error
   */
  captureMultipleApps(appIdentifiers: MultiAppIdentifier, options: MultiAppCaptureOptions = {}): boolean {
    this._assertNotDisposed();
    this._assertNativeMethod('startCaptureMultiApp', 'Multi-app capture');

    const { allowPartial = true, ...captureOptions } = options;

    if (!Array.isArray(appIdentifiers) || appIdentifiers.length === 0) {
      const error = AudioCaptureError.invalidArgument(
        'appIdentifiers must be a non-empty array of app names, bundle IDs, process IDs, or ApplicationInfo objects',
        { receivedType: typeof appIdentifiers }
      );
      this.emit('error', error);
      throw error;
    }

    // Resolve all app identifiers to ApplicationInfo objects
    const apps = this.getApplications();
    const resolvedApps: ApplicationInfo[] = [];
    const notFoundIdentifiers: (string | number)[] = [];

    for (const identifier of appIdentifiers) {
      let foundApp: ApplicationInfo | null = null;

      if (typeof identifier === 'number') {
        // PID
        foundApp = apps.find((a) => a.processId === identifier) || null;
        if (!foundApp) notFoundIdentifiers.push(identifier);
      } else if (typeof identifier === 'string') {
        const search = identifier.toLowerCase().trim();
        if (search.length === 0) continue;

        // Try exact name match first
        foundApp = apps.find((a) => a.applicationName.toLowerCase() === search) || null;

        // Try exact bundle ID match
        if (!foundApp) {
          foundApp = apps.find((a) => a.bundleIdentifier.toLowerCase() === search) || null;
        }

        // Try partial name match
        if (!foundApp) {
          foundApp = apps.find((a) => a.applicationName.toLowerCase().includes(search)) || null;
        }

        // Try partial bundle ID match
        if (!foundApp) {
          foundApp = apps.find((a) => a.bundleIdentifier.toLowerCase().includes(search)) || null;
        }

        if (!foundApp) notFoundIdentifiers.push(identifier);
      } else if (typeof identifier === 'object' && identifier !== null && 'processId' in identifier) {
        // ApplicationInfo object - verify it still exists
        foundApp = apps.find((a) => a.processId === identifier.processId) || null;
        if (!foundApp) notFoundIdentifiers.push(identifier.processId);
      }

      if (foundApp && !resolvedApps.some((a) => a.processId === foundApp!.processId)) {
        resolvedApps.push(foundApp);
      }
    }

    // Check if we found any apps
    if (resolvedApps.length === 0) {
      const error = AudioCaptureError.appNotFound(
        appIdentifiers.map((id) => (typeof id === 'object' ? id.applicationName : String(id))).join(', '),
        apps.map((a) => a.applicationName)
      );
      this.emit('error', error);
      throw error;
    }

    // If allowPartial is false and some apps weren't found, throw error
    if (!allowPartial && notFoundIdentifiers.length > 0) {
      const error = new AudioCaptureError(
        `Some applications not found: ${notFoundIdentifiers.join(', ')}`,
        ErrorCode.APP_NOT_FOUND,
        {
          notFound: notFoundIdentifiers,
          found: resolvedApps.map((a) => a.applicationName),
          suggestion: 'Set allowPartial: true to capture from available apps only',
        }
      );
      this.emit('error', error);
      throw error;
    }

    const processIds = resolvedApps.map((app) => app.processId);

    const target: CaptureTarget = {
      type: 'multi-app',
      processId: processIds[0], // Primary app for backward compatibility
      app: resolvedApps[0],
      apps: resolvedApps,
      window: null,
      display: null,
      failureMessage: 'Failed to start multi-app capture',
      failureDetails: {
        processIds,
        apps: resolvedApps,
        notFound: notFoundIdentifiers,
        suggestion: 'One or more applications may not support audio capture.',
      },
    };

    const nativeStarter: NativeCaptureStarter = (nativeConfig, callback) =>
      this.captureKit.startCaptureMultiApp!(processIds, nativeConfig, callback);

    return this._startNativeCaptureMultiApp(target, captureOptions, nativeStarter, resolvedApps);
  }

  /**
   * Start capturing audio from multiple windows simultaneously
   * @param windowIdentifiers - Array of window IDs or WindowInfo objects
   * @param options - Capture options
   * @returns true if capture started successfully
   * @throws {AudioCaptureError} Throws structured error with code and details if capture fails
   * @fires AudioCapture#start
   * @fires AudioCapture#audio
   * @fires AudioCapture#error
   */
  captureMultipleWindows(windowIdentifiers: MultiWindowIdentifier, options: MultiWindowCaptureOptions = {}): boolean {
    this._assertNotDisposed();
    this._assertNativeMethod('startCaptureMultiWindow', 'Multi-window capture');

    const { allowPartial = true, ...captureOptions } = options;

    if (!Array.isArray(windowIdentifiers) || windowIdentifiers.length === 0) {
      const error = AudioCaptureError.invalidArgument(
        'windowIdentifiers must be a non-empty array of window IDs or WindowInfo objects',
        { receivedType: typeof windowIdentifiers }
      );
      this.emit('error', error);
      throw error;
    }

    const allWindows = this.getWindows();
    const resolvedWindows: WindowInfo[] = [];
    const notFoundIds: number[] = [];

    for (const identifier of windowIdentifiers) {
      let foundWindow: WindowInfo | null = null;

      if (typeof identifier === 'number') {
        foundWindow = allWindows.find((w) => w.windowId === identifier) || null;
        if (!foundWindow) notFoundIds.push(identifier);
      } else if (typeof identifier === 'object' && identifier !== null && 'windowId' in identifier) {
        foundWindow = allWindows.find((w) => w.windowId === identifier.windowId) || null;
        if (!foundWindow) notFoundIds.push(identifier.windowId);
      }

      if (foundWindow && !resolvedWindows.some((w) => w.windowId === foundWindow!.windowId)) {
        resolvedWindows.push(foundWindow);
      }
    }

    if (resolvedWindows.length === 0) {
      const error = new AudioCaptureError(
        'No windows found with the specified IDs',
        ErrorCode.INVALID_ARGUMENT,
        { requestedIds: windowIdentifiers, availableWindows: allWindows.map((w) => ({ id: w.windowId, title: w.title })) }
      );
      this.emit('error', error);
      throw error;
    }

    if (!allowPartial && notFoundIds.length > 0) {
      const error = new AudioCaptureError(
        `Some windows not found: ${notFoundIds.join(', ')}`,
        ErrorCode.INVALID_ARGUMENT,
        { notFound: notFoundIds, found: resolvedWindows.map((w) => w.windowId) }
      );
      this.emit('error', error);
      throw error;
    }

    const windowIds = resolvedWindows.map((w) => w.windowId);

    const target: CaptureTarget = {
      type: 'window',
      processId: resolvedWindows[0].owningProcessId || null,
      app: null,
      window: resolvedWindows[0],
      display: null,
      failureMessage: 'Failed to start multi-window capture',
      failureDetails: { windowIds, notFound: notFoundIds },
    };

    const nativeStarter: NativeCaptureStarter = (nativeConfig, callback) =>
      this.captureKit.startCaptureMultiWindow!(windowIds, nativeConfig, callback);

    return this._startNativeCapture(target, captureOptions, nativeStarter);
  }

  /**
   * Start capturing audio from multiple displays simultaneously
   * @param displayIdentifiers - Array of display IDs or DisplayInfo objects
   * @param options - Capture options
   * @returns true if capture started successfully
   * @throws {AudioCaptureError} Throws structured error with code and details if capture fails
   * @fires AudioCapture#start
   * @fires AudioCapture#audio
   * @fires AudioCapture#error
   */
  captureMultipleDisplays(displayIdentifiers: MultiDisplayIdentifier, options: MultiDisplayCaptureOptions = {}): boolean {
    this._assertNotDisposed();
    this._assertNativeMethod('startCaptureMultiDisplay', 'Multi-display capture');

    const { allowPartial = true, ...captureOptions } = options;

    if (!Array.isArray(displayIdentifiers) || displayIdentifiers.length === 0) {
      const error = AudioCaptureError.invalidArgument(
        'displayIdentifiers must be a non-empty array of display IDs or DisplayInfo objects',
        { receivedType: typeof displayIdentifiers }
      );
      this.emit('error', error);
      throw error;
    }

    const allDisplays = this.getDisplays();
    const resolvedDisplays: DisplayInfo[] = [];
    const notFoundIds: number[] = [];

    for (const identifier of displayIdentifiers) {
      let foundDisplay: DisplayInfo | null = null;

      if (typeof identifier === 'number') {
        foundDisplay = allDisplays.find((d) => d.displayId === identifier) || null;
        if (!foundDisplay) notFoundIds.push(identifier);
      } else if (typeof identifier === 'object' && identifier !== null && 'displayId' in identifier) {
        foundDisplay = allDisplays.find((d) => d.displayId === identifier.displayId) || null;
        if (!foundDisplay) notFoundIds.push(identifier.displayId);
      }

      if (foundDisplay && !resolvedDisplays.some((d) => d.displayId === foundDisplay!.displayId)) {
        resolvedDisplays.push(foundDisplay);
      }
    }

    if (resolvedDisplays.length === 0) {
      const error = new AudioCaptureError(
        'No displays found with the specified IDs',
        ErrorCode.INVALID_ARGUMENT,
        { requestedIds: displayIdentifiers, availableDisplays: allDisplays.map((d) => ({ id: d.displayId, main: d.isMainDisplay })) }
      );
      this.emit('error', error);
      throw error;
    }

    if (!allowPartial && notFoundIds.length > 0) {
      const error = new AudioCaptureError(
        `Some displays not found: ${notFoundIds.join(', ')}`,
        ErrorCode.INVALID_ARGUMENT,
        { notFound: notFoundIds, found: resolvedDisplays.map((d) => d.displayId) }
      );
      this.emit('error', error);
      throw error;
    }

    const displayIds = resolvedDisplays.map((d) => d.displayId);

    const target: CaptureTarget = {
      type: 'display',
      processId: null,
      app: null,
      window: null,
      display: resolvedDisplays[0],
      failureMessage: 'Failed to start multi-display capture',
      failureDetails: { displayIds, notFound: notFoundIds },
    };

    const nativeStarter: NativeCaptureStarter = (nativeConfig, callback) =>
      this.captureKit.startCaptureMultiDisplay!(displayIds, nativeConfig, callback);

    return this._startNativeCapture(target, captureOptions, nativeStarter);
  }

  /**
   * Stop the current capture session
   * @fires AudioCapture#stop
   */
  stopCapture(): void {
    if (!this.capturing) {
      return;
    }

    this.captureKit.stopCapture();
    this.capturing = false;
    const snapshot = this._createTargetSnapshot();
    this.currentProcessId = null;
    this.currentAppInfo = null;
    this._currentTarget = null;

    this.emit(
      'stop',
      snapshot || {
        processId: null,
        app: null,
        window: null,
        display: null,
        targetType: 'application' as const,
      }
    );
  }

  /**
   * Check if currently capturing
   * @returns true if currently capturing
   */
  isCapturing(): boolean {
    return this.capturing;
  }

  /**
   * Get current capture info
   * @returns Current capture info or null if not capturing
   */
  getCurrentCapture(): CaptureInfo | null {
    if (!this.capturing) {
      return null;
    }

    return this._createTargetSnapshot();
  }

  // ==================== Stream API ====================

  /**
   * Create a readable stream for audio capture
   * Provides a stream-based alternative to the event-based API
   * @param appIdentifier - Application name, bundle ID, or process ID
   * @param options - Stream and capture options
   * @returns Readable stream that emits audio data
   */
  createAudioStream(appIdentifier: AppIdentifier, options: AudioStreamOptions = {}): AudioStream {
    return new AudioStream(this, appIdentifier, options);
  }

  /**
   * Create a pre-configured stream for Speech-to-Text (STT) engines
   * Automatically converts to Int16 mono format - the most common STT input format
   * @param appIdentifier - App name, PID, bundle ID, or array to try in order
   * @param options - STT stream options
   * @returns Transform stream ready to pipe to STT engine
   */
  createSTTStream(appIdentifier: AppIdentifier, options: STTStreamOptions = {}): STTConverter {
    const { format = 'int16', channels = 1, minVolume, objectMode = false, autoSelect = true, ...captureOptions } = options;

    // Try to select app using smart selection
    let app: ApplicationInfo | null = null;
    if (appIdentifier) {
      app = this.selectApp(appIdentifier, { audioOnly: true, throwOnNotFound: false });
    }

    // Auto-select if not found and autoSelect is true
    if (!app && autoSelect) {
      app = this.selectApp(null, { audioOnly: true, throwOnNotFound: false });
    }

    // If still no app, throw error
    if (!app) {
      throw new AudioCaptureError(
        'No application found for STT stream',
        ErrorCode.APP_NOT_FOUND,
        {
          requestedApp: appIdentifier,
          suggestion: 'Start an audio application or check screen recording permissions',
        }
      );
    }

    // Create audio stream with appropriate settings
    const audioStream = this.createAudioStream(app.processId, {
      ...captureOptions,
      format: 'float32', // Always get float32 from source
      objectMode: true, // Need metadata for conversion
      minVolume,
    });

    // Create STT converter
    const converter = new STTConverter({ format, channels, objectMode });

    // Pipe audio stream through converter
    audioStream.pipe(converter);

    // Forward errors
    audioStream.on('error', (err) => converter.destroy(err));

    // Add stop method to converter for convenience
    converter.stop = () => audioStream.stop();

    // Add app info to converter
    converter.app = app;

    return converter;
  }

  // ==================== Utility Methods ====================

  /**
   * Convert Buffer to Float32Array for easier audio processing
   * @param buffer - Buffer containing Float32 PCM audio samples
   * @returns Float32Array view of the buffer
   */
  static bufferToFloat32Array(buffer: Buffer): Float32Array {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }

  /**
   * Convert RMS to decibels
   * @param rms - RMS value (0.0 to 1.0)
   * @returns dB level (-Infinity to 0)
   */
  static rmsToDb(rms: number): number {
    if (rms <= 0) return -Infinity;
    return 20 * Math.log10(rms);
  }

  /**
   * Convert peak to decibels
   * @param peak - Peak value (0.0 to 1.0)
   * @returns dB level (-Infinity to 0)
   */
  static peakToDb(peak: number): number {
    if (peak <= 0) return -Infinity;
    return 20 * Math.log10(peak);
  }

  /**
   * Calculate decibels from audio samples
   * @param samples - Float32 audio samples
   * @param method - 'rms' or 'peak'
   * @returns dB level
   */
  static calculateDb(samples: Buffer, method: 'rms' | 'peak' = 'rms'): number {
    const floatView = new Float32Array(samples.buffer, samples.byteOffset, samples.length / 4);

    if (method === 'peak') {
      let peak = 0;
      for (let i = 0; i < floatView.length; i++) {
        const abs = Math.abs(floatView[i]);
        if (abs > peak) peak = abs;
      }
      return AudioCapture.peakToDb(peak);
    } else {
      // RMS
      let sum = 0;
      for (let i = 0; i < floatView.length; i++) {
        sum += floatView[i] * floatView[i];
      }
      const rms = Math.sqrt(sum / floatView.length);
      return AudioCapture.rmsToDb(rms);
    }
  }

  /**
   * Create a WAV file from PCM audio data
   * @param buffer - PCM audio data (Float32 or Int16)
   * @param options - WAV file options
   * @returns Complete WAV file that can be written to disk
   */
  static writeWav(buffer: Buffer, options: WavOptions): Buffer {
    const { sampleRate, channels, format = 'float32' } = options;

    // Validate required options
    if (!sampleRate || !channels) {
      throw new Error('sampleRate and channels are required options');
    }

    if (format !== 'float32' && format !== 'int16') {
      throw new Error('format must be "float32" or "int16"');
    }

    // Calculate WAV format parameters
    const isFloat = format === 'float32';
    const audioFormat = isFloat ? 3 : 1; // 3 = IEEE Float, 1 = PCM
    const bitsPerSample = isFloat ? 32 : 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    // Data size
    const dataSize = buffer.length;
    const fileSize = 36 + dataSize; // 36 bytes of headers + data

    // Create buffer for complete WAV file
    const wavBuffer = Buffer.allocUnsafe(44 + dataSize);
    let offset = 0;

    // Helper to write strings
    const writeString = (str: string): void => {
      for (let i = 0; i < str.length; i++) {
        wavBuffer[offset++] = str.charCodeAt(i);
      }
    };

    // Helper to write 32-bit little-endian integer
    const writeUInt32LE = (value: number): void => {
      wavBuffer.writeUInt32LE(value, offset);
      offset += 4;
    };

    // Helper to write 16-bit little-endian integer
    const writeUInt16LE = (value: number): void => {
      wavBuffer.writeUInt16LE(value, offset);
      offset += 2;
    };

    // RIFF header
    writeString('RIFF');
    writeUInt32LE(fileSize);
    writeString('WAVE');

    // fmt chunk
    writeString('fmt ');
    writeUInt32LE(16); // fmt chunk size
    writeUInt16LE(audioFormat); // audio format (1=PCM, 3=IEEE Float)
    writeUInt16LE(channels); // number of channels
    writeUInt32LE(sampleRate); // sample rate
    writeUInt32LE(byteRate); // byte rate
    writeUInt16LE(blockAlign); // block align
    writeUInt16LE(bitsPerSample); // bits per sample

    // data chunk
    writeString('data');
    writeUInt32LE(dataSize);

    // Copy audio data
    buffer.copy(wavBuffer, offset);

    return wavBuffer;
  }

  // ==================== Private Methods ====================

  /**
   * Build native capture configuration
   * @internal
   */
  private _buildNativeConfig(options: CaptureOptions): NativeCaptureConfig {
    return {
      sampleRate: options.sampleRate || 48000,
      channels: options.channels || 2,
      bufferSize: options.bufferSize,
      excludeCursor: options.excludeCursor !== undefined ? options.excludeCursor : true,
    };
  }

  /**
   * Start native capture with unified logic
   * @internal
   */
  private _startNativeCapture(
    target: CaptureTarget,
    options: CaptureOptions,
    startInvoker: NativeCaptureStarter
  ): boolean {
    if (this.capturing) {
      const error = AudioCaptureError.alreadyCapturing({
        currentProcessId: this.currentProcessId,
        currentApp: this.currentAppInfo,
        currentTarget: this._createTargetSnapshot(),
      });
      this.emit('error', error);
      throw error;
    }

    this.captureOptions = {
      minVolume: options.minVolume || 0,
      format: options.format || 'float32',
    };

    const nativeConfig = this._buildNativeConfig(options);
    const processIdForActivity = typeof target.processId === 'number' ? target.processId : null;

    const success = startInvoker(nativeConfig, (sample) => this._handleNativeSample(sample, processIdForActivity));

    if (success) {
      this.capturing = true;
      this.currentProcessId = processIdForActivity;
      this.currentAppInfo = target.app || (processIdForActivity ? this.getApplicationByPid(processIdForActivity) : null);
      this._currentTarget = {
        processId: this.currentProcessId,
        app: this.currentAppInfo,
        window: this._cloneWindowInfo(target.window),
        display: this._cloneDisplayInfo(target.display),
        targetType: target.type || 'application',
      };

      this.emit('start', this._createTargetSnapshot());
    } else {
      const error = AudioCaptureError.captureFailed(target.failureMessage, target.failureDetails);
      this.emit('error', error);
      throw error;
    }

    return success;
  }

  /**
   * Start native capture for multiple apps with unified logic
   * @internal
   */
  private _startNativeCaptureMultiApp(
    target: CaptureTarget,
    options: CaptureOptions,
    startInvoker: NativeCaptureStarter,
    resolvedApps: ApplicationInfo[]
  ): boolean {
    if (this.capturing) {
      const error = AudioCaptureError.alreadyCapturing({
        currentProcessId: this.currentProcessId,
        currentApp: this.currentAppInfo,
        currentTarget: this._createTargetSnapshot(),
      });
      this.emit('error', error);
      throw error;
    }

    this.captureOptions = {
      minVolume: options.minVolume || 0,
      format: options.format || 'float32',
    };

    const nativeConfig = this._buildNativeConfig(options);
    // For multi-app capture, we don't track activity by a single PID
    const processIdForActivity = null;

    const success = startInvoker(nativeConfig, (sample) => this._handleNativeSample(sample, processIdForActivity));

    if (success) {
      this.capturing = true;
      this.currentProcessId = target.processId;
      this.currentAppInfo = target.app;
      this._currentTarget = {
        processId: this.currentProcessId,
        app: this.currentAppInfo,
        apps: [...resolvedApps],
        window: null,
        display: null,
        targetType: 'multi-app',
      };

      this.emit('start', this._createTargetSnapshot());
    } else {
      const error = AudioCaptureError.captureFailed(target.failureMessage, target.failureDetails);
      this.emit('error', error);
      throw error;
    }

    return success;
  }

  /**
   * Handle native audio sample
   * @internal
   */
  private _handleNativeSample(sample: NativeAudioSample, processIdForActivity: number | null): void {
    const rms = this._calculateRMS(sample.data);
    const peak = this._calculatePeak(sample.data);

    if (rms < this.captureOptions.minVolume) {
      return;
    }

    let audioData = sample.data;
    let actualFormat: AudioFormat = 'float32';

    if (this.captureOptions.format === 'int16') {
      audioData = this._convertToInt16(sample.data);
      actualFormat = 'int16';
    }

    const bytesPerSample = 4;
    const totalSamples = sample.data.length / bytesPerSample;
    const framesCount = totalSamples / sample.channelCount;
    const durationMs = (framesCount / sample.sampleRate) * 1000;

    const enhancedSample: AudioSample = {
      data: audioData,
      sampleRate: sample.sampleRate,
      channels: sample.channelCount,
      timestamp: sample.timestamp,
      format: actualFormat,
      sampleCount: totalSamples,
      framesCount,
      durationMs,
      rms,
      peak,
    };

    this.emit('audio', enhancedSample);

    if (this._activityTrackingEnabled && typeof processIdForActivity === 'number') {
      const now = Date.now();
      const existing = this._audioActivityCache.get(processIdForActivity);

      if (existing) {
        const alpha = 0.1;
        existing.avgRMS = existing.avgRMS * (1 - alpha) + rms * alpha;
        existing.lastSeen = now;
        existing.sampleCount++;
      } else {
        this._audioActivityCache.set(processIdForActivity, {
          lastSeen: now,
          avgRMS: rms,
          sampleCount: 1,
        });
      }
    }
  }

  /**
   * Calculate RMS (Root Mean Square) volume level
   * @internal
   */
  private _calculateRMS(samples: Buffer): number {
    if (samples.length === 0) return 0;

    const floatView = new Float32Array(samples.buffer, samples.byteOffset, samples.length / 4);

    let sum = 0;
    let validSamples = 0;
    for (let i = 0; i < floatView.length; i++) {
      const sample = floatView[i];
      // Filter out NaN and extreme values
      if (!isNaN(sample) && isFinite(sample)) {
        // Clamp to reasonable audio range [-10, 10]
        const clamped = Math.max(-10, Math.min(10, sample));
        sum += clamped * clamped;
        validSamples++;
      }
    }
    if (validSamples === 0) return 0;
    return Math.sqrt(sum / validSamples);
  }

  /**
   * Calculate peak volume level
   * @internal
   */
  private _calculatePeak(samples: Buffer): number {
    if (samples.length === 0) return 0;

    const floatView = new Float32Array(samples.buffer, samples.byteOffset, samples.length / 4);

    let peak = 0;
    for (let i = 0; i < floatView.length; i++) {
      const sample = floatView[i];
      // Filter out NaN and extreme values
      if (!isNaN(sample) && isFinite(sample)) {
        // Clamp to reasonable audio range
        const clamped = Math.max(-10, Math.min(10, sample));
        const abs = Math.abs(clamped);
        if (abs > peak) peak = abs;
      }
    }
    return peak;
  }

  /**
   * Convert Float32 audio samples to Int16 format
   * @internal
   */
  private _convertToInt16(samples: Buffer): Buffer {
    const floatView = new Float32Array(samples.buffer, samples.byteOffset, samples.length / 4);

    const int16Buffer = Buffer.allocUnsafe(floatView.length * 2);
    const int16View = new Int16Array(int16Buffer.buffer, int16Buffer.byteOffset, floatView.length);

    for (let i = 0; i < floatView.length; i++) {
      // Clamp to [-1.0, 1.0] and convert to Int16 range [-32768, 32767]
      const clamped = Math.max(-1.0, Math.min(1.0, floatView[i]));
      int16View[i] = Math.round(clamped * 32767);
    }

    return int16Buffer;
  }

  /**
   * Create a snapshot of the current target
   * @internal
   */
  private _createTargetSnapshot(target: InternalTarget | null = this._currentTarget): CaptureInfo | null {
    if (!target) {
      return null;
    }

    const snapshot: CaptureInfo = {
      processId: typeof target.processId === 'number' ? target.processId : null,
      app: this._cloneAppInfo(target.app),
      window: this._cloneWindowInfo(target.window),
      display: this._cloneDisplayInfo(target.display),
      targetType: target.targetType || 'application',
    };

    // Include apps array for multi-app capture
    if (target.apps && target.apps.length > 0) {
      (snapshot as { apps?: readonly ApplicationInfo[] }).apps = target.apps.map((a) => ({ ...a }));
    }

    return snapshot;
  }

  /**
   * Clone app info
   * @internal
   */
  private _cloneAppInfo(app: ApplicationInfo | null): ApplicationInfo | null {
    if (!app) return null;
    return { ...app };
  }

  /**
   * Clone window info
   * @internal
   */
  private _cloneWindowInfo(window: WindowInfo | null): WindowInfo | null {
    if (!window) return null;
    return {
      ...window,
      frame: window.frame ? { ...window.frame } : null,
    };
  }

  /**
   * Clone display info
   * @internal
   */
  private _cloneDisplayInfo(display: DisplayInfo | null): DisplayInfo | null {
    if (!display) return null;
    return {
      ...display,
      frame: display.frame ? { ...display.frame } : null,
    };
  }

  /**
   * Assert that a native method exists
   * @internal
   */
  private _assertNativeMethod(methodName: string, featureDescription: string): void {
    if (!this.captureKit || typeof (this.captureKit as any)[methodName] !== 'function') {
      throw new AudioCaptureError(
        `${featureDescription} requires a rebuilt native addon. Reinstall or run "npm install" to compile the latest bindings.`,
        ErrorCode.CAPTURE_FAILED,
        { missingMethod: methodName }
      );
    }
  }
}
