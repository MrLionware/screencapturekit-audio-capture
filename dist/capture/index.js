"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStream = exports.AudioCapture = void 0;
/**
 * Capture module - Core audio capture functionality
 *
 * This module provides the main APIs for capturing audio:
 * - AudioCapture: Event-based audio capture with full control
 * - AudioStream: Stream-based interface for piping audio data
 */
var audio_capture_1 = require("./audio-capture");
Object.defineProperty(exports, "AudioCapture", { enumerable: true, get: function () { return audio_capture_1.AudioCapture; } });
var audio_stream_1 = require("./audio-stream");
Object.defineProperty(exports, "AudioStream", { enumerable: true, get: function () { return audio_stream_1.AudioStream; } });
//# sourceMappingURL=index.js.map