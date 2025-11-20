/**
 * Mock Native Layer Factory
 *
 * Creates configurable mock implementations of the native ScreenCaptureKit addon.
 * This allows tests to simulate various native behaviors without actual hardware.
 */

const { MOCK_APPS, MOCK_WINDOWS, MOCK_DISPLAYS } = require('./mock-data');

/**
 * Create a mock native ScreenCaptureKit implementation
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.apps - Mock applications to return
 * @param {Array} options.windows - Mock windows to return
 * @param {Array} options.displays - Mock displays to return
 * @param {Function} options.onStart - Callback when capture starts
 * @param {Function} options.onStop - Callback when capture stops
 * @param {boolean} options.captureSupport - Whether capture is supported
 * @returns {Object} Mock native module
 */
function createNativeMock(options = {}) {
  const {
    apps = MOCK_APPS.slice(0, 3), // Default: first 3 apps
    windows = MOCK_WINDOWS,
    displays = MOCK_DISPLAYS,
    onStart = null,
    onStop = null,
    captureSupport = true
  } = options;

  return {
    ScreenCaptureKit: class MockScreenCaptureKit {
      constructor() {
        this.appStarts = [];
        this.windowStarts = [];
        this.displayStarts = [];
        this._capturing = false;
        this._activeCallback = null;
      }

      getAvailableApps() {
        return apps;
      }

      getAvailableWindows() {
        if (!captureSupport) {
          throw new Error('Window capture not supported');
        }
        return windows;
      }

      getAvailableDisplays() {
        if (!captureSupport) {
          throw new Error('Display capture not supported');
        }
        return displays;
      }

      startCapture(pid, config, callback) {
        if (this._capturing) return false;

        this._capturing = true;
        this._activeCallback = callback;
        this.appStarts.push({ pid, config, callback });

        if (onStart) {
          onStart({ pid, config, type: 'application' });
        }

        return captureSupport;
      }

      startCaptureForWindow(windowId, config, callback) {
        if (this._capturing) return false;

        this._capturing = true;
        this._activeCallback = callback;
        this.windowStarts.push({ windowId, config, callback });

        if (onStart) {
          onStart({ windowId, config, type: 'window' });
        }

        return captureSupport;
      }

      startCaptureForDisplay(displayId, config, callback) {
        if (this._capturing) return false;

        this._capturing = true;
        this._activeCallback = callback;
        this.displayStarts.push({ displayId, config, callback });

        if (onStart) {
          onStart({ displayId, config, type: 'display' });
        }

        return captureSupport;
      }

      stopCapture() {
        this._capturing = false;
        this._activeCallback = null;

        if (onStop) {
          onStop();
        }
      }

      isCapturing() {
        return this._capturing;
      }

      // Helper to simulate audio callback
      simulateAudio(data = null) {
        if (this._activeCallback) {
          const audioData = data || this._createDefaultAudioBuffer();
          this._activeCallback(audioData);
        }
      }

      _createDefaultAudioBuffer() {
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
  };
}

/**
 * Create a minimal mock (for simple tests)
 */
function createMinimalMock(apps = MOCK_APPS.slice(0, 1)) {
  return createNativeMock({ apps });
}

/**
 * Create a mock that simulates permission denial
 */
function createPermissionDeniedMock() {
  return createNativeMock({ apps: [] });
}

/**
 * Create a mock that simulates feature not supported
 */
function createUnsupportedFeatureMock() {
  return createNativeMock({ captureSupport: false });
}

module.exports = {
  createNativeMock,
  createMinimalMock,
  createPermissionDeniedMock,
  createUnsupportedFeatureMock
};
