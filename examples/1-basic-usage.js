/**
 * Basic Usage - Event-Based API
 *
 * This example demonstrates the core functionality:
 * - Starting and stopping capture
 * - Receiving audio samples
 * - Volume threshold filtering
 * - Working with audio buffers
 * - Saving to WAV files
 */

const AudioCapture = require('../sdk');
const fs = require('fs');

const capture = new AudioCapture();

console.log('=== ScreenCaptureKit Audio Capture - Basic Usage ===\n');

// Find an app to capture (you can replace 'Spotify' with any app name)
const APP_NAME = 'Spotify'; // Change this to an app running on your system
const app = capture.findApplication(APP_NAME);

if (!app) {
  console.error(`❌ Application "${APP_NAME}" not found.`);
  console.log('\nAvailable applications:');
  const apps = capture.getApplications();
  apps.slice(0, 10).forEach(a => {
    console.log(`  • ${a.applicationName}`);
  });
  process.exit(1);
}

console.log(`✓ Found: ${app.applicationName} (PID: ${app.processId})\n`);

// Example 1: Basic audio capture with statistics
console.log('Starting capture with volume threshold...\n');

let sampleCount = 0;
let totalDuration = 0;
const audioChunks = [];

capture.on('start', (info) => {
  console.log(`✓ Capture started (PID: ${info.processId})`);
  console.log(`  Press Ctrl+C to stop\n`);
});

capture.on('audio', (sample) => {
  sampleCount++;
  totalDuration += sample.durationMs;

  // Convert Buffer to Float32Array for easier processing
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  // Calculate decibels
  const rmsDb = AudioCapture.rmsToDb(sample.rms);
  const peakDb = AudioCapture.peakToDb(sample.peak);

  // Log every 50th sample
  if (sampleCount % 50 === 0) {
    console.log(`Sample #${sampleCount}:`);
    console.log(`  Format: ${sample.format}`);
    console.log(`  Sample Rate: ${sample.sampleRate} Hz`);
    console.log(`  Channels: ${sample.channels}`);
    console.log(`  Samples: ${float32.length} (${sample.framesCount} frames)`);
    console.log(`  Duration: ${sample.durationMs.toFixed(2)} ms`);
    console.log(`  RMS: ${sample.rms.toFixed(4)} (${rmsDb.toFixed(1)} dB)`);
    console.log(`  Peak: ${sample.peak.toFixed(4)} (${peakDb.toFixed(1)} dB)`);
    console.log();
  }

  // Save audio chunks for WAV export (limit to 3 seconds)
  if (totalDuration < 3000) {
    audioChunks.push({
      data: sample.data,
      sampleRate: sample.sampleRate,
      channels: sample.channels,
      format: sample.format
    });
  }
});

capture.on('stop', () => {
  console.log(`\n✓ Capture stopped`);
  console.log(`  Total samples: ${sampleCount}`);
  console.log(`  Total duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  // Save captured audio to WAV file
  if (audioChunks.length > 0) {
    console.log('Saving to WAV file...');

    // Concatenate all audio chunks
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const combinedBuffer = Buffer.concat(audioChunks.map(c => c.data));

    // Use the first chunk's metadata (all should be the same)
    const { sampleRate, channels, format } = audioChunks[0];

    // Create WAV file
    const wavBuffer = AudioCapture.writeWav(combinedBuffer, {
      sampleRate,
      channels,
      format
    });

    // Write to disk
    const filename = `capture-${Date.now()}.wav`;
    fs.writeFileSync(filename, wavBuffer);

    console.log(`✓ Saved to ${filename}`);
    console.log(`  Size: ${(wavBuffer.length / 1024).toFixed(1)} KB`);
    console.log(`  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  }

  process.exit(0);
});

capture.on('error', (error) => {
  console.error(`❌ Error: ${error.message}`);
  if (error.details) {
    console.error('Details:', error.details);
  }
  process.exit(1);
});

// Start capture with options
capture.startCapture(app.applicationName, {
  minVolume: 0.01,    // Only emit when volume > 0.01 (filters silence)
  format: 'float32'   // Use Float32 format (default)
});

// Stop after 5 seconds
setTimeout(() => {
  console.log('\n⏱  5 seconds elapsed, stopping capture...');
  capture.stopCapture();
}, 5000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠  Interrupted by user');
  if (capture.isCapturing()) {
    capture.stopCapture();
  } else {
    process.exit(0);
  }
});
