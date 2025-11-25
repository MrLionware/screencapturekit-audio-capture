import { AudioCapture, type AudioSample } from '../src/index';

const capture = new AudioCapture();

// Find app
const app = capture.selectApp(undefined, { fallbackToFirst: true });
if (!app) {
    console.log('No app found.');
    process.exit(0);
}
console.log(`Capturing Int16 from: ${app.applicationName}`);

// Request Int16 format instead of Float32
capture.startCapture(app.processId, {
    format: 'int16'
});

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
