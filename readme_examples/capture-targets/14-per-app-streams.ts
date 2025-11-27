/**
 * Per-App Audio Streams Example
 * 
 * Capture audio from multiple applications with SEPARATE streams.
 * Each app gets its own independent audio capture - no mixing!
 * 
 * Use cases:
 * - Record Discord voice chat separately from game audio
 * - Transcribe Zoom meeting while recording background music
 * - Apply different audio processing to each source
 * 
 * Usage:
 *   npx tsx 14-per-app-streams.ts
 *   TARGET_APPS="Safari,Music" npx tsx 14-per-app-streams.ts
 */

import { AudioCapture, type AudioSample, type ApplicationInfo } from '../../src/index';

// Global error handlers for test suite
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

// ============================================
// Configuration
// ============================================

const targetAppNames = process.env.TARGET_APPS
    ? process.env.TARGET_APPS.split(',').map(s => s.trim())
    : ['Safari', 'Music']; // Default: try two common audio apps

// ============================================
// Per-App Capture Manager
// ============================================

interface AppStream {
    capture: AudioCapture;
    app: ApplicationInfo;
    sampleCount: number;
    totalVolume: number;
    lastAudioTime: number;
    hasReceivedAudio: boolean;
}

const appStreams: Map<string, AppStream> = new Map();

// Use a temporary capture instance just to discover apps
const discovery = new AudioCapture();
const allApps = discovery.getApplications();
const audioApps = discovery.getAudioApps();

console.log('=========================================');
console.log('    Per-App Audio Streams Example');
console.log('=========================================');
console.log('');
console.log('Available audio apps:');
audioApps.forEach((app, i) => {
    console.log(`  ${i + 1}. ${app.applicationName} (PID: ${app.processId})`);
});
console.log('');

// ============================================
// Resolve target apps
// ============================================

const resolvedApps: ApplicationInfo[] = [];
const notFoundApps: string[] = [];

for (const name of targetAppNames) {
    const found = allApps.find(a => 
        a.applicationName.toLowerCase() === name.toLowerCase() ||
        a.applicationName.toLowerCase().includes(name.toLowerCase()) ||
        a.bundleIdentifier.toLowerCase().includes(name.toLowerCase())
    );
    
    if (found) {
        resolvedApps.push(found);
    } else {
        notFoundApps.push(name);
    }
}

console.log('=========================================');
console.log(`📋 Requested: ${targetAppNames.length} app(s)`);
console.log(`✅ Resolved:  ${resolvedApps.length} app(s)`);
if (notFoundApps.length > 0) {
    console.log(`❌ Not found: ${notFoundApps.join(', ')}`);
}
console.log('=========================================');
console.log('');

if (resolvedApps.length === 0) {
    console.log('No apps found to capture. Exiting.');
    process.exit(1);
}

if (resolvedApps.length === 1) {
    console.log('⚠️  Only one app found - adding first available audio app for demo');
    const other = audioApps.find(a => a.processId !== resolvedApps[0].processId);
    if (other) {
        resolvedApps.push(other);
    }
}

// ============================================
// Create separate capture for each app
// ============================================

console.log('Creating separate audio streams...');
console.log('');

