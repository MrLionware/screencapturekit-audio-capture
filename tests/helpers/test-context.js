/**
 * Test Context Factory
 *
 * Provides a consistent way to create test contexts with mocked dependencies.
 * This makes tests more maintainable and reduces boilerplate.
 */

const { loadSDKWithMock } = require('./test-utils');
const { createNativeMock } = require('../fixtures/mock-native');

/**
 * Create a test context with SDK and mocks
 *
 * @param {Object} nativeMock - Optional native mock to use
 * @param {Object} options - Additional options
 * @returns {Object} Test context with SDK classes
 *
 * @example
 * const { AudioCapture, ErrorCodes } = createTestContext();
 * const capture = new AudioCapture();
 */
function createTestContext(nativeMock = null, options = {}) {
  const mock = nativeMock || createNativeMock(options);
  return loadSDKWithMock({ nativeMock: mock });
}

/**
 * Create a test context for capture testing
 *
 * @param {Object} options - Capture options
 * @returns {Object} Context with capture and native instance
 *
 * @example
 * const { capture, native } = createCaptureContext();
 * capture.startCapture(100);
 * native.simulateAudio();
 */
function createCaptureContext(options = {}) {
  let nativeInstance = null;

  const nativeMock = {
    ScreenCaptureKit: class extends (createNativeMock(options).ScreenCaptureKit) {
      constructor() {
        super();
        nativeInstance = this;
      }
    }
  };

  const { AudioCapture } = loadSDKWithMock({ nativeMock });
  const capture = new AudioCapture();

  return {
    capture,
    native: nativeInstance,
    AudioCapture
  };
}

/**
 * Create a test context for stream testing
 *
 * @param {Object} options - Stream options
 * @returns {Object} Context with stream helpers
 */
function createStreamContext(options = {}) {
  const { capture, native } = createCaptureContext(options);

  return {
    capture,
    native,
    createStream: (identifier, streamOptions) => {
      return capture.createAudioStream(identifier, streamOptions);
    },
    simulateAudio: (data) => native.simulateAudio(data)
  };
}

/**
 * Wait for event loop to clear
 * Useful for async operations in tests
 */
function waitForEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Wait for a specific event with timeout
 *
 * @param {EventEmitter} emitter - Event emitter
 * @param {string} event - Event name
 * @param {number} timeout - Timeout in ms (default: 1000)
 * @returns {Promise} Resolves with event data
 */
function waitForEvent(emitter, event, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event '${event}'`));
    }, timeout);

    emitter.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Run code with timeout protection
 *
 * @param {Function} fn - Async function to run
 * @param {number} timeout - Timeout in ms
 * @returns {Promise} Result of function
 */
function withTimeout(fn, timeout = 5000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    )
  ]);
}

module.exports = {
  createTestContext,
  createCaptureContext,
  createStreamContext,
  waitForEventLoop,
  waitForEvent,
  withTimeout
};
