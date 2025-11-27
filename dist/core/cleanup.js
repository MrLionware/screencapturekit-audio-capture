"use strict";
/**
 * Unified cleanup utilities for graceful shutdown
 *
 * @example
 * ```typescript
 * import { cleanupAll, installGracefulShutdown } from 'screencapturekit-audio-capture';
 *
 * // Manual cleanup
 * process.on('SIGINT', async () => {
 *   await cleanupAll();
 *   process.exit(0);
 * });
 *
 * // Or install automatic handlers
 * installGracefulShutdown();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAll = cleanupAll;
exports.getActiveInstanceCount = getActiveInstanceCount;
exports.installGracefulShutdown = installGracefulShutdown;
const audio_capture_1 = require("../capture/audio-capture");
const server_1 = require("../service/server");
/**
 * Clean up all active AudioCapture and AudioCaptureServer instances.
 * This is a convenience function that calls cleanupAll() on both classes.
 *
 * @returns Cleanup statistics
 *
 * @example
 * ```typescript
 * const result = await cleanupAll();
 * console.log(`Cleaned up ${result.total} resources`);
 * ```
 */
async function cleanupAll() {
    const captureInstances = audio_capture_1.AudioCapture.cleanupAll();
    const serverInstances = await server_1.AudioCaptureServer.cleanupAll();
    return {
        captureInstances,
        serverInstances,
        total: captureInstances + serverInstances,
    };
}
/**
 * Get count of all active instances across capture and server
 *
 * @returns Total count of active instances
 */
function getActiveInstanceCount() {
    return audio_capture_1.AudioCapture.getActiveInstanceCount() + server_1.AudioCaptureServer.getActiveInstanceCount();
}
/** Whether graceful shutdown handlers have been installed via installGracefulShutdown */
let gracefulShutdownInstalled = false;
/**
 * Install graceful shutdown handlers for SIGINT and SIGTERM.
 * When either signal is received, all audio captures and servers will be
 * stopped cleanly before the process exits.
 *
 * This is idempotent - calling it multiple times has no additional effect.
 * Note: AudioCapture and AudioCaptureServer already install their own handlers,
 * so this is only needed if you want explicit control over the cleanup process.
 *
 * @example
 * ```typescript
 * import { installGracefulShutdown } from 'screencapturekit-audio-capture';
 *
 * // At application startup
 * installGracefulShutdown();
 *
 * // Now Ctrl+C or kill signals will clean up properly
 * ```
 */
function installGracefulShutdown() {
    if (gracefulShutdownInstalled)
        return;
    gracefulShutdownInstalled = true;
    const handleSignal = async () => {
        await cleanupAll();
        process.exit(0);
    };
    process.on('SIGINT', () => handleSignal());
    process.on('SIGTERM', () => handleSignal());
}
//# sourceMappingURL=cleanup.js.map