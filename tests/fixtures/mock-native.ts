/**
 * Mock Native Layer Factory
 *
 * Creates configurable mock implementations of the native ScreenCaptureKit addon.
 * This allows tests to simulate various native behaviors without actual hardware.
 */

import type { ApplicationInfo, WindowInfo, DisplayInfo } from '../../dist/core/types';
import { MOCK_APPS, MOCK_WINDOWS, MOCK_DISPLAYS } from './mock-data';

/**
 * Native audio sample structure (from C++ addon)
 */
export interface NativeAudioSample {
  data: Buffer;
  sampleRate: number;
  channelCount: number;
  timestamp: number;
}

/**
 * Native capture configuration
 */
export interface NativeCaptureConfig {
  minVolume?: number;
  format?: string;
  sampleRate?: number;
  channels?: number;
  bufferSize?: number;
  excludeCursor?: boolean;
}

/**
 * Callback for audio samples from native layer
 */
export type NativeAudioCallback = (sample: NativeAudioSample) => void;

/**
 * Interface for any native ScreenCaptureKit implementation (real or mock)
 */
export interface NativeScreenCaptureKitClass {
  new (...args: any[]): any;
}

/**
 * Options for creating native mock
 */
export interface CreateNativeMockOptions {
  apps?: ApplicationInfo[];
  windows?: WindowInfo[];
  displays?: DisplayInfo[];
  onStart?: (info: { pid?: number; windowId?: number; displayId?: number; config: NativeCaptureConfig; type: string }) => void;
  onStop?: () => void;
  captureSupport?: boolean;
}

/**
 * Mock implementation of native ScreenCaptureKit class
 */
export class MockScreenCaptureKit {
  public appStarts: Array<{ pid: number; config: NativeCaptureConfig; callback: NativeAudioCallback }> = [];
  public windowStarts: Array<{ windowId: number; config: NativeCaptureConfig; callback: NativeAudioCallback }> = [];
  public displayStarts: Array<{ displayId: number; config: NativeCaptureConfig; callback: NativeAudioCallback }> = [];

  private readonly _apps: ApplicationInfo[];
  private readonly _windows: WindowInfo[];
  private readonly _displays: DisplayInfo[];
  private readonly _onStart: CreateNativeMockOptions['onStart'];
  private readonly _onStop: CreateNativeMockOptions['onStop'];
  private readonly _captureSupport: boolean;
  protected _capturing: boolean = false;
  protected _activeCallback: NativeAudioCallback | null = null;

  constructor(options: CreateNativeMockOptions = {}) {
    this._apps = options.apps ?? MOCK_APPS.slice(0, 3);
    this._windows = options.windows ?? MOCK_WINDOWS;
    this._displays = options.displays ?? MOCK_DISPLAYS;
    this._onStart = options.onStart;
    this._onStop = options.onStop;
    this._captureSupport = options.captureSupport ?? true;
  }

  getAvailableApps(): ApplicationInfo[] {
    return this._apps;
  }

  getAvailableWindows(): WindowInfo[] {
    if (!this._captureSupport) {
      throw new Error('Window capture not supported');
    }
    return this._windows;
  }

  getAvailableDisplays(): DisplayInfo[] {
    if (!this._captureSupport) {
      throw new Error('Display capture not supported');
    }
    return this._displays;
  }

  startCapture(pid: number, config: NativeCaptureConfig, callback: NativeAudioCallback): boolean {
    if (this._capturing) return false;

    this._capturing = true;
    this._activeCallback = callback;
    this.appStarts.push({ pid, config, callback });

    if (this._onStart) {
      this._onStart({ pid, config, type: 'application' });
    }

    return this._captureSupport;
  }

  startCaptureForWindow(windowId: number, config: NativeCaptureConfig, callback: NativeAudioCallback): boolean {
    if (this._capturing) return false;

    this._capturing = true;
    this._activeCallback = callback;
    this.windowStarts.push({ windowId, config, callback });

    if (this._onStart) {
      this._onStart({ windowId, config, type: 'window' });
    }

    return this._captureSupport;
  }

  startCaptureForDisplay(displayId: number, config: NativeCaptureConfig, callback: NativeAudioCallback): boolean {
    if (this._capturing) return false;

    this._capturing = true;
    this._activeCallback = callback;
    this.displayStarts.push({ displayId, config, callback });

    if (this._onStart) {
      this._onStart({ displayId, config, type: 'display' });
    }

    return this._captureSupport;
  }

  stopCapture(): void {
    this._capturing = false;
    this._activeCallback = null;

    if (this._onStop) {
      this._onStop();
    }
  }

  isCapturing(): boolean {
    return this._capturing;
  }

  // Helper to simulate audio callback
  simulateAudio(data: NativeAudioSample | null = null): void {
    if (this._activeCallback) {
      const audioData = data || this._createDefaultAudioBuffer();
      this._activeCallback(audioData);
    }
  }

  private _createDefaultAudioBuffer(): NativeAudioSample {
    const floatData = new Float32Array(1024);
    floatData.fill(0.5);
    return {
      data: Buffer.from(floatData.buffer),
      sampleRate: 48000,
      channelCount: 2,
      timestamp: Date.now() / 1000
    };
  }
}

/**
 * Create a mock native ScreenCaptureKit implementation
 */
export function createNativeMock(options: CreateNativeMockOptions = {}): { ScreenCaptureKit: typeof MockScreenCaptureKit } {
  return {
    ScreenCaptureKit: class extends MockScreenCaptureKit {
      constructor() {
        super(options);
      }
    }
  };
}

/**
 * Create a minimal mock (for simple tests)
 */
export function createMinimalMock(apps: ApplicationInfo[] = MOCK_APPS.slice(0, 1)): { ScreenCaptureKit: typeof MockScreenCaptureKit } {
  return createNativeMock({ apps });
}

/**
 * Create a mock that simulates permission denial
 */
export function createPermissionDeniedMock(): { ScreenCaptureKit: typeof MockScreenCaptureKit } {
  return createNativeMock({ apps: [] });
}

/**
 * Create a mock that simulates feature not supported
 */
export function createUnsupportedFeatureMock(): { ScreenCaptureKit: typeof MockScreenCaptureKit } {
  return createNativeMock({ captureSupport: false });
}
