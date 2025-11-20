/**
 * Finding and Filtering Applications
 *
 * Demonstrates discovery helpers and smart selection:
 * - Permission verification
 * - Finding capturable applications
 * - Filtering audio-likely apps
 * - Smart selectApp() fallbacks
 * - Activity tracking hints
 */

const AudioCapture = require('../sdk');

const capture = new AudioCapture();
console.log('=== Finding and Filtering Applications ===\n');

const permission = AudioCapture.verifyPermissions();
console.log(`Permission: ${permission.message}`);
if (!permission.granted) {
  console.log('\nGrant Screen Recording permission to see real application data.\n');
  process.exit(0);
}

console.log('1. All Capturable Applications (including helper processes):\n');
const allApps = capture.getApplications({ includeEmpty: true });
console.log(`Found ${allApps.length} running applications\n`);
allApps.slice(0, 5).forEach(app => {
  console.log(`  • ${app.applicationName || '(unnamed process)'} (${app.processId})`);
});
if (allApps.length > 5) {
  console.log(`  ... and ${allApps.length - 5} more\n`);
}

console.log('─'.repeat(70));
console.log('\n2. Audio-Likely Applications:\n');
const audioApps = capture.getAudioApps();
audioApps.forEach(app => console.log(`  • ${app.applicationName}`));
console.log('\nℹ️  getAudioApps() filters out system utilities.');
console.log('   Include everything with getAudioApps({ includeSystemApps: true }).\n');

// Enable tracking so developers can see structure returned later
capture.enableActivityTracking({ decayMs: 60000 });
const initialActivity = capture.getActivityInfo();
console.log('Tracking info:', initialActivity);
console.log('Start a capture and call getAudioApps({ sortByActivity: true }) to see active apps first.\n');

console.log('─'.repeat(70));
console.log('3. Search Helpers:\n');
['Spotify', 'Safari', 'Chrome', 'Music'].forEach(term => {
  const app = capture.findByName(term);
  console.log(app
    ? `  ✓ "${term}" → ${app.applicationName} (PID ${app.processId})`
    : `  ✗ "${term}" not running`);
});
console.log();

['com.spotify.client', 'com.apple.Safari'].forEach(bundleId => {
  const app = capture.findApplication(bundleId);
  console.log(app
    ? `  ✓ ${bundleId} → ${app.applicationName}`
    : `  ✗ ${bundleId} not running`);
});
console.log();

if (allApps.length > 0) {
  const app = capture.getApplicationByPid(allApps[0].processId);
  console.log(`Lookup by PID ${allApps[0].processId} → ${app?.applicationName}`);
}

console.log('\n─'.repeat(70));
console.log('4. Smart Selection with selectApp():\n');
const preferredOrder = ['Spotify', 'Music', 'Safari', 'Chrome'];
const selected = capture.selectApp(preferredOrder, { audioOnly: true }) || capture.selectApp();
if (selected) {
  console.log(`  ✓ First available audio app: ${selected.applicationName} (PID ${selected.processId})`);
  console.log('  Suggested capture calls:');
  console.log(`    capture.startCapture('${selected.applicationName}');`);
  console.log(`    capture.startCapture(${selected.processId});`);
  console.log(`    capture.startCapture('${selected.bundleIdentifier}');\n`);
} else {
  console.log('  ⚠ No matching audio apps detected. Start playback and re-run this example.\n');
}

console.log('─'.repeat(70));
console.log('5. Custom Filtering by Category:\n');
const categorize = (pattern) => allApps.filter(app => pattern.test(app.applicationName));
const showCategory = (name, items) => {
  console.log(`${name} (${items.length}):`);
  if (items.length === 0) {
    console.log('  (none running)');
  } else {
    items.forEach(app => console.log(`  • ${app.applicationName}`));
  }
  console.log();
};

showCategory('Browsers', categorize(/safari|chrome|firefox|edge|brave/i));
showCategory('Media Players', categorize(/spotify|music|vlc|itunes|quicktime/i));
showCategory('Comms Apps', categorize(/zoom|teams|slack|discord|skype/i));

console.log('═'.repeat(70));
console.log('\nSummary:\n');
console.log('  getApplications({ includeEmpty })    → All capturable apps');
console.log('  getAudioApps({ sortByActivity })     → Filter/sort audio apps');
console.log('  selectApp([...])                     → Smart fallbacks');
console.log('  enableActivityTracking() + getActivityInfo() → Surface recent audio activity');
console.log('\nRun "node 1-basic-usage.js" next to see a full capture workflow.\n');
