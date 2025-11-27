"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenCaptureKit = exports.STTConverter = void 0;
/**
 * Utils module - Utility classes and helpers
 *
 * Provides supporting utilities for audio processing:
 * - STTConverter: Transform stream for converting audio to STT-ready format
 * - ScreenCaptureKit: Direct access to native bindings (advanced use)
 */
var stt_converter_1 = require("./stt-converter");
Object.defineProperty(exports, "STTConverter", { enumerable: true, get: function () { return stt_converter_1.STTConverter; } });
var native_loader_1 = require("./native-loader");
Object.defineProperty(exports, "ScreenCaptureKit", { enumerable: true, get: function () { return native_loader_1.ScreenCaptureKit; } });
//# sourceMappingURL=index.js.map