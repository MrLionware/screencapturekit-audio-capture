/**
 * Multi-Display Capture Example
 * 
 * Capture audio from multiple displays simultaneously.
 * Note: Most setups have only one display, but this works with multi-monitor setups.
 * 
 * Usage:
 *   npx tsx 18-multi-display-capture.ts
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
console.log('     Multi-Display Capture Example');
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

console.log(`Found ${displays.length} display(s):`);
displays.forEach((display, i) => {
    const mainBadge = display.isMainDisplay ? ' ★ Main' : '';
    console.log(`  ${i + 1}. Display ${display.displayId}${mainBadge}`);
    console.log(`     Resolution: ${display.width} x ${display.height}`);
});
console.log('');

// Select displays - use TARGET_DISPLAY env var if set
let selectedDisplays: DisplayInfo[];

if (process.env.TARGET_DISPLAY) {
    const displayId = parseInt(process.env.TARGET_DISPLAY, 10);
    const targetDisp = displays.find(d => d.displayId === displayId);
    if (targetDisp) {
        // Include the target display and any others
        selectedDisplays = [targetDisp, ...displays.filter(d => d.displayId !== displayId)];
        console.log(`Using TARGET_DISPLAY: ${displayId}`);
    } else {
        console.log(`⚠️  Display ID ${displayId} not found. Using all displays.`);
        selectedDisplays = displays;
    }
} else if (displays.length === 1) {
    console.log('ℹ️  Only one display found. Using single display capture.');
    console.log('   (Connect more monitors to test multi-display capture)');
    selectedDisplays = [displays[0]];
} else {
    // Use all displays for multi-display capture
    selectedDisplays = displays;
    console.log(`🖥️  Multi-monitor setup detected! Capturing from all ${displays.length} displays.`);
}

console.log('');
console.log('=========================================');
console.log(`🎯 Selected ${selectedDisplays.length} display(s):`);
selectedDisplays.forEach((display, i) => {
    const mainBadge = display.isMainDisplay ? ' (Main)' : '';
    console.log(`   ${i + 1}. Display ${display.displayId}${mainBadge} - ${display.width}x${display.height}`);
});
console.log('=========================================');
console.log('');

// Track audio
let lastAudioTime = 0;
let totalSamples = 0;

capture.on('start', (info) => {
    console.log('✅ Display capture started!');
    console.log(`   Target type: ${info.targetType}`);
    if (info.display) {
        console.log(`   Primary display: ${info.display.displayId}`);
    }
    console.log('');
    console.log('📢 Capturing audio from apps on selected display(s).');
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
    if (selectedDisplays.length === 1) {
        // Single display
        capture.captureDisplay(selectedDisplays[0].displayId);
    } else {
        // Multiple displays
        const displayIds = selectedDisplays.map(d => d.displayId);
        capture.captureMultipleDisplays(displayIds, { allowPartial: true });
    }
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
