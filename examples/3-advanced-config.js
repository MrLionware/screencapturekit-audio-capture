/**
 * Advanced Configuration Options
 *
 * This example demonstrates advanced audio capture configuration:
 * - Sample rate configuration (system-dependent)
 * - Channel configuration (mono/stereo)
 * - Buffer size control (latency vs CPU trade-off)
 * - Format selection (float32 vs int16)
 */

const AudioCapture = require('../sdk');

const capture = new AudioCapture();

console.log('=== Advanced Configuration Options ===\n');

// Find an app
const APP_NAME = 'Spotify'; // Change this to an app running on your system
const app = capture.findApplication(APP_NAME);

if (!app) {
  console.error(`❌ Application "${APP_NAME}" not found.`);
  process.exit(1);
}

console.log(`✓ Found: ${app.applicationName}\n`);
console.log('Choose a configuration preset:\n');
console.log('  1 - Low Latency: Small buffers, stereo, float32');
console.log('  2 - Efficient: Mono, int16, larger buffers (75% less data)');
console.log('  3 - High Quality: Stereo, float32, balanced buffer');
console.log('  4 - Custom: Specify your own settings\n');

const preset = process.argv[2] || '1';

let config;

switch (preset) {
  case '1':
    console.log('Using: Low Latency Configuration\n');
    config = {
      sampleRate: 48000,
      channels: 2,          // Stereo
      bufferSize: 1024,     // Small buffer = ~21ms latency
      format: 'float32',
      minVolume: 0.01
    };
    break;

  case '2':
    console.log('Using: Efficient Configuration (75% data reduction)\n');
    config = {
      sampleRate: 48000,
      channels: 1,          // Mono (-50% data)
      bufferSize: 4096,     // Large buffer = stable, low CPU
      format: 'int16',      // Int16 (-50% data)
      minVolume: 0.01
    };
    break;

  case '3':
    console.log('Using: High Quality Configuration\n');
    config = {
      sampleRate: 48000,
      channels: 2,          // Stereo
      bufferSize: 2048,     // Balanced ~43ms latency
      format: 'float32',    // Full precision
      minVolume: 0.01
    };
    break;

  case '4':
    console.log('Using: Custom Configuration\n');
    config = {
      sampleRate: parseInt(process.argv[3]) || 48000,
      channels: parseInt(process.argv[4]) || 2,
      bufferSize: parseInt(process.argv[5]) || 2048,
      format: process.argv[6] || 'float32',
      minVolume: 0.01
    };
    console.log(`Custom settings: ${config.sampleRate}Hz, ${config.channels}ch, buffer=${config.bufferSize}, ${config.format}\n`);
    break;

  default:
    console.log('Usage: node 3-advanced-config.js [1-4] [sampleRate] [channels] [bufferSize] [format]');
    console.log('Example: node 3-advanced-config.js 4 48000 1 2048 int16');
    process.exit(0);
}

// Display configuration
console.log('Configuration:');
console.log(`  Sample Rate: ${config.sampleRate} Hz (requested)`);
console.log(`  Channels: ${config.channels} (${config.channels === 1 ? 'mono' : 'stereo'})`);
console.log(`  Buffer Size: ${config.bufferSize} frames`);
console.log(`  Format: ${config.format}`);
console.log(`  Expected Latency: ~${((config.bufferSize / config.sampleRate) * 1000).toFixed(1)}ms`);
console.log();

let sampleCount = 0;
const durations = [];

capture.on('audio', (sample) => {
  sampleCount++;
  durations.push(sample.durationMs);

  if (sampleCount === 1) {
    console.log('✓ First sample received:\n');
    console.log('  ACTUAL CONFIGURATION:');
    console.log(`    Sample Rate: ${sample.sampleRate} Hz ${sample.sampleRate !== config.sampleRate ? '⚠️  (differs from requested)' : '✓'}`);
    console.log(`    Channels: ${sample.channels} ${sample.channels === config.channels ? '✓' : '❌'}`);
    console.log(`    Format: ${sample.format} ${sample.format === config.format ? '✓' : '❌'}`);
    console.log(`    Duration: ${sample.durationMs.toFixed(2)}ms`);
    console.log(`    Frames: ${sample.framesCount}`);
    console.log();

    if (sample.sampleRate !== config.sampleRate) {
      console.log('  ℹ️  Sample rate differs from requested:');
      console.log('     This is normal. ScreenCaptureKit captures at your system\'s native');
      console.log('     audio device sample rate. Use resampling if you need a specific rate.\n');
    }
  }

  if (sampleCount === 5) {
    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    const dataPerSecond = (sample.data.length / sample.durationMs) * 1000;

    console.log('✓ Statistics after 5 samples:\n');
    console.log(`  Average Duration: ${avgDuration.toFixed(2)}ms per chunk`);
    console.log(`  Data Rate: ${(dataPerSecond / 1024).toFixed(1)} KB/s`);
    console.log(`  Samples Per Second: ${(1000 / avgDuration).toFixed(0)} chunks/s`);
    console.log();

    // Calculate data savings vs baseline (stereo float32)
    if (config.channels === 1 || config.format === 'int16') {
      const baselineRate = (48000 * 2 * 4); // 48kHz stereo float32
      const actualRate = sample.sampleRate * sample.channels * (sample.format === 'int16' ? 2 : 4);
      const savings = ((baselineRate - actualRate) / baselineRate * 100);

      if (savings > 0) {
        console.log(`  💾 Data Reduction: ${savings.toFixed(0)}% vs baseline (stereo float32)`);
        console.log();
      }
    }
  }

  if (sampleCount % 50 === 0) {
    const rmsDb = AudioCapture.rmsToDb(sample.rms);
    console.log(`  Sample #${sampleCount}: RMS ${rmsDb.toFixed(1)} dB`);
  }
});

capture.on('stop', () => {
  console.log(`\n✓ Capture stopped. Total samples: ${sampleCount}\n`);
  process.exit(0);
});

capture.on('error', (err) => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});

// Start capture
console.log('Starting capture...\n');
capture.startCapture(app.applicationName, config);

// Stop after 5 seconds
setTimeout(() => {
  console.log('\n⏱  5 seconds elapsed, stopping...');
  capture.stopCapture();
}, 5000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠  Interrupted by user');
  if (capture.isCapturing()) {
    capture.stopCapture();
  } else {
    process.exit(0);
  }
});
