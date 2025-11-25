"use strict";
/**
 * Native addon loader for ScreenCaptureKit
 * Handles loading the compiled .node addon from build directory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenCaptureKit = exports.nativeAddon = void 0;
let addon;
try {
    // Try to load the compiled addon (Release build)
    addon = require('../build/Release/screencapturekit_addon.node');
}
catch {
    try {
        // Fallback to Debug build
        addon = require('../build/Debug/screencapturekit_addon.node');
    }
    catch {
        throw new Error('Could not load the native addon. Please run "npm install" or "npm run build" to compile the addon.');
    }
}
exports.nativeAddon = addon;
exports.ScreenCaptureKit = addon.ScreenCaptureKit;
//# sourceMappingURL=native.js.map