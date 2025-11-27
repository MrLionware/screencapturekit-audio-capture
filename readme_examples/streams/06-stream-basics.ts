import { AudioCapture, AudioStream, type AudioSample } from '../../src/index';
import { pipeline } from 'stream';
import fs from 'fs';
import path from 'path';

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

// Find an app - use TARGET_APP env var if set
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : ['Spotify', 'Music', 'Chrome'];
const app = capture.selectApp(appList, { fallbackToFirst: true });
if (!app) {
    console.log('No app found for stream basics.');
    process.exit(0);
}
console.log(`Streaming from: ${app.applicationName}`);

// Create a readable stream
const audioStream: AudioStream = capture.createAudioStream(app.processId, {
    minVolume: 0.01,
    format: 'float32'
});

// Pipe to a file (just for demonstration)
const outputPath = path.join(__dirname, 'stream_output.raw');
const writeStream = fs.createWriteStream(outputPath);

// Pipe to any writable stream
audioStream.pipe(writeStream);

// Stop the stream
setTimeout(() => {
    console.log('Stopping stream...');
    audioStream.stop();

    // Run Object Mode example
    runObjectModeExample();
}, 3000);


function runObjectModeExample() {
    console.log('\n--- Object Mode Example ---');
    const capture2 = new AudioCapture();
    const appList2 = process.env.TARGET_APP ? [process.env.TARGET_APP] : undefined;
    const app2 = capture2.selectApp(appList2, { fallbackToFirst: true });

    if (!app2) return;

    // Returns full sample objects with metadata
    const audioStream2: AudioStream = capture2.createAudioStream(app2.processId, {
        objectMode: true
    });

    audioStream2.on('data', (sample: AudioSample) => {
        // sample contains both data and metadata
        if (sample.rms > 0.01) {
            console.log(`Loud audio detected: ${sample.rms.toFixed(4)}`);
            // processAudio(sample.data);
        }
    });

    setTimeout(() => {
        console.log('Stopping object mode stream...');
        audioStream2.stop();
    }, 3000);
}
