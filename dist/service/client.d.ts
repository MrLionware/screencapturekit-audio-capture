/**
 * Audio Capture Client
 *
 * Connects to an AudioCaptureServer via WebSocket to receive audio data.
 * Provides a similar API to AudioCapture for easy migration.
 *
 * @example
 * ```typescript
 * import { AudioCaptureClient } from 'screencapturekit-audio-capture/client';
 *
 * const client = new AudioCaptureClient({ url: 'ws://localhost:9123' });
 * await client.connect();
 *
 * client.on('audio', (sample) => {
 *   console.log('Received audio:', sample.data.length, 'samples');
 * });
 *
 * await client.startCapture('Spotify');
 * ```
 */
import { EventEmitter } from 'events';
import type { ApplicationInfo, WindowInfo, DisplayInfo, CaptureOptions } from '../core/types';
export interface ClientOptions {
    /** WebSocket URL of the capture server (default: 'ws://localhost:9123') */
    url?: string;
    /** Auto-reconnect on disconnect (default: true) */
    autoReconnect?: boolean;
    /** Reconnect delay in ms (default: 1000) */
    reconnectDelay?: number;
    /** Max reconnect attempts (default: 10) */
    maxReconnectAttempts?: number;
}
export interface RemoteAudioSample {
    data: Float32Array;
    sampleRate: number;
    channels: number;
    timestamp: number;
}
export declare class AudioCaptureClient extends EventEmitter {
    private ws;
    private options;
    private clientId;
    private sessionId;
    private pendingRequests;
    private requestIdCounter;
    private reconnectAttempts;
    private isReconnecting;
    private shouldReconnect;
    constructor(options?: ClientOptions);
    /**
     * Connect to the capture server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the server
     */
    disconnect(): void;
    private attemptReconnect;
    private handleMessage;
    private handleResponse;
    private handleAudio;
    private handleError;
    private handleEvent;
    private sendRequest;
    /**
     * Get list of available applications
     */
    getApplications(): Promise<ApplicationInfo[]>;
    /**
     * Get list of available windows
     */
    getWindows(): Promise<WindowInfo[]>;
    /**
     * Get list of available displays
     */
    getDisplays(): Promise<DisplayInfo[]>;
    /**
     * Start capturing audio from an application
     * @param target - Application name, bundle ID, or process ID
     * @param options - Capture options
     */
    startCapture(target: string | number, options?: CaptureOptions): Promise<boolean>;
    /**
     * Start capturing audio from a window
     * @param windowId - Window ID from getWindows()
     * @param options - Capture options
     */
    captureWindow(windowId: number, options?: CaptureOptions): Promise<boolean>;
    /**
     * Start capturing audio from a display
     * @param displayId - Display ID from getDisplays()
     * @param options - Capture options
     */
    captureDisplay(displayId: number, options?: CaptureOptions): Promise<boolean>;
    /**
     * Start capturing audio from multiple applications
     * @param targets - Array of application names, bundle IDs, or process IDs
     * @param options - Capture options
     */
    captureMultipleApps(targets: (string | number)[], options?: CaptureOptions): Promise<boolean>;
    /**
     * Stop the current capture
     */
    stopCapture(): Promise<void>;
    /**
     * Get current server status
     */
    getStatus(): Promise<{
        capturing: boolean;
        session: {
            id: string;
            target: string;
            targetType: string;
            clientCount: number;
        } | null;
        totalClients: number;
    }>;
    /**
     * Check if currently capturing (joined a session)
     */
    isCapturing(): boolean;
    /**
     * Check if connected to server
     */
    isConnected(): boolean;
    /**
     * Get current client ID assigned by server
     */
    getClientId(): string | null;
    /**
     * Get current session ID
     */
    getSessionId(): string | null;
}
export default AudioCaptureClient;
//# sourceMappingURL=client.d.ts.map