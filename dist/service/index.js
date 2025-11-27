"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioCaptureClient = exports.AudioCaptureServer = void 0;
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
var server_1 = require("./server");
Object.defineProperty(exports, "AudioCaptureServer", { enumerable: true, get: function () { return server_1.AudioCaptureServer; } });
var client_1 = require("./client");
Object.defineProperty(exports, "AudioCaptureClient", { enumerable: true, get: function () { return client_1.AudioCaptureClient; } });
//# sourceMappingURL=index.js.map