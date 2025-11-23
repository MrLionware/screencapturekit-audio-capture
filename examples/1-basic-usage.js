/**
 * Basic Usage - Event-Based API
 *
 * Best practices demonstrated here:
 * - Verifying Screen Recording permission
 * - Smart app selection with fallbacks
 * - Activity tracking for audio apps
 * - Accessing capture status metadata
 * - Saving buffers to WAV on stop
 */

const AudioCapture = require('../sdk');
const fs = require('fs');

console.log('=== ScreenCaptureKit Audio Capture - Basic Usage ===\n');

// 1) Verify permissions up front so we can provide actionable guidance
const permissionStatus = AudioCapture.verifyPermissions();
console.log(`Permission check: ${permissionStatus.message}`);
if (!permissionStatus.granted) {
  console.error('\nGrant Screen Recording permission and re-run this example.');
  if (permissionStatus.remediation) {
    console.error(permissionStatus.remediation);
  }
  process.exit(1);
}

const capture = new AudioCapture();
capture.enableActivityTracking({ decayMs: 60_000 });

// 2) Smart target selection (reuse the permission app list to avoid extra native calls)
const cliIdentifiers = process.argv.slice(2).filter(Boolean);
const defaultCandidates = cliIdentifiers.length > 0
  ? cliIdentifiers
  : ['Spotify', 'Music', 'Google Chrome', 'Safari', 'Arc', 'Firefox'];

// Filter/sort the prefetched apps instead of calling getApplications() again
const apps = capture.getAudioApps({
  appList: permissionStatus.apps,
  sortByActivity: true
});

const targetApp = capture.selectApp(defaultCandidates, {
  appList: apps,
  fallbackToFirst: cliIdentifiers.length === 0,
  audioOnly: false // apps is already audio-only from getAudioApps()
});

if (!targetApp) {
  console.error('❌ No audio-capable applications were found.');
  console.log('\nAvailable applications:');
  const fallbackList = (apps.length ? apps : (permissionStatus.apps || [])).slice(0, 10);
  fallbackList.forEach(app => {
    console.log(`  • ${app.applicationName}`);
  });
  process.exit(1);
}

console.log(`Targeting ${targetApp.applicationName} (PID ${targetApp.processId}) [${targetApp.bundleIdentifier}]`);
console.log('Starting capture with volume threshold...\n');

let sampleCount = 0;
let totalDuration = 0;
const audioChunks = [];

capture.on('start', (info) => {
  console.log(`✓ Capture started (${info.targetType})`);
  logStatusSnapshot('Current status', capture.getStatus());
});

capture.on('audio', (sample) => {
  sampleCount++;
  totalDuration += sample.durationMs;

  // Convert Buffer to Float32Array for easier processing
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  // Calculate decibels
  const rmsDb = AudioCapture.rmsToDb(sample.rms);
  const peakDb = AudioCapture.peakToDb(sample.peak);

  if (sampleCount % 50 === 0) {
    console.log(`Sample #${sampleCount}:`);
    console.log(`  ${sample.sampleRate}Hz, ${sample.channels}ch, ${sample.format}`);
    console.log(`  Frames: ${sample.framesCount}, Duration: ${sample.durationMs.toFixed(2)}ms`);
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
  console.log(`  Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
  logStatusSnapshot('Final status', capture.getStatus());

  const activity = capture.getActivityInfo();
  console.log(`Tracked apps: ${activity.trackedApps} (activity tracking ${activity.enabled ? 'enabled' : 'disabled'})\n`);

  if (audioChunks.length > 0) {
    console.log('Saving to WAV file...');

    const combinedBuffer = Buffer.concat(audioChunks.map(c => c.data));
    const { sampleRate, channels, format } = audioChunks[0];

    const wavBuffer = AudioCapture.writeWav(combinedBuffer, {
      sampleRate,
      channels,
      format
    });

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

// Start capture with options - pass the full targetApp object to bypass redundant app lookup
try {
  capture.startCapture(targetApp, {
    minVolume: 0.01,    // Filter silence
    format: 'float32'
  });
} catch (err) {
  // Error already emitted via 'error' event
}

// Stop after 5 seconds
const stopTimer = setTimeout(() => {
  console.log('\n⏱  5 seconds elapsed, stopping capture...');
  capture.stopCapture();
}, 5000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠  Interrupted by user');
  clearTimeout(stopTimer);
  if (capture.isCapturing()) {
    capture.stopCapture();
  } else {
    process.exit(0);
  }
});

function logStatusSnapshot(label, status) {
  if (!status) {
    console.log(`${label}: not capturing`);
    return;
  }

  console.log(`${label}:`);
  console.log(`  Target Type: ${status.targetType}`);
  if (status.app) {
    console.log(`  App: ${status.app.applicationName} (${status.processId || 'n/a'})`);
  }
  console.log(`  Format: ${status.config.format}, Min Volume: ${status.config.minVolume}`);
  console.log();
}
