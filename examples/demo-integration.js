/**
 * Real-world integration example
 * Shows how to use this SDK in a production application
 */

// Import the SDK (in your project, this would be from npm)
const AudioCapture = require('../sdk');

// Example 1: Simple audio monitoring
function simpleMonitor(appName) {
  console.log(`\n=== Example 1: Simple Audio Monitor ===\n`);

  const capture = new AudioCapture();

  capture.on('audio', (sample) => {
    const db = AudioCapture.rmsToDb(sample.rms);
    console.log(`Volume: ${db.toFixed(1)} dB`);
  });

  capture.startCapture(appName);

  setTimeout(() => capture.stopCapture(), 5000);
}

// Example 2: Recording to buffer
function recordToBuffer(appName, durationMs) {
  console.log(`\n=== Example 2: Record to Buffer ===\n`);

  const capture = new AudioCapture();
  const audioChunks = [];
  let startTime = null;

  capture.on('start', ({ app }) => {
    console.log(`Recording from: ${app.applicationName}`);
    startTime = Date.now();
  });

  capture.on('audio', (sample) => {
    audioChunks.push(Buffer.from(sample.data));

    // Check if we've recorded enough
    if (Date.now() - startTime >= durationMs) {
      capture.stopCapture();
    }
  });

  capture.on('stop', () => {
    const totalBuffer = Buffer.concat(audioChunks);
    console.log(`Recorded ${audioChunks.length} chunks`);
    console.log(`Total size: ${(totalBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Could save to file here
    // fs.writeFileSync('recording.raw', totalBuffer);
  });

  capture.startCapture(appName);
}

// Example 3: Volume meter with threshold detection
function volumeMeter(appName) {
  console.log(`\n=== Example 3: Volume Meter with Threshold ===\n`);

  const capture = new AudioCapture();
  const SILENCE_THRESHOLD_DB = -40;
  const LOUD_THRESHOLD_DB = -10;

  capture.on('audio', (sample) => {
    const dbRMS = AudioCapture.rmsToDb(sample.rms);
    const dbPeak = AudioCapture.peakToDb(sample.peak);

    // Classify volume level
    let status;
    if (dbRMS < SILENCE_THRESHOLD_DB) {
      status = '🔇 Silent';
    } else if (dbRMS < LOUD_THRESHOLD_DB) {
      status = '🔉 Normal';
    } else {
      status = '🔊 LOUD!';
    }

    // Visual meter
    const meterWidth = 50;
    const normalized = Math.max(0, Math.min(1, (dbRMS + 60) / 60)); // Map -60dB to 0dB -> 0 to 1
    const barLength = Math.floor(normalized * meterWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(meterWidth - barLength);

    console.log(`${status} [${bar}] ${dbRMS.toFixed(1)} dB (peak: ${dbPeak.toFixed(1)} dB)`);
  });

  capture.startCapture(appName);

  setTimeout(() => capture.stopCapture(), 10000);
}

// Example 4: Multi-app monitoring (sequential)
function multiAppMonitor(appNames) {
  console.log(`\n=== Example 4: Multi-App Monitor ===\n`);

  const capture = new AudioCapture();
  let currentIndex = 0;

  function monitorNext() {
    if (currentIndex >= appNames.length) {
      console.log('\nMonitoring complete!');
      return;
    }

    const appName = appNames[currentIndex];
    const app = capture.findApplication(appName);

    if (!app) {
      console.log(`App "${appName}" not found, skipping...`);
      currentIndex++;
      monitorNext();
      return;
    }

    console.log(`\nMonitoring: ${app.applicationName}`);

    let sampleCount = 0;
    const captureHandler = (sample) => {
      sampleCount++;
      if (sampleCount === 1) {
        const db = AudioCapture.rmsToDb(sample.rms);
        console.log(`  Sample captured: ${db.toFixed(1)} dB`);
      }

      if (sampleCount >= 3) {
        capture.stopCapture();
      }
    };

    capture.on('audio', captureHandler);

    capture.on('stop', () => {
      capture.removeListener('audio', captureHandler);
      currentIndex++;
      setTimeout(monitorNext, 500);
    });

    capture.startCapture(app.processId);
  }

  monitorNext();
}

// Example 5: Error handling and recovery
function robustCapture(appName) {
  console.log(`\n=== Example 5: Robust Error Handling ===\n`);

  const capture = new AudioCapture();
  let retryCount = 0;
  const MAX_RETRIES = 3;

  function attemptCapture() {
    const app = capture.findApplication(appName);

    if (!app) {
      console.error(`Application "${appName}" not found`);

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying in 2 seconds... (${retryCount}/${MAX_RETRIES})`);
        setTimeout(attemptCapture, 2000);
      } else {
        console.error('Max retries reached. Giving up.');
      }
      return;
    }

    console.log(`Found: ${app.applicationName} (PID: ${app.processId})`);

    const success = capture.startCapture(app.processId);

    if (!success) {
      console.error('Failed to start capture');
      return;
    }
  }

  capture.on('error', (err) => {
    console.error('Capture error:', err.message);
  });

  capture.on('audio', (sample) => {
    console.log(`✓ Receiving audio (${sample.sampleCount} samples)`);
  });

  attemptCapture();

  setTimeout(() => capture.stopCapture(), 5000);
}

// Main CLI
const args = process.argv.slice(2);
const example = args[0];
const appName = args[1] || 'Safari';

switch (example) {
  case '1':
    simpleMonitor(appName);
    break;

  case '2':
    recordToBuffer(appName, 3000);
    break;

  case '3':
    volumeMeter(appName);
    break;

  case '4':
    multiAppMonitor(['Safari', 'Music', 'iTerm']);
    break;

  case '5':
    robustCapture(appName);
    break;

  default:
    console.log('ScreenCaptureKit SDK - Real-World Integration Examples\n');
    console.log('Usage: node demo-integration.js <example-number> [app-name]\n');
    console.log('Examples:');
    console.log('  1 - Simple audio monitor');
    console.log('  2 - Record to buffer');
    console.log('  3 - Volume meter with threshold detection');
    console.log('  4 - Multi-app monitoring');
    console.log('  5 - Error handling and recovery\n');
    console.log('Example usage:');
    console.log('  node demo-integration.js 1 Safari');
    console.log('  node demo-integration.js 3 Music');
    console.log('  node demo-integration.js 4');
    break;
}
