import { AudioCapture, type AudioSample } from '../src/index';

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
console.log(`Processing samples from: ${app.applicationName}`);

capture.on('audio', (sample: AudioSample) => {
    // Convert Buffer to Float32Array
    const float32: Float32Array = AudioCapture.bufferToFloat32Array(sample.data);

    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < float32.length; i++) {
        sum += Math.abs(float32[i]);
    }
    const avgAmplitude: number = sum / float32.length;

    // Find min/max values
    let min = 0, max = 0;
    for (let i = 0; i < float32.length; i++) {
        if (float32[i] < min) min = float32[i];
        if (float32[i] > max) max = float32[i];
    }

    console.log(`Samples: ${float32.length}, Avg: ${avgAmplitude.toFixed(4)}, Range: [${min.toFixed(4)}, ${max.toFixed(4)}]`);
});

try {
    capture.startCapture(app.processId);
} catch (err) {
    console.error('❌ Failed to start capture:', (err as Error).message);
    process.exit(1);
}

setTimeout(() => {
    console.log('Stopping manual processing...');
    capture.stopCapture();
}, 5000);
