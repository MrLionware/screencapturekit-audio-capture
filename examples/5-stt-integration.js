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
    // Try common audio apps first, then fall back to first available
    // This prioritizes apps that are more likely to be playing audio
    const sttStream = capture.createSTTStream([
        'Spotify',
        'Music',
        'Google Chrome',
        'Chrome',
        'Safari',
        'Arc',
        'Firefox',
        'Zoom',
        'Teams',
        'Discord',
        'Slack'
    ], {
        minVolume: 0.05, // Ignore silence to save bandwidth
        autoSelect: true  // Fall back to first available if none match
    });

    console.log(`Started STT stream for: ${sttStream.app.applicationName} (PID: ${sttStream.app.processId})`);
    console.log('Format: Int16, Mono, 48kHz (default)');
    console.log('Minimum volume: 5% (ignoring silence)');
    console.log('\n🎧 Listening for audio...');

    // 4. Simulate piping to an STT service
    // In a real app, you would pipe this to a WebSocket or HTTP request
    // sttStream.pipe(sttClient.createStream());

    // For this example, we'll just log data size
    let totalBytes = 0;
    let packets = 0;
    let hasReceivedData = false;

    sttStream.on('data', (chunk) => {
        // By default, createSTTStream outputs raw buffers (objectMode: false)
        // If objectMode: true was passed, we'd get sample objects with metadata
        const size = chunk.data ? chunk.data.length : chunk.length;
        totalBytes += size;
        packets++;

        if (!hasReceivedData) {
            hasReceivedData = true;
            console.log('✓ Receiving audio data!');
        }

        process.stdout.write(`\rCaptured: ${packets} packets (${(totalBytes / 1024).toFixed(1)} KB)`);
    });

    sttStream.on('error', (err) => {
        console.error('\nStream error:', err.message);
    });

    // Stop after 10 seconds
    setTimeout(() => {
        console.log('\n\n⏹  Stopping capture...');
        sttStream.stop();

        if (packets === 0) {
            console.log('\n⚠️  No audio captured.');
            console.log('   Make sure the selected app is playing audio and volume is above 5%.');
        } else {
            console.log(`\n✓ Captured ${packets} packets (${(totalBytes / 1024).toFixed(1)} KB)`);
        }

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
