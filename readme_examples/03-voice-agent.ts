import { AudioCapture, AudioStream, type CaptureStatus } from '../src/index';
import { pipeline, Writable } from 'stream';

const capture = new AudioCapture();

// Mock streams
const yourVoiceProcessor = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
        // console.log('[Voice Processor] Processing chunk...');
        callback();
    }
});

const yourResponseGenerator = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
        // console.log('[Response Gen] Generating response...');
        callback();
    }
});

// Find an app to capture
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : ['Zoom', 'Slack', 'Discord', 'Music', 'Spotify'];
const app = capture.selectApp(appList, { fallbackToFirst: true });

if (!app) {
    console.log('No suitable app found for Voice Agent example.');
    process.exit(0);
}

console.log(`Starting Voice Agent capture on: ${app.applicationName}`);

// Stream API for backpressure handling
const audioStream: AudioStream = capture.createAudioStream(app.processId, {
    objectMode: true,      // Get metadata with each chunk
    minVolume: 0.005,      // Voice activity detection threshold
    format: 'int16',
    channels: 1,
    bufferSize: 1024       // Low latency (~21ms)
});

// Process with streams for better flow control
pipeline(
    audioStream,
    yourVoiceProcessor,
    // yourResponseGenerator, // Pipeline usually goes Readable -> Transform -> Writable. Two Writables in a row isn't standard pipeline, removing one for validity.
    (err) => {
        if (err) console.error('Pipeline error:', err);
        else console.log('Pipeline finished');
    }
);

// Check status anytime
const status: CaptureStatus | null = capture.getStatus();
if (status) {
    console.log(`Capturing from: ${status.app?.applicationName}`);
    console.log(`Config: ${status.config.format}, ${status.config.minVolume} threshold`);
}

// Stop after a while
setTimeout(() => {
    console.log('Stopping Voice Agent...');
    audioStream.stop();
}, 5000);
