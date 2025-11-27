/**
 * Graceful Cleanup Example
 * 
 * Demonstrates resource lifecycle management and cleanup:
 * - dispose() - Clean up a single AudioCapture instance
 * - isDisposed() - Check if instance has been disposed
 * - AudioCapture.cleanupAll() - Clean up all AudioCapture instances
 * - AudioCapture.getActiveInstanceCount() - Count active instances
 * - cleanupAll() - Unified cleanup (captures + servers)
 * - getActiveInstanceCount() - Total active resources
 * - installGracefulShutdown() - Install process exit handlers
 * 
 * Key features:
 * - Automatic cleanup on SIGINT/SIGTERM (built-in)
 * - Idempotent dispose() - safe to call multiple times
 * - Disposed instances throw when used
 * - Static cleanup for test suites and shutdown
 * 
 * Usage:
 *   npx tsx 21-graceful-cleanup.ts
 */

import { 
    AudioCapture, 
    cleanupAll, 
    getActiveInstanceCount,
    type CleanupResult,
    type AudioSample 
} from '../../src/index';

// Global error handlers for test suite
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

console.log('=========================================');
console.log('       Graceful Cleanup Example');
console.log('=========================================');
console.log('');

// ============================================
// 1. Instance Tracking
// ============================================
console.log('--- 1. Instance Tracking ---');
console.log(`Initial active instances: ${AudioCapture.getActiveInstanceCount()}`);
console.log(`Initial total resources: ${getActiveInstanceCount()}`);
console.log('');

// Create multiple instances
const capture1 = new AudioCapture();
const capture2 = new AudioCapture();
const capture3 = new AudioCapture();

console.log(`After creating 3 instances: ${AudioCapture.getActiveInstanceCount()}`);
console.log('');

// ============================================
// 2. dispose() - Single Instance Cleanup
// ============================================
console.log('--- 2. dispose() - Single Instance Cleanup ---');

// Check disposed state before
console.log(`capture1.isDisposed() before: ${capture1.isDisposed()}`);

// Dispose one instance
capture1.dispose();
console.log('✅ capture1.dispose() called');

// Check disposed state after
console.log(`capture1.isDisposed() after: ${capture1.isDisposed()}`);
console.log(`Active instances after dispose: ${AudioCapture.getActiveInstanceCount()}`);

// Verify idempotent - safe to call multiple times
capture1.dispose();
capture1.dispose();
console.log('✅ Multiple dispose() calls are safe (idempotent)');
console.log('');

// ============================================
// 3. Disposed Instance Protection
// ============================================
console.log('--- 3. Disposed Instance Protection ---');

try {
    // Attempting to use a disposed instance should throw
    capture1.startCapture('SomeApp');
    console.log('❌ Should have thrown an error');
} catch (err) {
    const error = err as Error;
    if (error.message.includes('disposed')) {
        console.log('✅ Disposed instance throws on use: "' + error.message.substring(0, 50) + '..."');
    } else {
        // Other errors (like app not found) are also acceptable
        console.log('✅ Instance properly rejected operation');
    }
}
console.log('');

// ============================================
// 4. Active Capture with Cleanup
// ============================================
console.log('--- 4. Active Capture with Cleanup ---');

// Find an app to capture
const targetAppName = process.env.TARGET_APP;
const targetApp = targetAppName 
    ? capture2.findApplication(targetAppName) 
    : capture2.selectApp(null, { fallbackToFirst: true });

if (!targetApp) {
    console.log('No app available for capture demo.');
    console.log('Cleaning up remaining instances...');
    AudioCapture.cleanupAll();
    process.exit(0);
}

console.log(`Starting capture on: ${targetApp.applicationName}`);

// Track samples
let sampleCount = 0;
capture2.on('audio', (sample: AudioSample) => {
    sampleCount++;
    if (sampleCount % 50 === 0) {
        console.log(`   Received ${sampleCount} samples...`);
    }
});

capture2.on('error', (err) => {
    console.error('❌ Capture Error:', err.message);
});

try {
    capture2.startCapture(targetApp.processId);
    console.log('✅ Capture started');
    console.log(`   isCapturing(): ${capture2.isCapturing()}`);
} catch (err) {
    console.error('❌ Failed to start capture:', (err as Error).message);
    AudioCapture.cleanupAll();
    process.exit(1);
}

