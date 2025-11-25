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
console.log(`Visualizing audio from: ${app.applicationName}`);

capture.on('audio', (sample: AudioSample) => {
    // Simple ASCII visualizer
    const db: number = AudioCapture.rmsToDb(sample.rms);
    const bars: number = Math.max(0, Math.round((db + 60) / 2)); // Map -60dB to 0dB
    console.log('|' + '█'.repeat(bars) + ' '.repeat(30 - bars) + '| ' + db.toFixed(1) + ' dB');
});

try {
    capture.startCapture(app.processId);
} catch (err) {
    console.error('❌ Failed to start capture:', (err as Error).message);
    process.exit(1);
}

setTimeout(() => {
    console.log('Stopping visualizer...');
    capture.stopCapture();
}, 10000);
