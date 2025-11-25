import { AudioCapture, type AudioSample } from '../src/index';
import fs from 'fs';
import path from 'path';

const capture = new AudioCapture();
const chunks: Buffer[] = [];

// Find an app
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : ['Music', 'Spotify', 'YouTube', 'Safari'];
const app = capture.selectApp(appList, { fallbackToFirst: true });

if (!app) {
    console.log('No app found for recording.');
    process.exit(0);
}

console.log(`Recording from: ${app.applicationName}`);

// Efficient configuration for recording
capture.startCapture(app.processId, {
    format: 'int16',       // 50% smaller than float32
    channels: 2,           // Preserve stereo
    bufferSize: 4096       // Larger buffer = lower CPU
});

capture.on('audio', (sample: AudioSample) => {
    chunks.push(sample.data);

    // Monitor levels
    const db: number = AudioCapture.rmsToDb(sample.rms);
    // Only log occasionally to avoid spam
    if (Math.random() < 0.05) console.log(`Level: ${db.toFixed(1)} dB`);
});

capture.on('stop', () => {
    // Save as WAV file
    const combined: Buffer = Buffer.concat(chunks);
    const wav: Buffer = AudioCapture.writeWav(combined, {
        sampleRate: 48000,
        channels: 2,
        format: 'int16'
    });

    const outputPath = path.join(__dirname, 'recording.wav');
    fs.writeFileSync(outputPath, wav);
    console.log(`Saved recording.wav to ${outputPath}`);
});

// Stop after 5 seconds
setTimeout(() => capture.stopCapture(), 5000);
