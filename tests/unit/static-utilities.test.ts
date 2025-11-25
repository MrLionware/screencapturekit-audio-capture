/**
 * Unit Tests: Static Utilities
 *
 * Tests for AudioCapture static utility methods:
 * - Buffer conversions (bufferToFloat32Array)
 * - Audio level conversions (rmsToDb, peakToDb)
 * - WAV file generation (writeWav)
 * - Utility methods (selectApp, getStatus, etc.)
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { loadSDKWithMock } from '../helpers/test-utils';
import { MOCK_APPS } from '../fixtures/mock-data';
import type { ApplicationInfo, CaptureStatus } from '../../dist/types';
import type { NativeCaptureConfig, NativeAudioSample } from '../fixtures/mock-native';

test('Static Utilities', async (t) => {
  await t.test('bufferToFloat32Array', async (t) => {
    await t.test('should convert buffer to Float32Array', () => {
      const { AudioCapture } = loadSDKWithMock();
      const floatData = new Float32Array([0.5, -0.5, 0.0]);
      const buffer = Buffer.from(floatData.buffer);

      const result = AudioCapture.bufferToFloat32Array(buffer);
      assert.deepEqual(result, floatData);
    });
  });

  await t.test('Audio Level Conversions', async (t) => {
    await t.test('should calculate decibels from RMS/peak', () => {
      const { AudioCapture } = loadSDKWithMock();

      // 1.0 -> 0 dB
      assert.equal(AudioCapture.rmsToDb(1.0), 0);
      // 0.5 -> ~-6 dB
      assert.ok(Math.abs(AudioCapture.rmsToDb(0.5) - (-6.02)) < 0.01);
      // 0 -> -Infinity
      assert.equal(AudioCapture.rmsToDb(0), -Infinity);
    });
  });

  await t.test('WAV File Generation', async (t) => {
    await t.test('should create valid WAV header', () => {
      const { AudioCapture } = loadSDKWithMock();
      const floatData = new Float32Array(100);
      const buffer = Buffer.from(floatData.buffer);

      const wav = AudioCapture.writeWav(buffer, {
        sampleRate: 48000,
        channels: 2,
        format: 'float32'
      });

      // Check RIFF header
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
      assert.equal(wav.toString('ascii', 12, 16), 'fmt ');

      // Check sample rate (offset 24, 4 bytes)
      assert.equal(wav.readUInt32LE(24), 48000);

      // Check channels (offset 22, 2 bytes)
      assert.equal(wav.readUInt16LE(22), 2);
    });
  });
});

test('AudioCapture Utilities', async (t) => {
  const mockNative = {
    ScreenCaptureKit: class {
      getAvailableApps(): ApplicationInfo[] {
        return MOCK_APPS;
      }
      startCapture(): boolean {
        return true;
      }
      stopCapture(): void { }
      getAvailableWindows(): any[] {
        return [];
      }
      getAvailableDisplays(): any[] {
        return [];
      }
    }
  };

  const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('selectApp', async (t) => {
    const capture = new AudioCapture();

    await t.test('should find app by exact name', () => {
      const app = capture.selectApp('Music Player');
      assert.equal(app!.processId, 200);
    });

    await t.test('should find app by PID', () => {
      const app = capture.selectApp(100);
      assert.equal(app!.applicationName, 'Example App');
    });

    await t.test('should try multiple identifiers', () => {
      // First one doesn't exist, second one does
      const app = capture.selectApp(['NonExistent', 'Music Player']);
      assert.equal(app!.processId, 200);
    });

    await t.test('should fallback to first audio app when no args', () => {
      const app = capture.selectApp();
      // Should be Example App (first one)
      assert.equal(app!.processId, 100);
    });

    await t.test('should filter system apps by default', () => {
      const audioApps = capture.getAudioApps();
      assert.ok(!audioApps.find(a => a.applicationName === 'Finder'));

      const app = capture.selectApp('Finder');
      assert.equal(app, null);
    });

    await t.test('should find system apps when audioOnly=false', () => {
      const app = capture.selectApp('Finder', {
        audioOnly: false
      });
      assert.equal(app!.applicationName, 'Finder');
    });

    await t.test('should throw when throwOnNotFound is true', () => {
      assert.throws(() => {
        capture.selectApp('NonExistent', {
          throwOnNotFound: true
        });
      }, (err: any) => {
        assert.equal(err.code, ErrorCodes.APP_NOT_FOUND);
        return true;
      });
    });
  });

  await t.test('Error Handling', async (t) => {
    await t.test('should throw helpful error when app missing', () => {
      const capture = new AudioCapture();
      const errors: any[] = [];
      capture.on('error', (err) => errors.push(err));

      assert.throws(() => {
        capture.startCapture('Nonexistent App');
      }, (err: any) => {
        assert.equal(err.code, ErrorCodes.APP_NOT_FOUND);
        assert.ok(Array.isArray(err.details.availableApps));
        assert.ok(err.details.availableApps.includes('Example App'));
        return true;
      });

      assert.equal(errors.length, 1);
      assert.equal(errors[0].code, ErrorCodes.APP_NOT_FOUND);
    });
  });

  await t.test('Status Management', async (t) => {
    await t.test('should return null when not capturing', () => {
      const capture = new AudioCapture();
      assert.equal(capture.getStatus(), null);
    });

    await t.test('should return status when capturing', () => {
      const capture = new AudioCapture();

      // Start capture
      capture.startCapture('Example App', {
        format: 'int16',
        channels: 1
      });

      const status = capture.getStatus() as CaptureStatus;
      assert.ok(status);
      assert.equal(status.capturing, true);
      assert.equal(status.app!.applicationName, 'Example App');
      assert.equal(status.config.format, 'int16');
      assert.equal(status.config.minVolume, 0);

      capture.stopCapture();
      assert.equal(capture.getStatus(), null);
    });
  });

  await t.test('Native Config Propagation', async (t) => {
    await t.test('should pass config to native layer', (t: TestContext, done: () => void) => {
      let nativeConfigReceived: NativeCaptureConfig | null = null;
      const mockNativeSpy = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(_pid: number, config: NativeCaptureConfig, _callback: (sample: NativeAudioSample) => void): boolean {
            nativeConfigReceived = config;
            return true;
          }
        }
      };

      const { AudioCapture: AudioCaptureSpy } = loadSDKWithMock({ nativeMock: mockNativeSpy });
      const capture = new AudioCaptureSpy();

      capture.startCapture('Example App', {
        sampleRate: 44100,
        channels: 1,
        bufferSize: 2048,
        excludeCursor: false
      });

      assert.ok(nativeConfigReceived);
      assert.equal(nativeConfigReceived!.sampleRate, 44100);
      assert.equal(nativeConfigReceived!.channels, 1);
      assert.equal(nativeConfigReceived!.bufferSize, 2048);
      assert.equal(nativeConfigReceived!.excludeCursor, false);
      done();
    });
  });
});
