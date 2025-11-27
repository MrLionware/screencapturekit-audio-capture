/**
 * Unit Tests: Audio Processing
 *
 * Tests for core audio processing functionality including:
 * - RMS and peak calculation
 * - Format conversion (Float32 ↔ Int16)
 * - Volume threshold filtering
 * - Audio metrics computation
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureContext } from '../helpers/test-context';
import { createAudioPattern } from '../helpers/factories';
import { assertAudioSample, assertNear } from '../helpers/assertions';
import type { AudioSample } from '../../dist/core/types';
import type { NativeAudioSample } from '../fixtures/mock-native';

test('Audio Processing', async (t) => {
  await t.test('RMS Calculation', async (t) => {
    await t.test('should calculate RMS for constant signal', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        // Constant 0.5 signal should have RMS ≈ 0.5
        assertNear(sample.rms, 0.5, 0.01, 'RMS should be approximately 0.5');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio({
        data: createAudioPattern('constant', 1024),
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 0
      });
    });

    await t.test('should calculate RMS = 0 for silence', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        assert.equal(sample.rms, 0, 'Silent signal should have RMS = 0');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio({
        data: createAudioPattern('silence', 1024),
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 0
      });
    });

    await t.test('should handle NaN values in RMS calculation', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        assert.ok(!Number.isNaN(sample.rms), 'RMS should not be NaN');
        assert.ok(Number.isFinite(sample.rms), 'RMS should be finite');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio({
        data: createAudioPattern('nan', 100),
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 0
      });
    });
  });

  await t.test('Peak Calculation', async (t) => {
    await t.test('should calculate peak value correctly', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        assert.ok(sample.peak >= 0, 'Peak should be non-negative');
        assert.ok(sample.peak <= 10, 'Peak should be clamped to reasonable range');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio();
    });

    await t.test('should clamp extreme peak values', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        assert.ok(sample.peak <= 10, 'Extreme peaks should be clamped to 10');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio({
        data: createAudioPattern('extreme', 256),
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 0
      });
    });
  });

  await t.test('Format Conversion', async (t) => {
    await t.test('should convert Float32 to Int16', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { format: 'int16', minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        assertAudioSample(sample, { format: 'int16' });

        // Verify Int16 data
        const int16View = new Int16Array(
          sample.data.buffer,
          sample.data.byteOffset,
          sample.data.length / 2
        );

        // 0.5 float should convert to ~16384 int16
        const expectedValue = 16384;
        assertNear(int16View[0], expectedValue, 10, 'Conversion should be accurate');

        capture.stopCapture();
        done();
      });

      native?.simulateAudio();
    });

    await t.test('should keep Float32 format by default', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        assertAudioSample(sample, { format: 'float32' });
        capture.stopCapture();
        done();
      });

      native?.simulateAudio();
    });
  });

  await t.test('Volume Threshold', async (t) => {
    await t.test('should filter audio below minVolume', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();

      let audioEmitted = false;
      capture.on('audio', () => { audioEmitted = true; });

      capture.startCapture(100, { minVolume: 0.8 }); // High threshold

      // Simulate quiet audio (RMS ≈ 0.1)
      const quietBuffer = createAudioPattern('silence', 1024);
      const floatView = new Float32Array(quietBuffer.buffer);
      floatView.fill(0.1);

      native?.simulateAudio({
        data: Buffer.from(floatView.buffer),
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 0
      } as NativeAudioSample);

      setTimeout(() => {
        assert.equal(audioEmitted, false, 'Audio below threshold should be filtered');
        capture.stopCapture();
        done();
      }, 10);
    });

    await t.test('should emit audio above minVolume', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0.1 }); // Low threshold

      capture.once('audio', (sample: AudioSample) => {
        assert.ok(sample.rms >= 0.1, 'Emitted audio should exceed threshold');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio(); // Default buffer has RMS ≈ 0.5
    });
  });

  await t.test('Audio Metrics', async (t) => {
    await t.test('should calculate correct sample count', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        const expectedSamples = 1024; // Buffer size
        assert.equal(sample.sampleCount, expectedSamples);
        capture.stopCapture();
        done();
      });

      native?.simulateAudio();
    });

    await t.test('should calculate correct frame count', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        const expectedFrames = 512; // 1024 samples / 2 channels
        assert.equal(sample.framesCount, expectedFrames);
        capture.stopCapture();
        done();
      });

      native?.simulateAudio();
    });

    await t.test('should calculate duration correctly', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        // 512 frames at 48000 Hz = ~10.67 ms
        const expectedDuration = (512 / 48000) * 1000;
        assertNear(sample.durationMs, expectedDuration, 0.1);
        capture.stopCapture();
        done();
      });

      native?.simulateAudio();
    });
  });
});
