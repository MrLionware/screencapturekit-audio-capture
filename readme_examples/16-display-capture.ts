/**
 * Display Capture Example
 * 
 * Capture audio from an entire display (screen).
 * Captures audio from ALL applications on that display.
 * 
 * Usage:
 *   npx tsx 16-display-capture.ts
 */

import { AudioCapture, type AudioSample, type DisplayInfo } from '../src/index';

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
console.log('        Display Capture Example');
console.log('=========================================');
console.log('');

// Get available displays
let displays;
try {
    displays = capture.getDisplays();
} catch (err) {
    console.error('❌ Failed to get displays:', (err as Error).message);
    console.log('   This may require screen recording permission.');
    process.exit(1);
}

if (displays.length === 0) {
    console.log('No displays available for capture.');
    console.log('Make sure screen recording permission is granted.');
    process.exit(1);
}

console.log('Available displays:');
displays.forEach((display, i) => {
    const mainBadge = display.isMainDisplay ? ' (Main)' : '';
    console.log(`  ${i + 1}. Display ${display.displayId}${mainBadge}`);
    console.log(`     Resolution: ${display.width} x ${display.height}`);
});
console.log('');

// Select display - use TARGET_DISPLAY env var if set, otherwise use main display
let targetDisplay: DisplayInfo | null = null;

if (process.env.TARGET_DISPLAY) {
    const displayId = parseInt(process.env.TARGET_DISPLAY, 10);
    targetDisplay = displays.find(d => d.displayId === displayId) || null;
    if (!targetDisplay) {
        console.log(`⚠️  Display ID ${displayId} not found. Using auto-selection.`);
    }
}

if (!targetDisplay) {
    targetDisplay = displays.find(d => d.isMainDisplay) || displays[0];
}

console.log('=========================================');
console.log(`🎯 Selected display:`);
console.log(`   Display ID: ${targetDisplay.displayId}`);
console.log(`   Resolution: ${targetDisplay.width} x ${targetDisplay.height}`);
console.log(`   Main display: ${targetDisplay.isMainDisplay ? 'Yes' : 'No'}`);
console.log('=========================================');
console.log('');

// Track audio activity
let lastAudioTime = 0;
let totalSamples = 0;

// Set up event handlers
capture.on('start', (info) => {
    console.log('✅ Display capture started!');
    console.log(`   Target type: ${info.targetType}`);
    if (info.display) {
        console.log(`   Display: ${info.display.displayId} (${info.display.width}x${info.display.height})`);
    }
    console.log('');
    console.log('📢 Capturing audio from ALL apps on this display.');
    console.log('');
});

capture.on('audio', (sample: AudioSample) => {
    totalSamples++;
    const db = AudioCapture.rmsToDb(sample.rms);
    if (db > -40) {
        lastAudioTime = Date.now();
        console.log(`🔊 Audio: ${db.toFixed(1)} dB | ${sample.sampleCount} samples @ ${sample.sampleRate}Hz`);
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
        console.log('⚠️  No audible audio detected. Play audio in any app.');
    } else if (lastAudioTime > 0 && Date.now() - lastAudioTime > 5000) {
        console.log(`🔇 Silence (${((Date.now() - lastAudioTime) / 1000).toFixed(0)}s)`);
    }
}, 5000);

// Start capture
try {
    capture.captureDisplay(targetDisplay.displayId);
    console.log('Capturing for 15 seconds...');
    console.log('(Play audio in any app to see output)\n');
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
