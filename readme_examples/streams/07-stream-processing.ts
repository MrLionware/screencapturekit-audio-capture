import { AudioCapture, AudioStream, type AudioSample } from '../../src/index';
import { Transform, TransformCallback, pipeline } from 'stream';

// Global error handlers for test suite
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

const capture = new AudioCapture();

// Error handler
capture.on('error', (err) => {
    console.error('❌ Capture Error:', err.message);
});

// Create a transform stream to process audio
class VolumeAnalyzer extends Transform {
    constructor() {
        super({ objectMode: true });
    }

    override _transform(sample: AudioSample, encoding: BufferEncoding, callback: TransformCallback) {
        const db = AudioCapture.rmsToDb(sample.rms);
        console.log(`Volume: ${db.toFixed(1)} dB`);

        // Pass the sample through
        this.push(sample);
        callback();
    }
}

// Find app - use TARGET_APP env var if set
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : undefined;
const app = capture.selectApp(appList, { fallbackToFirst: true });
if (!app) {
    console.log('No app found.');
    process.exit(0);
}
console.log(`Analyzing volume from: ${app.applicationName}`);

// Create audio stream in object mode
const audioStream = capture.createAudioStream(app.processId, {
    objectMode: true,
    minVolume: 0.01
});

const analyzer = new VolumeAnalyzer();

// Use pipeline for proper error handling
pipeline(audioStream, analyzer, (err) => {
    if (err) console.error('Error:', err);
    else console.log('Stream ended');
});

// Stop after 10 seconds
setTimeout(() => audioStream.stop(), 10000);
