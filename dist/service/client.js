"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioCaptureClient = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
class AudioCaptureClient extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.ws = null;
        this.clientId = null;
        this.sessionId = null;
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.shouldReconnect = true;
        this.options = {
            url: options.url ?? 'ws://localhost:9123',
            autoReconnect: options.autoReconnect ?? true,
            reconnectDelay: options.reconnectDelay ?? 1000,
            maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
        };
    }
    /**
     * Connect to the capture server
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.shouldReconnect = true;
            try {
                this.ws = new ws_1.default(this.options.url);
                this.ws.on('open', () => {
                    this.reconnectAttempts = 0;
                    this.isReconnecting = false;
                    this.emit('connected');
                });
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message, resolve);
                    }
                    catch (error) {
                        this.emit('error', new Error('Failed to parse server message'));
                    }
                });
                this.ws.on('close', () => {
                    this.clientId = null;
                    this.sessionId = null;
                    this.emit('disconnected');
                    if (this.shouldReconnect && this.options.autoReconnect) {
                        this.attemptReconnect();
                    }
                });
                this.ws.on('error', (error) => {
                    this.emit('error', error);
                    if (!this.clientId) {
                        reject(error);
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
        this.shouldReconnect = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Client disconnected'));
        }
        this.pendingRequests.clear();
    }
    attemptReconnect() {
        if (this.isReconnecting)
            return;
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this.emit('reconnectFailed');
            return;
        }
        this.isReconnecting = true;
        this.reconnectAttempts++;
        setTimeout(() => {
            this.isReconnecting = false;
            this.emit('reconnecting', this.reconnectAttempts);
            this.connect().catch(() => {
                // Will retry via close handler
            });
        }, this.options.reconnectDelay);
    }
    handleMessage(message, connectResolve) {
        switch (message.type) {
            case 'response':
                this.handleResponse(message, connectResolve);
                break;
            case 'audio':
                this.handleAudio(message.payload);
                break;
            case 'error':
                this.handleError(message);
                break;
            case 'event':
                this.handleEvent(message.payload);
                break;
        }
    }
    handleResponse(message, connectResolve) {
        const payload = message.payload;
        // Handle welcome message (connection established)
        if (message.requestId === 'welcome') {
            this.clientId = payload.clientId;
            if (payload.session) {
                this.sessionId = payload.session.id;
            }
            connectResolve?.();
            return;
        }
        // Handle pending request response
        const requestId = message.requestId;
        if (requestId && this.pendingRequests.has(requestId)) {
            const pending = this.pendingRequests.get(requestId);
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            pending.resolve(payload);
        }
    }
    handleAudio(payload) {
        const sample = {
            data: new Float32Array(payload.data),
            sampleRate: payload.sampleRate,
            channels: payload.channels,
            timestamp: payload.timestamp,
        };
        this.emit('audio', sample);
    }
    handleError(message) {
        const payload = message.payload;
        const error = new Error(payload.error);
        // Handle pending request error
        const requestId = message.requestId;
        if (requestId && this.pendingRequests.has(requestId)) {
            const pending = this.pendingRequests.get(requestId);
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            pending.reject(error);
        }
        else {
            this.emit('error', error);
        }
    }
    handleEvent(payload) {
        const event = payload.event;
        this.emit(event, payload);
        if (event === 'captureStopped') {
            this.sessionId = null;
        }
    }
    sendRequest(type, payload, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
                reject(new Error('Not connected to server'));
                return;
            }
            const requestId = `req_${++this.requestIdCounter}`;
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${type}`));
            }, timeoutMs);
            this.pendingRequests.set(requestId, {
                resolve: resolve,
                reject,
                timeout,
            });
            const message = { type, requestId, payload };
            this.ws.send(JSON.stringify(message));
        });
    }
    /**
     * Get list of available applications
     */
    async getApplications() {
        const response = await this.sendRequest('listApps');
        return response.apps;
    }
    /**
     * Get list of available windows
     */
    async getWindows() {
        const response = await this.sendRequest('listWindows');
        return response.windows;
    }
    /**
     * Get list of available displays
     */
    async getDisplays() {
        const response = await this.sendRequest('listDisplays');
        return response.displays;
    }
    /**
     * Start capturing audio from an application
     * @param target - Application name, bundle ID, or process ID
     * @param options - Capture options
     */
    async startCapture(target, options = {}) {
        const response = await this.sendRequest('startCapture', {
            target,
            targetType: 'app',
            options,
        });
        if (response.success && response.sessionId) {
            this.sessionId = response.sessionId;
        }
        return response.success;
    }
    /**
     * Start capturing audio from a window
     * @param windowId - Window ID from getWindows()
     * @param options - Capture options
     */
    async captureWindow(windowId, options = {}) {
        const response = await this.sendRequest('startCapture', {
            target: windowId,
            targetType: 'window',
            options,
        });
        if (response.success && response.sessionId) {
            this.sessionId = response.sessionId;
        }
        return response.success;
    }
    /**
     * Start capturing audio from a display
     * @param displayId - Display ID from getDisplays()
     * @param options - Capture options
     */
    async captureDisplay(displayId, options = {}) {
        const response = await this.sendRequest('startCapture', {
            target: displayId,
            targetType: 'display',
            options,
        });
        if (response.success && response.sessionId) {
            this.sessionId = response.sessionId;
        }
        return response.success;
    }
    /**
     * Start capturing audio from multiple applications
     * @param targets - Array of application names, bundle IDs, or process IDs
     * @param options - Capture options
     */
    async captureMultipleApps(targets, options = {}) {
        const response = await this.sendRequest('startCapture', {
            target: targets,
            targetType: 'multi-app',
            options,
        });
        if (response.success && response.sessionId) {
            this.sessionId = response.sessionId;
        }
        return response.success;
    }
    /**
     * Stop the current capture
     */
    async stopCapture() {
        await this.sendRequest('stopCapture');
        this.sessionId = null;
    }
    /**
     * Get current server status
     */
    async getStatus() {
        return this.sendRequest('getStatus');
    }
    /**
     * Check if currently capturing (joined a session)
     */
    isCapturing() {
        return this.sessionId !== null;
    }
    /**
     * Check if connected to server
     */
    isConnected() {
        return this.ws !== null && this.ws.readyState === ws_1.default.OPEN;
    }
    /**
     * Get current client ID assigned by server
     */
    getClientId() {
        return this.clientId;
    }
    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionId;
    }
}
exports.AudioCaptureClient = AudioCaptureClient;
exports.default = AudioCaptureClient;
//# sourceMappingURL=client.js.map