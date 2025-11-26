/**
 * Native addon loader for ScreenCaptureKit
 * Uses node-gyp-build to load prebuilt binaries or fall back to compilation
 */

import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const nodeGypBuild = require('node-gyp-build') as (dir: string) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let addon: any;

try {
  // node-gyp-build automatically checks:
  // 1. prebuilds/ for matching prebuilt binaries
  // 2. build/Release/ for compiled binaries
  // 3. build/Debug/ as fallback
  addon = nodeGypBuild(path.resolve(__dirname, '..'));
} catch (error) {
  throw new Error(
    `Could not load the native addon. If you're developing, run "npm run build:native" to compile. ` +
    `Original error: ${error instanceof Error ? error.message : error}`
  );
}

export const nativeAddon = addon;
export const ScreenCaptureKit = addon.ScreenCaptureKit;
