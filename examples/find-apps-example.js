/**
 * Find Apps Example
 *
 * Demonstrates the various methods for finding and filtering applications:
 * - getApplications(): Get all capturable apps
 * - getAudioApps(): Get only apps likely to have audio
 * - findByName(): Find app by name (case-insensitive)
 * - findApplication(): Find by name or bundle ID
 * - getApplicationByPid(): Find by process ID
 */

const AudioCapture = require('..');

const capture = new AudioCapture();

console.log('='.repeat(70));
console.log('Application Discovery Example');
console.log('='.repeat(70));

// 1. Get ALL applications
console.log('\n1. Get ALL Applications (getApplications):\n');
const allApps = capture.getApplications();

if (allApps.length === 0) {
  console.error('❌ No applications found!');
  console.error('   This likely means Screen Recording permission is not granted.');
  console.error('   Go to: System Preferences → Privacy & Security → Screen Recording');
  process.exit(1);
}

console.log(`Found ${allApps.length} total applications:\n`);
allApps.slice(0, 10).forEach((app, i) => {
  console.log(`  ${i + 1}. ${app.applicationName}`);
  console.log(`     PID: ${app.processId}`);
  console.log(`     Bundle: ${app.bundleIdentifier}`);
});

if (allApps.length > 10) {
  console.log(`  ... and ${allApps.length - 10} more`);
}

// 2. Get only AUDIO applications
console.log('\n' + '─'.repeat(70));
console.log('\n2. Get AUDIO Applications Only (getAudioApps):\n');
const audioApps = capture.getAudioApps();

console.log(`Found ${audioApps.length} audio applications (system apps filtered out):\n`);
audioApps.forEach((app, i) => {
  console.log(`  ${i + 1}. ${app.applicationName} (PID: ${app.processId})`);
});

// 3. Find application by name
console.log('\n' + '─'.repeat(70));
console.log('\n3. Find Application by Name (findByName):\n');

const searchTerms = ['spotify', 'safari', 'music', 'chrome', 'zoom'];

searchTerms.forEach(term => {
  const found = capture.findByName(term);
  if (found) {
    console.log(`  ✅ Found "${term}": ${found.applicationName} (PID: ${found.processId})`);
  } else {
    console.log(`  ❌ "${term}" not found`);
  }
});

// 4. Find by bundle identifier
console.log('\n' + '─'.repeat(70));
console.log('\n4. Find by Bundle Identifier (findApplication):\n');

const bundleIds = [
  'com.spotify.client',
  'com.apple.Safari',
  'com.apple.Music',
  'com.google.Chrome'
];

bundleIds.forEach(bundleId => {
  const found = capture.findApplication(bundleId);
  if (found) {
    console.log(`  ✅ Found "${bundleId}"`);
    console.log(`     App: ${found.applicationName}`);
    console.log(`     PID: ${found.processId}`);
  } else {
    console.log(`  ❌ "${bundleId}" not found`);
  }
});

// 5. Find by Process ID
console.log('\n' + '─'.repeat(70));
console.log('\n5. Find by Process ID (getApplicationByPid):\n');

if (audioApps.length > 0) {
  const testPid = audioApps[0].processId;
  const found = capture.getApplicationByPid(testPid);

  if (found) {
    console.log(`  ✅ Found PID ${testPid}:`);
    console.log(`     App: ${found.applicationName}`);
    console.log(`     Bundle: ${found.bundleIdentifier}`);
  }

  // Try invalid PID
  const invalidFound = capture.getApplicationByPid(99999);
  console.log(`  ❌ Invalid PID 99999: ${invalidFound ? 'Found' : 'Not found (expected)'}`);
}

// 6. Case-insensitive search demonstration
console.log('\n' + '─'.repeat(70));
console.log('\n6. Case-Insensitive Search:\n');

const variations = ['SPOTIFY', 'Spotify', 'spotify', 'SpOtIfY'];

console.log('Testing different case variations of "Spotify":');
variations.forEach(term => {
  const found = capture.findByName(term);
  console.log(`  "${term}" → ${found ? '✅ Found' : '❌ Not found'}`);
});

// 7. Start capture with found app
console.log('\n' + '─'.repeat(70));
console.log('\n7. Start Capture Using Found App:\n');

if (audioApps.length > 0) {
  const targetApp = audioApps[0];

  console.log(`Starting capture from: ${targetApp.applicationName}`);

  let eventCount = 0;

  capture.on('audio', (sample) => {
    eventCount++;
    const db = AudioCapture.rmsToDb(sample.rms);
    console.log(`  [${eventCount}] Audio: ${db.toFixed(1)} dB, ${sample.durationMs.toFixed(1)}ms`);

    if (eventCount >= 5) {
      capture.stopCapture();
    }
  });

  capture.on('start', ({ app }) => {
    console.log(`  ✅ Capture started: ${app.applicationName}\n`);
  });

  capture.on('stop', () => {
    console.log(`\n  ✅ Capture stopped after ${eventCount} samples\n`);
    console.log('='.repeat(70));
    process.exit(0);
  });

  capture.on('error', (err) => {
    console.error(`\n  ❌ Error: ${err.message}\n`);
    console.log('='.repeat(70));
    process.exit(1);
  });

  // Start capture
  capture.startCapture(targetApp.processId);

  console.log('  Waiting for audio samples...\n');
} else {
  console.log('No audio apps found to capture from.');
  console.log('\n' + '='.repeat(70));
  process.exit(0);
}
