/**
 * Advanced Methods Example
 * 
 * Demonstrates SDK methods not covered by other examples:
 * - findByName() - Alias for findApplication
 * - getApplicationByPid() - Get app info by process ID
 * - enableActivityTracking() - Track which apps produce audio
 * - disableActivityTracking() - Stop tracking
 * - getActivityInfo() - Get activity statistics
 * - getCurrentCapture() - Get current capture details
 * - AudioCapture.peakToDb() - Convert peak to decibels
 * - AudioCapture.calculateDb() - Calculate dB from samples
 * 
 * Usage:
 *   npx tsx 19-advanced-methods.ts
 */

import { AudioCapture, type AudioSample, type ApplicationInfo, type ActivityInfo, type CaptureInfo } from '../src/index';

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
console.log('       Advanced Methods Example');
console.log('=========================================');
console.log('');

// ============================================
// 1. findByName() - Alias for findApplication
// ============================================
console.log('--- 1. findByName() ---');
const safari = capture.findByName('Safari');
if (safari) {
    console.log(`✅ Found Safari: PID ${safari.processId}, Bundle: ${safari.bundleIdentifier}`);
} else {
    console.log('ℹ️  Safari not running');
}

const music = capture.findByName('Music');
if (music) {
    console.log(`✅ Found Music: PID ${music.processId}`);
} else {
    console.log('ℹ️  Music not running');
}
console.log('');

// ============================================
// 2. getApplicationByPid() - Get app by PID
// ============================================
console.log('--- 2. getApplicationByPid() ---');
const apps = capture.getApplications();
if (apps.length > 0) {
    const firstApp = apps[0];
    const foundByPid = capture.getApplicationByPid(firstApp.processId);
    if (foundByPid) {
        console.log(`✅ Found app by PID ${firstApp.processId}: ${foundByPid.applicationName}`);
    }
    
    // Try non-existent PID
    const notFound = capture.getApplicationByPid(99999);
    console.log(`✅ Non-existent PID returns: ${notFound === null ? 'null (correct)' : 'unexpected value'}`);
}
console.log('');

// ============================================
// 3. Activity Tracking Methods
// ============================================
console.log('--- 3. Activity Tracking ---');

// Enable activity tracking with custom decay time
capture.enableActivityTracking({ decayMs: 10000 }); // 10 second decay
console.log('✅ Activity tracking enabled (10s decay)');

// Check initial state
let activityInfo: ActivityInfo = capture.getActivityInfo();
console.log(`   Tracking: ${activityInfo.enabled ? 'YES' : 'NO'}`);
console.log(`   Tracked apps: ${activityInfo.trackedApps}`);
console.log(`   Recent apps: ${activityInfo.recentApps.length}`);
console.log('');

// ============================================
// 4. Start capture to generate activity data
// ============================================
console.log('--- 4. Capture with Activity Tracking ---');

// Find an app to capture
const targetAppName = process.env.TARGET_APP;
const targetApp = targetAppName 
    ? capture.findApplication(targetAppName) 
    : capture.selectApp(null, { fallbackToFirst: true });

if (!targetApp) {
    console.log('No app available for capture.');
    capture.disableActivityTracking();
    process.exit(0);
}

console.log(`Capturing from: ${targetApp.applicationName}`);

// Track samples for demonstration
let sampleCount = 0;

capture.on('audio', (sample: AudioSample) => {
    sampleCount++;
    
    // ============================================
    // 5. Static utility methods
    // ============================================
    if (sampleCount === 1) {
        console.log('');
        console.log('--- 5. Static Utility Methods ---');
        
        // AudioCapture.peakToDb() - Convert peak to dB
        const peakDb = AudioCapture.peakToDb(sample.peak);
        console.log(`   peakToDb(${sample.peak.toFixed(4)}) = ${peakDb.toFixed(1)} dB`);
        
        // AudioCapture.rmsToDb() - For comparison
        const rmsDb = AudioCapture.rmsToDb(sample.rms);
        console.log(`   rmsToDb(${sample.rms.toFixed(4)}) = ${rmsDb.toFixed(1)} dB`);
        
        // AudioCapture.calculateDb() - Calculate from raw samples
        const calcRmsDb = AudioCapture.calculateDb(sample.data, 'rms');
        const calcPeakDb = AudioCapture.calculateDb(sample.data, 'peak');
        console.log(`   calculateDb(data, 'rms') = ${calcRmsDb.toFixed(1)} dB`);
        console.log(`   calculateDb(data, 'peak') = ${calcPeakDb.toFixed(1)} dB`);
    }
    
    // Show periodic updates
    if (sampleCount % 50 === 0) {
        const db = AudioCapture.rmsToDb(sample.rms);
        console.log(`   Sample #${sampleCount}: ${db.toFixed(1)} dB`);
    }
});

try {
    capture.startCapture(targetApp.processId);
} catch (err) {
    console.error('❌ Failed to start capture:', (err as Error).message);
    capture.disableActivityTracking();
    process.exit(1);
}

// ============================================
// 6. getCurrentCapture() - Get capture details
// ============================================
console.log('');
console.log('--- 6. getCurrentCapture() ---');
const currentCapture: CaptureInfo | null = capture.getCurrentCapture();
if (currentCapture) {
    console.log(`   Target type: ${currentCapture.targetType}`);
    console.log(`   Process ID: ${currentCapture.processId}`);
    console.log(`   App: ${currentCapture.app?.applicationName || 'N/A'}`);
} else {
    console.log('   No active capture (unexpected)');
}

// Check activity after some capture time
setTimeout(() => {
    console.log('');
    console.log('--- 7. Activity Stats After Capture ---');
    activityInfo = capture.getActivityInfo();
    console.log(`   Tracking: ${activityInfo.enabled ? 'YES' : 'NO'}`);
    console.log(`   Recent apps with audio: ${activityInfo.recentApps.length}`);
    
    if (activityInfo.recentApps.length > 0) {
        console.log('   Active apps:');
        for (const app of activityInfo.recentApps) {
            console.log(`     - PID ${app.processId}: ${app.sampleCount} samples, avg RMS ${app.avgRMS.toFixed(4)}`);
        }
    }
}, 3000);

// Stop after 5 seconds
setTimeout(() => {
    console.log('');
    console.log('--- 8. Cleanup ---');
    
    // Disable activity tracking
    capture.disableActivityTracking();
    console.log('✅ Activity tracking disabled');
    
    // Verify tracking is off
    const finalInfo = capture.getActivityInfo();
    console.log(`   Tracking now: ${finalInfo.enabled ? 'YES' : 'NO'}`);
    console.log(`   Cache cleared: ${finalInfo.recentApps.length === 0 ? 'YES' : 'NO'}`);
    
    // Stop capture
    capture.stopCapture();
    console.log('✅ Capture stopped');
    
    console.log('');
    console.log('=========================================');
    console.log('       All Advanced Methods Tested!');
    console.log('=========================================');
    console.log(`Total samples captured: ${sampleCount}`);
    
    process.exit(0);
}, 5000);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\nInterrupted, cleaning up...');
    capture.disableActivityTracking();
    capture.stopCapture();
    process.exit(0);
});
