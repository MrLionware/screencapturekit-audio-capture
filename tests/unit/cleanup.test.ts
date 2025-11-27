/**
 * Unit Tests: Cleanup & Lifecycle
 *
 * Tests for graceful cleanup and resource management:
 * - dispose() method
 * - isDisposed() method
 * - AudioCapture.cleanupAll() static method
 * - AudioCapture.getActiveInstanceCount() static method
 * - Disposed instance protection
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeMock } from '../fixtures/mock-native';
import { loadSDKWithMock } from '../helpers/test-utils';
import { MOCK_APPS } from '../fixtures/mock-data';
import type { ApplicationInfo } from '../../dist/core/types';

test('Cleanup & Lifecycle', async (t) => {
  await t.test('Instance Tracking', async (t) => {
    await t.test('should track active instances', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

      const initialCount = AudioCapture.getActiveInstanceCount();

      const capture1 = new AudioCapture();
      assert.equal(AudioCapture.getActiveInstanceCount(), initialCount + 1);

      const capture2 = new AudioCapture();
      assert.equal(AudioCapture.getActiveInstanceCount(), initialCount + 2);

      // Cleanup
      capture1.dispose();
      capture2.dispose();
    });
  });

  await t.test('dispose()', async (t) => {
    await t.test('should mark instance as disposed', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      assert.equal(capture.isDisposed(), false);
      capture.dispose();
      assert.equal(capture.isDisposed(), true);
    });

    await t.test('should be idempotent (safe to call multiple times)', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.dispose();
      capture.dispose();
      capture.dispose();

      assert.equal(capture.isDisposed(), true);
    });

    await t.test('should stop active capture when disposed', () => {
      let stopCalled = false;
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(): boolean {
            return true;
          }
          stopCapture(): void {
            stopCalled = true;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.startCapture('Music Player');
      assert.equal(capture.isCapturing(), true);

      capture.dispose();
      assert.equal(stopCalled, true, 'stopCapture should be called');
      assert.equal(capture.isDisposed(), true);
    });

    await t.test('should remove instance from active tracking', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

      const countBefore = AudioCapture.getActiveInstanceCount();
      const capture = new AudioCapture();
      assert.equal(AudioCapture.getActiveInstanceCount(), countBefore + 1);

      capture.dispose();
      assert.equal(AudioCapture.getActiveInstanceCount(), countBefore);
    });
  });

  await t.test('Disposed Instance Protection', async (t) => {
    await t.test('should throw when startCapture called on disposed instance', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.dispose();

      assert.throws(() => {
        capture.startCapture('Music Player');
      }, /disposed/i);
    });

    await t.test('should throw when captureWindow called on disposed instance', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.dispose();

      assert.throws(() => {
        capture.captureWindow(1000);
      }, /disposed/i);
    });

    await t.test('should throw when captureDisplay called on disposed instance', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      capture.dispose();

      assert.throws(() => {
        capture.captureDisplay(77);
      }, /disposed/i);
    });
  });

  await t.test('cleanupAll()', async (t) => {
    await t.test('should dispose all active instances', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

      // Clear any existing instances first
      AudioCapture.cleanupAll();

      const capture1 = new AudioCapture();
      const capture2 = new AudioCapture();
      const capture3 = new AudioCapture();

      assert.equal(AudioCapture.getActiveInstanceCount(), 3);

      const cleanedCount = AudioCapture.cleanupAll();
      assert.equal(cleanedCount, 3);
      assert.equal(AudioCapture.getActiveInstanceCount(), 0);

      assert.equal(capture1.isDisposed(), true);
      assert.equal(capture2.isDisposed(), true);
      assert.equal(capture3.isDisposed(), true);
    });

    await t.test('should return 0 when no active instances', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

      // Ensure no instances
      AudioCapture.cleanupAll();

      const cleanedCount = AudioCapture.cleanupAll();
      assert.equal(cleanedCount, 0);
    });

    await t.test('should stop active captures during cleanup', () => {
      let stopCallCount = 0;
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
          startCapture(): boolean {
            return true;
          }
          stopCapture(): void {
            stopCallCount++;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

      // Clear any existing instances
      AudioCapture.cleanupAll();
      stopCallCount = 0;

      const capture1 = new AudioCapture();
      const capture2 = new AudioCapture();

      capture1.startCapture('Music Player');
      capture2.startCapture('Example App');

      AudioCapture.cleanupAll();

      assert.equal(stopCallCount, 2, 'Both captures should be stopped');
    });
  });

  await t.test('getActiveInstanceCount()', async (t) => {
    await t.test('should return correct count', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

      // Start fresh
      AudioCapture.cleanupAll();
      assert.equal(AudioCapture.getActiveInstanceCount(), 0);

      const capture1 = new AudioCapture();
      assert.equal(AudioCapture.getActiveInstanceCount(), 1);

      const capture2 = new AudioCapture();
      assert.equal(AudioCapture.getActiveInstanceCount(), 2);

      capture1.dispose();
      assert.equal(AudioCapture.getActiveInstanceCount(), 1);

      capture2.dispose();
      assert.equal(AudioCapture.getActiveInstanceCount(), 0);
    });
  });
});
