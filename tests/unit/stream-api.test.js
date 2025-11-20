/**
 * Unit Tests: AudioStream API
 *
 * Tests for AudioStream functionality:
 * - Stream creation and data flow
 * - Object mode vs buffer mode
 * - Stream lifecycle and cleanup
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createNativeMock } = require('../fixtures/mock-native');
const { loadSDKWithMock } = require('../helpers/test-utils');
const { MOCK_APPS } = require('../fixtures/mock-data');

test('AudioStream', async (t) => {
  await t.test('Basic Stream Creation', async (t) => {
    await t.test('should return readable stream', () => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            // Simulate async data flow
            setTimeout(() => {
              const floatData = new Float32Array(1024);
              const buffer = Buffer.from(floatData.buffer);
              callback({
                data: buffer,
                sampleRate: 48000,
                channelCount: 2,
                timestamp: 123
              });
            }, 10);
            return true;
          }
          stopCapture() {}
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream('Music Player');

      assert.ok(stream);
      assert.equal(typeof stream.on, 'function');
      assert.equal(typeof stream.pipe, 'function');
    });

    await t.test('should emit data events', (t, done) => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            setTimeout(() => {
              const floatData = new Float32Array(1024);
              const buffer = Buffer.from(floatData.buffer);
              callback({
                data: buffer,
                sampleRate: 48000,
                channelCount: 2,
                timestamp: 123
              });
            }, 10);
            return true;
          }
          stopCapture() {}
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream('Music Player');

      stream.once('data', (chunk) => {
        assert.ok(chunk instanceof Buffer);
        stream.destroy();
        done();
      });
    });

    await t.test('should emit objects in objectMode', (t, done) => {
      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            setTimeout(() => {
              const floatData = new Float32Array(1024);
              const buffer = Buffer.from(floatData.buffer);
              callback({
                data: buffer,
                sampleRate: 48000,
                channelCount: 2,
                timestamp: 123
              });
            }, 10);
            return true;
          }
          stopCapture() {}
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
    await t.test('should stream raw buffers by default', (t, done) => {
      let activeCallback = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            activeCallback = callback;
            return true;
          }
          stopCapture() {
            activeCallback = null;
          }
          isCapturing() {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100);

      assert.ok(stream instanceof AudioStream);
      assert.ok(stream instanceof Readable);

      const receivedChunks = [];
      stream.on('data', (chunk) => {
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

    await t.test('should stream objects when objectMode is true', (t, done) => {
      let activeCallback = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            activeCallback = callback;
            return true;
          }
          stopCapture() {
            activeCallback = null;
          }
          isCapturing() {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100, {
        objectMode: true
      });

      const receivedChunks = [];
      stream.on('data', (chunk) => {
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
    await t.test('should stop capture when stream is destroyed', (t, done) => {
      let activeCallback = null;
      let stopCalled = false;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            activeCallback = callback;
            return true;
          }
          stopCapture() {
            stopCalled = true;
            activeCallback = null;
          }
          isCapturing() {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100);

      // Start the stream flow
      stream.on('data', () => {});

      setTimeout(() => {
        stream.destroy();
        assert.equal(stopCalled, true);
        done();
      }, 10);
    });

    await t.test('should match underlying capture info', async () => {
      let activeCallback = null;

      const mockNative = {
        ScreenCaptureKit: class {
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            activeCallback = callback;
            return true;
          }
          stopCapture() {
            activeCallback = null;
          }
          isCapturing() {
            return !!activeCallback;
          }
        }
      };

      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const stream = capture.createAudioStream(100, {
        objectMode: true
      });

      stream.on('data', () => {});
      await new Promise((resolve) => capture.once('start', resolve));

      if (activeCallback) {
        const buffer = Buffer.alloc(1024);
        activeCallback({
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
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            this.callback = callback;
            return true;
          }
          stopCapture() {}
          isCapturing() {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise((resolve, reject) => {
        const capture = new AudioCapture();
        const stream = new AudioStream(capture, 'Example App');

        stream.on('data', (chunk) => {
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
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            this.callback = callback;
            return true;
          }
          stopCapture() {}
          isCapturing() {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise((resolve, reject) => {
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
          getAvailableApps() {
            return MOCK_APPS;
          }
          startCapture(pid, config, callback) {
            this.callback = callback;
            return true;
          }
          stopCapture() {}
          isCapturing() {
            return true;
          }
        }
      };

      const { AudioCapture, AudioStream } = loadSDKWithMock({ nativeMock: mockNative });

      return new Promise((resolve, reject) => {
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
            reject(err);
          }
        }, 10);
      });
    });
  });
});
