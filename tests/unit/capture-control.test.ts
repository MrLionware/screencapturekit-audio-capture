/**
 * Unit Tests: Capture Control
 *
 * Tests for AudioCapture initialization and capture control:
 * - AudioCapture initialization
 * - Starting and stopping capture
 * - Audio processing (RMS, format conversion, volume threshold)
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeMock } from '../fixtures/mock-native';
import { loadSDKWithMock } from '../helpers/test-utils';
import { MOCK_APPS } from '../fixtures/mock-data';
import type { ApplicationInfo, CaptureStatus } from '../../dist/types';
import type { NativeAudioSample, NativeCaptureConfig } from '../fixtures/mock-native';

test('Capture Control', async (t) => {
  await t.test('Initialization', async (t) => {
    await t.test('should initialize correctly', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      assert.ok(capture instanceof AudioCapture);
      assert.equal((capture as any).capturing, false);
      assert.equal((capture as any).currentProcessId, null);

      // Test activity tracking via public API
      const info = capture.getActivityInfo();
      assert.equal(info.enabled, false, 'Activity tracking should be disabled by default');
      assert.equal(info.trackedApps, 0);
      assert.ok(Array.isArray(info.recentApps));
    });
  });

  await t.test('Start and Stop', async (t) => {
    await t.test('should start capturing with valid app name', () => {
      let capturedCallback: ((sample: NativeAudioSample) => void) | null = null;
      let startCaptureCalledWith: { pid: number; config: NativeCaptureConfig } | null = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(pid: number, config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            startCaptureCalledWith = { pid, config };
            capturedCallback = callback;
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      const success = capture.startCapture('Music Player');
      assert.equal(success, true);
      assert.equal(capture.isCapturing(), true);
      assert.equal((startCaptureCalledWith as { pid: number; config: NativeCaptureConfig } | null)?.pid, 200);
      assert.equal(typeof capturedCallback, 'function');

      capture.stopCapture();
    });

    await t.test('should accept app object directly to bypass lookup', () => {
      let startCaptureCalledWith: { pid: number; config: NativeCaptureConfig } | null = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(pid: number, config: NativeCaptureConfig): boolean {
            startCaptureCalledWith = { pid, config };
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      // Pass app object directly (e.g., from verifyPermissions or selectApp)
      const appObject: ApplicationInfo = { processId: 200, bundleIdentifier: 'com.example.music', applicationName: 'Music Player' };
      const success = capture.startCapture(appObject);

      assert.equal(success, true);
      assert.equal(capture.isCapturing(), true);
      assert.equal((startCaptureCalledWith as { pid: number; config: NativeCaptureConfig } | null)?.pid, 200, 'Should use processId from app object');

      capture.stopCapture();
    });

    await t.test('should fail when already capturing', () => {
      let capturedCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            capturedCallback = callback;
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.startCapture('Music Player');

      let errorEmitted: any = null;
      capture.once('error', (err) => {
        errorEmitted = err;
      });

      assert.throws(() => {
        capture.startCapture('Example App');
      }, (err: any) => {
        assert.equal(err.code, ErrorCodes.ALREADY_CAPTURING);
        return true;
      });

      assert.ok(errorEmitted);
      assert.equal(errorEmitted.code, ErrorCodes.ALREADY_CAPTURING);

      capture.stopCapture();
      void capturedCallback;
    });

    await t.test('should stop capturing', (t: TestContext, done: () => void) => {
      let stopCaptureCalled = false;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(): boolean {
            return true;
          }
          stopCapture(): void {
            stopCaptureCalled = true;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.startCapture('Music Player');

      capture.once('stop', (data: CaptureStatus) => {
        assert.equal(data.processId, 200);
        assert.equal(capture.isCapturing(), false);
        assert.equal(stopCaptureCalled, true);
        done();
      });

      capture.stopCapture();
    });
  });

  await t.test('Audio Processing', async (t) => {
    await t.test('should process RMS and format conversion', (t: TestContext, done: () => void) => {
      let capturedCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            capturedCallback = callback;
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.startCapture('Music Player', {
        format: 'int16',
        minVolume: 0.1
      });

      // Create a mock float buffer
      const floatData = new Float32Array(1024);
      for (let i = 0; i < floatData.length; i++) {
        floatData[i] = 0.5; // constant value
      }
      const buffer = Buffer.from(floatData.buffer);

      const mockSample: NativeAudioSample = {
        data: buffer,
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 1234567890
      };

      capture.once('audio', (sample) => {
        // Verify format conversion
        assert.equal(sample.format, 'int16');
        assert.ok(sample.data instanceof Buffer);
        // Int16 value for 0.5 should be around 16384 (0.5 * 32767)
        const int16View = new Int16Array(sample.data.buffer, sample.data.byteOffset, sample.data.length / 2);
        assert.ok(Math.abs(int16View[0] - 16384) < 5);

        // Verify computed properties
        assert.equal(sample.sampleRate, 48000);
        assert.equal(sample.channels, 2);
        assert.ok(sample.rms > 0);
        assert.ok(sample.peak > 0);
        assert.equal(sample.sampleCount, 1024);
        assert.equal(sample.framesCount, 512);
        assert.ok(Math.abs(sample.durationMs - 10.6667) < 0.01);
        assert.equal(sample.timestamp, 1234567890);

        capture.stopCapture();
        done();
      });

      // Simulate native callback
      (capturedCallback as unknown as (sample: NativeAudioSample) => void)(mockSample);
    });

    await t.test('should filter audio below volume threshold', () => {
      let capturedCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            capturedCallback = callback;
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.startCapture('Music Player', {
        minVolume: 0.8
      }); // High threshold

      let audioEmitted = false;
      const handler = (): void => {
        audioEmitted = true;
      };
      capture.on('audio', handler);

      // Create quiet sample (0.1 amplitude)
      const floatData = new Float32Array(100);
      floatData.fill(0.1);
      const buffer = Buffer.from(floatData.buffer);

      if (capturedCallback) {
        (capturedCallback as (sample: NativeAudioSample) => void)({
          data: buffer,
          sampleRate: 48000,
          channelCount: 2,
          timestamp: 100
        });
      }

      assert.equal(audioEmitted, false, 'Should not emit audio below threshold');

      capture.removeListener('audio', handler);
      capture.stopCapture();
    });
  });
});
