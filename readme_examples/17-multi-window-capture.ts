/**
 * Multi-Window Capture Example
 * 
 * Capture audio from multiple windows simultaneously.
 * Useful for capturing audio from multiple browser tabs or app windows.
 * 
 * Usage:
 *   npx tsx 17-multi-window-capture.ts
 */

import { AudioCapture, type AudioSample, type WindowInfo } from '../src/index';

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

console.log('=========================================');
console.log('     Multi-Window Capture Example');
console.log('=========================================');
console.log('');

// Get available windows
let allWindows;
try {
    allWindows = capture.getWindows();
} catch (err) {
    console.error('❌ Failed to get windows:', (err as Error).message);
    console.log('   This may require screen recording permission or a display connection.');
    process.exit(1);
}

if (allWindows.length === 0) {
    console.log('No windows available for capture.');
    process.exit(1);
}

// Filter to windows with titles (more likely to be useful)
const windows = allWindows.filter(w => w.title && w.title.length > 0);

console.log(`Found ${windows.length} windows with titles (${allWindows.length} total)`);
console.log('');
console.log('Available windows:');
windows.slice(0, 15).forEach((win, i) => {
    const title = win.title!.length > 35 ? win.title!.substring(0, 32) + '...' : win.title;
    console.log(`  ${i + 1}. [${win.owningApplicationName || '?'}] ${title}`);
});
if (windows.length > 15) {
    console.log(`  ... and ${windows.length - 15} more`);
}
console.log('');

// Select windows - use TARGET_WINDOW env var if set to include that window
const selectedWindows: WindowInfo[] = [];
const seenApps = new Set<string>();

// If TARGET_WINDOW is set, include it first
if (process.env.TARGET_WINDOW) {
    const windowId = parseInt(process.env.TARGET_WINDOW, 10);
    const targetWin = windows.find(w => w.windowId === windowId);
    if (targetWin) {
        selectedWindows.push(targetWin);
        seenApps.add(targetWin.owningApplicationName || 'Unknown');
        console.log(`Using TARGET_WINDOW: ${targetWin.title}`);
    }
}

// Try to get windows from different apps
for (const win of windows) {
    const appName = win.owningApplicationName || 'Unknown';
    if (!seenApps.has(appName) && selectedWindows.length < 3) {
        selectedWindows.push(win);
        seenApps.add(appName);
    }
}

// Fallback if we don't have enough different apps
if (selectedWindows.length < 2 && windows.length >= 2) {
    selectedWindows.length = 0;
    selectedWindows.push(windows[0], windows[1]);
}

if (selectedWindows.length === 0) {
    console.log('Not enough windows to demonstrate multi-window capture.');
    process.exit(1);
}

console.log('=========================================');
console.log(`🎯 Selected ${selectedWindows.length} windows:`);
selectedWindows.forEach((win, i) => {
    console.log(`   ${i + 1}. [${win.owningApplicationName}] ${win.title}`);
    console.log(`      Window ID: ${win.windowId}`);
});
console.log('=========================================');
console.log('');

// Track audio
let lastAudioTime = 0;
let totalSamples = 0;

capture.on('start', (info) => {
    console.log('✅ Multi-window capture started!');
    console.log(`   Target type: ${info.targetType}`);
    console.log('');
});

capture.on('audio', (sample: AudioSample) => {
    totalSamples++;
    const db = AudioCapture.rmsToDb(sample.rms);
    if (db > -40) {
        lastAudioTime = Date.now();
        console.log(`🔊 Audio: ${db.toFixed(1)} dB | ${sample.sampleCount} samples`);
    }
});

capture.on('error', (err) => {
    console.error('❌ Error:', err.message);
});

capture.on('stop', () => {
    console.log('\n⏹️  Capture stopped');
});

// Silence detection
const silenceCheck = setInterval(() => {
    if (!capture.isCapturing()) {
        clearInterval(silenceCheck);
        return;
    }
    if (totalSamples > 0 && lastAudioTime === 0) {
        console.log('⚠️  No audible audio. Play audio in one of the target windows.');
    } else if (lastAudioTime > 0 && Date.now() - lastAudioTime > 5000) {
        console.log(`🔇 Silence (${((Date.now() - lastAudioTime) / 1000).toFixed(0)}s)`);
    }
}, 5000);

// Start capture
try {
    const windowIds = selectedWindows.map(w => w.windowId);
    capture.captureMultipleWindows(windowIds, { allowPartial: true });
    console.log('Capturing for 15 seconds...');
    console.log('(Play audio in any of the target windows)\n');
} catch (err) {
    console.error('Failed to start capture:', (err as Error).message);
    process.exit(1);
}

// Stop after 15 seconds
setTimeout(() => {
    clearInterval(silenceCheck);
    console.log('\nStopping capture...');
    capture.stopCapture();
    process.exit(0);
}, 15000);

// Handle Ctrl+C
process.on('SIGINT', () => {
    clearInterval(silenceCheck);
    console.log('\nInterrupted, stopping...');
    capture.stopCapture();
    process.exit(0);
});
