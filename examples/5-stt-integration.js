/**
 * Example 5: Speech-to-Text (STT) Integration
 * 
 * This example demonstrates how to use the createSTTStream() utility
 * to easily stream audio in a format compatible with most STT engines
 * (typically 16kHz or 48kHz, mono, 16-bit integer).
 */

const AudioCapture = require('../sdk');
const fs = require('fs');

// 1. Verify permissions first
const permStatus = AudioCapture.verifyPermissions();
if (!permStatus.granted) {
    console.error('Permission denied:', permStatus.message);
    console.log(permStatus.remediation);
    process.exit(1);
}

// 2. Create a capture instance
const capture = new AudioCapture();

// 3. Create an STT-ready stream
// This helper does several things automatically:
// - Selects an app (tries arguments, then falls back to first audio app)
// - Converts audio to Int16 (required by most STT)
// - Downmixes to Mono (required by most STT)
// - Handles stream lifecycle
console.log('Looking for audio source...');

try {
    // You can pass specific app names, or leave empty to find first available
    // Example: createSTTStream(['Zoom', 'Teams', 'Google Chrome'])
    const sttStream = capture.createSTTStream(null, {
        minVolume: 0.05 // Ignore silence to save bandwidth
    });

    console.log(`Started STT stream for: ${sttStream.app.applicationName} (PID: ${sttStream.app.processId})`);
    console.log('Format: Int16, Mono, 48kHz (default)');
    console.log('Speaking (audio > 5% volume) will be captured...');

    // 4. Simulate piping to an STT service
    // In a real app, you would pipe this to a WebSocket or HTTP request
    // sttStream.pipe(sttClient.createStream());

    // For this example, we'll just log data size
    let totalBytes = 0;
    let packets = 0;

    sttStream.on('data', (chunk) => {
        // If objectMode is true (default for createSTTStream), we get sample objects
        // If we piped to a file, we'd get raw buffers
        const size = chunk.data ? chunk.data.length : chunk.length;
        totalBytes += size;
        packets++;

        process.stdout.write(`\rCaptured: ${packets} packets (${(totalBytes / 1024).toFixed(1)} KB)`);
    });

    sttStream.on('error', (err) => {
        console.error('\nStream error:', err.message);
    });

    // Stop after 10 seconds
    setTimeout(() => {
        console.log('\nStopping capture...');
        sttStream.stop();
        console.log('Done.');
        process.exit(0);
    }, 10000);

} catch (err) {
    console.error('Failed to start stream:', err.message);
    if (err.details && err.details.availableApps) {
        console.log('Available apps:', err.details.availableApps.join(', '));
    }
    process.exit(1);
}
