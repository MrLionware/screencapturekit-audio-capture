"use strict";
/**
 * Core module - Shared types, errors, and lifecycle management
 *
 * This module contains cross-cutting concerns used throughout the SDK:
 * - Type definitions for all public APIs
 * - Error classes and error codes
 * - Resource lifecycle and cleanup utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.installGracefulShutdown = exports.getActiveInstanceCount = exports.cleanupAll = exports.ErrorCodes = exports.ErrorCode = exports.AudioCaptureError = void 0;
// Error handling
var errors_1 = require("./errors");
Object.defineProperty(exports, "AudioCaptureError", { enumerable: true, get: function () { return errors_1.AudioCaptureError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return errors_1.ErrorCodes; } });
// Cleanup utilities
var cleanup_1 = require("./cleanup");
Object.defineProperty(exports, "cleanupAll", { enumerable: true, get: function () { return cleanup_1.cleanupAll; } });
Object.defineProperty(exports, "getActiveInstanceCount", { enumerable: true, get: function () { return cleanup_1.getActiveInstanceCount; } });
Object.defineProperty(exports, "installGracefulShutdown", { enumerable: true, get: function () { return cleanup_1.installGracefulShutdown; } });
//# sourceMappingURL=index.js.map