const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSDKWithMock } = require('./helpers/test-utils');

// Mock data
const MOCK_APPS = [
    {
        processId: 100,
        bundleIdentifier: 'com.example.app',
        applicationName: 'Example App'
    },
    {
        processId: 200,
        bundleIdentifier: 'com.music.player',
        applicationName: 'Music Player'
    },
    {
        processId: 300,
        bundleIdentifier: 'com.apple.finder',
        applicationName: 'Finder'
    }
];

test('AudioCapture Initialization', async (t) => {
    await t.test('should initialize correctly', () => {
        const { AudioCapture } = loadSDKWithMock();
        const capture = new AudioCapture();

        assert.ok(capture instanceof AudioCapture);
        assert.equal(capture.capturing, false);
        assert.equal(capture.currentProcessId, null);
    });
});

test('Application Discovery', async (t) => {
    const mockNative = {
        ScreenCaptureKit: class {
            getAvailableApps() { return MOCK_APPS; }
        }
    };

    const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
    const capture = new AudioCapture();

    await t.test('getApplications should return all apps', () => {
        const apps = capture.getApplications();
        assert.deepEqual(apps, MOCK_APPS);
    });

    await t.test('findApplication should find by name', () => {
        const app = capture.findApplication('Music Player');
        assert.deepEqual(app, MOCK_APPS[1]);
    });

    await t.test('findApplication should find by bundle ID', () => {
        const app = capture.findApplication('com.example.app');
        assert.deepEqual(app, MOCK_APPS[0]);
    });

    await t.test('findApplication should return undefined for unknown app', () => {
        const app = capture.findApplication('Unknown App');
        assert.equal(app, undefined);
    });

    await t.test('getApplicationByPid should find by PID', () => {
        const app = capture.getApplicationByPid(200);
        assert.deepEqual(app, MOCK_APPS[1]);
    });

    await t.test('getAudioApps should filter system apps by default', () => {
        const audioApps = capture.getAudioApps();
        assert.equal(audioApps.length, 2);
        assert.ok(audioApps.find(a => a.applicationName === 'Example App'));
        assert.ok(audioApps.find(a => a.applicationName === 'Music Player'));
        assert.ok(!audioApps.find(a => a.applicationName === 'Finder'));
    });

    await t.test('getAudioApps should return all apps if includeSystemApps is true', () => {
        const audioApps = capture.getAudioApps({ includeSystemApps: true });
        assert.equal(audioApps.length, 3);
    });
});

test('Capture Control & Audio Processing', async (t) => {
    let capturedCallback = null;
    let startCaptureCalledWith = null;
    let stopCaptureCalled = false;

    const mockNative = {
        ScreenCaptureKit: class {
            getAvailableApps() { return MOCK_APPS; }
            startCapture(pid, config, callback) {
                startCaptureCalledWith = { pid, config };
                capturedCallback = callback;
                return true;
            }
            stopCapture() {
                stopCaptureCalled = true;
            }
        }
    };

    const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });
    const capture = new AudioCapture();

    await t.test('startCapture should start capturing with valid app name', () => {
        const success = capture.startCapture('Music Player');
        assert.equal(success, true);
        assert.equal(capture.isCapturing(), true);
        assert.equal(startCaptureCalledWith.pid, 200);
        assert.equal(typeof capturedCallback, 'function');
    });

    await t.test('startCapture should fail if already capturing', () => {
        let errorEmitted = null;
        capture.once('error', (err) => { errorEmitted = err; });

        assert.throws(() => {
            capture.startCapture('Example App');
        }, (err) => {
            assert.equal(err.code, ErrorCodes.ALREADY_CAPTURING);
            return true;
        });

        assert.ok(errorEmitted);
        assert.equal(errorEmitted.code, ErrorCodes.ALREADY_CAPTURING);
    });

    await t.test('stopCapture should stop capturing', (t, done) => {
        capture.once('stop', (data) => {
            assert.equal(data.processId, 200);
            assert.equal(capture.isCapturing(), false);
            assert.equal(stopCaptureCalled, true);
            done();
        });
        capture.stopCapture();
    });

    await t.test('Audio Processing - RMS and Format', (t, done) => {
        // Reset state
        capturedCallback = null;
        startCaptureCalledWith = null;

        capture.startCapture('Music Player', { format: 'int16', minVolume: 0.1 });

        // Create a mock float buffer
        const floatData = new Float32Array(1024);
        for (let i = 0; i < floatData.length; i++) {
            floatData[i] = 0.5; // constant value
        }
        const buffer = Buffer.from(floatData.buffer);

        const mockSample = {
            data: buffer,
            sampleRate: 48000,
            channelCount: 2,
            timestamp: 1234567890
        };

        capture.once('audio', (sample) => {
            // Verify format conversion
            assert.equal(sample.format, 'int16');
            assert.ok(sample.data instanceof Buffer);
            // Int16 value for 0.5 should be around 16384 (0.5 * 32767)
            const int16View = new Int16Array(sample.data.buffer, sample.data.byteOffset, sample.data.length / 2);
            assert.ok(Math.abs(int16View[0] - 16384) < 5);

            // Verify computed properties
            assert.equal(sample.sampleRate, 48000);
            assert.equal(sample.channels, 2);
            assert.ok(sample.rms > 0);
            assert.ok(sample.peak > 0);

            capture.stopCapture();
            done();
        });

        // Simulate native callback
        capturedCallback(mockSample);
    });

    await t.test('Audio Processing - Volume Threshold', (t) => {
        // Reset state
        capturedCallback = null;
        capture.startCapture('Music Player', { minVolume: 0.8 }); // High threshold

        let audioEmitted = false;
        const handler = () => { audioEmitted = true; };
        capture.on('audio', handler);

        // Create quiet sample (0.1 amplitude)
        const floatData = new Float32Array(100);
        floatData.fill(0.1);
        const buffer = Buffer.from(floatData.buffer);

        capturedCallback({
            data: buffer,
            sampleRate: 48000,
            channelCount: 2,
            timestamp: 100
        });

        assert.equal(audioEmitted, false, 'Should not emit audio below threshold');

        capture.removeListener('audio', handler);
        capture.stopCapture();
    });
});

