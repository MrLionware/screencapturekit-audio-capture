/**
 * Test Data Factories
 *
 * Factory functions for creating test data with sensible defaults.
 * Makes tests more readable and maintainable.
 */

/**
 * Create a mock audio sample
 *
 * @param {Object} overrides - Properties to override
 * @returns {Object} Audio sample object
 */
function createAudioSample(overrides = {}) {
  const buffer = Buffer.alloc(overrides.bufferSize || 16);
  if (!overrides.data) {
    buffer.writeFloatLE(0.25, 0);
    buffer.writeFloatLE(-0.5, 4);
  }

  return {
    data: overrides.data || buffer,
    durationMs: overrides.durationMs ?? 1000,
    framesCount: overrides.framesCount ?? 960,
    sampleRate: overrides.sampleRate ?? 48000,
    channels: overrides.channels ?? 2,
    format: overrides.format ?? 'float32',
    timestamp: overrides.timestamp ?? 0,
    rms: overrides.rms ?? 0.5,
    peak: overrides.peak ?? 0.8,
    sampleCount: overrides.sampleCount ?? 1920
  };
}

/**
 * Create a mock application
 *
 * @param {Object} overrides - Properties to override
 * @returns {Object} Application object
 */
function createMockApp(overrides = {}) {
  return {
    processId: overrides.processId ?? 100,
    bundleIdentifier: overrides.bundleIdentifier ?? 'com.test.app',
    applicationName: overrides.applicationName ?? 'Test App',
    ...overrides
  };
}

/**
 * Create a mock window
 *
 * @param {Object} overrides - Properties to override
 * @returns {Object} Window object
 */
function createMockWindow(overrides = {}) {
  return {
    windowId: overrides.windowId ?? 1000,
    layer: overrides.layer ?? 0,
    frame: overrides.frame ?? { x: 0, y: 0, width: 800, height: 600 },
    title: overrides.title ?? 'Test Window',
    onScreen: overrides.onScreen ?? true,
    active: overrides.active ?? true,
    owningProcessId: overrides.owningProcessId ?? 100,
    owningApplicationName: overrides.owningApplicationName ?? 'Test App',
    owningBundleIdentifier: overrides.owningBundleIdentifier ?? 'com.test.app',
    ...overrides
  };
}

/**
 * Create a mock display
 *
 * @param {Object} overrides - Properties to override
 * @returns {Object} Display object
 */
function createMockDisplay(overrides = {}) {
  return {
    displayId: overrides.displayId ?? 77,
    frame: overrides.frame ?? { x: 0, y: 0, width: 1440, height: 900 },
    width: overrides.width ?? 1440,
    height: overrides.height ?? 900,
    isMainDisplay: overrides.isMainDisplay ?? true,
    ...overrides
  };
}

/**
 * Create a Float32 audio buffer
 *
 * @param {number} length - Number of samples
 * @param {number} value - Value to fill (default: 0.5)
 * @returns {Buffer} Audio buffer
 */
function createFloat32Buffer(length = 1024, value = 0.5) {
  const floatData = new Float32Array(length);
  floatData.fill(value);
  return Buffer.from(floatData.buffer);
}

/**
 * Create an Int16 audio buffer
 *
 * @param {number} length - Number of samples
 * @param {number} value - Value to fill (default: 16384)
 * @returns {Buffer} Audio buffer
 */
function createInt16Buffer(length = 1024, value = 16384) {
  const intData = new Int16Array(length);
  intData.fill(value);
  return Buffer.from(intData.buffer);
}

/**
 * Create a buffer with specific audio pattern
 *
 * @param {string} pattern - Pattern type: 'sine', 'silence', 'noise', 'extreme'
 * @param {number} length - Number of samples
 * @returns {Buffer} Audio buffer
 */
function createAudioPattern(pattern, length = 1024) {
  const floatData = new Float32Array(length);

  switch (pattern) {
    case 'sine':
      for (let i = 0; i < length; i++) {
        floatData[i] = Math.sin(i * 0.1);
      }
      break;
    case 'silence':
      floatData.fill(0);
      break;
    case 'noise':
      for (let i = 0; i < length; i++) {
        floatData[i] = Math.random() * 2 - 1;
      }
      break;
    case 'extreme':
      floatData.fill(999999);
      break;
    case 'nan':
      floatData.fill(NaN);
      break;
    default:
      floatData.fill(0.5);
  }

  return Buffer.from(floatData.buffer);
}

module.exports = {
  createAudioSample,
  createMockApp,
  createMockWindow,
  createMockDisplay,
  createFloat32Buffer,
  createInt16Buffer,
  createAudioPattern
};
