/**
 * Window Capture Example
 * 
 * Capture audio from a specific window.
 * Useful when you want to capture audio from one browser tab or specific app window.
 * 
 * Usage:
 *   npx tsx 15-window-capture.ts
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
console.log('        Window Capture Example');
console.log('=========================================');
console.log('');

// Get available windows
let windows;
try {
    windows = capture.getWindows();
} catch (err) {
    console.error('❌ Failed to get windows:', (err as Error).message);
    console.log('   This may require screen recording permission or a display connection.');
    process.exit(1);
}

if (windows.length === 0) {
    console.log('No windows available for capture.');
    console.log('Make sure you have windows open and screen recording permission granted.');
    process.exit(1);
}

console.log('Available windows:');
windows.slice(0, 20).forEach((win, i) => {
    const title = win.title || '(no title)';
    const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
    console.log(`  ${i + 1}. [${win.owningApplicationName || 'Unknown'}] ${truncatedTitle}`);
    console.log(`     Window ID: ${win.windowId}`);
});

if (windows.length > 20) {
    console.log(`  ... and ${windows.length - 20} more windows`);
}

console.log('');

// Select a window - use TARGET_WINDOW env var if set, otherwise auto-select
let targetWindow: WindowInfo | null = null;

if (process.env.TARGET_WINDOW) {
    const windowId = parseInt(process.env.TARGET_WINDOW, 10);
    targetWindow = windows.find(w => w.windowId === windowId) || null;
    if (!targetWindow) {
        console.log(`⚠️  Window ID ${windowId} not found. Using auto-selection.`);
    }
}

if (!targetWindow) {
    // Try to find a window from a media app
    const mediaApps = ['Safari', 'Chrome', 'Firefox', 'Music', 'Spotify', 'VLC', 'QuickTime'];
    for (const appName of mediaApps) {
        targetWindow = windows.find(w => 
            w.owningApplicationName?.includes(appName) && w.title && w.title.length > 0
        ) || null;
        if (targetWindow) break;
    }
}

// Fallback to first window with a title
if (!targetWindow) {
    targetWindow = windows.find(w => w.title && w.title.length > 0) || windows[0];
}

console.log('=========================================');
console.log(`🎯 Selected window:`);
console.log(`   App: ${targetWindow.owningApplicationName || 'Unknown'}`);
console.log(`   Title: ${targetWindow.title || '(no title)'}`);
console.log(`   Window ID: ${targetWindow.windowId}`);
console.log('=========================================');
console.log('');

// Track audio activity
let lastAudioTime = 0;
let totalSamples = 0;

// Set up event handlers
capture.on('start', (info) => {
    console.log('✅ Window capture started!');
    console.log(`   Target type: ${info.targetType}`);
    if (info.window) {
        console.log(`   Window: ${info.window.title || '(no title)'}`);
    }
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
        console.log('⚠️  No audible audio detected. Play audio in the target window.');
    } else if (lastAudioTime > 0 && Date.now() - lastAudioTime > 5000) {
        console.log(`🔇 Silence (${((Date.now() - lastAudioTime) / 1000).toFixed(0)}s)`);
    }
}, 5000);

// Start capture
try {
    capture.captureWindow(targetWindow.windowId);
    console.log('Capturing for 15 seconds...');
    console.log('(Play audio in the target window to see output)\n');
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
