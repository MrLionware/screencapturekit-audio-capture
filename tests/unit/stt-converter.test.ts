/**
 * Unit Tests: STTConverter
 *
 * Tests for STTConverter and createSTTStream functionality:
 * - Format conversion (Float32 to Int16)
 * - Channel downmixing (stereo to mono)
 * - Stream pipeline integration
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { loadSDKWithMock } from '../helpers/test-utils';
import { MOCK_APPS } from '../fixtures/mock-data';
import type { ApplicationInfo, AppIdentifier, AudioSample, AudioStreamOptions } from '../../dist/core/types';

test('STTConverter', async (t) => {
  await t.test('Format Conversion', async (t) => {
    await t.test('should convert Float32 to Int16', (t: TestContext, done: () => void) => {
      const { STTConverter } = loadSDKWithMock();
      // Set channels to 2 to prevent implicit downmixing (STTConverter defaults to channels: 1)
      const converter = new STTConverter({
        format: 'int16',
        channels: 2
      });

      // Create Float32 input (values 1.0 and -1.0)
      const input = Buffer.alloc(8);
      input.writeFloatLE(1.0, 0);
      input.writeFloatLE(-1.0, 4);

      converter.on('data', (chunk: Buffer) => {
        assert.ok(chunk instanceof Buffer);
        assert.equal(chunk.length, 4); // 2 samples * 2 bytes
        assert.equal(chunk.readInt16LE(0), 32767);
        assert.equal(chunk.readInt16LE(2), -32768);
        done();
      });

      converter.write(input);
    });

    await t.test('should convert using internal method', () => {
      const { STTConverter } = loadSDKWithMock();
      const converter = new STTConverter({
        format: 'int16'
      });

      // Create a Float32 buffer with known values: 1.0, -1.0, 0.0, 0.5
      const floatData = new Float32Array([1.0, -1.0, 0.0, 0.5]);
      const inputBuffer = Buffer.from(floatData.buffer);

      const outputBuffer = (converter as any)._convertToInt16(inputBuffer);
      const int16Data = new Int16Array(outputBuffer.buffer, outputBuffer.byteOffset, outputBuffer.length / 2);

      assert.equal(int16Data.length, 4);
      assert.equal(int16Data[0], 32767); // 1.0 -> max int16
      assert.equal(int16Data[1], -32768); // -1.0 -> min int16
      assert.equal(int16Data[2], 0); // 0.0 -> 0
      assert.equal(int16Data[3], 16383); // 0.5 -> approx half max
    });
  });

  await t.test('Channel Downmixing', async (t) => {
    await t.test('should downmix stereo to mono (Float32)', (t: TestContext, done: () => void) => {
      const { STTConverter } = loadSDKWithMock();
      const converter = new STTConverter({
        format: 'float32',
        channels: 1
      });

      // Create stereo Float32 input (L=1.0, R=0.0) using ArrayBuffer to ensure alignment
      const ab = new ArrayBuffer(8);
      const floatView = new Float32Array(ab);
      floatView[0] = 1.0;
      floatView[1] = 0.0;
      const input = Buffer.from(ab);

      converter.on('data', (chunk: Buffer) => {
        assert.equal(chunk.length, 4); // 1 sample * 4 bytes
        const value = chunk.readFloatLE(0);

        // Average should be 0.5
        assert.equal(value, 0.5);
        done();
      });

      converter.write(input);
    });

    await t.test('should downmix stereo to mono (Int16)', (t: TestContext, done: () => void) => {
      const { STTConverter } = loadSDKWithMock();
      const converter = new STTConverter({
        format: 'int16',
        channels: 1,
        objectMode: true
      });

      // Create stereo Int16 input (L=1000, R=0)
      const ab = new ArrayBuffer(4);
      const intView = new Int16Array(ab);
      intView[0] = 1000;
      intView[1] = 0;
      const inputBuffer = Buffer.from(ab);

      const inputSample: AudioSample = {
        data: inputBuffer,
        format: 'int16',
        channels: 2,
        sampleRate: 48000,
        timestamp: Date.now(),
        durationMs: 0,
        framesCount: 2,
        sampleCount: 2,
        rms: 0,
        peak: 0
      };

      converter.on('data', (chunk: AudioSample) => {
        // In objectMode, we get a sample object back
        assert.equal(chunk.format, 'int16');
        assert.equal(chunk.channels, 1);

        const data = chunk.data;
        assert.equal(data.length, 2); // 1 sample * 2 bytes
        const value = data.readInt16LE(0);
        assert.equal(value, 500); // Average
        done();
      });

      converter.write(inputSample);
    });

    await t.test('should downmix using internal method', () => {
      const { STTConverter } = loadSDKWithMock();
      const converter = new STTConverter({
        channels: 1
      });

      // Create stereo Float32 buffer: [L1, R1, L2, R2]
      // [1.0, 0.0, 0.5, 0.5] -> Mono: [0.5, 0.5]
      const floatData = new Float32Array([1.0, 0.0, 0.5, 0.5]);
      const inputBuffer = Buffer.from(floatData.buffer);

      const outputBuffer = (converter as any)._stereoToMono(inputBuffer, 'float32');
      const monoData = new Float32Array(outputBuffer.buffer, outputBuffer.byteOffset, outputBuffer.length / 4);

      assert.equal(monoData.length, 2);
      assert.equal(monoData[0], 0.5);
      assert.equal(monoData[1], 0.5);
    });
  });

  await t.test('Stream Transformation', async (t) => {
    await t.test('should transform stream data correctly', () => {
      const { STTConverter } = loadSDKWithMock();

      return new Promise<void>((resolve, reject) => {
        const converter = new STTConverter({
          format: 'int16',
          channels: 1
        });
        const floatData = new Float32Array([1.0, 1.0]); // Stereo full volume
        const inputBuffer = Buffer.from(floatData.buffer);

        converter.on('data', (chunk: Buffer) => {
          try {
            // Should be mono int16
            // 1.0 + 1.0 / 2 = 1.0 -> 32767
            const int16Data = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
            assert.equal(int16Data.length, 1);
            assert.equal(int16Data[0], 32767);
            resolve();
          } catch (err) {
            reject(err as Error);
          }
        });

        converter.on('error', reject);

        converter.write(inputBuffer);
        converter.end();
      });
    });
  });

  await t.test('Float32 Passthrough', async (t) => {
    await t.test('should passthrough float32 without conversion', (t: TestContext, done: () => void) => {
      const { STTConverter } = loadSDKWithMock();
      const converter = new STTConverter({
        format: 'float32',
        channels: 2 // Keep stereo
      });

      // Create Float32 stereo input
      const floatData = new Float32Array([0.5, -0.5, 0.25, -0.25]);
      const inputBuffer = Buffer.from(floatData.buffer);

      converter.on('data', (chunk: Buffer) => {
        // Should remain float32 stereo - no conversion
        assert.equal(chunk.length, inputBuffer.length);

        const outputData = new Float32Array(chunk.buffer, chunk.byteOffset, chunk.length / 4);
        assert.equal(outputData.length, 4);
        assert.equal(outputData[0], 0.5);
        assert.equal(outputData[1], -0.5);
        done();
      });

      converter.write(inputBuffer);
    });

    await t.test('should downmix stereo to mono while keeping float32', (t: TestContext, done: () => void) => {
      const { STTConverter } = loadSDKWithMock();
      const converter = new STTConverter({
        format: 'float32',
        channels: 1 // Convert to mono
      });

      // Create Float32 stereo input (L=1.0, R=0.0)
      const floatData = new Float32Array([1.0, 0.0]);
      const inputBuffer = Buffer.from(floatData.buffer);

      converter.on('data', (chunk: Buffer) => {
        // Should be mono float32
        const outputData = new Float32Array(chunk.buffer, chunk.byteOffset, chunk.length / 4);
        assert.equal(outputData.length, 1);
        assert.equal(outputData[0], 0.5); // Average of 1.0 and 0.0
        done();
      });

      converter.write(inputBuffer);
    });
  });
});

test('createSTTStream', async (t) => {
  const mockNative = {
    ScreenCaptureKit: class {
      getAvailableApps(): ApplicationInfo[] {
        return MOCK_APPS;
      }
      startCapture(): boolean {
        return true;
      }
      stopCapture(): void { }
    }
  };

  const { AudioCapture, STTConverter } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('should create pipeline with auto-selected app', () => {
    const capture = new AudioCapture();
    const sttStream = capture.createSTTStream(null as unknown as string, {
      autoSelect: true
    });
    assert.ok(sttStream instanceof STTConverter);
    assert.equal(sttStream.app!.applicationName, 'Example App'); // First app
  });

  await t.test('should throw when app not found', () => {
    const capture = new AudioCapture();
    assert.throws(() => {
      capture.createSTTStream('NonExistentApp', {
        autoSelect: false
      });
    }, /No application found for STT stream/);
  });

  await t.test('should wire options and expose stop helper', async () => {
    const capture = new AudioCapture();
    const app: ApplicationInfo = {
      processId: 999,
      bundleIdentifier: 'com.audio.mock',
      applicationName: 'Mock Audio'
    };

    const selections: AppIdentifier[] = [];
    capture.selectApp = (identifier: AppIdentifier | null | undefined): ApplicationInfo | null => {
      selections.push(identifier as AppIdentifier);
      return app;
    };

    class MockStream extends Readable {
      public stopped: boolean = false;

      constructor() {
        super({
          objectMode: true
        });
      }
      override _read(): void { }
      stop(): void {
        this.stopped = true;
        this.push(null);
      }
      emitSample(sample: AudioSample): void {
        this.push(sample);
      }
    }

    const mockStream = new MockStream();
    let capturedIdentifier: AppIdentifier | null = null;
    let capturedOptions: AudioStreamOptions | undefined;

    capture.createAudioStream = (identifier: AppIdentifier, options?: AudioStreamOptions): any => {
      capturedIdentifier = identifier;
      capturedOptions = options;
      return mockStream;
    };

    const sttStream = capture.createSTTStream('Mock Audio', {
      minVolume: 0.2,
      channels: 1,
      format: 'int16',
      objectMode: true,
      autoSelect: false
    });

    assert.deepEqual(selections, ['Mock Audio']);
    assert.equal(capturedIdentifier, app.processId);
    assert.equal(capturedOptions!.objectMode, true);
    assert.equal(capturedOptions!.format, 'float32', 'source stream should remain float32');
    assert.equal(capturedOptions!.minVolume, 0.2);

    const convertedPromise = new Promise<AudioSample>((resolve) => {
      sttStream.once('data', resolve);
    });

    const floatData = new Float32Array([0.75, -0.75]);
    mockStream.emitSample({
      data: Buffer.from(floatData.buffer),
      format: 'float32',
      channels: 2,
      sampleRate: 48000,
      timestamp: 111,
      durationMs: 0,
      framesCount: 1,
      sampleCount: 2,
      rms: 0,
      peak: 0
    });

    const converted = await convertedPromise;
    assert.equal(converted.format, 'int16');
    assert.equal(converted.channels, 1);
    assert.ok(converted.data instanceof Buffer);

    sttStream.stop!();
    assert.equal(mockStream.stopped, true);
  });
});
