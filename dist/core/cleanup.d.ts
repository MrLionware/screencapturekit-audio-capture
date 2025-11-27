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
/**
 * Result of cleanup operation
 */
export interface CleanupResult {
    /** Number of AudioCapture instances cleaned up */
    captureInstances: number;
    /** Number of AudioCaptureServer instances cleaned up */
    serverInstances: number;
    /** Total resources cleaned up */
    total: number;
}
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
export declare function cleanupAll(): Promise<CleanupResult>;
/**
 * Get count of all active instances across capture and server
 *
 * @returns Total count of active instances
 */
export declare function getActiveInstanceCount(): number;
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
export declare function installGracefulShutdown(): void;
//# sourceMappingURL=cleanup.d.ts.map