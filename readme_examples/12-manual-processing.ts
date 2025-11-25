import { AudioCapture, type AudioSample } from '../src/index';

const capture = new AudioCapture();

// Find app
const app = capture.selectApp(undefined, { fallbackToFirst: true });
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

capture.startCapture(app.processId);

setTimeout(() => {
    console.log('Stopping manual processing...');
    capture.stopCapture();
}, 5000);