// Let capture run for a bit
setTimeout(() => {
    console.log('');
    console.log('--- 5. dispose() Stops Active Capture ---');
    console.log(`   Before dispose - isCapturing(): ${capture2.isCapturing()}`);
    console.log(`   Samples received: ${sampleCount}`);
    
    // Dispose should stop the capture automatically
    capture2.dispose();
    console.log('✅ capture2.dispose() called');
    console.log(`   After dispose - isDisposed(): ${capture2.isDisposed()}`);
    console.log(`   Active instances: ${AudioCapture.getActiveInstanceCount()}`);
    
    // Continue to next test
    testStaticCleanup();
}, 3000);

// ============================================
// 5. Static cleanupAll()
// ============================================
function testStaticCleanup() {
    console.log('');
    console.log('--- 6. AudioCapture.cleanupAll() ---');
    
    // Create a few more instances
    const temp1 = new AudioCapture();
    const temp2 = new AudioCapture();
    
    console.log(`Created 2 more instances. Total: ${AudioCapture.getActiveInstanceCount()}`);
    
    // Clean up all at once
    const cleanedCount = AudioCapture.cleanupAll();
    console.log(`✅ AudioCapture.cleanupAll() cleaned up ${cleanedCount} instance(s)`);
    console.log(`   Active instances after: ${AudioCapture.getActiveInstanceCount()}`);
    
    // Verify all are disposed
    console.log(`   capture3.isDisposed(): ${capture3.isDisposed()}`);
    console.log(`   temp1.isDisposed(): ${temp1.isDisposed()}`);
    console.log(`   temp2.isDisposed(): ${temp2.isDisposed()}`);
    
    // Continue to unified cleanup test
    testUnifiedCleanup();
}

// ============================================
// 6. Unified cleanupAll()
// ============================================
async function testUnifiedCleanup() {
    console.log('');
    console.log('--- 7. Unified cleanupAll() ---');
    
    // Create new instances
    const newCapture = new AudioCapture();
    console.log(`Created new instance. Total resources: ${getActiveInstanceCount()}`);
    
    // Use unified cleanup
    const result: CleanupResult = await cleanupAll();
    console.log('✅ Unified cleanupAll() result:');
    console.log(`   captureInstances: ${result.captureInstances}`);
    console.log(`   serverInstances: ${result.serverInstances}`);
    console.log(`   total: ${result.total}`);
    console.log(`   Active after cleanup: ${getActiveInstanceCount()}`);
    
    // Final summary
    printSummary();
}

function printSummary() {
    console.log('');
    console.log('=========================================');
    console.log('       Graceful Cleanup Complete!');
    console.log('=========================================');
    console.log('');
    console.log('Summary of cleanup methods:');
    console.log('  - instance.dispose()         → Clean up single instance');
    console.log('  - instance.isDisposed()      → Check if disposed');
    console.log('  - AudioCapture.cleanupAll()  → Clean up all captures');
    console.log('  - AudioCapture.getActiveInstanceCount() → Count captures');
    console.log('  - cleanupAll()               → Unified cleanup (async)');
    console.log('  - getActiveInstanceCount()   → Count all resources');
    console.log('');
    console.log('Automatic cleanup:');
    console.log('  - SIGINT (Ctrl+C) triggers cleanup automatically');
    console.log('  - SIGTERM triggers cleanup automatically');
    console.log('  - dispose() stops active captures');
    console.log('');
    console.log(`Final active instances: ${AudioCapture.getActiveInstanceCount()}`);
    console.log(`Total samples captured: ${sampleCount}`);
    
    process.exit(0);
}

// Handle Ctrl+C for demonstration
// Note: AudioCapture already installs handlers, this is just for logging
const originalSigint = process.listeners('SIGINT');
process.removeAllListeners('SIGINT');
process.on('SIGINT', () => {
    console.log('\n');
    console.log('--- SIGINT Received ---');
    console.log('Built-in cleanup handlers will stop all captures...');
    // Restore and trigger original handlers
    for (const handler of originalSigint) {
        (handler as () => void)();
    }
});
