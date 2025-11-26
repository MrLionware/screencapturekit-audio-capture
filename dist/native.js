"use strict";
/**
 * Native addon loader for ScreenCaptureKit
 * Uses node-gyp-build to load prebuilt binaries or fall back to compilation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenCaptureKit = exports.nativeAddon = void 0;
const path_1 = __importDefault(require("path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const nodeGypBuild = require('node-gyp-build');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let addon;
try {
    // node-gyp-build automatically checks:
    // 1. prebuilds/ for matching prebuilt binaries
    // 2. build/Release/ for compiled binaries
    // 3. build/Debug/ as fallback
    addon = nodeGypBuild(path_1.default.resolve(__dirname, '..'));
}
catch (error) {
    throw new Error(`Could not load the native addon. If you're developing, run "npm run build:native" to compile. ` +
        `Original error: ${error instanceof Error ? error.message : error}`);
}
exports.nativeAddon = addon;
exports.ScreenCaptureKit = addon.ScreenCaptureKit;
//# sourceMappingURL=native.js.map