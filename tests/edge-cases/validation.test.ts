/**
 * Edge Case Tests: Configuration Validation
 *
 * Tests for handling edge cases in configuration:
 * - Extreme/invalid minVolume values
 * - Extreme sample rates
 * - Invalid format strings
 * - Extreme buffer sizes
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSDKWithMock } from '../helpers/test-utils';
import type { ApplicationInfo } from '../../dist/core/types';
import type { NativeCaptureConfig } from '../fixtures/mock-native';

const MOCK_APPS: ApplicationInfo[] = [
  { processId: 100, bundleIdentifier: 'com.example.app', applicationName: 'Example App' }
];

test('Configuration Validation', async (t) => {
  const mockNative = {
    ScreenCaptureKit: class {
      public lastConfig: NativeCaptureConfig | undefined;
      getAvailableApps(): ApplicationInfo[] { return MOCK_APPS; }
      startCapture(_pid: number, config: NativeCaptureConfig): boolean {
        this.lastConfig = config;
        return true;
      }
      stopCapture(): void { }
    }
  };

  const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('should handle negative minVolume gracefully', () => {
    const capture = new AudioCapture();
    capture.startCapture(100, { minVolume: -0.5 });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();
  });

  await t.test('should handle minVolume > 1.0 gracefully', () => {
    const capture = new AudioCapture();
    capture.startCapture(100, { minVolume: 2.0 });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();
  });

  await t.test('should handle extreme sample rates', () => {
    const capture = new AudioCapture();

    // Very low sample rate
    capture.startCapture(100, { sampleRate: 8000 });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();

    // Very high sample rate
    capture.startCapture(100, { sampleRate: 192000 });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();
  });

  await t.test('should handle invalid format strings', () => {
    const capture = new AudioCapture();
    capture.startCapture(100, { format: 'invalid' as any });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();
  });

  await t.test('should handle extreme buffer sizes', () => {
    const capture = new AudioCapture();

    // Very small buffer
    capture.startCapture(100, { bufferSize: 64 });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();

    // Very large buffer
    capture.startCapture(100, { bufferSize: 65536 });
    assert.equal(capture.isCapturing(), true);
    capture.stopCapture();
  });
});
