/**
 * Example: Using the high-level SDK wrapper
 * This demonstrates the event-based API for easier integration
 */

const AudioCapture = require('../sdk');

console.log('ScreenCaptureKit SDK Example\n');

// Create capture instance
const capture = new AudioCapture();

// Event: Capture started
capture.on('start', ({ processId, app }) => {
  console.log('✓ Capture started');
  console.log(`  App: ${app?.applicationName || 'Unknown'}`);
  console.log(`  PID: ${processId}`);
  console.log(`  Bundle: ${app?.bundleIdentifier || 'Unknown'}\n`);
});

// Event: Audio sample received
let sampleCount = 0;
const maxSamples = 20;

capture.on('audio', (sample) => {
  sampleCount++;

  // Calculate volume in dB
  const dbRMS = AudioCapture.rmsToDb(sample.rms);
  const dbPeak = AudioCapture.peakToDb(sample.peak);

  // Log every sample (or every Nth sample for less verbose output)
  if (sampleCount <= 5 || sampleCount % 5 === 0) {
    console.log(`Sample #${sampleCount}:`);
    console.log(`  Duration: ${sample.durationMs.toFixed(2)} ms`);
    console.log(`  Samples: ${sample.sampleCount.toLocaleString()}`);
    console.log(`  RMS: ${sample.rms.toFixed(4)} (${dbRMS.toFixed(2)} dB)`);
    console.log(`  Peak: ${sample.peak.toFixed(4)} (${dbPeak.toFixed(2)} dB)`);

    // Visual volume indicator
    const bars = '█'.repeat(Math.floor(sample.rms * 50));
    console.log(`  Volume: [${bars}]\n`);
  }

  // Stop after maxSamples
  if (sampleCount >= maxSamples) {
    console.log(`Captured ${sampleCount} samples. Stopping...\n`);
    capture.stopCapture();
  }
});

// Event: Capture stopped
capture.on('stop', ({ processId }) => {
  console.log('✓ Capture stopped');
  console.log(`  Total samples captured: ${sampleCount}`);
  process.exit(0);
});

// Event: Error occurred
capture.on('error', (error) => {
  console.error('✗ Error:', error.message);
  process.exit(1);
});

// Main logic
const targetAppName = process.argv[2];

if (!targetAppName) {
  console.log('Usage: node example-sdk.js <app-name>');
  console.log('\nAvailable applications:');

  const apps = capture.getApplications();
  apps.slice(0, 10).forEach((app, index) => {
    console.log(`  ${index + 1}. ${app.applicationName}`);
  });

  if (apps.length > 10) {
    console.log(`  ... and ${apps.length - 10} more`);
  }

  console.log('\nExamples:');
  console.log('  node example-sdk.js Safari');
  console.log('  node example-sdk.js Music');
  console.log('  node example-sdk.js Spotify');
  process.exit(0);
}

// Start capturing
console.log(`Looking for application: ${targetAppName}\n`);

if (!capture.startCapture(targetAppName)) {
  console.error('Failed to start capture.');
  console.error('Make sure:');
  console.error('1. The application is running');
  console.error('2. Screen Recording permission is granted');
  console.error('3. You specified the correct app name');
  process.exit(1);
}

console.log('Capturing audio... (Ctrl+C to stop early)\n');

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nInterrupted by user.');
  capture.stopCapture();
});
