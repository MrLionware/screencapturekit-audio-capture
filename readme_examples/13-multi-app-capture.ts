/**
 * Multi-App Capture Example
 * 
 * Capture audio from multiple applications simultaneously.
 * Perfect for recording game + Discord, Zoom + Music, browser + media player, etc.
 * 
 * Usage:
 *   npx tsx 13-multi-app-capture.ts                    # Normal mode
 *   VERIFY=1 npx tsx 13-multi-app-capture.ts           # Verification mode
 *   TARGET_APPS="Safari,Music" npx tsx 13-multi-app-capture.ts
 */

import { AudioCapture, AudioCaptureError, ErrorCode, type AudioSample, type CaptureInfo, type ApplicationInfo } from '../src/index';
import * as readline from 'readline';

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
const VERIFY_MODE = process.env.VERIFY === '1' || process.env.VERIFY === 'true';

// List all audio apps to help users choose
const audioApps = capture.getAudioApps();
console.log('=========================================');
console.log('       Multi-App Capture Example');
console.log('=========================================');
console.log(`Mode: ${VERIFY_MODE ? '🔍 VERIFICATION' : '🎵 NORMAL'}`);
console.log('');
console.log('Available audio apps:');
audioApps.forEach((app, i) => {
    console.log(`  ${i + 1}. ${app.applicationName} (PID: ${app.processId})`);
});

// Define which apps to capture
const targetApps = process.env.TARGET_APPS
    ? process.env.TARGET_APPS.split(',').map(s => s.trim())
    : ['Safari', 'Music', 'Spotify']; // Default: try common audio apps

console.log('');
console.log('=========================================');
console.log(`📋 Requested apps: ${targetApps.length}`);
targetApps.forEach((app) => console.log(`   • ${app}`));
console.log('=========================================');

// Track which apps were resolved for verification
let resolvedApps: readonly ApplicationInfo[] = [];

