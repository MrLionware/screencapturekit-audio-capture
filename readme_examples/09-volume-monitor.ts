import { AudioCapture, type AudioSample } from '../src/index';

const capture = new AudioCapture();

const LOUD_THRESHOLD = -20; // dB
const QUIET_THRESHOLD = -40; // dB

// Find app - use TARGET_APP env var if set
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : undefined;
const app = capture.selectApp(appList, { fallbackToFirst: true });
if (!app) {
    console.log('No app found.');
    process.exit(0);
}
console.log(`Monitoring volume from: ${app.applicationName}`);

capture.on('audio', (sample: AudioSample) => {
    const db: number = AudioCapture.rmsToDb(sample.rms);

    if (db > LOUD_THRESHOLD) {
        console.log(`⚠️ LOUD: ${db.toFixed(1)} dB`);
    } else if (db < QUIET_THRESHOLD) {
        console.log(`🔇 Quiet: ${db.toFixed(1)} dB`);
    } else {
        console.log(`🟢 Normal: ${db.toFixed(1)} dB`);
    }
});

capture.startCapture(app.processId);

// Stop after 10 seconds
setTimeout(() => {
    console.log('Stopping volume monitor...');
    capture.stopCapture();

    // Run Smart Audio Detection example
    runSmartDetection();
}, 10000);

function runSmartDetection() {
    console.log('\n--- Smart Audio Detection (Min Volume) ---');
    const capture2 = new AudioCapture();
    const appList2 = process.env.TARGET_APP ? [process.env.TARGET_APP] : undefined;
    const app2 = capture2.selectApp(appList2, { fallbackToFirst: true });

    if (!app2) return;

    // Only emit events when there's actual audio
    capture2.startCapture(app2.processId, {
        minVolume: 0.01  // Ignore audio below this RMS threshold
    });

    capture2.on('audio', (sample: AudioSample) => {
        // This only fires when audio is present
        console.log(`Active audio: ${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB`);
    });

    setTimeout(() => {
        console.log('Stopping smart detection...');
        capture2.stopCapture();
    }, 5000);
}
