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
import { WebSocketServer, WebSocket } from 'ws';
import { AudioCapture } from '../capture/audio-capture';
import type { AudioSample, CaptureOptions } from '../core/types';

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

interface ClientInfo {
  id: string;
  ws: WebSocket;
  sessionId: string | null;
}

type MessageType =
  | 'listApps'
  | 'listWindows'
  | 'listDisplays'
  | 'startCapture'
  | 'stopCapture'
  | 'getStatus';

interface ClientMessage {
  type: MessageType;
  requestId: string;
  payload?: Record<string, unknown>;
}

interface ServerMessage {
  type: 'response' | 'audio' | 'error' | 'event';
  requestId?: string;
  payload: unknown;
}

/** Set of all active server instances for cleanup */
const activeServers = new Set<AudioCaptureServer>();

/** Symbol to mark that server exit handlers have been installed (survives module reloads) */
const SERVER_EXIT_HANDLERS_KEY = Symbol.for('screencapturekit.server.exitHandlers');

/**
 * Install process exit handlers for graceful server cleanup
 * Uses a process-level symbol to prevent duplicate handlers across module reloads
 */
function installServerExitHandlers(): void {
  // Check process-level flag to prevent duplicate handlers across module reloads
  if ((process as any)[SERVER_EXIT_HANDLERS_KEY]) return;
  (process as any)[SERVER_EXIT_HANDLERS_KEY] = true;

  const cleanup = async (signal?: string): Promise<void> => {
    // Stop all active servers
    const stopPromises: Promise<void>[] = [];
    for (const server of activeServers) {
      stopPromises.push(
        server.stop().catch(() => {
          // Ignore errors during cleanup
        })
      );
    }
    await Promise.all(stopPromises);
    activeServers.clear();

    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      process.exit(0);
    }
  };

  // Handle Ctrl+C and kill signals
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
}

