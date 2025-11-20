/**
 * Integration Tests: Native Capability Guards
 *
 * Tests for detecting and handling missing native methods:
 * - getWindows when getAvailableWindows missing
 * - getDisplays when getAvailableDisplays missing
 * - captureWindow when startCaptureForWindow missing
 * - captureDisplay when startCaptureForDisplay missing
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSDKWithMock } = require('../helpers/test-utils');

const MOCK_APPS = [
  { processId: 100, bundleIdentifier: 'com.example.app', applicationName: 'Example App' },
  { processId: 200, bundleIdentifier: 'com.music.player', applicationName: 'Music Player' },
  { processId: 300, bundleIdentifier: 'com.apple.finder', applicationName: 'Finder' },
];

test('Native Capability Guards', async (t) => {
  const mockNative = {
    ScreenCaptureKit: class {
      constructor() {
        this.startCaptureCalls = [];
      }
      getAvailableApps() {
        return MOCK_APPS;
      }
    }
  };

  const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('should throw when getAvailableWindows missing', () => {
    const capture = new AudioCapture();
    delete capture.captureKit.getAvailableWindows;
    assert.throws(() => capture.getWindows(), (err) => {
      assert.equal(err.code, ErrorCodes.CAPTURE_FAILED);
      assert.equal(err.details.missingMethod, 'getAvailableWindows');
      return true;
    });
  });

  await t.test('should throw when getAvailableDisplays missing', () => {
    const capture = new AudioCapture();
    delete capture.captureKit.getAvailableDisplays;
    assert.throws(() => capture.getDisplays(), (err) => {
      assert.equal(err.code, ErrorCodes.CAPTURE_FAILED);
      assert.equal(err.details.missingMethod, 'getAvailableDisplays');
      return true;
    });
  });

  await t.test('should throw when startCaptureForWindow missing', () => {
    const capture = new AudioCapture();
    capture.captureKit.getAvailableWindows = () => [{
      windowId: 9000,
      owningProcessId: null,
      title: 'Test Window',
      onScreen: true,
      layer: 0
    }];
    delete capture.captureKit.startCaptureForWindow;

    assert.throws(() => capture.captureWindow(9000), (err) => {
      assert.equal(err.code, ErrorCodes.CAPTURE_FAILED);
      assert.equal(err.details.missingMethod, 'startCaptureForWindow');
      return true;
    });
  });

  await t.test('should throw when startCaptureForDisplay missing', () => {
    const capture = new AudioCapture();
    capture.captureKit.getAvailableDisplays = () => [{
      displayId: 42,
      frame: { x: 0, y: 0, width: 100, height: 100 },
      width: 100,
      height: 100,
      isMainDisplay: true
    }];
    delete capture.captureKit.startCaptureForDisplay;

    assert.throws(() => capture.captureDisplay(42), (err) => {
      assert.equal(err.code, ErrorCodes.CAPTURE_FAILED);
      assert.equal(err.details.missingMethod, 'startCaptureForDisplay');
      return true;
    });
  });
});
