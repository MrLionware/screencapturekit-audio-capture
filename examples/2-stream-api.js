/**
 * Stream API - Node.js Readable Streams
 *
 * This example demonstrates the stream-based API:
 * - Using createAudioStream() for composable audio processing
 * - Object mode vs normal mode
 * - Piping to transforms and writable streams
 * - Using pipeline() for error handling
 * - Real-time WAV file streaming
 */

const AudioCapture = require('../sdk');
const { pipeline, Transform } = require('stream');
const fs = require('fs');

const capture = new AudioCapture();

console.log('=== ScreenCaptureKit Audio Capture - Stream API ===\n');

// Find an app
const APP_NAME = 'Spotify'; // Change this to an app running on your system
const app = capture.findApplication(APP_NAME);

if (!app) {
  console.error(`❌ Application "${APP_NAME}" not found.`);
  process.exit(1);
}

console.log(`✓ Found: ${app.applicationName}\n`);
console.log('Choose an example to run:\n');
console.log('  1 - Object Mode: Stream with metadata');
console.log('  2 - Normal Mode: Raw audio data piping');
console.log('  3 - Pipeline: Save to WAV file with error handling');
console.log('  4 - Transform: Real-time audio processing\n');

const example = process.argv[2] || '1';

switch (example) {
  case '1':
    exampleObjectMode();
    break;
  case '2':
    exampleNormalMode();
    break;
  case '3':
    examplePipeline();
    break;
  case '4':
    exampleTransform();
    break;
  default:
    console.log('Usage: node 2-stream-api.js [1-4]');
    process.exit(0);
}

// Example 1: Object Mode - Receive full sample objects
function exampleObjectMode() {
  console.log('Running: Object Mode Example\n');

  const audioStream = capture.createAudioStream(app.applicationName, {
    objectMode: true,      // Receive full sample objects
    minVolume: 0.01,       // Filter silence
    format: 'float32'
  });

  let sampleCount = 0;

  audioStream.on('data', (sample) => {
    sampleCount++;

    if (sampleCount % 25 === 0) {
      console.log(`Sample #${sampleCount}:`);
      console.log(`  ${sample.sampleRate}Hz, ${sample.channels}ch, ${sample.format}`);
      console.log(`  RMS: ${sample.rms.toFixed(4)} (${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB)`);
      console.log(`  Peak: ${sample.peak.toFixed(4)}`);
      console.log(`  Duration: ${sample.durationMs.toFixed(2)}ms`);
      console.log();
    }
  });

  audioStream.on('end', () => {
    console.log(`\n✓ Stream ended. Total samples: ${sampleCount}`);
    process.exit(0);
  });

  audioStream.on('error', (err) => {
    console.error(`❌ Stream error: ${err.message}`);
    process.exit(1);
  });

  // Stop after 5 seconds
  setTimeout(() => {
    console.log('⏱  5 seconds elapsed, stopping...\n');
    audioStream.stop();
  }, 5000);

  handleSigint(audioStream);
}

// Example 2: Normal Mode - Raw audio buffers
function exampleNormalMode() {
  console.log('Running: Normal Mode Example\n');

  const audioStream = capture.createAudioStream(app.applicationName, {
    objectMode: false,     // Receive raw Buffers only (more efficient)
    format: 'float32'
  });

  let bytesReceived = 0;
  let chunkCount = 0;

  audioStream.on('data', (buffer) => {
    bytesReceived += buffer.length;
    chunkCount++;

    if (chunkCount % 25 === 0) {
      console.log(`Chunk #${chunkCount}:`);
      console.log(`  Size: ${buffer.length} bytes`);
      console.log(`  Total: ${(bytesReceived / 1024).toFixed(1)} KB`);
      console.log();
    }
  });

  audioStream.on('end', () => {
    console.log(`\n✓ Stream ended`);
    console.log(`  Total chunks: ${chunkCount}`);
    console.log(`  Total data: ${(bytesReceived / 1024).toFixed(1)} KB`);
    process.exit(0);
  });

  audioStream.on('error', (err) => {
    console.error(`❌ Stream error: ${err.message}`);
    process.exit(1);
  });

  setTimeout(() => {
    console.log('⏱  5 seconds elapsed, stopping...\n');
    audioStream.stop();
  }, 5000);

  handleSigint(audioStream);
}

// Example 3: Pipeline with WAV file writing
function examplePipeline() {
  console.log('Running: Pipeline Example (Save to WAV)\n');

  const audioStream = capture.createAudioStream(app.applicationName, {
    objectMode: false,
    format: 'float32'
  });

  const filename = `stream-capture-${Date.now()}.wav`;
  const chunks = [];

  // Collect chunks to write WAV header at the end
  const collector = new Transform({
    transform(chunk, encoding, callback) {
      chunks.push(chunk);
      this.push(chunk);
      callback();
    },
    flush(callback) {
      console.log(`\n✓ Collected ${chunks.length} chunks`);
      callback();
    }
  });

  // Use pipeline for proper error handling
  pipeline(
    audioStream,
    collector,
    (err) => {
      if (err) {
        console.error(`❌ Pipeline failed: ${err.message}`);
        process.exit(1);
      } else {
        // Create WAV file from collected chunks
        const combinedBuffer = Buffer.concat(chunks);

        // Get capture info to know the audio format
        const captureInfo = audioStream.getCurrentCapture();

        const wavBuffer = AudioCapture.writeWav(combinedBuffer, {
          sampleRate: 48000,  // Default system rate
          channels: 2,        // Default stereo
          format: 'float32'
        });

        fs.writeFileSync(filename, wavBuffer);

        console.log(`✓ Saved to ${filename}`);
        console.log(`  Size: ${(wavBuffer.length / 1024).toFixed(1)} KB`);

        process.exit(0);
      }
    }
  );

  setTimeout(() => {
    console.log('⏱  3 seconds elapsed, stopping...\n');
    audioStream.stop();
  }, 3000);

  handleSigint(audioStream);
}

// Example 4: Transform stream for real-time processing
function exampleTransform() {
  console.log('Running: Transform Example (Volume Meter)\n');

  const audioStream = capture.createAudioStream(app.applicationName, {
    objectMode: true,      // Need metadata
    minVolume: 0.001
  });

  // Create a transform stream that logs volume levels
  const volumeMeter = new Transform({
    objectMode: true,
    transform(sample, encoding, callback) {
      const rmsDb = AudioCapture.rmsToDb(sample.rms);
      const bars = Math.max(0, Math.min(50, Math.floor((rmsDb + 60) / 60 * 50)));
      const meter = '█'.repeat(bars) + '░'.repeat(50 - bars);

      // Clear line and print meter
      process.stdout.write(`\r${meter} ${rmsDb.toFixed(1)} dB  `);

      this.push(sample);
      callback();
    }
  });

  pipeline(
    audioStream,
    volumeMeter,
    (err) => {
      console.log('\n');
      if (err) {
        console.error(`❌ Pipeline failed: ${err.message}`);
        process.exit(1);
      } else {
        console.log('✓ Stream ended');
        process.exit(0);
      }
    }
  );

  setTimeout(() => {
    console.log('\n\n⏱  5 seconds elapsed, stopping...\n');
    audioStream.stop();
  }, 5000);

  handleSigint(audioStream);
}

// Helper: Handle Ctrl+C
function handleSigint(audioStream) {
  process.on('SIGINT', () => {
    console.log('\n\n⚠  Interrupted by user');
    if (!audioStream.destroyed) {
      audioStream.stop();
    } else {
      process.exit(0);
    }
  });
}
