/**
 * Custom Assertions
 *
 * Domain-specific assertion helpers that make tests more readable
 * and provide better error messages.
 */

import assert from 'node:assert/strict';
import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import type { AudioSample, AudioFormat } from '../../dist/types';
import type { AudioCapture } from '../../dist/audio-capture';

/**
 * Expected properties for audio sample assertion
 */
export interface ExpectedAudioSampleProperties {
  format?: AudioFormat;
  channels?: 1 | 2;
  sampleRate?: number;
  minRMS?: number;
  maxRMS?: number;
}

/**
 * Assert that an audio sample has expected properties
 */
export function assertAudioSample(sample: AudioSample, expected: ExpectedAudioSampleProperties = {}): void {
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
 * Expected capture state
 */
export interface ExpectedCaptureState {
  capturing?: boolean;
  processId?: number | null;
  targetType?: 'application' | 'window' | 'display';
}

/**
 * Assert that capture state is as expected
 */
export function assertCaptureState(capture: AudioCapture, expected: ExpectedCaptureState): void {
  if (expected.capturing !== undefined) {
    assert.equal(
      capture.isCapturing(),
      expected.capturing,
      `Capture should${expected.capturing ? '' : ' not'} be active`
    );
  }

  if (expected.processId !== undefined) {
    assert.equal(
      (capture as any).currentProcessId,
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
 * Expected error properties
 */
export interface ExpectedErrorProperties {
  code?: string;
  message?: RegExp;
  details?: Record<string, unknown>;
}

/**
 * Assert that an error has expected properties
 */
export function assertAudioCaptureError(error: any, expected: ExpectedErrorProperties = {}): void {
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
 */
export function assertNear(actual: number, expected: number, tolerance: number, message?: string): void {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    message || `Expected ${actual} to be within ${tolerance} of ${expected}, but diff was ${diff}`
  );
}

/**
 * Options for audio buffer validation
 */
export interface AudioBufferValidationOptions {
  format?: AudioFormat;
  minLength?: number;
}

/**
 * Assert that a buffer contains valid audio data
 */
export function assertValidAudioBuffer(buffer: Buffer, options: AudioBufferValidationOptions = {}): void {
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
 */
export function assertNoListenerLeak(emitter: EventEmitter, event: string, maxListeners: number = 10): void {
  const count = emitter.listenerCount(event);
  assert.ok(
    count <= maxListeners,
    `Listener leak detected: ${count} listeners for '${event}' (max: ${maxListeners})`
  );
}

/**
 * Expected stream state
 */
export interface ExpectedStreamState {
  readable?: boolean;
  destroyed?: boolean;
  objectMode?: boolean;
}

/**
 * Assert that a stream is in expected state
 */
export function assertStreamState(stream: Readable, expected: ExpectedStreamState): void {
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
