/**
 * Buffer Conversion Example
 *
 * Demonstrates how to use AudioCapture.bufferToFloat32Array() to convert
 * the Buffer data to Float32Array for easier audio processing.
 *
 * This helper simplifies working with the audio data by handling the
 * Buffer-to-TypedArray conversion automatically.
 */

const AudioCapture = require('..');

const capture = new AudioCapture();

// Find an audio app
const audioApps = capture.getAudioApps();

if (audioApps.length === 0) {
  console.error('❌ No audio apps found. Please start Spotify, Music, Safari, etc.');
  process.exit(1);
}

const app = audioApps[0];
console.log(`Using: ${app.applicationName}\n`);

capture.startCapture(app.processId);

let sampleNum = 0;

capture.on('audio', (sample) => {
  sampleNum++;

  console.log(`\n=== Sample ${sampleNum} ===\n`);

  // Method 1: Use the helper method (RECOMMENDED)
  console.log('Method 1: Using bufferToFloat32Array() helper');
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  console.log(`  Type: ${float32.constructor.name}`);
  console.log(`  Length: ${float32.length} samples`);
  console.log(`  First sample: ${float32[0].toFixed(6)}`);
  console.log(`  Last sample: ${float32[float32.length - 1].toFixed(6)}`);

  // Method 2: Manual conversion (for comparison)
  console.log('\nMethod 2: Manual conversion');
  const float32Manual = new Float32Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 4
  );

  console.log(`  Type: ${float32Manual.constructor.name}`);
  console.log(`  Length: ${float32Manual.length} samples`);
  console.log(`  First sample: ${float32Manual[0].toFixed(6)}`);

  // Verify they're the same
  console.log('\nVerification:');
  console.log(`  Methods match: ${float32[0] === float32Manual[0] ? '✅' : '❌'}`);

  // Now do some audio processing with the Float32Array
  console.log('\nAudio Processing:');

  // Calculate min/max
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSquares = 0;

  for (let i = 0; i < float32.length; i++) {
    const val = float32[i];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += Math.abs(val);
    sumSquares += val * val;
  }

  const avgAmplitude = sum / float32.length;
  const rms = Math.sqrt(sumSquares / float32.length);

  console.log(`  Range: ${min.toFixed(4)} to ${max.toFixed(4)}`);
  console.log(`  Average amplitude: ${avgAmplitude.toFixed(6)}`);
  console.log(`  Calculated RMS: ${rms.toFixed(6)}`);
  console.log(`  Built-in RMS: ${sample.rms.toFixed(6)}`);
  console.log(`  RMS match: ${Math.abs(rms - sample.rms) < 0.0001 ? '✅' : '❌'}`);

  // Calculate volume in dB
  const db = AudioCapture.rmsToDb(rms);
  console.log(`  Volume: ${db.toFixed(1)} dB`);

  // Sample metadata
  console.log('\nSample Metadata:');
  console.log(`  Sample rate: ${sample.sampleRate} Hz`);
  console.log(`  Channels: ${sample.channels}`);
  console.log(`  Duration: ${sample.durationMs.toFixed(2)} ms`);
  console.log(`  Timestamp: ${sample.timestamp.toFixed(3)} s`);

  // Stop after 3 samples
  if (sampleNum >= 3) {
    console.log('\n✅ Stopping capture after 3 samples\n');
    capture.stopCapture();
  }
});

capture.on('start', ({ app }) => {
  console.log(`✅ Started capturing from ${app.applicationName}\n`);
  console.log('This example shows how to convert Buffer to Float32Array for processing.\n');
});

capture.on('stop', () => {
  console.log('Capture stopped.');
  process.exit(0);
});

capture.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
