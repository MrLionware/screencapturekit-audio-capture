import { AudioCapture, type AudioSample, type ApplicationInfo } from '../../src/index';

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

// List available applications
const apps: ApplicationInfo[] = capture.getApplications();
apps.forEach((app) => {
    console.log(`${app.applicationName} (PID: ${app.processId})`);
    console.log(`  Bundle ID: ${app.bundleIdentifier}`);
});

// Start capturing from TARGET_APP env var, or Spotify, or first available audio app
const audioApps = capture.getAudioApps();
const targetAppName = process.env.TARGET_APP;
const targetApp = targetAppName 
    ? audioApps.find(a => a.applicationName === targetAppName) || audioApps[0]
    : audioApps.find(a => a.applicationName === 'Spotify') || audioApps[0];

if (!targetApp) {
    console.log('No audio apps found to capture from.');
    process.exit(0);
}

console.log(`Capturing from: ${targetApp.applicationName}`);

capture.on('audio', (sample: AudioSample) => {
    // Convert Buffer to Float32Array for easier processing
    const float32: Float32Array = AudioCapture.bufferToFloat32Array(sample.data);

    console.log(`Got ${float32.length} samples at ${sample.sampleRate}Hz`);
    console.log(`Volume: ${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB`);
});

try {
    capture.startCapture(targetApp.processId);
} catch (err) {
    console.error('❌ Failed to start capture:', (err as Error).message);
    process.exit(1);
}

// Stop after 10 seconds
setTimeout(() => {
    console.log('Stopping capture...');
    capture.stopCapture();
}, 10000);