export class AudioCaptureServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private capture: AudioCapture;
  private clients: Map<string, ClientInfo> = new Map();
  private currentSession: CaptureSession | null = null;
  private options: Required<ServerOptions>;
  private clientIdCounter = 0;
  private _disposed = false;

  constructor(options: ServerOptions = {}) {
    super();
    this.options = {
      port: options.port ?? 9123,
      host: options.host ?? 'localhost',
    };
    this.capture = new AudioCapture();
    this.setupCaptureEvents();

    // Track this instance for cleanup
    activeServers.add(this);
    installServerExitHandlers();
  }

  private setupCaptureEvents(): void {
    this.capture.on('audio', (sample: AudioSample) => {
      this.broadcastAudio(sample);
    });

    this.capture.on('error', (error: Error) => {
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
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.options.port,
          host: this.options.host,
        });

        this.wss.on('listening', () => {
          this.emit('started', { port: this.options.port, host: this.options.host });
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (error: Error) => {
          this.emit('error', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server and all captures
   */
  stop(): Promise<void> {
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
      } else {
        resolve();
      }
    });
  }

  /**
   * Dispose of this server instance and release all resources.
   * Stops the server, disposes the underlying AudioCapture, and cleans up.
   * This method is idempotent - calling it multiple times is safe.
   */
  async dispose(): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;

    await this.stop();
    this.capture.dispose();
    activeServers.delete(this);
    this.removeAllListeners();
  }

  /**
   * Check if this server has been disposed
   */
  isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Clean up all active server instances
   * @returns Number of servers that were cleaned up
   */
  static async cleanupAll(): Promise<number> {
    const count = activeServers.size;
    const disposePromises: Promise<void>[] = [];
    for (const server of activeServers) {
      disposePromises.push(
        server.dispose().catch(() => {
          // Ignore errors during cleanup
        })
      );
    }
    await Promise.all(disposePromises);
    activeServers.clear();
    return count;
  }

  /**
   * Get the count of active server instances
   */
  static getActiveInstanceCount(): number {
    return activeServers.size;
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = `client_${++this.clientIdCounter}`;
    const clientInfo: ClientInfo = {
      id: clientId,
      ws,
      sessionId: null,
    };

    this.clients.set(clientId, clientInfo);
    this.emit('clientConnected', clientId);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        this.handleMessage(clientId, message);
      } catch (error) {
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

    ws.on('error', (error: Error) => {
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

  private handleMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

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
    } catch (error) {
      this.sendError(client.ws, requestId, (error as Error).message);
    }
  }

  private handleListApps(ws: WebSocket, requestId: string): void {
    const apps = this.capture.getApplications();
    this.sendResponse(ws, requestId, { apps });
  }

  private handleListWindows(ws: WebSocket, requestId: string): void {
    const windows = this.capture.getWindows();
    this.sendResponse(ws, requestId, { windows });
  }

  private handleListDisplays(ws: WebSocket, requestId: string): void {
    const displays = this.capture.getDisplays();
    this.sendResponse(ws, requestId, { displays });
  }

  private handleStartCapture(
    clientId: string,
    ws: WebSocket,
    requestId: string,
    payload?: Record<string, unknown>
  ): void {
    if (!payload) {
      this.sendError(ws, requestId, 'Missing payload for startCapture');
      return;
    }

    const { target, targetType = 'app', options = {} } = payload as {
      target: string | number | number[];
      targetType?: 'app' | 'window' | 'display' | 'multi-app';
      options?: CaptureOptions;
    };

    // If already capturing the same target, just add client to session
    if (this.currentSession && this.capture.isCapturing()) {
      const sameTarget =
        JSON.stringify(this.currentSession.target) === JSON.stringify(target) &&
        this.currentSession.targetType === targetType;

      if (sameTarget) {
        this.currentSession.clients.add(clientId);
        const client = this.clients.get(clientId);
        if (client) client.sessionId = this.currentSession.id;

        this.sendResponse(ws, requestId, {
          success: true,
          sessionId: this.currentSession.id,
          message: 'Joined existing capture session',
        });
        return;
      } else {
        // Different target - need to stop current capture first
        this.capture.stopCapture();
        this.currentSession = null;
      }
    }

    try {
      let success = false;

      switch (targetType) {
        case 'app':
          success = this.capture.startCapture(target as string | number, options);
          break;
        case 'window':
          success = this.capture.captureWindow(target as number, options);
          break;
        case 'display':
          success = this.capture.captureDisplay(target as number, options);
          break;
        case 'multi-app':
          success = this.capture.captureMultipleApps(target as (string | number)[], options);
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
        if (client) client.sessionId = sessionId;

        this.sendResponse(ws, requestId, {
          success: true,
          sessionId,
          message: 'Capture started',
        });

        this.emit('captureStarted', { sessionId, target, targetType });
      } else {
        this.sendError(ws, requestId, 'Failed to start capture');
      }
    } catch (error) {
      this.sendError(ws, requestId, (error as Error).message);
    }
  }

  private handleStopCapture(ws: WebSocket, requestId: string): void {
    if (this.capture.isCapturing()) {
      this.capture.stopCapture();
      this.currentSession = null;
      this.sendResponse(ws, requestId, { success: true, message: 'Capture stopped' });
    } else {
      this.sendResponse(ws, requestId, { success: true, message: 'No capture was running' });
    }
  }

  private handleGetStatus(ws: WebSocket, requestId: string): void {
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

  private broadcastAudio(sample: AudioSample): void {
    if (!this.currentSession) return;

    // Convert Float32Array to regular array for JSON serialization
    const message: ServerMessage = {
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
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  private broadcastEvent(event: string, payload: Record<string, unknown>): void {
    const message: ServerMessage = {
      type: 'event',
      payload: { event, ...payload },
    };

    const data = JSON.stringify(message);

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  private sendResponse(ws: WebSocket, requestId: string, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      const message: ServerMessage = { type: 'response', requestId, payload };
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, requestId: string, errorMessage: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      const message: ServerMessage = {
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
  getSession(): CaptureSession | null {
    return this.currentSession;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.wss !== null;
  }
}

export default AudioCaptureServer;
