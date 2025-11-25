/**
 * Unit Tests: Permission Verification
 *
 * Tests for screen recording permission verification:
 * - verifyPermissions() when denied (no apps returned)
 * - verifyPermissions() when granted (apps returned)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSDKWithMock } from '../helpers/test-utils';
import { MOCK_APPS } from '../fixtures/mock-data';
import type { ApplicationInfo } from '../../dist/types';

test('Permission Verification', async (t) => {
  await t.test('Permission Denied', async (t) => {
    await t.test('should report denied when no apps found', () => {
      // Mock scenario where no apps are returned (permission denied)
      const mockNativeDenied = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return [];
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNativeDenied });
      const status = AudioCapture.verifyPermissions();
      assert.equal(status.granted, false);
      assert.ok(status.message.includes('permission is not granted'));
      assert.ok(status.remediation);
    });
  });

  await t.test('Permission Granted', async (t) => {
    await t.test('should report granted when apps found', () => {
      // Mock scenario where apps are found (permission granted)
      const mockNativeGranted = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNativeGranted });
      const status = AudioCapture.verifyPermissions();
      assert.equal(status.granted, true);
      assert.equal(status.availableApps, 3);
    });

    await t.test('should return apps list for reuse to avoid redundant calls', () => {
      const mockNativeGranted = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNativeGranted });
      const status = AudioCapture.verifyPermissions();
      assert.equal(status.granted, true);
      assert.ok(Array.isArray(status.apps), 'Should return apps array');
      assert.equal(status.apps!.length, 3);
      assert.equal(status.apps![0].processId, 100);
      assert.equal(status.apps![0].applicationName, 'Example App');
    });
  });

  await t.test('From AudioCapture Utilities', async (t) => {
    await t.test('should verify permissions successfully', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return MOCK_APPS;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const status = AudioCapture.verifyPermissions();
      assert.equal(status.granted, true);
      assert.equal(typeof status.message, 'string');
      assert.equal(status.availableApps, 3);
    });

    await t.test('should return false when no apps found', () => {
      const mockNativeEmpty = {
        ScreenCaptureKit: class {
          getAvailableApps(): ApplicationInfo[] {
            return [];
          }
        }
      };

      const { AudioCapture: AudioCaptureEmpty } = loadSDKWithMock({ nativeMock: mockNativeEmpty });
      const status = AudioCaptureEmpty.verifyPermissions();
      assert.equal(status.granted, false);
      assert.ok(status.remediation);
    });
  });
});
