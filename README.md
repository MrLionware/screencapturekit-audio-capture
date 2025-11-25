# ScreenCaptureKit Audio Capture

> Native Node.js addon for capturing per-application audio on macOS using the ScreenCaptureKit framework

[![npm version](https://badge.fury.io/js/screencapturekit-audio-capture.svg)](https://www.npmjs.com/package/screencapturekit-audio-capture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%2013.0%2B-blue.svg)](https://developer.apple.com/documentation/screencapturekit)

Capture real-time audio from any macOS application with a simple, event-driven API. Built with N-API for Node.js compatibility and ScreenCaptureKit for system-level audio access.

---

## 📖 Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Quick Integration Guide](#quick-integration-guide)
- [Module Exports](#module-exports)
- [Testing](#testing)
- [Stream-Based API](#stream-based-api)
- [API Reference](#api-reference)
- [TypeScript](#typescript)
- [Working with Audio Data](#working-with-audio-data)
- [Common Issues](#common-issues)
- [Examples](#examples)
- [System Permissions](#system-permissions)
- [Audio Format](#audio-format)
- [Platform Support](#platform-support)
- [Performance](#performance)
- [Architecture](#architecture)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Contributing](#contributing)

---

## Features

- 🎵 **Per-App Audio Capture** - Isolate audio from specific applications
- ⚡ **Real-Time Streaming** - Low-latency audio callbacks
- 🎯 **Dual API Design** - Event-driven or Stream-based (your choice!)
- 🪟 **Window & Display Targeting** - Capture a single window or full display audio when you need finer control
- 🌊 **Node.js Streams** - Pipe audio through standard Readable streams
- 📊 **Audio Analysis** - Built-in RMS, peak, and dB calculations
- 💾 **WAV File Export** - Simple helper to save audio as standard WAV files
- 🔒 **Memory Safe** - No crashes, proper resource cleanup
- 📘 **TypeScript-First** - Written in TypeScript with full type definitions
- 🚀 **Production Ready** - Thoroughly tested and documented

## Requirements

- macOS 13.0 (Ventura) or later
- Node.js 14.0.0 or later (Node.js 18+ recommended for running the automated test suite)
- Xcode Command Line Tools (minimum version 14.0)
- Screen Recording permission (granted in System Preferences)

## Installation

```bash
npm install screencapturekit-audio-capture
```

The native addon will automatically compile during installation.

### Build Requirements

The native addon requires:

- **Xcode Command Line Tools** (minimum version 14.0)
  ```bash
  xcode-select --install
  ```
- **macOS SDK 13.0 or later**
- **Node.js development headers** (automatically included with Node.js)

The build process automatically links these macOS frameworks:
- **ScreenCaptureKit** - Per-application audio capture
- **AVFoundation** - Audio processing
- **CoreMedia** - Media sample handling
- **CoreVideo** - Video frame handling
- **Foundation** - Core Objective-C runtime

All frameworks are part of the macOS system and require no additional installation.

### Package Contents

When installed from npm, the package includes:
- `src/` - TypeScript SDK source code and native C++/Objective-C++ code
- `dist/` - Compiled JavaScript and TypeScript declarations
- `binding.gyp` - Native build configuration
- `sdk.js` - Legacy JavaScript wrapper (for backward compatibility)
- `index.js` - Native addon loader
- `README.md`, `LICENSE`, `CHANGELOG.md`

**Note:** Example files are available in the [GitHub repository](https://github.com/mrlionware/screencapturekit-audio-capture/tree/main/examples) but are not included in the npm package to reduce installation size.

See `npm ls screencapturekit-audio-capture` for installation location.

### Version Recommendations

- **Recommended:** Use **1.2.x** for the latest features (window/display capture, STT helper streams, activity tracking, modular test suite).
- **Security/Stability:** If you're on < **1.1.2**, upgrade immediately to fix native buffer handling and multi-channel stability.

Update with:
```bash
npm update screencapturekit-audio-capture
```

## Quick Start

> 📁 **See [`readme_examples/01-quick-start.ts`](readme_examples/01-quick-start.ts) for runnable code**

```typescript
import { AudioCapture } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();
const app = capture.selectApp(['Spotify', 'Music', 'Safari'], { fallbackToFirst: true });

capture.on('audio', (sample) => {
  console.log(`Volume: ${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB`);
});

capture.startCapture(app.processId);
setTimeout(() => capture.stopCapture(), 10000);
```

## Quick Integration Guide

> 📁 **All integration patterns below have runnable examples in [`readme_examples/`](readme_examples/)**

Common patterns for integrating audio capture into your application:

| Pattern | Example File | Description |
|---------|--------------|-------------|
| **STT Integration** | [`02-stt-integration.ts`](readme_examples/02-stt-integration.ts) | Stream + event-based approaches for speech-to-text |
| **Voice Agent** | [`03-voice-agent.ts`](readme_examples/03-voice-agent.ts) | Real-time processing with low-latency config |
| **Recording** | [`04-audio-recording.ts`](readme_examples/04-audio-recording.ts) | Capture to WAV file with efficient settings |
| **Robust Capture** | [`05-robust-capture.ts`](readme_examples/05-robust-capture.ts) | Production error handling with fallbacks |

### Key Configuration Patterns

**For STT engines:**
```typescript
{ format: 'int16', channels: 1, minVolume: 0.01 }  // Int16 mono, silence filtered
```

**For low-latency voice processing:**
```typescript
{ format: 'int16', channels: 1, bufferSize: 1024, minVolume: 0.005 }
```

**For recording:**
```typescript
{ format: 'int16', channels: 2, bufferSize: 4096 }  // Stereo, larger buffer for stability
```

### Audio Sample Structure

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Buffer` | Audio data (Float32 or Int16) |
| `sampleRate` | `number` | Sample rate in Hz (e.g., 48000) |
| `channels` | `number` | 1 = mono, 2 = stereo |
| `format` | `'float32' \| 'int16'` | Audio format |
| `rms` | `number` | RMS volume (0.0-1.0) |
| `peak` | `number` | Peak volume (0.0-1.0) |
| `timestamp` | `number` | Timestamp in seconds |
| `durationMs` | `number` | Duration in milliseconds |
| `sampleCount` | `number` | Total samples across all channels |
| `framesCount` | `number` | Frames per channel |

## Module Exports

The package provides multiple exports for different use cases:

```typescript
// Import classes and types
import {
  AudioCapture,          // High-level SDK wrapper
  AudioStream,           // Readable stream class
  STTConverter,          // STT conversion transform stream
  ScreenCaptureKit,      // Low-level native binding
  AudioCaptureError,     // Custom error class
  ErrorCode,             // Error code enum (recommended)
  ErrorCodes,            // Error codes object (legacy)
  // Type imports
  type AudioSample,
  type ApplicationInfo,
  type CaptureOptions,
  type PermissionStatus,
} from 'screencapturekit-audio-capture';
```

**Available Exports:**

| Export | Description | Use Case |
|--------|-------------|----------|
| `AudioCapture` | High-level event-based API | Most users (recommended) |
| `AudioStream` | Readable stream class | Created via `createAudioStream()` |
| `STTConverter` | Transform stream for STT | Created via `createSTTStream()` |
| `AudioCaptureError` | Custom error class with codes/details | Structured error handling |
| `ErrorCode` | Error code enum | Type-safe error branching |
| `ErrorCodes` | Error codes object (deprecated) | Legacy compatibility |
| `ScreenCaptureKit` | Low-level native binding | Advanced users, minimal overhead |

**Type Exports (TypeScript):**

All types are exported for TypeScript users:
- `AudioSample`, `ApplicationInfo`, `WindowInfo`, `DisplayInfo`
- `CaptureInfo`, `CaptureStatus`, `PermissionStatus`
- `CaptureOptions`, `AudioStreamOptions`, `STTStreamOptions`
- See the [TypeScript section](#typescript) for full details.

## Testing

**Note:** Test files are available in the [GitHub repository](https://github.com/mrlionware/screencapturekit-audio-capture) but are not included in the npm package.

Tests are written in **TypeScript** and live under `tests/`. They use Node's built-in test runner with `tsx` (**Node 18+**).

**Test Commands:**

- `npm test` — Runs every suite in `tests/**/*.test.ts` (unit, integration, examples, edge-cases) against the mocked ScreenCaptureKit layer; works cross-platform.
- `npm run test:unit` — Fast coverage for utilities, audio metrics, selection, and capture control.
- `npm run test:integration` — Multi-component flows (window/display capture, activity tracking, capability guards) using the shared mock.
- `npm run test:examples` — Example validation scaffolding (mirrors the runnable scripts).
- `npm run test:edge-cases` — Boundary/error handling coverage.

**Type Checking:**

- `npm run typecheck` — Type-check the SDK source code.
- `npm run typecheck:tests` — Type-check the test files.

For true hardware validation, run the example scripts on macOS with Screen Recording permission enabled.

## Stream-Based API

> 📁 **See [`readme_examples/06-stream-basics.ts`](readme_examples/06-stream-basics.ts) and [`readme_examples/07-stream-processing.ts`](readme_examples/07-stream-processing.ts) for runnable examples**

Use Node.js Readable streams for composable audio processing:

```typescript
const audioStream = capture.createAudioStream('Spotify', { minVolume: 0.01 });
audioStream.pipe(yourWritableStream);

// Object mode for metadata access
const metaStream = capture.createAudioStream('Spotify', { objectMode: true });
metaStream.on('data', (sample) => console.log(`RMS: ${sample.rms}`));
```

### When to Use Streams vs Events

| Use Case | Recommended API |
|----------|----------------|
| Piping through transforms | **Stream** |
| Backpressure handling | **Stream** |
| Multiple listeners | **Event** |
| Maximum simplicity | **Event** |

Both APIs use the same underlying capture mechanism and have identical performance.

### Stream API Best Practices

1. **Always handle errors** - Attach an `error` handler to prevent crashes
2. **Use `pipeline()`** - Better error handling than chaining `.pipe()`
3. **Clean up resources** - Call `stream.stop()` when done
4. **Choose the right mode** - Normal mode for raw data, object mode for metadata
5. **Stream must flow** - Attach a `data` listener to start capture

```typescript
import { pipeline } from 'stream';

// Recommended pattern
pipeline(audioStream, transform, writable, (err) => {
  if (err) console.error('Pipeline failed:', err);
});

// Always handle SIGINT
process.on('SIGINT', () => audioStream.stop());
```

### Troubleshooting Stream Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Application not found" | App not running | Use `selectApp()` with fallbacks |
| No data events | App not playing audio / `minVolume` too high | Verify app is playing; lower or remove threshold |
| "stream.push() after EOF" | Stopping abruptly | Use `pipeline()` for proper cleanup |
| "Already capturing" | Multiple streams from one instance | Create separate `AudioCapture` instances |
| Memory growing | Not consuming data | Attach `data` listener; use circular buffer |

### Stream Performance Tips

- **Normal mode** is faster than object mode (no metadata calculation)
- **Batch processing** is more efficient than per-sample processing
- **Default highWaterMark** is suitable for most cases

> 📁 **See [`readme_examples/07-stream-processing.ts`](readme_examples/07-stream-processing.ts) for a complete production-ready stream example**

## API Reference

### Class: `AudioCapture`

High-level event-based API (recommended).

#### Methods

##### `getApplications(options?: object): ApplicationInfo[]`

Get list of all capturable applications. By default, filters out apps with empty names (helper processes).

**Options:**
- `includeEmpty` (boolean): Include apps with empty `applicationName` (default: `false`)

```typescript
import { AudioCapture, type ApplicationInfo } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Get all apps (filters empty names by default)
const apps: ApplicationInfo[] = capture.getApplications();

// Include apps with empty names (helper processes, background services)
const allApps: ApplicationInfo[] = capture.getApplications({ includeEmpty: true });
```

##### `findApplication(identifier: string): ApplicationInfo | null`

Find application by name or bundle ID (case-insensitive).

```typescript
const spotify: ApplicationInfo | null = capture.findApplication('Spotify');
const safari: ApplicationInfo | null = capture.findApplication('com.apple.Safari');
```

##### `findByName(name: string): ApplicationInfo | null`

Find application by name (alias for `findApplication`, case-insensitive search).

```typescript
const app: ApplicationInfo | null = capture.findByName('Spotify');
if (app) {
  console.log(`Found: ${app.applicationName} (PID: ${app.processId})`);
}
```

##### `getAudioApps(options?: object): ApplicationInfo[]`

Get only applications likely to produce audio. Filters out system apps and utilities, and optionally sorts by recent activity.

**Options:**
- `includeSystemApps` (boolean): Include system apps (default: `false`)
- `includeEmpty` (boolean): Include apps with empty names (default: `false`)
- `sortByActivity` (boolean): Sort by recent audio activity (requires `enableActivityTracking()`, default: `false`)
- `appList` (Array): Use a prefetched app list instead of calling `getApplications()` (default: `null`)

```typescript
// Get audio apps (filters system apps and empty names)
const audioApps: ApplicationInfo[] = capture.getAudioApps();
console.log('Audio apps:', audioApps.map((a) => a.applicationName));
// Example output: ['Spotify', 'Safari', 'Music', 'Zoom']
// (excludes Finder, Terminal, System Preferences, AutoFill helpers, etc.)

// Sort by recent audio activity (shows actively playing apps first)
capture.enableActivityTracking();
const activeApps = capture.getAudioApps({ sortByActivity: true });
// Apps currently producing audio appear first

// Reuse prefetched app list to avoid redundant native calls
const permissionStatus = AudioCapture.verifyPermissions();
const audioApps = capture.getAudioApps({ appList: permissionStatus.apps });
// More efficient - reuses apps from permission check
```


##### `getApplicationByPid(processId: number): ApplicationInfo | null`

Get application info by process ID.

```typescript
const app: ApplicationInfo | null = capture.getApplicationByPid(12345);
if (app) {
  console.log(`Found ${app.applicationName}`);
}
```

##### Window & Display Selection

Need to capture audio from a single window or an entire display instead of a whole application? Use the new helpers to inspect available targets and start a capture against them:

```typescript
import { AudioCapture, type WindowInfo, type DisplayInfo } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// List windows (filter to on-screen windows that have a title)
const windows: WindowInfo[] = capture.getWindows({ onScreenOnly: true, requireTitle: true });
windows.forEach((win) => {
  console.log(`#${win.windowId}: ${win.title} (${win.owningApplicationName})`);
});

// Capture a specific window
const targetWindow = windows.find(win => /Safari/.test(win.owningApplicationName));
if (targetWindow) {
  capture.captureWindow(targetWindow.windowId, { format: 'int16' });
}

// Capture a display (see getDisplays() for IDs)
const displays = capture.getDisplays();
const internalDisplay = displays.find(display => display.isMainDisplay);
capture.captureDisplay(internalDisplay.displayId);
```

`getWindows()` and `getDisplays()` return the raw ScreenCaptureKit metadata (ID, frame, layer, owning process, etc.) so you can build custom UIs for choosing targets. `captureWindow()` and `captureDisplay()` accept the IDs returned from those helpers and otherwise share the same options as `startCapture()`.

##### `selectApp(identifiers?: string | number | Array, options?: Object): ApplicationInfo | null`

Smart app selection with multiple fallback strategies. Tries exact name, PID, bundle ID, and partial matches.

**Parameters:**
- `identifiers` - App name, PID, bundle ID, or array to try in order. `null`/`undefined` returns first audio app
- `options.audioOnly` (boolean) - Only search audio apps (default: `true`)
- `options.appList` (Array) - Prefetched app list to reuse (e.g., from `verifyPermissions()`) to avoid re-fetching (default: `null`)
- `options.fallbackToFirst` (boolean) - Return the first available app if no identifier matches (default: `false`)
- `options.sortByActivity` (boolean) - Sort using recent audio activity (requires `enableActivityTracking()`, default: `false`)
- `options.throwOnNotFound` (boolean) - Throw error if no app found (default: `false`)

**Returns:** Application info or `null` (unless `throwOnNotFound` is `true`)

```typescript
import { AudioCapture, AudioCaptureError, ErrorCode, type ApplicationInfo } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Try multiple apps in order
const app: ApplicationInfo | null = capture.selectApp(['Spotify', 'Music', 'Safari']);

// Get first audio app if none specified
const firstApp: ApplicationInfo | null = capture.selectApp();

// Use a prefetched list to avoid redundant native calls
const permissionStatus = AudioCapture.verifyPermissions();
const appFromList: ApplicationInfo | null = capture.selectApp(['Spotify', 'Safari'], {
  appList: permissionStatus.apps
});

// Fallback to first app if no match
const fallbackApp: ApplicationInfo | null = capture.selectApp(['Spotify', 'Music'], { fallbackToFirst: true });

// Throw on failure for cleaner error handling
try {
  const foundApp: ApplicationInfo = capture.selectApp(['Spotify'], { throwOnNotFound: true })!;
} catch (err) {
  if (AudioCaptureError.isAudioCaptureError(err) && err.code === ErrorCode.APP_NOT_FOUND) {
    console.log('Try:', err.details.suggestion);
  }
}
```

##### `enableActivityTracking(options?: object): void`

Enable background tracking of audio activity for smarter app filtering and sorting.

**Options:**
- `decayMs` (number): Remove apps from cache after this many ms of inactivity (default: `30000`)

```typescript
// Enable tracking
capture.enableActivityTracking();

// Or with custom decay time
capture.enableActivityTracking({ decayMs: 60000 }); // 60 second decay
```

##### `disableActivityTracking(): void`

Disable activity tracking and clear the cache.

```typescript
capture.disableActivityTracking();
```

##### `getActivityInfo(): Object`

Get activity tracking status and statistics about recently active apps.

**Returns:**
- `enabled` (boolean): Whether tracking is enabled
- `trackedApps` (number): Number of apps currently in cache
- `recentApps` (Array): Recently active apps with metadata

```typescript
const info = capture.getActivityInfo();
console.log(`Tracking enabled: ${info.enabled}`);
console.log(`Active apps: ${info.trackedApps}`);
info.recentApps.forEach((app) => {
  console.log(`PID ${app.processId}: avg RMS ${app.avgRMS}, last seen ${app.ageMs}ms ago`);
});
```

##### `AudioCapture.verifyPermissions(): Object` (Static)

Verify screen recording permissions before attempting capture. Returns a status object with remediation steps if permissions are not granted.

**Returns:**
- `granted` (boolean): Whether permission is granted
- `message` (string): Human-readable status message
- `apps` (Array, optional): Prefetched application list you can reuse for selection (if granted)
- `remediation` (string, optional): Instructions to fix permission issues
- `availableApps` (number, optional): Number of apps found (if granted)

```typescript
import { AudioCapture, type PermissionStatus } from 'screencapturekit-audio-capture';

const status: PermissionStatus = AudioCapture.verifyPermissions();
if (!status.granted) {
  console.error(status.message);
  console.log(status.remediation);
  process.exit(1);
} else {
  console.log(`Permission granted, found ${status.availableApps} apps`);
  // Optionally reuse status.apps to avoid re-fetching
  const audioApps = capture.getAudioApps({ appList: status.apps });
  const selectedApp = capture.selectApp(['Spotify', 'Music'], {
    appList: status.apps,
    fallbackToFirst: true
  });
}
```

##### `getStatus(): Object | null`

Get detailed status of the current capture session. Returns `null` if not capturing.

**Returns (when capturing):**
- `capturing` (boolean): Always `true` when not null
- `processId` (number | null): Process ID being captured (may be `null` for display capture)
- `app` (ApplicationInfo | null): Application info (if available)
- `window` (WindowInfo | null): Window info when capturing a single window
- `display` (DisplayInfo | null): Display info when capturing a display
- `targetType` (`'application' | 'window' | 'display'`): Target kind
- `config` (Object): Current capture configuration
  - `minVolume` (number): Volume threshold
  - `format` (string): Audio format ('float32' or 'int16')

```typescript
import { AudioCapture, type CaptureStatus } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();
const status: CaptureStatus | null = capture.getStatus();
if (status) {
  console.log(`Capturing type: ${status.targetType}`);
  console.log(`Process ID: ${status.processId}`);
  if (status.app) {
    console.log(`App: ${status.app.applicationName}`);
  }
  console.log(`Config: format=${status.config.format}, minVolume=${status.config.minVolume}`);
} else {
  console.log('Not currently capturing');
}
```

##### `startCapture(appIdentifier: string | number | Object, options?: object): boolean`

Start capturing audio. Accepts app name, bundle ID, process ID, or an app object (from `getApplications()` or `selectApp()`).

**Throws:** `AudioCaptureError` with code and details if capture fails (permission denied, app not found, etc.). Always emits the error event before throwing.

**Options:**

*Processing Options:*
- `minVolume` (number): Minimum RMS volume threshold (0.0-1.0). Only emit audio when volume exceeds this level.
- `format` (string): Audio format - `'float32'` (default) or `'int16'`

*Advanced Configuration Options:*
- `sampleRate` (number): **Requested** sample rate in Hz (e.g., 44100, 48000). Default: 48000

  ⚠️ **Important**: ScreenCaptureKit captures audio at the system's native sample rate (usually 48000 Hz). This setting is a hint to the system, but the actual sample rate depends on your audio hardware configuration. Always check `sample.sampleRate` in received samples to see the actual rate. If you need a specific sample rate, consider using a resampling library.

- `channels` (number): Number of audio channels: 1 (mono) or 2 (stereo). Default: 2

  ✅ **Reliable**: This setting is consistently honored by ScreenCaptureKit.

- `bufferSize` (number): Buffer size for audio processing in frames. Smaller values = lower latency but higher CPU usage. Default: system default
- `excludeCursor` (boolean): Exclude cursor from capture (reserved for future video features). Default: true

```typescript
import { AudioCapture, type ApplicationInfo } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Basic usage
capture.startCapture('Music');                    // By name
capture.startCapture('com.spotify.client');       // By bundle ID
capture.startCapture(12345);                      // By process ID

// Pass app object directly (avoids redundant lookups)
const app: ApplicationInfo = capture.selectApp(['Spotify', 'Music']);
capture.startCapture(app);                        // By app object

// With volume threshold (only emit when audio is present)
capture.startCapture('Spotify', { minVolume: 0.01 });

// Convert to Int16 format
capture.startCapture('Spotify', { format: 'int16' });

// Low-latency configuration (smaller buffer = lower latency)
capture.startCapture('Spotify', {
  sampleRate: 44100,
  channels: 2,
  bufferSize: 1024,     // Small buffer for low latency
  format: 'float32'
});

// Mono, high-quality configuration
capture.startCapture('Spotify', {
  sampleRate: 48000,
  channels: 1,          // Mono reduces data by half
  bufferSize: 4096,     // Larger buffer for stability
  format: 'int16'
});

// Combine all options
capture.startCapture('Spotify', {
  minVolume: 0.01,
  format: 'int16',
  sampleRate: 48000,
  channels: 2,
  bufferSize: 2048
});

// With error handling
try {
  capture.startCapture('Spotify', { minVolume: 0.01 });
} catch (err) {
  if (err.code === ErrorCode.APP_NOT_FOUND) {
    console.log('Available apps:', err.details.availableApps);
  } else if (err.code === ErrorCode.PERMISSION_DENIED) {
    console.log(err.details.suggestion);
  } else {
    console.error('Failed to start:', err.message);
  }
}
```

**Buffer Size Guidelines:**
- **1024 frames**: Ultra-low latency (~21ms at 48kHz), higher CPU usage
- **2048 frames**: Balanced latency (~43ms at 48kHz), moderate CPU usage (recommended)
- **4096 frames**: Higher latency (~85ms at 48kHz), lower CPU usage, more stable
- **0 or undefined**: Use system default

**How Configuration Options Work:**

The SDK passes configuration to the native ScreenCaptureKit layer:
- **sampleRate**: Requested rate (actual rate depends on system audio device)
- **channels**: Reliably honored by ScreenCaptureKit
- **bufferSize**: Controls latency/CPU trade-off (0 = system default)
- **excludeCursor**: Reserved for future video features (currently has no effect on audio)

Note: These are configuration hints. Always verify actual values in received samples.

##### `stopCapture(): void`

Stop the current capture session.

##### `isCapturing(): boolean`

Check if currently capturing.

##### `getCurrentCapture(): CaptureInfo | null`

Get information about the current capture. Returns the same structure emitted with the `start`/`stop` events:

- `targetType`: `'application'`, `'window'`, or `'display'`
- `processId`: PID backing the capture (if available)
- `app`: Application info (when available)
- `window`: Window info when capturing a specific window
- `display`: Display info when capturing a display

##### `createAudioStream(appIdentifier: string | number, options?: object): AudioStream`

Create a readable stream for audio capture. Provides a stream-based alternative to the event-based API.

**Options:**

*Processing Options:*
- `minVolume` (number): Minimum RMS volume threshold
- `format` (string): Audio format - `'float32'` (default) or `'int16'`
- `objectMode` (boolean): Enable object mode to receive full sample objects instead of just raw audio data (default: false)

*Advanced Configuration Options:*
- `sampleRate` (number): Requested sample rate in Hz (e.g., 44100, 48000). Default: 48000 (see note in `startCapture`)
- `channels` (number): Number of audio channels: 1 (mono) or 2 (stereo). Default: 2 ✅
- `bufferSize` (number): Buffer size for audio processing in frames. Smaller values = lower latency but higher CPU usage. Default: system default
- `excludeCursor` (boolean): Exclude cursor from capture (reserved for future video features). Default: true

**Returns:** `AudioStream` - A Node.js Readable stream

```typescript
import { AudioCapture, AudioStream } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Basic usage - stream raw audio buffers
const audioStream: AudioStream = capture.createAudioStream('Spotify');
audioStream.pipe(myProcessor);

// Object mode - stream full sample objects with metadata
const audioStream = capture.createAudioStream('Spotify', { objectMode: true });
audioStream.on('data', (sample) => {
  console.log(`RMS: ${sample.rms}, Peak: ${sample.peak}`);
});

// Low-latency streaming
const audioStream = capture.createAudioStream('Spotify', {
  sampleRate: 44100,
  channels: 2,
  bufferSize: 1024,
  format: 'float32',
  objectMode: true
});

// With pipeline for error handling
const { pipeline } = require('stream');
pipeline(
  capture.createAudioStream('Spotify', {
    format: 'int16',
    sampleRate: 48000,
    channels: 1
  }),
  myTransform,
  myWritable,
  (err) => {
    if (err) console.error('Pipeline failed:', err);
  }
);

// Stop the stream
audioStream.stop();
```

##### `createSTTStream(appIdentifier?: string | number | Array, options?: object): STTConverter`

Create a pre-configured stream for Speech-to-Text (STT) engines. Automatically converts to Int16 mono format and handles app selection with fallbacks.

**Parameters:**
- `appIdentifier` - App name, PID, bundle ID, or array to try in order. `null`/`undefined` auto-selects first audio app

**Options:**
- `format` (string): Output format - `'int16'` (default) or `'float32'`
- `channels` (number): Output channels - `1` (default, mono) or `2` (stereo)
- `minVolume` (number): Minimum RMS volume threshold
- `objectMode` (boolean): Stream emits sample objects with metadata (default: `false`)
- `autoSelect` (boolean): Auto-select first audio app if identifier not found (default: `true`)
- Plus all `CaptureOptions` (sampleRate, bufferSize, etc.)

**Returns:** `STTConverter` - Transform stream ready to pipe to STT engine

```typescript
import { AudioCapture, STTConverter } from 'screencapturekit-audio-capture';
import { pipeline } from 'stream';

const capture = new AudioCapture();

// Simple - auto-converts to Int16 mono
const sttStream: STTConverter = capture.createSTTStream('Safari');
sttStream.pipe(yourSTTEngine);

// With fallback apps
const sttStream = capture.createSTTStream(['Zoom', 'Safari', 'Chrome']);

// Auto-select first available audio app
const sttStream = capture.createSTTStream();
console.log(`Selected: ${sttStream.app.applicationName}`);

// Custom format and channels
const sttStream = capture.createSTTStream('Spotify', {
  format: 'float32',
  channels: 2,
  minVolume: 0.01
});

// Pipe to writable stream
pipeline(
  capture.createSTTStream(['Spotify', 'Music']),
  yourSTTWritableStream,
  (err) => {
    if (err) console.error('Pipeline error:', err);
  }
);

// Stop when done
sttStream.stop();
```

#### Static Methods

##### `AudioCapture.bufferToFloat32Array(buffer: Buffer): Float32Array`

Convert Buffer to Float32Array for easier audio processing. This is the recommended way to work with audio data.

```typescript
capture.on('audio', (sample: AudioSample) => {
  // Convert Buffer to Float32Array
  const float32: Float32Array = AudioCapture.bufferToFloat32Array(sample.data);

  // Now you can access individual samples
  for (let i = 0; i < float32.length; i++) {
    const value: number = float32[i]; // Range: -1.0 to 1.0
  }

  // Calculate average amplitude
  let sum = 0;
  for (let i = 0; i < float32.length; i++) {
    sum += Math.abs(float32[i]);
  }
  const avgAmplitude: number = sum / float32.length;
  console.log(`Average amplitude: ${avgAmplitude}`);
});
```

##### `AudioCapture.rmsToDb(rms: number): number`

Convert RMS value (0.0-1.0) to decibels.

```typescript
const db: number = AudioCapture.rmsToDb(0.5); // Returns: -6.02 dB
```

##### `AudioCapture.peakToDb(peak: number): number`

Convert peak value (0.0-1.0) to decibels.

```typescript
const peakDb: number = AudioCapture.peakToDb(0.5); // Returns: -6.02 dB
```

##### `AudioCapture.calculateDb(samples: Buffer, method?: 'rms' | 'peak'): number`

Calculate dB level from audio samples.

```typescript
capture.on('audio', (sample: AudioSample) => {
  const rmsDb: number = AudioCapture.calculateDb(sample.data, 'rms');
  const peakDb: number = AudioCapture.calculateDb(sample.data, 'peak');
  console.log(`RMS: ${rmsDb.toFixed(1)} dB, Peak: ${peakDb.toFixed(1)} dB`);
});
```

##### `AudioCapture.writeWav(buffer: Buffer, options: object): Buffer`

Create a WAV file from PCM audio data. Returns a complete WAV file buffer that can be written directly to disk.

**Options:**
- `sampleRate` (number, required): Sample rate in Hz (e.g., 48000)
- `channels` (number, required): Number of channels (e.g., 2 for stereo)
- `format` (string): Audio format - `'float32'` (default) or `'int16'`

```typescript
import fs from 'fs';

capture.on('audio', (sample: AudioSample) => {
  // Create WAV file from audio sample
  const wavBuffer: Buffer = AudioCapture.writeWav(sample.data, {
    sampleRate: sample.sampleRate,
    channels: sample.channels,
    format: sample.format
  });

  // Write to file
  fs.writeFileSync('output.wav', wavBuffer);
});
```

**Note:** The helper automatically creates proper WAV headers for both Float32 (IEEE Float) and Int16 (PCM) formats. The resulting files can be played in any standard audio player.

#### Events

##### Event: `'start'`

Emitted when capture starts.

```typescript
capture.on('start', ({ processId, app }) => {
  console.log(`Capturing from ${app?.applicationName}`);
});
```

##### Event: `'audio'`

Emitted for each audio sample (typically 160ms chunks at 48kHz).

```typescript
capture.on('audio', (sample: AudioSample) => {
  // sample.data: Buffer (Float32 or Int16 PCM audio, depending on format option)
  // sample.sampleRate: 48000
  // sample.channels: 2
  // sample.timestamp: 123.456
  // sample.format: 'float32' or 'int16'
  // sample.sampleCount: 15360 (total samples)
  // sample.framesCount: 7680 (samples per channel)
  // sample.durationMs: 160 (approximate)
  // sample.rms: 0.123 (root mean square volume)
  // sample.peak: 0.456 (peak volume)
});
```

##### Event: `'stop'`

Emitted when capture stops.

```typescript
capture.on('stop', ({ processId }) => {
  console.log('Capture stopped');
});
```

##### Event: `'error'`

Emitted on errors.

```typescript
capture.on('error', (err: Error) => {
  console.error('Error:', err.message);
});
```


### Error Handling

#### Class: `AudioCaptureError`

Custom error class thrown by the SDK.

- `message`: Human-readable error message
- `code`: Machine-readable error code (see below)
- `details`: Additional context (e.g., `processId`, `availableApps`)

#### Error Codes

Import `ErrorCodes` for reliable error checking:

```typescript
import { AudioCapture, AudioCaptureError, ErrorCode } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();
capture.on('error', (err: AudioCaptureError) => {
  if (err.code === ErrorCode.APP_NOT_FOUND) {
    // Handle missing app
  }
});
```

| Code | Description |
|------|-------------|
| `ERR_PERMISSION_DENIED` | Screen Recording permission not granted |
| `ERR_APP_NOT_FOUND` | Application not found by name or bundle ID |
| `ERR_PROCESS_NOT_FOUND` | Process ID not found or not running |
| `ERR_ALREADY_CAPTURING` | Attempted to start capture while already capturing |
| `ERR_CAPTURE_FAILED` | Native capture failed to start (e.g., app has no windows) |
| `ERR_INVALID_ARGUMENT` | Invalid arguments provided to method |

**Using Error Codes:**

```typescript
import { AudioCapture, AudioCaptureError, ErrorCode } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

capture.on('error', (err: AudioCaptureError) => {
  switch (err.code) {
    case ErrorCode.PERMISSION_DENIED:
      console.log('Grant Screen Recording permission');
      break;
    case ErrorCode.APP_NOT_FOUND:
      console.log('App not found:', err.details.requestedApp);
      console.log('Available:', err.details.availableApps);
      break;
    case ErrorCode.ALREADY_CAPTURING:
      console.log('Stop current capture first');
      capture.stopCapture();
      break;
    case ErrorCode.PROCESS_NOT_FOUND:
      console.log('Process ID not found:', err.details.requestedPid);
      break;
    case ErrorCode.CAPTURE_FAILED:
      console.log('Native capture failed:', err.details.suggestion);
      break;
    case ErrorCode.INVALID_ARGUMENT:
      console.log('Invalid argument type:', err.details.receivedType);
      console.log('Expected:', err.details.expectedTypes);
      break;
    default:
      console.error('Error:', err.message);
  }
});
```

### Class: `AudioStream`

Readable stream for audio capture. Extends Node.js `Readable` stream.

#### Methods

##### `stop(): void`

Stop the stream and underlying capture.

```typescript
const audioStream: AudioStream = capture.createAudioStream('Spotify');
// ... use the stream
audioStream.stop();
```

##### `getCurrentCapture(): CaptureInfo | null`

Get information about the current capture (same structure as `AudioCapture#getCurrentCapture`).

```typescript
import type { CaptureInfo } from 'screencapturekit-audio-capture';

const info: CaptureInfo | null = audioStream.getCurrentCapture();
if (info) {
  console.log(`Target type: ${info.targetType}`);
}
```

#### Stream Events

AudioStream extends Node.js Readable, so it emits all standard stream events:

```typescript
import { AudioCapture, AudioStream } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();
const audioStream: AudioStream = capture.createAudioStream('Spotify');

audioStream.on('data', (chunk: Buffer) => {
  // Chunk is a Buffer (or sample object if objectMode is true)
  console.log(`Received ${chunk.length} bytes`);
});

audioStream.on('error', (error: Error) => {
  console.error('Stream error:', error);
});

audioStream.on('end', () => {
  console.log('Stream ended');
});

audioStream.on('close', () => {
  console.log('Stream closed');
});
```

### Low-Level API: ScreenCaptureKit

For advanced users who need direct access to the native binding:

```typescript
import { ScreenCaptureKit } from 'screencapturekit-audio-capture';

const captureKit = new ScreenCaptureKit();

// Get apps (returns basic ApplicationInfo array)
const apps = captureKit.getAvailableApps();

// Configuration object for native capture
const config = {
  sampleRate: 48000,
  channels: 2,
  bufferSize: 2048,
  excludeCursor: true
};

// Start capture (requires manual callback handling)
captureKit.startCapture(processId, config, (sample) => {
  // sample: { data, sampleRate, channelCount, timestamp }
  // No enhancement - raw native data
  // data is always Float32, channelCount (not 'channels')
  console.log(`Got ${sample.data.length} bytes at ${sample.sampleRate}Hz`);
});

// Stop and check status
captureKit.stopCapture();
const isCapturing: boolean = captureKit.isCapturing();
```

**When to use:**
- You need absolute minimal overhead
- You want to handle all enhancement yourself (RMS, peak, format conversion)
- You're building your own wrapper
- You need to avoid the event emitter overhead

**Most users should use `AudioCapture` instead** - it provides:
- Error handling with proper error codes
- Sample enhancement (RMS, peak, durationMs, etc.)
- Convenience methods (findApplication, getAudioApps, etc.)
- Format conversion (Int16)
- Volume threshold filtering
- Better property naming (channels vs channelCount)

## TypeScript

The SDK is written in TypeScript and provides full type definitions. All types are exported from the main module:

```typescript
import {
  AudioCapture,
  AudioStream,
  STTConverter,
  AudioCaptureError,
  ErrorCode,
  // Type imports
  type AudioSample,
  type ApplicationInfo,
  type WindowInfo,
  type DisplayInfo,
  type CaptureInfo,
  type CaptureStatus,
  type AudioStreamOptions,
  type CaptureOptions,
  type PermissionStatus,
} from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Type-safe permission verification
const status: PermissionStatus = AudioCapture.verifyPermissions();
if (!status.granted) {
  console.error(status.message);
  process.exit(1);
}

// Event-based API with typed samples
capture.on('audio', (sample: AudioSample) => {
  const db: number = AudioCapture.rmsToDb(sample.rms);
  console.log(`Volume: ${db.toFixed(1)} dB, Duration: ${sample.durationMs}ms`);
});

// Stream-based API with typed options
const streamOptions: AudioStreamOptions = {
  minVolume: 0.01,
  format: 'float32',
  objectMode: true
};

const audioStream: AudioStream = capture.createAudioStream('Spotify', streamOptions);

audioStream.on('data', (sample: AudioSample) => {
  console.log(`RMS: ${sample.rms}, Peak: ${sample.peak}`);
});

// Finding apps with proper types
const app: ApplicationInfo | null = capture.findApplication('Safari');
if (app) {
  capture.startCapture(app.processId);
}

// Window/display helpers are fully typed
const windows: WindowInfo[] = capture.getWindows({ onScreenOnly: true });
const displays: DisplayInfo[] = capture.getDisplays();
const captureStatus: CaptureStatus | null = capture.getStatus();

// Error handling with ErrorCode enum
capture.on('error', (err: AudioCaptureError) => {
  if (err.code === ErrorCode.APP_NOT_FOUND) {
    console.log('Available apps:', err.details.availableApps);
  }
});

// Type guard for error checking
try {
  capture.startCapture('NonexistentApp');
} catch (error) {
  if (AudioCaptureError.isAudioCaptureError(error)) {
    console.error(`Error [${error.code}]:`, error.message);
  }
}
```

### Available Types

| Type | Description |
|------|-------------|
| `AudioSample` | Audio sample with data, metadata (rms, peak, duration, etc.) |
| `ApplicationInfo` | Application info (processId, bundleIdentifier, applicationName) |
| `WindowInfo` | Window info (windowId, title, owningProcessId, frame, etc.) |
| `DisplayInfo` | Display info (displayId, width, height, frame, etc.) |
| `CaptureInfo` | Current capture target info |
| `CaptureStatus` | Full capture status including config |
| `PermissionStatus` | Permission verification result |
| `CaptureOptions` | Options for startCapture() |
| `AudioStreamOptions` | Options for createAudioStream() |
| `STTStreamOptions` | Options for createSTTStream() |
| `ErrorCode` | Enum of error codes (APP_NOT_FOUND, PERMISSION_DENIED, etc.) |

## Working with Audio Data

### Understanding the Buffer Format

Audio samples are provided as Node.js `Buffer` objects containing Float32 PCM audio data by default. Here's how to work with them:

```typescript
import { AudioCapture, type AudioSample } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

capture.on('audio', (sample: AudioSample) => {
  // Method 1: Use the helper (recommended)
  const float32: Float32Array = AudioCapture.bufferToFloat32Array(sample.data);

  // Method 2: Manual conversion
  const float32Manual = new Float32Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 4  // 4 bytes per Float32
  );

  // Now you can work with audio samples
  console.log(`Sample range: ${Math.min(...float32)} to ${Math.max(...float32)}`);
});
```

### Converting to Int16 Format

If you need Int16 audio (common for many audio libraries), use the `format` option:

```typescript
capture.startCapture('Spotify', { format: 'int16' });

capture.on('audio', (sample: AudioSample) => {
  // sample.data is now Int16 format
  const int16 = new Int16Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 2  // 2 bytes per Int16
  );

  console.log(`Int16 range: ${Math.min(...int16)} to ${Math.max(...int16)}`);
  // Output: Int16 range: -32768 to 32767
});
```

### Filtering Silent Audio

Use the `minVolume` option to only receive audio when sound is actually present:

```typescript
// Only emit audio events when RMS volume > 0.01
capture.startCapture('Spotify', { minVolume: 0.01 });

capture.on('audio', (sample: AudioSample) => {
  // This will only be called when audio is present
  console.log(`Active audio: ${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB`);
});
```

## Common Issues

### No applications available

**Symptom:** `getApplications()` returns an empty array or you get an error "No applications available"

**Solution:**
1. Grant Screen Recording permission in **System Preferences → Privacy & Security → Screen Recording**
2. Add your terminal app (Terminal.app, iTerm2, VS Code, etc.)
3. Toggle it **ON**
4. **Important:** Restart your terminal completely for changes to take effect

**Verification:**
```typescript
const apps = capture.getApplications();
if (apps.length === 0) {
  console.error('❌ No apps found - Screen Recording permission likely not granted');
  console.error('   Go to System Preferences → Privacy & Security → Screen Recording');
} else {
  console.log(`✅ Found ${apps.length} applications`);
}
```

### Application not found

**Symptom:** Error: `Application "AppName" not found`

**Solutions:**
1. **Check if the app is running:** The application must be actively running
2. **Check spelling:** Application names are case-insensitive but must match
3. **List available apps:**
   ```typescript
   const apps = capture.getApplications();
   console.log('Available:', apps.map((a) => a.applicationName).join(', '));
   ```
4. **Use bundle ID instead:**
   ```typescript
   // More reliable than app name
   capture.startCapture('com.spotify.client');
   ```
5. **Filter for audio apps only:**
   ```typescript
   const audioApps = capture.getAudioApps();
   console.log('Audio apps:', audioApps.map((a) => a.applicationName));
   ```

### No audio samples received

**Symptom:** Capture starts successfully but no `'audio'` events are emitted

**Solutions:**
1. **Ensure the app is actively playing audio** - Not all running apps produce audio
2. **Check if audio is muted** - Muted applications may not emit audio samples
3. **Verify the app has visible windows** - Some ScreenCaptureKit limitations require windows
4. **Try a different app** - Test with Music, Safari, or Spotify to verify your setup
5. **Check volume threshold:** If you set `minVolume`, ensure audio is loud enough
   ```typescript
   // Remove volume threshold for testing
   capture.startCapture('Spotify');  // No options
   ```

### How to work with the Buffer data

**Symptom:** Confused about how to process `sample.data`

**Solution:** Use the helper method:
```typescript
import { AudioCapture, type AudioSample } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

capture.on('audio', (sample: AudioSample) => {
  // Convert Buffer to Float32Array
  const float32: Float32Array = AudioCapture.bufferToFloat32Array(sample.data);

  // Access individual samples
  for (let i = 0; i < float32.length; i++) {
    const sampleValue: number = float32[i]; // Range: -1.0 to 1.0
  }
});
```

### Stream API Issues

**Symptom:** Stream-related errors or unexpected behavior

**Common Issues & Solutions:**

1. **Stream doesn't start capturing:**
   ```typescript
   // Won't start - missing data listener
   const stream = capture.createAudioStream('Spotify');
   stream.on('error', (err) => console.error(err));

   // Will start - has data listener
   stream.on('data', (chunk) => { /* process */ });
   ```

2. **"Already capturing" error when creating multiple streams:**
   ```typescript
   // Wrong: Same capture instance
   const stream1 = capture.createAudioStream('Spotify');
   const stream2 = capture.createAudioStream('Safari'); // Error!

   // Correct: Separate capture instances
   const capture1 = new AudioCapture();
   const capture2 = new AudioCapture();
   const stream1 = capture1.createAudioStream('Spotify');
   const stream2 = capture2.createAudioStream('Safari');
   ```

3. **Memory grows over time:**
   ```typescript
   // Problem: Not consuming data
   const stream = capture.createAudioStream('Spotify');
   // No data handler = buffering

   // Solution: Always consume
   stream.on('data', (chunk) => {
     // Process or discard
   });
   ```

4. **"stream.push() after EOF" error:**
   ```typescript
   // Use pipeline for proper cleanup
   import { pipeline } from 'stream';

   pipeline(stream, transform, writable, (err) => {
     if (err && (err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') {
       console.error(err);
     }
   });
   ```

5. **No data events in object mode:**
   ```typescript
   // Check if app is producing audio
   const stream = capture.createAudioStream('Spotify', {
     objectMode: true,
     minVolume: 0.01  // Remove threshold for testing
   });

   let received = false;
   setTimeout(() => {
     if (!received) {
       console.log('No audio - is app playing sound?');
     }
   }, 5000);

   stream.on('data', () => { received = true; });
   ```

### Build errors during installation

**Symptom:** Native addon fails to compile

**Solutions:**
1. Install Xcode Command Line Tools: `xcode-select --install`
2. Verify macOS version: `sw_vers` (requires macOS 13.0+)
3. Clean and rebuild:
   ```bash
   npm run clean
   npm run build
   ```
4. Check Node.js version: `node --version` (requires 14.0.0+)

**Common Build Errors:**

**Error: "No Xcode or CLT version detected"**
- Solution: `xcode-select --install`

**Error: "Unsupported macOS version"**
- Solution: Requires macOS 13.0+, check with `sw_vers`

**Error: "Module not found"**
- Solution: `npm rebuild screencapturekit-audio-capture`

**Error: "ScreenCaptureKit framework not found"**
- Solution: Update to macOS 13.0+ (ScreenCaptureKit not available on older versions)

### Capture timeout errors (macOS 15+)

**Symptom:** Capture fails with timeout error after 10 seconds on macOS 15 (Sequoia) or later

**Cause:** This is a known bug in macOS 15+ ScreenCaptureKit where `startCaptureWithCompletionHandler` never completes when audio capture is enabled. The SDK includes a 10-second timeout to prevent indefinite hangs.

**Solutions:**
1. **Try a different application** - Some apps may work better than others
2. **Restart the target application** - Sometimes helps reset ScreenCaptureKit state
3. **Check for macOS updates** - Apple may fix this in future updates
4. **Consider downgrading to macOS 14** - If possible and this is blocking your use case

**Note:** This is a system-level macOS bug, not an issue with this package. The 10-second timeout prevents your application from hanging indefinitely while waiting for ScreenCaptureKit to respond.

## Examples

> 📁 **All examples are in [`readme_examples/`](readme_examples/) with TypeScript source code**

| Example | File | Description |
|---------|------|-------------|
| Quick Start | [`01-quick-start.ts`](readme_examples/01-quick-start.ts) | Basic capture setup |
| STT Integration | [`02-stt-integration.ts`](readme_examples/02-stt-integration.ts) | Speech-to-text patterns |
| Voice Agent | [`03-voice-agent.ts`](readme_examples/03-voice-agent.ts) | Real-time voice processing |
| Recording | [`04-audio-recording.ts`](readme_examples/04-audio-recording.ts) | Record and save as WAV |
| Robust Capture | [`05-robust-capture.ts`](readme_examples/05-robust-capture.ts) | Production error handling |
| Stream Basics | [`06-stream-basics.ts`](readme_examples/06-stream-basics.ts) | Stream API fundamentals |
| Stream Processing | [`07-stream-processing.ts`](readme_examples/07-stream-processing.ts) | Transform streams |
| Visualizer | [`08-visualizer.ts`](readme_examples/08-visualizer.ts) | ASCII volume display |
| Volume Monitor | [`09-volume-monitor.ts`](readme_examples/09-volume-monitor.ts) | Level alerts |
| Int16 Capture | [`10-int16-capture.ts`](readme_examples/10-int16-capture.ts) | Int16 format for audio libs |
| Find Apps | [`11-find-apps.ts`](readme_examples/11-find-apps.ts) | App discovery helpers |
| Manual Processing | [`12-manual-processing.ts`](readme_examples/12-manual-processing.ts) | Buffer manipulation |

**Run examples:**
```bash
# Run with tsx
npx tsx readme_examples/01-quick-start.ts

# Run all examples (integration test)
npm run test:readme
```

## System Permissions

This package requires Screen Recording permission to capture audio.

### Granting Permission

1. Open **System Preferences** → **Privacy & Security** → **Screen Recording**
2. Click the lock to make changes
3. Add your terminal app (Terminal.app, iTerm2, VS Code, etc.)
4. Toggle it **ON**
5. **Restart your terminal** for changes to take effect

### Checking Permissions

```typescript
const apps = capture.getApplications();
if (apps.length === 0) {
  console.error('No apps available. Please grant Screen Recording permission.');
}
```

## Audio Format

**Default Configuration:**
- **Sample Rate:** 48000 Hz (system-dependent, may vary)
- **Channels:** 2 (Stereo)
- **Format:** 32-bit Float PCM (default) or 16-bit Int PCM (optional)
- **Chunk Duration:** ~160ms typical (7680 samples per channel at 48kHz)
- **Buffer Type:** Node.js Buffer containing Float32 or Int16 values
- **Sample Range:** Float32: -1.0 to 1.0, Int16: -32768 to 32767

**Native Format:**

The native layer always captures in Float32 format from ScreenCaptureKit. If you request Int16 format via the `format` option, conversion happens in JavaScript before the 'audio' event is emitted.

**Multi-Channel Support:**

While stereo (2 channels) is default and recommended, the system supports up to 16 channels. Use the `channels` option in `startCapture()` to configure mono (1) or stereo (2) output.

## Platform Support

| macOS Version | ScreenCaptureKit | Audio Capture | Notes |
|---------------|------------------|---------------|-------|
| macOS 15+ (Sequoia) | ⚠️ Known issues | ✅ Supported with timeout | 10s timeout added for capture start hangs |
| macOS 14+ (Sonoma) | ✅ Full | ✅ Fully tested | Recommended |
| macOS 13+ (Ventura) | ✅ Full | ✅ Supported | Minimum required version |
| macOS 12.x (Monterey) | ⚠️ Limited | ❌ No audio API | Screen capture only, no audio |
| macOS 11.x (Big Sur) | ❌ Not available | ❌ No | Use older AVFoundation methods |
| Windows/Linux | ❌ Not available | ❌ No | macOS-only framework |

**Why macOS 13.0+?**

ScreenCaptureKit's audio capture APIs were introduced in macOS 13.0 (Ventura). Earlier versions of the framework don't support per-application audio isolation.

**macOS 15+ Known Issues:**

On macOS 15 (Sequoia) and later, ScreenCaptureKit has a known bug where `startCaptureWithCompletionHandler` may never complete when audio capture is enabled. This SDK includes a 10-second timeout to prevent indefinite hangs. If you experience timeout errors on macOS 15+, this is a system-level bug, not an issue with this package.

## Performance

**Typical Performance (Apple Silicon M1):**
- **CPU Usage:** <1% for stereo Float32 capture
- **Memory:** ~10-20MB base + audio buffers
- **Latency:** ~160ms (one buffer duration, configurable via `bufferSize`)
- **Thread Safety:** Audio callbacks on dedicated thread, marshaled to JavaScript

**Optimization Tips:**
- Use `minVolume` threshold to reduce CPU when audio is silent
- Use Int16 format for 50% memory reduction
- Use mono (1 channel) for another 50% reduction
- Increase buffer size to reduce callback frequency (higher latency, lower CPU)

**Example:** `{ channels: 1, format: 'int16', bufferSize: 4096 }` reduces data bandwidth by 75% compared to defaults.

**Benchmarks:**

| Configuration | Data Rate | CPU Usage | Latency | Memory |
|--------------|-----------|-----------|---------|--------|
| Default (Float32, Stereo, 2048) | ~384 KB/s | <1% | ~43ms | ~15 MB |
| Efficient (Int16, Mono, 4096) | ~96 KB/s | <0.5% | ~85ms | ~12 MB |
| Low-Latency (Float32, Stereo, 1024) | ~384 KB/s | ~1.5% | ~21ms | ~15 MB |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    JavaScript API Layer                      │
│  AudioCapture (Event-based), AudioStream (Stream-based)     │
├─────────────────────────────────────────────────────────────┤
│                   N-API Bindings (addon.mm)                 │
│         Thread-safe callbacks, error marshaling            │
├─────────────────────────────────────────────────────────────┤
│          Objective-C++ Wrapper (screencapturekit_wrapper)   │
│     Audio format handling, buffer management, ARC          │
├─────────────────────────────────────────────────────────────┤
│                ScreenCaptureKit Framework                   │
│         macOS System Framework (requires 13.0+)            │
└─────────────────────────────────────────────────────────────┘
```

### Native Layer Implementation

**Thread Safety:**
- Audio callbacks execute on a dedicated ScreenCaptureKit thread
- ThreadSafeFunction (N-API) safely marshals data to JavaScript thread
- No blocking operations in audio callback path
- Separate thread for audio processing prevents blocking the main event loop

**Memory Management:**
- Automatic Reference Counting (ARC) manages Objective-C objects
- Buffer allocation is dynamic based on channel count and format
- Safety cap at 16 channels to prevent excessive allocation
- Proper cleanup on capture stop and module unload

**Audio Format Handling:**
- Detects planar vs interleaved audio using `kAudioFormatFlagIsNonInterleaved`
- Automatically interleaves planar audio (separate buffers per channel)
- Supports both Float32 and Int16 PCM formats natively
- Always converts to Float32 internally from ScreenCaptureKit
- Optional Int16 conversion in JavaScript layer when requested

**Security & Stability (v1.1.2+):**
- Fixed buffer overflow vulnerability in AudioBufferList allocation
- Dynamic buffer allocation based on actual channel count
- Validation of buffer counts against expected values
- Safe handling of multi-channel audio configurations

## Debugging & Troubleshooting

### Enable Verbose Logging

The native layer logs errors to stderr. To see detailed logs:

```bash
NODE_DEBUG=screencapturekit node your-app.js
```

### Check Native Module Load

```typescript
try {
  const { AudioCapture } = require('screencapturekit-audio-capture');
  console.log('✓ Native addon loaded successfully');
} catch (err) {
  console.error('✗ Failed to load native addon:', (err as Error).message);
  console.error('Try: npm rebuild screencapturekit-audio-capture');
}
```

### Verify Permissions Programmatically

```typescript
import { AudioCapture, type ApplicationInfo } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();
const apps: ApplicationInfo[] = capture.getApplications();

if (apps.length === 0) {
  console.error('❌ No apps available - likely a permission issue');
  console.error('Check: System Preferences → Privacy & Security → Screen Recording');
  console.error('Make sure your terminal app is listed and enabled');
} else {
  console.log(`✓ Permissions OK - found ${apps.length} apps`);
  console.log('Available apps:', apps.map((a) => a.applicationName).join(', '));
}
```

### Test Basic Capture

```typescript
import { AudioCapture, type ApplicationInfo, type AudioSample } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Find any available app
const apps: ApplicationInfo[] = capture.getAudioApps();
if (apps.length === 0) {
  console.error('No audio apps running');
  process.exit(1);
}

const app: ApplicationInfo = apps[0];
console.log(`Testing with: ${app.applicationName}`);

let receivedSamples = 0;

capture.on('audio', (sample: AudioSample) => {
  receivedSamples++;
  if (receivedSamples === 1) {
    console.log('✓ First sample received!');
    console.log(`  Sample rate: ${sample.sampleRate}Hz`);
    console.log(`  Channels: ${sample.channels}`);
    console.log(`  Format: ${sample.format}`);
    console.log(`  RMS: ${sample.rms.toFixed(4)}`);
  }
});

capture.on('error', (err: Error) => {
  console.error('❌ Capture error:', err.message);
  if ('code' in err) console.error('Code:', (err as any).code);
  if ('details' in err) console.error('Details:', (err as any).details);
});

capture.startCapture(app.applicationName);

setTimeout(() => {
  console.log(`\nReceived ${receivedSamples} samples`);
  if (receivedSamples === 0) {
    console.log('⚠️  No samples received - is the app playing audio?');
  }
  capture.stopCapture();
  process.exit(0);
}, 3000);
```

### Debug Build Issues

```bash
# Clean build artifacts
npm run clean

# Rebuild with verbose output
npm run build -- --verbose

# Check node-gyp version
npx node-gyp --version

# Verify Xcode CLI tools
xcode-select -p

# Check macOS version
sw_vers
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

**Development Setup:**

```bash
git clone https://github.com/mrlionware/screencapturekit-audio-capture.git
cd screencapturekit-audio-capture
npm install
npm run build          # Build native addon + TypeScript
```

**Build Commands:**

```bash
npm run build          # Build everything (native + TypeScript)
npm run build:native   # Build native addon only
npm run build:ts       # Compile TypeScript only
npm run clean          # Clean build artifacts
```

**Running Tests:**

```bash
# Full suite (cross-platform, mocked native)
npm test

# Focused suites
npm run test:unit
npm run test:integration
npm run test:edge-cases
npm run test:readme        # README examples (requires audio source)

# Type checking
npm run typecheck          # Check SDK source
npm run typecheck:tests    # Check test files
```

**Code Structure:**

```
src/
├── index.ts              # Main entry point and exports
├── audio-capture.ts      # AudioCapture class (high-level API)
├── audio-stream.ts       # AudioStream class (Readable stream)
├── stt-converter.ts      # STTConverter class (Transform stream)
├── errors.ts             # AudioCaptureError and ErrorCode enum
├── types.ts              # All TypeScript type definitions
├── addon.mm              # N-API bindings (native)
├── screencapturekit_wrapper.mm  # Objective-C++ wrapper
└── screencapturekit_wrapper.h   # C++ header

dist/                     # Compiled JavaScript output
tests/                    # TypeScript test files
readme_examples/          # Runnable example scripts
sdk.js                    # Legacy JavaScript wrapper
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history, bug fixes, and upgrade notes.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Related Projects

- [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit) - Apple's framework
- [node-addon-api](https://github.com/nodejs/node-addon-api) - N-API C++ wrapper

## Author

Caleb Rubiano - [GitHub](https://github.com/MrLionware)

## Support

- 📝 [Report Issues](https://github.com/MrLionware/screencapturekit-audio-capture/issues)
- 💬 [Discussions](https://github.com/MrLionware/screencapturekit-audio-capture/discussions)
- 📖 [Documentation](https://github.com/MrLionware/screencapturekit-audio-capture#readme)
- 📦 [npm Package](https://www.npmjs.com/package/screencapturekit-audio-capture)

---

**Made with ❤️ for the Node.js and macOS developer community**
