/**
 * Audio Capture Server
 *
 * A WebSocket-based server that handles audio capture centrally.
 * Multiple clients can connect and receive audio data without
 * conflicting with each other (works around macOS ScreenCaptureKit
 * single-process audio capture limitation).
 *
 * @example
 * ```typescript
 * import { AudioCaptureServer } from 'screencapturekit-audio-capture/server';
 *
 * const server = new AudioCaptureServer({ port: 9123 });
 * server.start();
 *
 * // Server handles capture requests from clients
 * server.on('clientConnected', (clientId) => {
 *   console.log(`Client ${clientId} connected`);
 * });
 * ```
 */
import { EventEmitter } from 'events';
import type { CaptureOptions } from '../core/types';
export interface ServerOptions {
    /** Port to listen on (default: 9123) */
    port?: number;
    /** Host to bind to (default: 'localhost') */
    host?: string;
}
export interface CaptureSession {
    id: string;
    target: string | number;
    targetType: 'app' | 'window' | 'display' | 'multi-app';
    clients: Set<string>;
    options: CaptureOptions;
}
export declare class AudioCaptureServer extends EventEmitter {
    private wss;
    private capture;
    private clients;
    private currentSession;
    private options;
    private clientIdCounter;
    private _disposed;
    constructor(options?: ServerOptions);
    private setupCaptureEvents;
    /**
     * Start the WebSocket server
     */
    start(): Promise<void>;
    /**
     * Stop the server and all captures
     */
    stop(): Promise<void>;
    /**
     * Dispose of this server instance and release all resources.
     * Stops the server, disposes the underlying AudioCapture, and cleans up.
     * This method is idempotent - calling it multiple times is safe.
     */
    dispose(): Promise<void>;
    /**
     * Check if this server has been disposed
     */
    isDisposed(): boolean;
    /**
     * Clean up all active server instances
     * @returns Number of servers that were cleaned up
     */
    static cleanupAll(): Promise<number>;
    /**
     * Get the count of active server instances
     */
    static getActiveInstanceCount(): number;
    private handleConnection;
    private handleMessage;
    private handleListApps;
    private handleListWindows;
    private handleListDisplays;
    private handleStartCapture;
    private handleStopCapture;
    private handleGetStatus;
    private broadcastAudio;
    private broadcastEvent;
    private sendResponse;
    private sendError;
    /**
     * Get the current session info
     */
    getSession(): CaptureSession | null;
    /**
     * Get connected client count
     */
    getClientCount(): number;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
}
export default AudioCaptureServer;
//# sourceMappingURL=server.d.ts.map