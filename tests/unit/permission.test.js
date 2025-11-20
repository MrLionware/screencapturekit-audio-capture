/**
 * Unit Tests: Permission Verification
 *
 * Tests for screen recording permission verification:
 * - verifyPermissions() when denied (no apps returned)
 * - verifyPermissions() when granted (apps returned)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSDKWithMock } = require('../helpers/test-utils');
const { MOCK_APPS } = require('../fixtures/mock-data');

test('Permission Verification', async (t) => {
  await t.test('Permission Denied', async (t) => {
    await t.test('should report denied when no apps found', () => {
      // Mock scenario where no apps are returned (permission denied)
      const mockNativeDenied = {
        ScreenCaptureKit: class {
          getAvailableApps() {
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
          getAvailableApps() {
            return MOCK_APPS;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNativeGranted });
      const status = AudioCapture.verifyPermissions();
      assert.equal(status.granted, true);
      assert.equal(status.availableApps, 3);
    });
  });

  await t.test('From AudioCapture Utilities', async (t) => {
    await t.test('should verify permissions successfully', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
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
          getAvailableApps() {
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
