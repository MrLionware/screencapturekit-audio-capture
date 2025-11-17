/**
 * Volume Threshold Example
 *
 * Demonstrates how to use the minVolume option to only receive audio
 * events when sound is actually present, filtering out silence.
 *
 * This is useful for:
 * - Saving CPU by not processing silent audio
 * - Detecting when audio playback starts/stops
 * - Reducing bandwidth when streaming audio data
 */

const AudioCapture = require('..');

const capture = new AudioCapture();

// Find Spotify (or any audio app you have running)
const app = capture.findByName('Spotify');

if (!app) {
  console.error('❌ Spotify not found. Please make sure Spotify is running.');
  console.log('\nAvailable audio apps:');
  const audioApps = capture.getAudioApps();
  audioApps.forEach(a => console.log(`  - ${a.applicationName}`));
  process.exit(1);
}

console.log(`Found: ${app.applicationName} (PID: ${app.processId})\n`);

// Only emit audio events when RMS volume > 0.01
// This filters out silence and very quiet background noise
const MIN_VOLUME = 0.01;

console.log(`Starting capture with volume threshold: ${MIN_VOLUME}`);
console.log('Audio events will only fire when sound is present.\n');

capture.startCapture(app.processId, { minVolume: MIN_VOLUME });

let eventCount = 0;

capture.on('audio', (sample) => {
  eventCount++;

  const db = AudioCapture.rmsToDb(sample.rms);
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  console.log(`[Event ${eventCount}] 🔊 Audio detected!`);
  console.log(`  Volume: ${db.toFixed(1)} dB (RMS: ${sample.rms.toFixed(4)})`);
  console.log(`  Peak: ${sample.peak.toFixed(4)}`);
  console.log(`  Samples: ${float32.length}`);
  console.log(`  Duration: ${sample.durationMs.toFixed(1)}ms`);
  console.log('');
});

capture.on('start', ({ app }) => {
  console.log(`✅ Started monitoring ${app.applicationName}`);
  console.log(`   Waiting for audio above threshold...\n`);
});

capture.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

// Stop after 60 seconds
setTimeout(() => {
  capture.stopCapture();
  console.log(`\nStopped capture. Received ${eventCount} audio events.`);
  console.log('(Silent periods were filtered out)');
  process.exit(0);
}, 60000);

console.log('Tip: Play some audio in Spotify to see events being emitted.');
console.log('     When audio is silent, no events will be emitted.\n');
