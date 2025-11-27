import { AudioCapture, type AudioSample } from '../../src/index';

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

// Find app - use TARGET_APP env var if set
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : undefined;
const app = capture.selectApp(appList, { fallbackToFirst: true });
if (!app) {
    console.log('No app found.');
    process.exit(0);
}
console.log(`Capturing Int16 from: ${app.applicationName}`);

// Request Int16 format instead of Float32
try {
    capture.startCapture(app.processId, {
        format: 'int16'
    });
} catch (err) {
    console.error('❌ Failed to start capture:', (err as Error).message);
    process.exit(1);
}

capture.on('audio', (sample: AudioSample) => {
    // sample.format will be 'int16'
    // sample.data contains Int16 samples

    // Convert to Int16Array for processing
    const int16 = new Int16Array(
        sample.data.buffer,
        sample.data.byteOffset,
        sample.data.byteLength / 2
    );

    console.log(`Got ${int16.length} Int16 samples. Range: ${Math.min(...int16)} to ${Math.max(...int16)}`);
});

setTimeout(() => {
    console.log('Stopping Int16 capture...');
    capture.stopCapture();
}, 5000);
