/**
 * Native addon loader for ScreenCaptureKit
 * Handles loading the compiled .node addon from build directory
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NativeAddon = any;

let addon: NativeAddon;

try {
  // Try to load the compiled addon (Release build)
  addon = require('../build/Release/screencapturekit_addon.node');
} catch {
  try {
    // Fallback to Debug build
    addon = require('../build/Debug/screencapturekit_addon.node');
  } catch {
    throw new Error(
      'Could not load the native addon. Please run "npm install" or "npm run build" to compile the addon.'
    );
  }
}

export const nativeAddon = addon;
export const ScreenCaptureKit = addon.ScreenCaptureKit;