// Set up event handlers
capture.on('start', (info: CaptureInfo) => {
    resolvedApps = info.apps || [];
    
    console.log('');
    console.log('╔═══════════════════════════════════════╗');
    console.log('║     MULTI-APP CAPTURE STARTED         ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║  Requested:  ${targetApps.length} app(s)`.padEnd(40) + '║');
    console.log(`║  Resolved:   ${resolvedApps.length} app(s)`.padEnd(40) + '║');
    console.log(`║  Status:     ${resolvedApps.length === targetApps.length ? '✅ All found' : '⚠️  Partial'}`.padEnd(40) + '║');
    console.log('╠═══════════════════════════════════════╣');
    
    if (resolvedApps.length > 0) {
        console.log('║  Capturing from:'.padEnd(40) + '║');
        resolvedApps.forEach((app) => {
            console.log(`║    ✓ ${app.applicationName} (PID: ${app.processId})`.padEnd(40) + '║');
        });
    }
    
    // Show which apps were NOT found
    const resolvedNames = resolvedApps.map(a => a.applicationName.toLowerCase());
    const notFound = targetApps.filter(name => 
        !resolvedApps.some(a => 
            a.applicationName.toLowerCase() === name.toLowerCase() ||
            a.applicationName.toLowerCase().includes(name.toLowerCase()) ||
            a.bundleIdentifier.toLowerCase().includes(name.toLowerCase())
        )
    );
    
    if (notFound.length > 0) {
        console.log('║  Not found:'.padEnd(40) + '║');
        notFound.forEach((name) => {
            console.log(`║    ✗ ${name}`.padEnd(40) + '║');
        });
    }
    
    console.log('╚═══════════════════════════════════════╝');
    console.log('');
});

// Track audio activity for silence detection
let lastAudioTime = 0;
let totalSamples = 0;

capture.on('audio', (sample: AudioSample) => {
    totalSamples++;
    const db = AudioCapture.rmsToDb(sample.rms);
    if (db > -40) { // Only log when there's audible audio
        lastAudioTime = Date.now();
        console.log(`🔊 Audio: ${db.toFixed(1)} dB | ${sample.sampleCount} samples @ ${sample.sampleRate}Hz`);
    }
});

// Silence detection - warn if no audible audio after 5 seconds
const silenceCheckInterval = setInterval(() => {
    if (!capture.isCapturing()) {
        clearInterval(silenceCheckInterval);
        return;
    }
    
    const silenceDuration = Date.now() - (lastAudioTime || Date.now());
    if (lastAudioTime === 0 && totalSamples > 0) {
        console.log('⚠️  No audible audio detected yet. Make sure audio is playing in the target apps.');
    } else if (silenceDuration > 5000 && lastAudioTime > 0) {
        console.log(`🔇 Silence detected (${(silenceDuration / 1000).toFixed(0)}s since last audio)`);
    }
}, 5000);

capture.on('error', (err: Error) => {
    console.error('❌ Error:', err.message);
});

capture.on('stop', () => {
    console.log('\n⏹️  Capture stopped');
});

// ============================================
// Verification Mode
// ============================================
async function runVerificationMode() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    };

    console.log('');
    console.log('╔═══════════════════════════════════════╗');
    console.log('║       VERIFICATION MODE               ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log('║  This mode helps you verify that      ║');
    console.log('║  audio from each app is captured.     ║');
    console.log('║                                       ║');
    console.log('║  You will be prompted to play audio   ║');
    console.log('║  from each app one at a time.         ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('');

    for (let i = 0; i < resolvedApps.length; i++) {
        const app = resolvedApps[i];
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  Step ${i + 1}/${resolvedApps.length}: Testing "${app.applicationName}"`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`\n  1. MUTE all other apps`);
        console.log(`  2. Play audio ONLY in "${app.applicationName}"`);
        console.log(`  3. Watch for 🔊 Audio logs below`);
        console.log(`  4. Press ENTER when done\n`);

        // Listen for audio for a few seconds
        let audioDetected = false;
        const audioListener = () => { audioDetected = true; };
        capture.on('audio', audioListener);

        await question(`  ➤ Press ENTER when playing audio in "${app.applicationName}"... `);
        
        console.log(`\n  ⏳ Listening for 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        capture.off('audio', audioListener);

        if (audioDetected) {
            console.log(`  ✅ PASSED: Audio detected from "${app.applicationName}"`);
        } else {
            console.log(`  ⚠️  WARNING: No audio detected from "${app.applicationName}"`);
            console.log(`     (Make sure audio is playing and volume is up)`);
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Verification Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n  Now try playing audio from MULTIPLE apps');
    console.log('  simultaneously to hear the mixed output.\n');
    
    await question('  ➤ Press ENTER to stop capture... ');
    
    rl.close();
    capture.stopCapture();
    process.exit(0);
}

// ============================================
// Start Capture
// ============================================
try {
    capture.captureMultipleApps(targetApps, {
        allowPartial: true,
        format: 'float32',
        minVolume: 0.001,
    });

    if (VERIFY_MODE) {
        // Give time for 'start' event to fire, then run verification
        setTimeout(() => runVerificationMode(), 500);
    } else {
        // Normal mode: capture for 15 seconds
        const duration = 15000;
        console.log(`Capturing for ${duration / 1000} seconds...`);
        console.log('(Play audio in the target apps to see output)\n');
        console.log('Tip: Run with VERIFY=1 to test each app individually\n');

        setTimeout(() => {
            console.log('\nStopping capture...');
            capture.stopCapture();
            process.exit(0);
        }, duration);
    }
} catch (err) {
    if (AudioCaptureError.isAudioCaptureError(err)) {
        if (err.code === ErrorCode.APP_NOT_FOUND) {
            console.log('\n⚠️  Could not find requested apps.');
            console.log('   Tip: Set TARGET_APPS env var, e.g.:');
            console.log('   TARGET_APPS="Safari,Music" npx tsx 13-multi-app-capture.ts');
            
            // Fallback: capture from first two audio apps if available
            if (audioApps.length >= 2) {
                console.log(`\n   Falling back to: ${audioApps[0].applicationName}, ${audioApps[1].applicationName}`);
                capture.captureMultipleApps([audioApps[0], audioApps[1]], {
                    allowPartial: true,
                    minVolume: 0.001,
                });
            } else if (audioApps.length === 1) {
                console.log(`\n   Only one audio app available: ${audioApps[0].applicationName}`);
                capture.startCapture(audioApps[0]);
            } else {
                console.log('   No audio apps available to capture.');
                process.exit(1);
            }
        } else {
            throw err;
        }
    } else {
        throw err;
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\nInterrupted, stopping capture...');
    capture.stopCapture();
    process.exit(0);
});
