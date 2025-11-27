/**
 * Integration Tests: Window and Display Selection
 *
 * Tests for window and display capture functionality:
 * - Window discovery and filtering
 * - Display discovery
 * - Window capture with metadata
 * - Display capture with metadata
 * - Real-world scenarios (sequential discovery, switching targets, etc.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSDKWithMock } from '../helpers/test-utils';
import { createNativeMock, MockScreenCaptureKit } from '../fixtures/mock-native';
import type { ApplicationInfo, CaptureStatus } from '../../dist/core/types';

const MOCK_APPS: ApplicationInfo[] = [
  { processId: 100, bundleIdentifier: 'com.example.app', applicationName: 'Example App' },
  { processId: 200, bundleIdentifier: 'com.music.player', applicationName: 'Music Player' },
  { processId: 300, bundleIdentifier: 'com.apple.finder', applicationName: 'Finder' },
];

const MOCK_WINDOWS = [
  {
    windowId: 1000, layer: 0,
    frame: { x: 0, y: 0, width: 800, height: 600 },
    title: 'Example App – Main', onScreen: true, active: true,
    owningProcessId: 100, owningApplicationName: 'Example App',
    owningBundleIdentifier: 'com.example.app'
  },
  {
    windowId: 2000, layer: 0,
    frame: { x: 50, y: 50, width: 640, height: 480 },
    title: '', onScreen: true, active: false,
    owningProcessId: 200, owningApplicationName: 'Music Player',
    owningBundleIdentifier: 'com.music.player'
  },
  {
    windowId: 3000, layer: 0,
    frame: { x: 100, y: 100, width: 500, height: 400 },
    title: 'Offscreen Window', onScreen: false, active: false,
    owningProcessId: 0, owningApplicationName: '',
    owningBundleIdentifier: ''
  }
] as any[];

const MOCK_DISPLAYS = [
  {
    displayId: 77,
    frame: { x: 0, y: 0, width: 1440, height: 900 },
    width: 1440, height: 900, isMainDisplay: true
  },
  {
    displayId: 88,
    frame: { x: 1440, y: 0, width: 1920, height: 1080 },
    width: 1920, height: 1080, isMainDisplay: false
  }
] as any[];

test('Window and Display Selection', async (t) => {
  let lastNativeInstance: (MockScreenCaptureKit & { windowStarts: any[]; displayStarts: any[]; appStarts: any[] }) | null = null;

  const baseMock = createNativeMock({ apps: MOCK_APPS, windows: MOCK_WINDOWS, displays: MOCK_DISPLAYS });
  const mockNative = {
    ScreenCaptureKit: class extends baseMock.ScreenCaptureKit {
      constructor() {
        super();
        lastNativeInstance = this;
      }
      override stopCapture(): void {
        super.stopCapture();
        this.windowStarts = [];
        this.displayStarts = [];
        this.appStarts = [];
      }
    }
  };

  const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('should support window filtering options', () => {
    const capture = new AudioCapture();

    const all = capture.getWindows();
    assert.equal(all.length, MOCK_WINDOWS.length);

    const onScreen = capture.getWindows({ onScreenOnly: true });
    assert.ok(onScreen.every(window => window.onScreen));
    assert.ok(!onScreen.find(window => !window.onScreen));

    const titled = capture.getWindows({ requireTitle: true });
    assert.ok(titled.every(window => window.title && window.title.trim().length > 0));

    const byProcess = capture.getWindows({ processId: 100 });
    assert.equal(byProcess.length, 1);
    assert.equal(byProcess[0].windowId, 1000);
  });

  await t.test('should return native displays', () => {
    const capture = new AudioCapture();
    const displays = capture.getDisplays();
    assert.deepEqual(displays, MOCK_DISPLAYS);
  });

  await t.test('should start window capture and emit metadata', async () => {
    const capture = new AudioCapture();
    const targetWindow = capture.getWindows({ onScreenOnly: true, requireTitle: true })[0];
    const nativeInstance = lastNativeInstance;

    const startPromise = new Promise<void>((resolve) => {
      capture.once('start', (info: CaptureStatus) => {
        assert.equal(info.targetType, 'window');
        assert.equal(info.window!.windowId, targetWindow.windowId);
        assert.equal(info.app!.processId, targetWindow.owningProcessId);
        resolve();
      });
    });

    const success = capture.captureWindow(targetWindow.windowId, { channels: 1 });
    assert.equal(success, true);
    assert.ok(nativeInstance);
    assert.equal(nativeInstance!.windowStarts.length, 1);
    assert.equal(nativeInstance!.windowStarts[0].windowId, targetWindow.windowId);
    assert.equal(nativeInstance!.windowStarts[0].config.channels, 1);

    const status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'window');
    assert.equal(status.window!.windowId, targetWindow.windowId);
    assert.equal(status.processId, targetWindow.owningProcessId);

    await startPromise;

    const stopPromise = new Promise<void>((resolve) => {
      capture.once('stop', (info: CaptureStatus) => {
        assert.equal(info.targetType, 'window');
        assert.equal(info.window!.windowId, targetWindow.windowId);
        resolve();
      });
    });

    capture.stopCapture();
    await stopPromise;
  });

  await t.test('should throw when window not found', () => {
    const capture = new AudioCapture();
    assert.throws(() => capture.captureWindow(99999), (err: any) => {
      assert.equal(err.code, ErrorCodes.INVALID_ARGUMENT);
      return true;
    });
  });

  await t.test('should validate windowId argument type', () => {
    const capture = new AudioCapture();
    assert.throws(() => capture.captureWindow('not-a-number' as any), (err: any) => {
      assert.equal(err.code, ErrorCodes.INVALID_ARGUMENT);
      assert.equal(err.details.receivedType, 'string');
      return true;
    });
  });

  await t.test('should start display capture and emit metadata', async () => {
    const capture = new AudioCapture();
    const display = capture.getDisplays()[0];
    const nativeInstance = lastNativeInstance;

    const startPromise = new Promise<void>((resolve) => {
      capture.once('start', (info: CaptureStatus) => {
        assert.equal(info.targetType, 'display');
        assert.equal(info.display!.displayId, display.displayId);
        assert.equal(info.processId, null);
        resolve();
      });
    });

    const success = capture.captureDisplay(display.displayId, { sampleRate: 44100 });
    assert.equal(success, true);

    assert.ok(nativeInstance);
    assert.equal(nativeInstance!.displayStarts.length, 1);
    assert.equal(nativeInstance!.displayStarts[0].displayId, display.displayId);
    assert.equal(nativeInstance!.displayStarts[0].config.sampleRate, 44100);

    const status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'display');
    assert.equal(status.display!.displayId, display.displayId);
    assert.equal(status.processId, null);

    await startPromise;

    const stopPromise = new Promise<void>((resolve) => {
      capture.once('stop', (info: CaptureStatus) => {
        assert.equal(info.targetType, 'display');
        assert.equal(info.display!.displayId, display.displayId);
        resolve();
      });
    });

    capture.stopCapture();
    await stopPromise;
  });

  await t.test('should report display metadata', () => {
    const capture = new AudioCapture();
    const display = capture.getDisplays()[0];
    capture.captureDisplay(display.displayId, { channels: 2 });

    const info = capture.getCurrentCapture()!;
    assert.ok(info);
    assert.equal(info.targetType, 'display');
    assert.equal(info.display!.displayId, display.displayId);
    assert.equal(info.app, null);

    capture.stopCapture();
  });

  await t.test('should throw when display not found', () => {
    const capture = new AudioCapture();
    assert.throws(() => capture.captureDisplay(123456), (err: any) => {
      assert.equal(err.code, ErrorCodes.INVALID_ARGUMENT);
      return true;
    });
  });

  await t.test('should validate displayId argument type', () => {
    const capture = new AudioCapture();
    assert.throws(() => capture.captureDisplay('display' as any), (err: any) => {
      assert.equal(err.code, ErrorCodes.INVALID_ARGUMENT);
      assert.equal(err.details.receivedType, 'string');
      return true;
    });
  });
});

test('Real-world Window and Display Scenarios', async (t) => {
  let lastNativeInstance: (MockScreenCaptureKit & { _capturing: boolean; _activeCallback: any; simulateAudio: () => void }) | null = null;
  let getAvailableCallCount = 0;

  const baseMock = createNativeMock({ apps: MOCK_APPS, windows: MOCK_WINDOWS, displays: MOCK_DISPLAYS });
  const mockNative = {
    ScreenCaptureKit: class extends baseMock.ScreenCaptureKit {
      protected override _capturing = false;
      protected override _activeCallback: ((sample: any) => void) | null = null;

      constructor() {
        super();
        lastNativeInstance = this as any;
      }

      override getAvailableApps() {
        getAvailableCallCount++;
        return super.getAvailableApps();
      }

      override getAvailableWindows() {
        getAvailableCallCount++;
        return super.getAvailableWindows();
      }

      override getAvailableDisplays() {
        getAvailableCallCount++;
        return super.getAvailableDisplays();
      }

      override startCapture(pid: number, config: any, callback: (sample: any) => void): boolean {
        if (this._capturing) return false;
        this._capturing = true;
        this._activeCallback = callback;
        this.appStarts.push({ pid, config, callback });
        return true;
      }

      override startCaptureForWindow(windowId: number, config: any, callback: (sample: any) => void): boolean {
        if (this._capturing) return false;
        this._capturing = true;
        this._activeCallback = callback;
        this.windowStarts.push({ windowId, config, callback });
        return true;
      }

      override startCaptureForDisplay(displayId: number, config: any, callback: (sample: any) => void): boolean {
        if (this._capturing) return false;
        this._capturing = true;
        this._activeCallback = callback;
        this.displayStarts.push({ displayId, config, callback });
        return true;
      }

      override stopCapture(): void {
        this._capturing = false;
        this._activeCallback = null;
      }

      override isCapturing(): boolean {
        return this._capturing;
      }

      // Helper to simulate audio callback
      override simulateAudio(): void {
        if (this._activeCallback) {
          const floatData = new Float32Array(1024);
          floatData.fill(0.5);
          const buffer = Buffer.from(floatData.buffer);
          this._activeCallback({
            data: buffer,
            sampleRate: 48000,
            channelCount: 2,
            timestamp: Date.now() / 1000
          });
        }
      }
    }
  };

  const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('should avoid concurrent SCShareableContent calls', async () => {
    const capture = new AudioCapture();
    getAvailableCallCount = 0;

    const apps = capture.getApplications();
    assert.ok(apps.length > 0);
    const appsCallCount = getAvailableCallCount;

    const windows = capture.getWindows();
    assert.ok(windows.length > 0);
    const windowsCallCount = getAvailableCallCount - appsCallCount;

    const displays = capture.getDisplays();
    assert.ok(displays.length > 0);
    const displaysCallCount = getAvailableCallCount - appsCallCount - windowsCallCount;

    assert.equal(appsCallCount, 1, 'Apps call should happen once');
    assert.equal(windowsCallCount, 1, 'Windows call should happen once');
    assert.equal(displaysCallCount, 1, 'Displays call should happen once');
  });

  await t.test('should discover active app window and capture it', async () => {
    const capture = new AudioCapture();

    const apps = capture.getApplications();
    const exampleApp = apps.find(app => app.applicationName === 'Example App');
    assert.ok(exampleApp, 'Should find Example App');

    const appWindows = capture.getWindows({ processId: exampleApp.processId });
    assert.equal(appWindows.length, 1, 'Example App should have 1 window');
    const targetWindow = appWindows[0];

    const audioReceived: any[] = [];
    capture.on('audio', (sample) => audioReceived.push(sample));

    const success = capture.captureWindow(targetWindow.windowId, {
      format: 'int16',
      channels: 2,
      minVolume: 0.01
    });
    assert.equal(success, true);

    lastNativeInstance?.simulateAudio();
    assert.equal(audioReceived.length, 1);
    assert.equal(audioReceived[0].format, 'int16');
    assert.equal(audioReceived[0].channels, 2);

    const status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'window');
    assert.equal(status.window!.windowId, targetWindow.windowId);
    assert.equal(status.app!.processId, exampleApp.processId);

    capture.stopCapture();
  });

  await t.test('should capture specific display in multi-display scenario', async () => {
    const capture = new AudioCapture();

    const displays = capture.getDisplays();
    assert.equal(displays.length, 2, 'Should have 2 mock displays');

    const secondaryDisplay = displays.find(d => !d.isMainDisplay);
    assert.ok(secondaryDisplay, 'Should find secondary display');
    assert.equal(secondaryDisplay!.displayId, 88);

    const audioReceived: any[] = [];
    capture.on('audio', (sample) => audioReceived.push(sample));

    const success = capture.captureDisplay(secondaryDisplay!.displayId, {
      format: 'float32',
      sampleRate: 48000
    });
    assert.equal(success, true);

    lastNativeInstance?.simulateAudio();
    assert.equal(audioReceived.length, 1);
    assert.equal(audioReceived[0].format, 'float32');

    const status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'display');
    assert.equal(status.display!.displayId, secondaryDisplay!.displayId);
    assert.equal(status.processId, null, 'Display capture should have null processId');
    assert.equal(status.app, null, 'Display capture should have null app');

    capture.stopCapture();
  });

  await t.test('should find on-screen titled windows only', async () => {
    const capture = new AudioCapture();

    const visibleWindows = capture.getWindows({
      onScreenOnly: true,
      requireTitle: true
    });

    // Should exclude window 2000 (no title) and window 3000 (offscreen)
    assert.equal(visibleWindows.length, 1);
    assert.equal(visibleWindows[0].windowId, 1000);
    assert.ok(visibleWindows[0].onScreen);
    assert.ok(visibleWindows[0].title.length > 0);
  });

  await t.test('should switch between capture targets sequentially', async () => {
    const capture = new AudioCapture();

    // Start with app capture
    const app = capture.getApplications()[0];
    capture.startCapture(app.processId);
    assert.equal(capture.isCapturing(), true);
    let status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'application');
    assert.equal(status.processId, app.processId);

    // Stop and switch to window capture
    capture.stopCapture();
    assert.equal(capture.isCapturing(), false);

    const window = capture.getWindows({ onScreenOnly: true })[0];
    capture.captureWindow(window.windowId);
    status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'window');
    assert.equal(status.window!.windowId, window.windowId);

    // Stop and switch to display capture
    capture.stopCapture();

    const display = capture.getDisplays()[0];
    capture.captureDisplay(display.displayId);
    status = capture.getStatus() as CaptureStatus;
    assert.equal(status.targetType, 'display');
    assert.equal(status.display!.displayId, display.displayId);

    capture.stopCapture();
  });

  await t.test('should prevent concurrent captures', async () => {
    const capture = new AudioCapture();

    // Start window capture
    const window = capture.getWindows()[0];
    capture.captureWindow(window.windowId);
    assert.equal(capture.isCapturing(), true);

    // Try to start display capture while window capture is active
    const display = capture.getDisplays()[0];
    assert.throws(() => {
      capture.captureDisplay(display.displayId);
    }, (err: any) => {
      assert.equal(err.code, ErrorCodes.ALREADY_CAPTURING);
      assert.equal(err.details.currentTarget.targetType, 'window');
      return true;
    });

    // Try to start app capture while window capture is active
    assert.throws(() => {
      capture.startCapture(100);
    }, (err: any) => {
      assert.equal(err.code, ErrorCodes.ALREADY_CAPTURING);
      return true;
    });

    capture.stopCapture();
  });

  await t.test('should process audio across all capture types', async () => {
    const capture = new AudioCapture();
    const receivedSamples: Record<string, any[]> = {
      application: [],
      window: [],
      display: []
    };

    capture.on('audio', (sample) => {
      const status = capture.getStatus() as CaptureStatus;
      receivedSamples[status.targetType].push(sample);
    });

    // Test application capture
    const app = capture.getApplications()[0];
    capture.startCapture(app.processId, { minVolume: 0.1 });
    lastNativeInstance?.simulateAudio();
    capture.stopCapture();

    // Test window capture
    const window = capture.getWindows({ onScreenOnly: true })[0];
    capture.captureWindow(window.windowId, { minVolume: 0.1 });
    lastNativeInstance?.simulateAudio();
    capture.stopCapture();

    // Test display capture
    const display = capture.getDisplays()[0];
    capture.captureDisplay(display.displayId, { minVolume: 0.1 });
    lastNativeInstance?.simulateAudio();
    capture.stopCapture();

    // Verify all received audio
    assert.equal(receivedSamples.application.length, 1);
    assert.equal(receivedSamples.window.length, 1);
    assert.equal(receivedSamples.display.length, 1);

    // Verify audio properties are consistent
    for (const samples of Object.values(receivedSamples)) {
      assert.ok(samples[0].data instanceof Buffer);
      assert.equal(samples[0].sampleRate, 48000);
      assert.ok(samples[0].rms > 0);
      assert.ok(samples[0].peak > 0);
    }
  });

  await t.test('should handle real-world browser window capture workflow', async () => {
    const capture = new AudioCapture();

    // Search for a specific app
    const app = capture.findApplication('Music Player');
    assert.ok(app, 'Should find Music Player');

    // Get all windows for that app
    const windows = capture.getWindows({ processId: app!.processId });
    assert.ok(windows.length > 0, 'App should have windows');

    // Find active, on-screen window
    const activeWindow = windows.find(w => w.onScreen);
    assert.ok(activeWindow, 'Should have on-screen window');

    // Start capture
    const audioSamples: any[] = [];
    capture.on('audio', (sample) => audioSamples.push(sample));

    capture.captureWindow(activeWindow!.windowId, {
      format: 'int16',
      channels: 2,
      minVolume: 0.05
    });

    // Simulate receiving audio
    lastNativeInstance?.simulateAudio();

    // Verify results
    assert.equal(audioSamples.length, 1);
    const sample = audioSamples[0];
    assert.equal(sample.format, 'int16');
    assert.equal(sample.channels, 2);
    assert.ok(sample.rms >= 0.05, 'RMS should exceed minVolume threshold');

    // Get current capture info
    const currentCapture = capture.getCurrentCapture()!;
    assert.equal(currentCapture.targetType, 'window');
    assert.equal(currentCapture.window!.windowId, activeWindow!.windowId);
    assert.equal(currentCapture.app!.applicationName, 'Music Player');

    capture.stopCapture();
  });
});
