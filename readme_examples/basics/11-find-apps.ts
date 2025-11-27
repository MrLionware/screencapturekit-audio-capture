import { AudioCapture, type ApplicationInfo } from '../../src/index';

// Global error handlers for test suite
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

const capture = new AudioCapture();

// Error handler
capture.on('error', (err) => {
    console.error('❌ Capture Error:', err.message);
});

// Find a specific app
const spotify: ApplicationInfo | null = capture.findApplication('Spotify');
if (spotify) {
    console.log(`Found ${spotify.applicationName} (PID: ${spotify.processId})`);
} else {
    console.log('Spotify not found.');
}

// Get only audio-producing apps (filters out system apps)
const audioApps: ApplicationInfo[] = capture.getAudioApps();
console.log('Audio apps:', audioApps.map((a) => a.applicationName));

// Get all apps including system apps
const allApps: ApplicationInfo[] = capture.getApplications();
console.log(`Total apps found: ${allApps.length}`);
// console.log('All apps:', allApps.map((a) => a.applicationName));

// Find by bundle ID
const safari: ApplicationInfo | null = capture.findApplication('com.apple.Safari');
if (safari) {
    console.log(`Found Safari by Bundle ID: ${safari.processId}`);
    // capture.startCapture(safari.processId); // Don't actually start capture in this example, just finding
} else {
    console.log('Safari not found by Bundle ID.');
}