for (const app of resolvedApps) {
    // Each app gets its own AudioCapture instance!
    const capture = new AudioCapture();
    
    const stream: AppStream = {
        capture,
        app,
        sampleCount: 0,
        totalVolume: 0,
        lastAudioTime: 0,
        hasReceivedAudio: false,
    };
    
    // Set up event handlers for this specific app
    capture.on('start', (info) => {
        console.log(`  ✅ [${app.applicationName}] Stream started`);
    });
    
    capture.on('audio', (sample: AudioSample) => {
        stream.sampleCount++;
        stream.totalVolume += sample.rms;
        
        const db = AudioCapture.rmsToDb(sample.rms);
        if (db > -40) { // Only log audible audio
            stream.lastAudioTime = Date.now();
            stream.hasReceivedAudio = true;
            
            // Color-code by app for visual distinction
            const colors = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[32m'];
            const colorIdx = resolvedApps.indexOf(app) % colors.length;
            const color = colors[colorIdx];
            const reset = '\x1b[0m';
            
            console.log(`${color}🔊 [${app.applicationName.padEnd(15)}]${reset} ${db.toFixed(1)} dB`);
        }
    });
    
    capture.on('error', (err) => {
        console.error(`  ❌ [${app.applicationName}] Error: ${err.message}`);
    });
    
    capture.on('stop', () => {
        console.log(`  ⏹️  [${app.applicationName}] Stream stopped`);
    });
    
    appStreams.set(app.applicationName, stream);
}

// ============================================
// Start all captures
// ============================================

console.log('╔═══════════════════════════════════════╗');
console.log('║   STARTING SEPARATE AUDIO STREAMS     ║');
console.log('╠═══════════════════════════════════════╣');

let startedCount = 0;
for (const [name, stream] of appStreams) {
    try {
        const success = stream.capture.startCapture(stream.app.processId);
        if (success) {
            startedCount++;
        } else {
            console.log(`║  ❌ ${name}: Failed to start`.padEnd(40) + '║');
        }
    } catch (err) {
        console.log(`║  ❌ ${name}: ${(err as Error).message}`.padEnd(40) + '║');
    }
}

console.log('╠═══════════════════════════════════════╣');
console.log(`║  Active streams: ${startedCount}/${appStreams.size}`.padEnd(40) + '║');
console.log('╚═══════════════════════════════════════╝');
console.log('');

if (startedCount === 0) {
    console.log('No streams started. Exiting.');
    process.exit(1);
}

console.log('Each app has its own SEPARATE audio stream.');
console.log('Play audio in different apps to see color-coded output.');
console.log('');
console.log('Legend:');
resolvedApps.forEach((app, i) => {
    const colors = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[32m'];
    const names = ['Cyan', 'Yellow', 'Magenta', 'Green'];
    const colorIdx = i % colors.length;
    console.log(`  ${colors[colorIdx]}■${'\x1b[0m'} ${names[colorIdx]}: ${app.applicationName}`);
});
console.log('');

// ============================================
// Run for 20 seconds, then show stats
// ============================================

const duration = 20000;
console.log(`Capturing for ${duration / 1000} seconds...`);
console.log('');

// Silence detection - check each stream for activity
const silenceCheckInterval = setInterval(() => {
    const now = Date.now();
    for (const [name, stream] of appStreams) {
        if (!stream.capture.isCapturing()) continue;
        
        if (stream.sampleCount > 0 && !stream.hasReceivedAudio) {
            console.log(`⚠️  [${name}] No audible audio detected yet. Make sure audio is playing.`);
        } else if (stream.hasReceivedAudio && (now - stream.lastAudioTime) > 5000) {
            console.log(`🔇 [${name}] Silence (${((now - stream.lastAudioTime) / 1000).toFixed(0)}s since last audio)`);
        }
    }
}, 5000);

setTimeout(() => {
    clearInterval(silenceCheckInterval);
    console.log('');
    console.log('=========================================');
    console.log('           CAPTURE STATISTICS');
    console.log('=========================================');
    
    for (const [name, stream] of appStreams) {
        const avgVolume = stream.sampleCount > 0 
            ? AudioCapture.rmsToDb(stream.totalVolume / stream.sampleCount)
            : -Infinity;
        
        console.log(`  ${name}:`);
        console.log(`    Samples received: ${stream.sampleCount}`);
        console.log(`    Average volume:   ${avgVolume.toFixed(1)} dB`);
        console.log('');
        
        // Stop each capture
        stream.capture.stopCapture();
    }
    
    console.log('=========================================');
    console.log('All streams stopped.');
    process.exit(0);
}, duration);

// ============================================
// Handle Ctrl+C gracefully
// ============================================

process.on('SIGINT', () => {
    console.log('\nInterrupted, stopping all streams...');
    for (const [name, stream] of appStreams) {
        stream.capture.stopCapture();
    }
    process.exit(0);
});
