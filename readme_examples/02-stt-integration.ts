import { AudioCapture, STTConverter, type AudioSample, type PermissionStatus, type ApplicationInfo, ErrorCode, AudioCaptureError } from '../src/index';
import { pipeline } from 'stream';
import { Writable } from 'stream';

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

// --- Approach 1: Simple approach with createSTTStream() ---
console.log('--- Approach 1: Simple STT Stream ---');

// Mock STT Writable Stream
const yourSTTWritableStream = new Writable({
    write(chunk, encoding, callback) {
        console.log(`[STT Stream] Received ${chunk.length} bytes of Int16 audio`);
        callback();
    }
});

// One-line STT stream with auto-conversion to Int16 mono
// Use TARGET_APP env var if set, otherwise try common apps
const appList = process.env.TARGET_APP ? [process.env.TARGET_APP] : ['Safari', 'Chrome', 'Zoom', 'Music', 'Spotify'];
const sttStream: STTConverter = capture.createSTTStream(appList, {
    minVolume: 0.01      // Filter silence
});

// Pipe directly to your STT engine
pipeline(
    sttStream,
    yourSTTWritableStream,
    (err) => {
        if (err) console.error('STT pipeline error:', err);
        else console.log('STT pipeline finished');
    }
);

// Which app was selected?
if (sttStream.app) {
    console.log(`Capturing from: ${sttStream.app.applicationName}`);
} else {
    console.log('No app selected for STT stream (maybe none running?)');
}

// Stop when done
setTimeout(() => {
    console.log('Stopping STT stream...');
    sttStream.stop?.();

    // --- Approach 2: Event-based approach ---
    // We'll run this after the first one finishes to avoid conflict
    runEventBasedApproach();
}, 5000);


function runEventBasedApproach() {
    console.log('\n--- Approach 2: Event-based STT ---');
    const capture2 = new AudioCapture();

    // Check permissions first
    const perms: PermissionStatus = AudioCapture.verifyPermissions();
    if (!perms.granted) {
        console.error(perms.message);
        console.log(perms.remediation);
        return;
    }

    // Smart app selection with fallback
    const appList2 = process.env.TARGET_APP ? [process.env.TARGET_APP] : ['Safari', 'Chrome', 'Zoom', 'Music', 'Spotify'];
    const app: ApplicationInfo | null = capture2.selectApp(appList2, { fallbackToFirst: true });
    if (!app) {
        console.error('No suitable app found');
        return;
    }

    console.log(`Selected app for event-based: ${app.applicationName}`);

    try {
        capture2.startCapture(app.processId, {
            format: 'int16',      // Most STT engines expect Int16
            channels: 1,          // Mono reduces bandwidth by 50%
            minVolume: 0.01       // Filter silence
        });

        capture2.on('audio', (sample: AudioSample) => {
            // sample.data is Int16 Buffer, ready for STT
            // sendToSTTEngine(sample.data, sample.sampleRate, sample.channels);
            console.log(`[Event STT] Got ${sample.data.length} bytes Int16 audio`);
        });

        capture2.on('error', (err) => console.error('Capture error:', err));

        setTimeout(() => {
            console.log('Stopping event-based capture...');
            capture2.stopCapture();
        }, 5000);

    } catch (err) {
        console.error('Failed to start capture:', err);
    }
}
