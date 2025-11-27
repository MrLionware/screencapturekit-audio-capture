/**
 * Unit Tests: AudioStream API
 *
 * Tests for AudioStream functionality:
 * - Stream creation and data flow
 * - Object mode vs buffer mode
 * - Stream lifecycle and cleanup
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { MockScreenCaptureKit, type NativeAudioSample, type NativeCaptureConfig } from '../fixtures/mock-native';
import { loadSDKWithMock } from '../helpers/test-utils';
import { MOCK_APPS } from '../fixtures/mock-data';
import type { CaptureInfo } from '../../dist/core/types';

function createSampleCallback(): NativeAudioSample {
  const floatData = new Float32Array(1024);
  const buffer = Buffer.from(floatData.buffer);
  return {
    data: buffer,
    sampleRate: 48000,
    channelCount: 2,
    timestamp: 123
  };
}

test('AudioStream', async (t) => {
  await t.test('Basic Stream Creation', async (t) => {
    await t.test('should return readable stream', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            // Simulate async data flow
            setTimeout(() => {
              callback(createSampleCallback());
            }, 10);
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream('Music Player');

      assert.ok(stream);
      assert.equal(typeof stream.on, 'function');
      assert.equal(typeof stream.pipe, 'function');
    });

    await t.test('should emit data events', (t: TestContext, done: () => void) => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            setTimeout(() => {
              callback(createSampleCallback());
            }, 10);
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream('Music Player');

      stream.once('data', (chunk: Buffer) => {
        assert.ok(chunk instanceof Buffer);
        stream.destroy();
        done();
      });
    });

    await t.test('should emit objects in objectMode', (t: TestContext, done: () => void) => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            setTimeout(() => {
              callback(createSampleCallback());
            }, 10);
            return true;
          }
          stopCapture(): void { }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream('Music Player', {
        objectMode: true
      });

      stream.once('data', (sample) => {
        assert.equal(typeof sample, 'object');
        assert.ok(sample.data instanceof Buffer);
        assert.equal(sample.sampleRate, 48000);
        stream.destroy();
        done();
      });
    });
  });

  await t.test('Stream Modes', async (t) => {
    await t.test('should stream raw buffers by default', (t: TestContext, done: () => void) => {
      let activeCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class extends MockScreenCaptureKit {
          override getAvailableApps() {
            return MOCK_APPS;
          }
          override startCapture(pid: number, config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            activeCallback = callback;
            return super.startCapture(pid, config, callback);
          }
          override stopCapture(): void {
            activeCallback = null;
          }
          override isCapturing(): boolean {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100);

      assert.ok(stream instanceof AudioStream);
      assert.ok(stream instanceof Readable);

      const receivedChunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        receivedChunks.push(chunk);
        if (receivedChunks.length === 1) {
          stream.stop();
          assert.ok(receivedChunks[0] instanceof Buffer);
          done();
        }
      });

      // Wait for stream to start and simulate data
      setTimeout(() => {
        if (activeCallback) {
          const buffer = Buffer.alloc(1024);
          activeCallback({
            data: buffer,
            sampleRate: 48000,
            channelCount: 2,
            timestamp: Date.now()
          });
        }
      }, 10);
    });

    await t.test('should stream objects when objectMode is true', (t: TestContext, done: () => void) => {
      let activeCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class extends MockScreenCaptureKit {
          override getAvailableApps() {
            return MOCK_APPS;
          }
          override startCapture(pid: number, config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            activeCallback = callback;
            return super.startCapture(pid, config, callback);
          }
          override stopCapture(): void {
            activeCallback = null;
          }
          override isCapturing(): boolean {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100, {
        objectMode: true
      });

      const receivedChunks: any[] = [];
      stream.on('data', (chunk: any) => {
        receivedChunks.push(chunk);
        if (receivedChunks.length === 1) {
          stream.stop();
          assert.equal(typeof chunk, 'object');
          assert.ok(chunk.data instanceof Buffer);
          assert.equal(chunk.sampleRate, 48000);
          done();
        }
      });

      setTimeout(() => {
        if (activeCallback) {
          const buffer = Buffer.alloc(1024);
          activeCallback({
            data: buffer,
            sampleRate: 48000,
            channelCount: 2,
            timestamp: Date.now()
          });
        }
      }, 10);
    });
  });

  await t.test('Stream Lifecycle', async (t) => {
    await t.test('should stop capture when stream is destroyed', (t: TestContext, done: () => void) => {
      let activeCallback: ((sample: NativeAudioSample) => void) | null = null;
      let stopCalled = false;

      const mockNative = {
        ScreenCaptureKit: class extends MockScreenCaptureKit {
          override getAvailableApps() {
            return MOCK_APPS;
          }
          override startCapture(pid: number, config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            activeCallback = callback;
            return super.startCapture(pid, config, callback);
          }
          override stopCapture(): void {
            stopCalled = true;
            activeCallback = null;
          }
          override isCapturing(): boolean {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100);

      // Start the stream flow
      stream.on('data', () => { });

      setTimeout(() => {
        stream.destroy();
        assert.equal(stopCalled, true);
        done();
      }, 10);
    });

    await t.test('should match underlying capture info', async () => {
      let activeCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class extends MockScreenCaptureKit {
          override getAvailableApps() {
            return MOCK_APPS;
          }
          override startCapture(pid: number, config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            activeCallback = callback;
            return super.startCapture(pid, config, callback);
          }
          override stopCapture(): void {
            activeCallback = null;
          }
          override isCapturing(): boolean {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100, {
        objectMode: true
      });

      stream.on('data', () => { });
      await new Promise<void>((resolve) => capture.once('start', resolve));

      if (activeCallback) {
        const buffer = Buffer.alloc(1024);
        (activeCallback as unknown as (sample: NativeAudioSample) => void)({
          data: buffer,
          sampleRate: 48000,
          channelCount: 2,
          timestamp: Date.now()
        });
      }

      const captureInfo = capture.getCurrentCapture();
      const streamInfo = stream.getCurrentCapture();
      assert.deepEqual(streamInfo, captureInfo);

      stream.destroy();
    });
  });

  await t.test('Direct AudioStream Construction', async (t) => {
    await t.test('should stream audio data', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          private callback: ((sample: NativeAudioSample) => void) | null = null;
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            this.callback = callback;
            return true;
          }
          stopCapture(): void { }
          isCapturing(): boolean {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise<void>((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App');

        stream.on('data', (chunk: Buffer) => {
          try {
            assert.ok(Buffer.isBuffer(chunk));
            stream.destroy();
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        stream.on('error', reject);

        // Trigger read to start capture
        stream.resume();

        // Simulate audio event
        setTimeout(() => {
          capture.emit('audio', {
            data: Buffer.alloc(10)
          });
        }, 10);
      });
    });

    await t.test('should stream objects in objectMode', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          private callback: ((sample: NativeAudioSample) => void) | null = null;
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            this.callback = callback;
            return true;
          }
          stopCapture(): void { }
          isCapturing(): boolean {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise<void>((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App', {
          objectMode: true
        });

        stream.on('data', (sample) => {
          try {
            assert.equal(sample.format, 'float32');
            stream.destroy();
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        stream.on('error', reject);

        stream.resume();
        setTimeout(() => {
          capture.emit('audio', {
            data: Buffer.alloc(10),
            format: 'float32'
          });
        }, 10);
      });
    });

    await t.test('should stop capture when destroyed', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          private callback: ((sample: NativeAudioSample) => void) | null = null;
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            this.callback = callback;
            return true;
          }
          stopCapture(): void { }
          isCapturing(): boolean {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise<void>((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App');

        stream.resume();

        // Wait for next tick to allow startCapture to be called
        setTimeout(() => {
          try {
            assert.ok(capture.isCapturing() || capture.listenerCount('audio') > 0);

            stream.destroy();
            // In mock, we can check if listeners were removed
            assert.equal(capture.listenerCount('audio'), 0);
            resolve();
          } catch (err) {
            reject(err as Error);
          }
        }, 10);
      });
    });
  });

  await t.test('AudioStream Edge Cases', async (t) => {
    await t.test('should handle double stop() calls gracefully', () => {
      let stopCalled = 0;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, _callback: (sample: NativeAudioSample) => void): boolean {
            return true;
          }
          stopCapture(): void {
            stopCalled++;
          }
          isCapturing(): boolean {
            return stopCalled === 0;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise<void>((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App');

        stream.resume();

        setTimeout(() => {
          try {
            // First stop
            stream.stop();
            assert.equal(stopCalled, 1);

            // Second stop should be no-op
            stream.stop();
            assert.equal(stopCalled, 1, 'Second stop() should not call stopCapture again');

            resolve();
          } catch (err) {
            reject(err as Error);
          }
        }, 10);
      });
    });

    await t.test('should handle startCapture failure gracefully', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, _callback: (sample: NativeAudioSample) => void): boolean {
            return false; // Simulate failure
          }
          stopCapture(): void { }
          isCapturing(): boolean {
            return false;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise<void>((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App');

        // Handle expected error
        stream.on('error', (err) => {
          try {
            assert.ok(err, 'Should emit error when startCapture fails');
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        });

        // Start flowing - this should trigger startCapture which will fail
        stream.resume();
      });
    });

    await t.test('should ignore audio events after stop()', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(_pid: number, _config: NativeCaptureConfig, _callback: (sample: NativeAudioSample) => void): boolean {
            return true;
          }
          stopCapture(): void { }
          isCapturing(): boolean {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise<void>((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App');

        let dataCount = 0;
        stream.on('data', () => {
          dataCount++;
        });

        stream.resume();

        setTimeout(() => {
          try {
            // Emit some audio
            capture.emit('audio', { data: Buffer.alloc(10) });
            assert.equal(dataCount, 1);

            // Stop the stream
            stream.stop();

            // Emit more audio - should be ignored
            capture.emit('audio', { data: Buffer.alloc(10) });
            assert.equal(dataCount, 1, 'Audio events after stop() should be ignored');

            resolve();
          } catch (err) {
            reject(err as Error);
          }
        }, 10);
      });
    });

    await t.test('should end stream when external stop event received', (t: TestContext, done: () => void) => {
      let activeCallback: ((sample: NativeAudioSample) => void) | null = null;

      const mockNative = {
        ScreenCaptureKit: class extends MockScreenCaptureKit {
          override getAvailableApps() {
            return MOCK_APPS;
          }
          override startCapture(pid: number, config: NativeCaptureConfig, callback: (sample: NativeAudioSample) => void): boolean {
            activeCallback = callback;
            return super.startCapture(pid, config, callback);
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100);

      stream.on('data', () => { });
      stream.on('end', () => {
        done();
      });

      // Wait for stream to start, then trigger external stop
      setTimeout(() => {
        capture.emit('stop', { processId: 100 });
      }, 10);
    });
  });
});
