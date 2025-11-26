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
import WebSocket from 'ws';
import type { ApplicationInfo, WindowInfo, DisplayInfo, CaptureOptions } from '../types';

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

interface ServerMessage {
  type: 'response' | 'audio' | 'error' | 'event';
  requestId?: string;
  payload: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class AudioCaptureClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: Required<ClientOptions>;
  private clientId: string | null = null;
  private sessionId: string | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private shouldReconnect = true;

  constructor(options: ClientOptions = {}) {
    super();
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
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.shouldReconnect = true;

      try {
        this.ws = new WebSocket(this.options.url);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.emit('connected');
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as ServerMessage;
            this.handleMessage(message, resolve);
          } catch (error) {
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

        this.ws.on('error', (error: Error) => {
          this.emit('error', error);
          if (!this.clientId) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
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

  private attemptReconnect(): void {
    if (this.isReconnecting) return;
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

  private handleMessage(message: ServerMessage, connectResolve?: (value: void) => void): void {
    switch (message.type) {
      case 'response':
        this.handleResponse(message, connectResolve);
        break;
      case 'audio':
        this.handleAudio(message.payload as Record<string, unknown>);
        break;
      case 'error':
        this.handleError(message);
        break;
      case 'event':
        this.handleEvent(message.payload as Record<string, unknown>);
        break;
    }
  }

  private handleResponse(message: ServerMessage, connectResolve?: (value: void) => void): void {
    const payload = message.payload as Record<string, unknown>;

    // Handle welcome message (connection established)
    if (message.requestId === 'welcome') {
      this.clientId = payload.clientId as string;
      if (payload.session) {
        this.sessionId = (payload.session as Record<string, unknown>).id as string;
      }
      connectResolve?.();
      return;
    }

    // Handle pending request response
    const requestId = message.requestId;
    if (requestId && this.pendingRequests.has(requestId)) {
      const pending = this.pendingRequests.get(requestId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(payload);
    }
  }

  private handleAudio(payload: Record<string, unknown>): void {
    const sample: RemoteAudioSample = {
      data: new Float32Array(payload.data as number[]),
      sampleRate: payload.sampleRate as number,
      channels: payload.channels as number,
      timestamp: payload.timestamp as number,
    };
    this.emit('audio', sample);
  }

  private handleError(message: ServerMessage): void {
    const payload = message.payload as Record<string, unknown>;
    const error = new Error(payload.error as string);

    // Handle pending request error
    const requestId = message.requestId;
    if (requestId && this.pendingRequests.has(requestId)) {
      const pending = this.pendingRequests.get(requestId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.reject(error);
    } else {
      this.emit('error', error);
    }
  }

  private handleEvent(payload: Record<string, unknown>): void {
    const event = payload.event as string;
    this.emit(event, payload);

    if (event === 'captureStopped') {
      this.sessionId = null;
    }
  }

  private sendRequest<T>(type: string, payload?: Record<string, unknown>, timeoutMs = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to server'));
        return;
      }

      const requestId = `req_${++this.requestIdCounter}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
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
  async getApplications(): Promise<ApplicationInfo[]> {
    const response = await this.sendRequest<{ apps: ApplicationInfo[] }>('listApps');
    return response.apps;
  }

  /**
   * Get list of available windows
   */
  async getWindows(): Promise<WindowInfo[]> {
    const response = await this.sendRequest<{ windows: WindowInfo[] }>('listWindows');
    return response.windows;
  }

  /**
   * Get list of available displays
   */
  async getDisplays(): Promise<DisplayInfo[]> {
    const response = await this.sendRequest<{ displays: DisplayInfo[] }>('listDisplays');
    return response.displays;
  }

  /**
   * Start capturing audio from an application
   * @param target - Application name, bundle ID, or process ID
   * @param options - Capture options
   */
  async startCapture(target: string | number, options: CaptureOptions = {}): Promise<boolean> {
    const response = await this.sendRequest<{ success: boolean; sessionId?: string }>('startCapture', {
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
  async captureWindow(windowId: number, options: CaptureOptions = {}): Promise<boolean> {
    const response = await this.sendRequest<{ success: boolean; sessionId?: string }>('startCapture', {
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
  async captureDisplay(displayId: number, options: CaptureOptions = {}): Promise<boolean> {
    const response = await this.sendRequest<{ success: boolean; sessionId?: string }>('startCapture', {
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
  async captureMultipleApps(targets: (string | number)[], options: CaptureOptions = {}): Promise<boolean> {
    const response = await this.sendRequest<{ success: boolean; sessionId?: string }>('startCapture', {
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
  async stopCapture(): Promise<void> {
    await this.sendRequest('stopCapture');
    this.sessionId = null;
  }

  /**
   * Get current server status
   */
  async getStatus(): Promise<{
    capturing: boolean;
    session: { id: string; target: string; targetType: string; clientCount: number } | null;
    totalClients: number;
  }> {
    return this.sendRequest('getStatus');
  }

  /**
   * Check if currently capturing (joined a session)
   */
  isCapturing(): boolean {
    return this.sessionId !== null;
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current client ID assigned by server
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

export default AudioCaptureClient;
