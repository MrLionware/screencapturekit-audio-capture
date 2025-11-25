"use strict";
/**
 * ScreenCaptureKit Audio Capture SDK
 * High-level TypeScript SDK for capturing audio from macOS applications
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.ScreenCaptureKit = exports.ErrorCodes = exports.ErrorCode = exports.AudioCaptureError = exports.STTConverter = exports.AudioStream = exports.AudioCapture = void 0;
// Export main classes
var audio_capture_1 = require("./audio-capture");
Object.defineProperty(exports, "AudioCapture", { enumerable: true, get: function () { return audio_capture_1.AudioCapture; } });
var audio_stream_1 = require("./audio-stream");
Object.defineProperty(exports, "AudioStream", { enumerable: true, get: function () { return audio_stream_1.AudioStream; } });
var stt_converter_1 = require("./stt-converter");
Object.defineProperty(exports, "STTConverter", { enumerable: true, get: function () { return stt_converter_1.STTConverter; } });
// Export errors
var errors_1 = require("./errors");
Object.defineProperty(exports, "AudioCaptureError", { enumerable: true, get: function () { return errors_1.AudioCaptureError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return errors_1.ErrorCodes; } });
// Import native binding
// Note: The native binding is loaded from ../index.js at runtime
const nativeModule = require('../index');
exports.ScreenCaptureKit = nativeModule.ScreenCaptureKit;
// Default export for convenience
var audio_capture_2 = require("./audio-capture");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return audio_capture_2.AudioCapture; } });
//# sourceMappingURL=index.js.map