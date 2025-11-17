/**
 * Int16 Format Example
 *
 * Demonstrates how to capture audio in Int16 format instead of Float32.
 * This is useful when working with audio libraries that expect Int16 data.
 *
 * Format comparison:
 * - Float32: Range -1.0 to 1.0 (4 bytes per sample)
 * - Int16: Range -32768 to 32767 (2 bytes per sample)
 */

const AudioCapture = require('..');
const fs = require('fs');
const path = require('path');

const capture = new AudioCapture();

// Get audio applications only (filters out system apps)
const audioApps = capture.getAudioApps();

if (audioApps.length === 0) {
  console.error('❌ No audio apps found.');
  console.log('Make sure you have apps like Spotify, Music, Safari, etc. running.');
  process.exit(1);
}

console.log('Available audio apps:');
audioApps.forEach((app, i) => {
  console.log(`  ${i + 1}. ${app.applicationName} (PID: ${app.processId})`);
});

// Use the first audio app
const app = audioApps[0];
console.log(`\nUsing: ${app.applicationName}\n`);

// Capture in Int16 format
console.log('Starting capture in Int16 format...\n');
capture.startCapture(app.processId, { format: 'int16' });

const chunks = [];
let sampleCount = 0;

capture.on('audio', (sample) => {
  sampleCount++;

  // sample.data is now Int16 format
  const int16 = new Int16Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 2
  );

  // Store chunk for later saving
  chunks.push(Buffer.from(sample.data));

  // Calculate statistics
  let min = 32767;
  let max = -32768;
  let sum = 0;

  for (let i = 0; i < int16.length; i++) {
    const val = int16[i];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += Math.abs(val);
  }

  const avgAmplitude = sum / int16.length;

  console.log(`[Sample ${sampleCount}]`);
  console.log(`  Format: ${sample.format}`);
  console.log(`  Samples: ${int16.length}`);
  console.log(`  Range: ${min} to ${max}`);
  console.log(`  Avg Amplitude: ${avgAmplitude.toFixed(0)}`);
  console.log(`  RMS: ${sample.rms.toFixed(4)} (${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB)`);
  console.log(`  Duration: ${sample.durationMs.toFixed(1)}ms`);
  console.log('');

  // Stop after 5 seconds
  if (sampleCount >= 30) {
    capture.stopCapture();
  }
});

capture.on('stop', () => {
  console.log('\n✅ Capture stopped\n');

  // Save the recorded audio
  const audioData = Buffer.concat(chunks);
  const outputPath = path.join(__dirname, 'recording-int16.raw');

  fs.writeFileSync(outputPath, audioData);

  // Save metadata
  const metadata = {
    format: 'int16',
    sampleRate: 48000,
    channels: 2,
    sampleCount: sampleCount,
    fileSize: audioData.length,
    durationSeconds: (audioData.length / 2 / 48000 / 2).toFixed(2)
  };

  const metadataPath = path.join(__dirname, 'recording-int16.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log('Saved recording:');
  console.log(`  Audio: ${outputPath} (${(audioData.length / 1024).toFixed(2)} KB)`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`  Duration: ${metadata.durationSeconds}s`);
  console.log('\nTo play with ffplay:');
  console.log(`  ffplay -f s16le -ar 48000 -ac 2 ${outputPath}`);

  process.exit(0);
});

capture.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

console.log('Recording for 5 seconds...\n');
