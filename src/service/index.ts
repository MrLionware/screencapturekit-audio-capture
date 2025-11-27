/**
 * Service module - Multi-process capture architecture
 * 
 * Provides WebSocket-based client/server for distributed audio capture:
 * - AudioCaptureServer: Central server handling audio capture requests
 * - AudioCaptureClient: Client that connects to server for audio data
 * 
 * This architecture works around macOS ScreenCaptureKit's single-process
 * audio capture limitation by centralizing capture in one server.
 */
export { AudioCaptureServer } from './server';
export type { ServerOptions, CaptureSession } from './server';
export { AudioCaptureClient } from './client';
export type { ClientOptions, RemoteAudioSample } from './client';
