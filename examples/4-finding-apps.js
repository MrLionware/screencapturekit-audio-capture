/**
 * Finding and Filtering Applications
 *
 * This example demonstrates the various methods for discovering
 * and filtering applications available for audio capture:
 * - getApplications(): Get all capturable applications
 * - getAudioApps(): Filter to likely audio-producing apps
 * - findApplication(): Search by name or bundle ID
 * - findByName(): Alias for findApplication()
 * - getApplicationByPid(): Look up by process ID
 */

const AudioCapture = require('../sdk');

const capture = new AudioCapture();

console.log('=== Finding and Filtering Applications ===\n');

// Example 1: Get all applications
console.log('1. All Capturable Applications:\n');
const allApps = capture.getApplications();
console.log(`Found ${allApps.length} running applications\n`);

// Show first 5
allApps.slice(0, 5).forEach(app => {
  console.log(`  • ${app.applicationName}`);
  console.log(`    Bundle ID: ${app.bundleIdentifier}`);
  console.log(`    Process ID: ${app.processId}`);
  console.log();
});

if (allApps.length > 5) {
  console.log(`  ... and ${allApps.length - 5} more\n`);
}

console.log('─'.repeat(70));
console.log();

// Example 2: Get only audio apps (filtered)
console.log('2. Audio-Likely Applications (Filtered):\n');
const audioApps = capture.getAudioApps();
console.log(`Found ${audioApps.length} applications likely to produce audio\n`);

audioApps.forEach(app => {
  console.log(`  • ${app.applicationName}`);
});

console.log();
console.log('ℹ️  getAudioApps() filters out system utilities like Finder, Terminal, etc.');
console.log('   To see all apps, use getAudioApps({ includeSystemApps: true })\n');

console.log('─'.repeat(70));
console.log();

// Example 3: Search by name (case-insensitive, partial match)
console.log('3. Search by Name:\n');

const searchTerms = ['Spotify', 'Safari', 'Chrome', 'Music'];

searchTerms.forEach(term => {
  const app = capture.findByName(term);
  if (app) {
    console.log(`  ✓ Found "${term}": ${app.applicationName} (PID: ${app.processId})`);
  } else {
    console.log(`  ✗ "${term}" not found`);
  }
});

console.log();
console.log('ℹ️  findByName() does partial, case-insensitive matching');
console.log('   e.g., "spot" will match "Spotify"\n');

console.log('─'.repeat(70));
console.log();

// Example 4: Search by bundle ID
console.log('4. Search by Bundle ID:\n');

const bundleIds = [
  'com.spotify.client',
  'com.apple.Safari',
  'com.google.Chrome'
];

bundleIds.forEach(bundleId => {
  const app = capture.findApplication(bundleId);
  if (app) {
    console.log(`  ✓ ${bundleId}`);
    console.log(`    → ${app.applicationName}`);
  } else {
    console.log(`  ✗ ${bundleId} (not running)`);
  }
});

console.log('\n');

console.log('─'.repeat(70));
console.log();

// Example 5: Lookup by PID
console.log('5. Lookup by Process ID:\n');

if (allApps.length > 0) {
  const testApp = allApps[0];
  const app = capture.getApplicationByPid(testApp.processId);

  if (app) {
    console.log(`  PID ${testApp.processId} → ${app.applicationName}`);
    console.log(`  Bundle ID: ${app.bundleIdentifier}`);
  }
} else {
  console.log('  No applications available for testing');
}

console.log('\n');

console.log('─'.repeat(70));
console.log();

// Example 6: Interactive app selection
console.log('6. Practical Example - Find and Capture:\n');

// Try to find common audio apps
const commonAudioApps = ['Spotify', 'Music', 'Safari', 'Chrome', 'Firefox', 'VLC'];
let targetApp = null;

for (const appName of commonAudioApps) {
  const app = capture.findByName(appName);
  if (app) {
    targetApp = app;
    break;
  }
}

if (targetApp) {
  console.log(`✓ Found audio app: ${targetApp.applicationName}`);
  console.log(`  Would start capture with:`);
  console.log(`    capture.startCapture('${targetApp.applicationName}');`);
  console.log(`  or`);
  console.log(`    capture.startCapture(${targetApp.processId}); // by PID`);
  console.log(`  or`);
  console.log(`    capture.startCapture('${targetApp.bundleIdentifier}'); // by bundle ID`);
} else {
  console.log('⚠  No common audio apps running');
  console.log('  Try starting Spotify, Safari, or any media player');
}

console.log('\n');

console.log('─'.repeat(70));
console.log();

// Example 7: Category filtering
console.log('7. Custom Filtering:\n');

// Find all browsers
const browsers = allApps.filter(app =>
  /safari|chrome|firefox|edge|brave/i.test(app.applicationName)
);

console.log(`Browsers (${browsers.length}):`);
browsers.forEach(app => console.log(`  • ${app.applicationName}`));

console.log();

// Find all media players
const mediaPlayers = allApps.filter(app =>
  /spotify|music|vlc|itunes|quicktime/i.test(app.applicationName)
);

console.log(`Media Players (${mediaPlayers.length}):`);
mediaPlayers.forEach(app => console.log(`  • ${app.applicationName}`));

console.log();

// Find communication apps
const commApps = allApps.filter(app =>
  /zoom|teams|slack|discord|skype/i.test(app.applicationName)
);

console.log(`Communication Apps (${commApps.length}):`);
if (commApps.length > 0) {
  commApps.forEach(app => console.log(`  • ${app.applicationName}`));
} else {
  console.log('  (none running)');
}

console.log('\n');

console.log('═'.repeat(70));
console.log();

// Summary
console.log('Summary of Methods:\n');
console.log('  getApplications()              → All capturable apps');
console.log('  getAudioApps()                 → Filtered list (no system apps)');
console.log('  findApplication(name)          → Search by name or bundle ID');
console.log('  findByName(name)               → Alias for findApplication()');
console.log('  getApplicationByPid(pid)       → Lookup by process ID');
console.log();
console.log('All search methods are case-insensitive and support partial matching.');
console.log();
