"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioCaptureServer = void 0;
const events_1 = require("events");
const ws_1 = require("ws");
const audio_capture_1 = require("../capture/audio-capture");
class AudioCaptureServer extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.wss = null;
        this.clients = new Map();
        this.currentSession = null;
        this.clientIdCounter = 0;
        this.options = {
            port: options.port ?? 9123,
            host: options.host ?? 'localhost',
        };
        this.capture = new audio_capture_1.AudioCapture();
        this.setupCaptureEvents();
    }
    setupCaptureEvents() {
        this.capture.on('audio', (sample) => {
            this.broadcastAudio(sample);
        });
        this.capture.on('error', (error) => {
            this.broadcastEvent('captureError', { message: error.message });
            this.emit('captureError', error);
        });
        this.capture.on('stop', () => {
            this.currentSession = null;
            this.broadcastEvent('captureStopped', {});
            this.emit('captureStopped');
        });
    }
    /**
     * Start the WebSocket server
     */
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new ws_1.WebSocketServer({
                    port: this.options.port,
                    host: this.options.host,
                });
                this.wss.on('listening', () => {
                    this.emit('started', { port: this.options.port, host: this.options.host });
                    resolve();
                });
                this.wss.on('connection', (ws) => {
                    this.handleConnection(ws);
                });
                this.wss.on('error', (error) => {
                    this.emit('error', error);
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Stop the server and all captures
     */
    stop() {
        return new Promise((resolve) => {
            if (this.capture.isCapturing()) {
                this.capture.stopCapture();
            }
            if (this.wss) {
                // Close all client connections
                for (const client of this.clients.values()) {
                    client.ws.close(1000, 'Server shutting down');
                }
                this.clients.clear();
                this.wss.close(() => {
                    this.wss = null;
                    this.emit('stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    handleConnection(ws) {
        const clientId = `client_${++this.clientIdCounter}`;
        const clientInfo = {
            id: clientId,
            ws,
            sessionId: null,
        };
        this.clients.set(clientId, clientInfo);
        this.emit('clientConnected', clientId);
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(clientId, message);
            }
            catch (error) {
                this.sendError(ws, 'unknown', 'Invalid message format');
            }
        });
        ws.on('close', () => {
            this.clients.delete(clientId);
            // Remove from session if applicable
            if (this.currentSession) {
                this.currentSession.clients.delete(clientId);
                // Stop capture if no clients left
                if (this.currentSession.clients.size === 0 && this.capture.isCapturing()) {
                    this.capture.stopCapture();
                    this.currentSession = null;
                }
            }
            this.emit('clientDisconnected', clientId);
        });
        ws.on('error', (error) => {
            this.emit('clientError', { clientId, error });
        });
        // Send welcome message with current status
        this.sendResponse(ws, 'welcome', {
            clientId,
            capturing: this.capture.isCapturing(),
            session: this.currentSession
                ? {
                    id: this.currentSession.id,
                    target: this.currentSession.target,
                    targetType: this.currentSession.targetType,
                }
                : null,
        });
    }
    handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        const { type, requestId, payload } = message;
        try {
            switch (type) {
                case 'listApps':
                    this.handleListApps(client.ws, requestId);
                    break;
                case 'listWindows':
                    this.handleListWindows(client.ws, requestId);
                    break;
                case 'listDisplays':
                    this.handleListDisplays(client.ws, requestId);
                    break;
                case 'startCapture':
                    this.handleStartCapture(clientId, client.ws, requestId, payload);
                    break;
                case 'stopCapture':
                    this.handleStopCapture(client.ws, requestId);
                    break;
                case 'getStatus':
                    this.handleGetStatus(client.ws, requestId);
                    break;
                default:
                    this.sendError(client.ws, requestId, `Unknown message type: ${type}`);
            }
        }
        catch (error) {
            this.sendError(client.ws, requestId, error.message);
        }
    }
    handleListApps(ws, requestId) {
        const apps = this.capture.getApplications();
        this.sendResponse(ws, requestId, { apps });
    }
    handleListWindows(ws, requestId) {
        const windows = this.capture.getWindows();
        this.sendResponse(ws, requestId, { windows });
    }
    handleListDisplays(ws, requestId) {
        const displays = this.capture.getDisplays();
        this.sendResponse(ws, requestId, { displays });
    }
    handleStartCapture(clientId, ws, requestId, payload) {
        if (!payload) {
            this.sendError(ws, requestId, 'Missing payload for startCapture');
            return;
        }
        const { target, targetType = 'app', options = {} } = payload;
        // If already capturing the same target, just add client to session
        if (this.currentSession && this.capture.isCapturing()) {
            const sameTarget = JSON.stringify(this.currentSession.target) === JSON.stringify(target) &&
                this.currentSession.targetType === targetType;
            if (sameTarget) {
                this.currentSession.clients.add(clientId);
                const client = this.clients.get(clientId);
                if (client)
                    client.sessionId = this.currentSession.id;
                this.sendResponse(ws, requestId, {
                    success: true,
                    sessionId: this.currentSession.id,
                    message: 'Joined existing capture session',
                });
                return;
            }
            else {
                // Different target - need to stop current capture first
                this.capture.stopCapture();
                this.currentSession = null;
            }
        }
        try {
            let success = false;
            switch (targetType) {
                case 'app':
                    success = this.capture.startCapture(target, options);
                    break;
                case 'window':
                    success = this.capture.captureWindow(target, options);
                    break;
                case 'display':
                    success = this.capture.captureDisplay(target, options);
                    break;
                case 'multi-app':
                    success = this.capture.captureMultipleApps(target, options);
                    break;
                default:
                    this.sendError(ws, requestId, `Unknown target type: ${targetType}`);
                    return;
            }
            if (success) {
                const sessionId = `session_${Date.now()}`;
                this.currentSession = {
                    id: sessionId,
                    target: Array.isArray(target) ? target.join(',') : target,
                    targetType,
                    clients: new Set([clientId]),
                    options,
                };
                const client = this.clients.get(clientId);
                if (client)
                    client.sessionId = sessionId;
                this.sendResponse(ws, requestId, {
                    success: true,
                    sessionId,
                    message: 'Capture started',
                });
                this.emit('captureStarted', { sessionId, target, targetType });
            }
            else {
                this.sendError(ws, requestId, 'Failed to start capture');
            }
        }
        catch (error) {
            this.sendError(ws, requestId, error.message);
        }
    }
    handleStopCapture(ws, requestId) {
        if (this.capture.isCapturing()) {
            this.capture.stopCapture();
            this.currentSession = null;
            this.sendResponse(ws, requestId, { success: true, message: 'Capture stopped' });
        }
        else {
            this.sendResponse(ws, requestId, { success: true, message: 'No capture was running' });
        }
    }
    handleGetStatus(ws, requestId) {
        this.sendResponse(ws, requestId, {
            capturing: this.capture.isCapturing(),
            session: this.currentSession
                ? {
                    id: this.currentSession.id,
                    target: this.currentSession.target,
                    targetType: this.currentSession.targetType,
                    clientCount: this.currentSession.clients.size,
                }
                : null,
            totalClients: this.clients.size,
        });
    }
    broadcastAudio(sample) {
        if (!this.currentSession)
            return;
        // Convert Float32Array to regular array for JSON serialization
        const message = {
            type: 'audio',
            payload: {
                data: Array.from(sample.data),
                sampleRate: sample.sampleRate,
                channels: sample.channels,
                timestamp: sample.timestamp,
            },
        };
        const data = JSON.stringify(message);
        for (const clientId of this.currentSession.clients) {
            const client = this.clients.get(clientId);
            if (client && client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(data);
            }
        }
    }
    broadcastEvent(event, payload) {
        const message = {
            type: 'event',
            payload: { event, ...payload },
        };
        const data = JSON.stringify(message);
        for (const client of this.clients.values()) {
            if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(data);
            }
        }
    }
    sendResponse(ws, requestId, payload) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            const message = { type: 'response', requestId, payload };
            ws.send(JSON.stringify(message));
        }
    }
    sendError(ws, requestId, errorMessage) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            const message = {
                type: 'error',
                requestId,
                payload: { error: errorMessage },
            };
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Get the current session info
     */
    getSession() {
        return this.currentSession;
    }
    /**
     * Get connected client count
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Check if server is running
     */
    isRunning() {
        return this.wss !== null;
    }
}
exports.AudioCaptureServer = AudioCaptureServer;
exports.default = AudioCaptureServer;
//# sourceMappingURL=server.js.map