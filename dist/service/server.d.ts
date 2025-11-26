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
import type { CaptureOptions } from '../types';
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