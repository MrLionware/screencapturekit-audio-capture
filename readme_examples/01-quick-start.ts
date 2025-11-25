import { AudioCapture, type AudioSample, type ApplicationInfo } from '../src/index';

const capture = new AudioCapture();

// List available applications
const apps: ApplicationInfo[] = capture.getApplications();
apps.forEach((app) => {
    console.log(`${app.applicationName} (PID: ${app.processId})`);
    console.log(`  Bundle ID: ${app.bundleIdentifier}`);
});

// Start capturing from Spotify (or first available audio app if not found)
const audioApps = capture.getAudioApps();
const targetApp = audioApps.find(a => a.applicationName === 'Spotify') || audioApps[0];

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

capture.startCapture(targetApp.processId);

// Stop after 10 seconds
setTimeout(() => {
    console.log('Stopping capture...');
    capture.stopCapture();
}, 10000);
