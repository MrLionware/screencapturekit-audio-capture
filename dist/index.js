"use strict";
/**
 * ScreenCaptureKit Audio Capture SDK
 * High-level TypeScript SDK for capturing audio from macOS applications
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.installGracefulShutdown = exports.getActiveInstanceCount = exports.cleanupAll = exports.ErrorCodes = exports.ErrorCode = exports.AudioCaptureError = exports.ScreenCaptureKit = exports.STTConverter = exports.AudioCaptureClient = exports.AudioCaptureServer = exports.AudioStream = exports.AudioCapture = void 0;
// Core capture functionality
var capture_1 = require("./capture");
Object.defineProperty(exports, "AudioCapture", { enumerable: true, get: function () { return capture_1.AudioCapture; } });
Object.defineProperty(exports, "AudioStream", { enumerable: true, get: function () { return capture_1.AudioStream; } });
// Multi-process service architecture
var service_1 = require("./service");
Object.defineProperty(exports, "AudioCaptureServer", { enumerable: true, get: function () { return service_1.AudioCaptureServer; } });
Object.defineProperty(exports, "AudioCaptureClient", { enumerable: true, get: function () { return service_1.AudioCaptureClient; } });
// Utilities
var utils_1 = require("./utils");
Object.defineProperty(exports, "STTConverter", { enumerable: true, get: function () { return utils_1.STTConverter; } });
Object.defineProperty(exports, "ScreenCaptureKit", { enumerable: true, get: function () { return utils_1.ScreenCaptureKit; } });
// Core: Errors, Types, and Cleanup (re-exported from core/)
var errors_1 = require("./core/errors");
Object.defineProperty(exports, "AudioCaptureError", { enumerable: true, get: function () { return errors_1.AudioCaptureError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return errors_1.ErrorCodes; } });
var cleanup_1 = require("./core/cleanup");
Object.defineProperty(exports, "cleanupAll", { enumerable: true, get: function () { return cleanup_1.cleanupAll; } });
Object.defineProperty(exports, "getActiveInstanceCount", { enumerable: true, get: function () { return cleanup_1.getActiveInstanceCount; } });
Object.defineProperty(exports, "installGracefulShutdown", { enumerable: true, get: function () { return cleanup_1.installGracefulShutdown; } });
// Default export for convenience
var capture_2 = require("./capture");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return capture_2.AudioCapture; } });
//# sourceMappingURL=index.js.map