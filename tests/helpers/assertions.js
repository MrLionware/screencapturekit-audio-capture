/**
 * Custom Assertions
 *
 * Domain-specific assertion helpers that make tests more readable
 * and provide better error messages.
 */

const assert = require('node:assert/strict');

/**
 * Assert that an audio sample has expected properties
 *
 * @param {Object} sample - Audio sample to validate
 * @param {Object} expected - Expected properties
 */
function assertAudioSample(sample, expected = {}) {
  assert.ok(sample, 'Sample should exist');
  assert.ok(sample.data instanceof Buffer, 'Sample should have Buffer data');

  if (expected.format) {
    assert.equal(sample.format, expected.format, `Format should be ${expected.format}`);
  }

  if (expected.channels) {
    assert.equal(sample.channels, expected.channels, `Channels should be ${expected.channels}`);
  }

  if (expected.sampleRate) {
    assert.equal(sample.sampleRate, expected.sampleRate, `Sample rate should be ${expected.sampleRate}`);
  }

  // RMS and peak should always be valid numbers
  assert.ok(typeof sample.rms === 'number' && !isNaN(sample.rms), 'RMS should be a valid number');
  assert.ok(typeof sample.peak === 'number' && !isNaN(sample.peak), 'Peak should be a valid number');

  if (expected.minRMS !== undefined) {
    assert.ok(sample.rms >= expected.minRMS, `RMS ${sample.rms} should be >= ${expected.minRMS}`);
  }

  if (expected.maxRMS !== undefined) {
    assert.ok(sample.rms <= expected.maxRMS, `RMS ${sample.rms} should be <= ${expected.maxRMS}`);
  }
}

/**
 * Assert that capture state is as expected
 *
 * @param {Object} capture - AudioCapture instance
 * @param {Object} expected - Expected state
 */
function assertCaptureState(capture, expected) {
  if (expected.capturing !== undefined) {
    assert.equal(
      capture.isCapturing(),
      expected.capturing,
      `Capture should${expected.capturing ? '' : ' not'} be active`
    );
  }

  if (expected.processId !== undefined) {
    assert.equal(
      capture.currentProcessId,
      expected.processId,
      `Process ID should be ${expected.processId}`
    );
  }

  if (expected.targetType !== undefined) {
    const status = capture.getStatus();
    if (status) {
      assert.equal(
        status.targetType,
        expected.targetType,
        `Target type should be ${expected.targetType}`
      );
    } else {
      assert.fail('Cannot check target type - capture not active');
    }
  }
}

/**
 * Assert that an error has expected properties
 *
 * @param {Error} error - Error to validate
 * @param {Object} expected - Expected properties
 */
function assertAudioCaptureError(error, expected = {}) {
  assert.ok(error, 'Error should exist');
  assert.equal(error.name, 'AudioCaptureError', 'Should be AudioCaptureError');

  if (expected.code) {
    assert.equal(error.code, expected.code, `Error code should be ${expected.code}`);
  }

  if (expected.message) {
    assert.match(error.message, expected.message, 'Error message should match');
  }

  if (expected.details) {
    assert.ok(error.details, 'Error should have details');
    for (const [key, value] of Object.entries(expected.details)) {
      assert.equal(
        error.details[key],
        value,
        `Error details.${key} should be ${value}`
      );
    }
  }
}

/**
 * Assert that a value is within a range
 *
 * @param {number} actual - Actual value
 * @param {number} expected - Expected value
 * @param {number} tolerance - Allowed deviation
 * @param {string} message - Error message
 */
function assertNear(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    message || `Expected ${actual} to be within ${tolerance} of ${expected}, but diff was ${diff}`
  );
}

/**
 * Assert that a buffer contains valid audio data
 *
 * @param {Buffer} buffer - Buffer to validate
 * @param {Object} options - Validation options
 */
function assertValidAudioBuffer(buffer, options = {}) {
  assert.ok(buffer instanceof Buffer, 'Should be a Buffer');
  assert.ok(buffer.length > 0, 'Buffer should not be empty');

  if (options.format === 'float32') {
    assert.equal(buffer.length % 4, 0, 'Float32 buffer length should be multiple of 4');
  } else if (options.format === 'int16') {
    assert.equal(buffer.length % 2, 0, 'Int16 buffer length should be multiple of 2');
  }

  if (options.minLength) {
    assert.ok(buffer.length >= options.minLength, `Buffer should be at least ${options.minLength} bytes`);
  }
}

/**
 * Assert that listener count hasn't grown (no memory leak)
 *
 * @param {EventEmitter} emitter - Event emitter to check
 * @param {string} event - Event name
 * @param {number} maxListeners - Maximum allowed listeners
 */
function assertNoListenerLeak(emitter, event, maxListeners = 10) {
  const count = emitter.listenerCount(event);
  assert.ok(
    count <= maxListeners,
    `Listener leak detected: ${count} listeners for '${event}' (max: ${maxListeners})`
  );
}

/**
 * Assert that a stream is in expected state
 *
 * @param {Stream} stream - Stream to validate
 * @param {Object} expected - Expected state
 */
function assertStreamState(stream, expected) {
  if (expected.readable !== undefined) {
    assert.equal(stream.readable, expected.readable, 'Stream readable state incorrect');
  }

  if (expected.destroyed !== undefined) {
    assert.equal(stream.destroyed, expected.destroyed, 'Stream destroyed state incorrect');
  }

  if (expected.objectMode !== undefined) {
    assert.equal(
      stream.readableObjectMode,
      expected.objectMode,
      'Stream object mode incorrect'
    );
  }
}

module.exports = {
  assertAudioSample,
  assertCaptureState,
  assertAudioCaptureError,
  assertNear,
  assertValidAudioBuffer,
  assertNoListenerLeak,
  assertStreamState
};