test('AudioStream', async (t) => {
    const mockNative = {
        ScreenCaptureKit: class {
            getAvailableApps() { return MOCK_APPS; }
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
            stopCapture() { }
        }
    };

    const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
    const capture = new AudioCapture();

    await t.test('createAudioStream should return readable stream', () => {
        const stream = capture.createAudioStream('Music Player');
        assert.ok(stream);
        assert.equal(typeof stream.on, 'function');
        assert.equal(typeof stream.pipe, 'function');
    });

    await t.test('stream should emit data events', (t, done) => {
        const stream = capture.createAudioStream('Music Player');

        stream.once('data', (chunk) => {
            assert.ok(chunk instanceof Buffer);
            stream.destroy();
            done();
        });
    });

    await t.test('stream should emit objects in objectMode', (t, done) => {
        const stream = capture.createAudioStream('Music Player', { objectMode: true });

        stream.once('data', (sample) => {
            assert.equal(typeof sample, 'object');
            assert.ok(sample.data instanceof Buffer);
            assert.equal(sample.sampleRate, 48000);
            stream.destroy();
            done();
        });
    });
});

test('Static Utilities', async (t) => {
    const { AudioCapture } = loadSDKWithMock();

    await t.test('bufferToFloat32Array should convert buffer', () => {
        const floatData = new Float32Array([0.5, -0.5, 0.0]);
        const buffer = Buffer.from(floatData.buffer);

        const result = AudioCapture.bufferToFloat32Array(buffer);
        assert.deepEqual(result, floatData);
    });

    await t.test('rmsToDb/peakToDb should calculate decibels', () => {
        // 1.0 -> 0 dB
        assert.equal(AudioCapture.rmsToDb(1.0), 0);
        // 0.5 -> ~-6 dB
        assert.ok(Math.abs(AudioCapture.rmsToDb(0.5) - (-6.02)) < 0.01);
        // 0 -> -Infinity
        assert.equal(AudioCapture.rmsToDb(0), -Infinity);
    });

    await t.test('writeWav should create valid WAV header', () => {
        const floatData = new Float32Array(100);
        const buffer = Buffer.from(floatData.buffer);

        const wav = AudioCapture.writeWav(buffer, {
            sampleRate: 48000,
            channels: 2,
            format: 'float32'
        });

        // Check RIFF header
        assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
        assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
        assert.equal(wav.toString('ascii', 12, 16), 'fmt ');

        // Check sample rate (offset 24, 4 bytes)
        assert.equal(wav.readUInt32LE(24), 48000);

        // Check channels (offset 22, 2 bytes)
        assert.equal(wav.readUInt16LE(22), 2);
    });
});
