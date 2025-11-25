import { AudioCapture, type AudioSample } from '../src/index';

const capture = new AudioCapture();

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

capture.startCapture(app.processId);

setTimeout(() => {
    console.log('Stopping visualizer...');
    capture.stopCapture();
}, 10000);
