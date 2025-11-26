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
- [Events Reference](#events-reference)
- [TypeScript](#typescript)
- [Working with Audio Data](#working-with-audio-data)
- [Common Issues](#common-issues)
- [Examples](#examples)
- [Platform Support](#platform-support)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- 🎵 **Per-App Audio Capture** - Isolate audio from specific applications
- 🎭 **Multi-Source Capture** - Capture from multiple apps, windows, or displays simultaneously
- ⚡ **Real-Time Streaming** - Low-latency audio callbacks
- 🎯 **Dual API Design** - Event-driven or Stream-based (your choice!)
- 🪟 **Window & Display Targeting** - Capture a single window or full display audio
- 🌊 **Node.js Streams** - Pipe audio through standard Readable streams
- 📊 **Audio Analysis** - Built-in RMS, peak, and dB calculations
- 💾 **WAV File Export** - Simple helper to save audio as standard WAV files
- 🔒 **Memory Safe** - No crashes, proper resource cleanup
- 📘 **TypeScript-First** - Written in TypeScript with full type definitions

## Requirements

- macOS 13.0 (Ventura) or later
- Node.js 14.0.0 or later (Node.js 18+ recommended for running the automated test suite)
- Screen Recording permission (granted in System Preferences)

## Installation

```bash
npm install screencapturekit-audio-capture
```

**Prebuilt binaries are included** — no compilation or Xcode required for most users.

### Fallback Compilation

If no prebuild is available for your architecture, the addon will compile from source automatically. This requires:

- **Xcode Command Line Tools** (minimum version 14.0)
  ```bash
  xcode-select --install
  ```
- **macOS SDK 13.0 or later**

The build process links these macOS frameworks:
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
- `README.md`, `LICENSE`, `CHANGELOG.md`

**Note:** Example files are available in the [GitHub repository](https://github.com/mrlionware/screencapturekit-audio-capture/tree/main/readme_examples) but are not included in the npm package to reduce installation size.

See `npm ls screencapturekit-audio-capture` for installation location.

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
| **Multi-App** | [`13-multi-app-capture.ts`](readme_examples/13-multi-app-capture.ts) | Capture game + Discord, Zoom + Music, etc. |

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

```typescript
import { AudioCapture, AudioCaptureError, ErrorCode } from 'screencapturekit-audio-capture';
import type { AudioSample, ApplicationInfo } from 'screencapturekit-audio-capture';
```

| Export | Description |
|--------|-------------|
| `AudioCapture` | High-level event-based API *(recommended)* |
| `AudioStream` | Readable stream (via `createAudioStream()`) |
| `STTConverter` | Transform stream for STT (via `createSTTStream()`) |
| `AudioCaptureError` | Error class with codes and details |
| `ErrorCode` | Error code enum for type-safe handling |
| `ScreenCaptureKit` | Low-level native binding *(advanced)* |

**Types:** `AudioSample`, `ApplicationInfo`, `WindowInfo`, `DisplayInfo`, `CaptureOptions`, `PermissionStatus`, `ActivityInfo`, and [more](#typescript).

## Testing

**Note:** Test files are available in the [GitHub repository](https://github.com/mrlionware/screencapturekit-audio-capture) but are not included in the npm package.

Tests are written in **TypeScript** and live under `tests/`. They use Node's built-in test runner with `tsx` (**Node 18+**).

**Test Commands:**

- `npm test` — Runs every suite in `tests/**/*.test.ts` (unit, integration, edge-cases) against the mocked ScreenCaptureKit layer; works cross-platform.
- `npm run test:unit` — Fast coverage for utilities, audio metrics, selection, and capture control.
- `npm run test:integration` — Multi-component flows (window/display capture, activity tracking, capability guards) using the shared mock.
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

#### Methods Overview

| # | Category | Method | Description |
|---|----------|--------|-------------|
| | **Discovery** | | |
| [1](#method-1) | | `getApplications(opts?)` | List all capturable apps |
| [2](#method-2) | | `getAudioApps(opts?)` | List apps likely to produce audio |
| [3](#method-3) | | `findApplication(id)` | Find app by name or bundle ID |
| [4](#method-4) | | `findByName(name)` | Alias for `findApplication()` |
| [5](#method-5) | | `getApplicationByPid(pid)` | Find app by process ID |
| [6](#method-6) | | `getWindows(opts?)` | List all capturable windows |
| [7](#method-7) | | `getDisplays()` | List all displays |
| | **Selection** | | |
| [8](#method-8) | | `selectApp(ids?, opts?)` | Smart app selection with fallbacks |
| | **Capture** | | |
| [9](#method-9) | | `startCapture(app, opts?)` | Start capturing from an app |
| [10](#method-10) | | `captureWindow(id, opts?)` | Capture from a specific window |
| [11](#method-11) | | `captureDisplay(id, opts?)` | Capture from a display |
| [12](#method-12) | | `captureMultipleApps(ids, opts?)` | Capture multiple apps (mixed) |
| [13](#method-13) | | `captureMultipleWindows(ids, opts?)` | Capture multiple windows (mixed) |
| [14](#method-14) | | `captureMultipleDisplays(ids, opts?)` | Capture multiple displays (mixed) |
| [15](#method-15) | | `stopCapture()` | Stop current capture |
| [16](#method-16) | | `isCapturing()` | Check if currently capturing |
| [17](#method-17) | | `getStatus()` | Get detailed capture status |
| [18](#method-18) | | `getCurrentCapture()` | Get current capture target info |
| | **Streams** | | |
| [19](#method-19) | | `createAudioStream(app, opts?)` | Create Node.js Readable stream |
| [20](#method-20) | | `createSTTStream(app?, opts?)` | Stream pre-configured for STT |
| | **Activity** | | |
| [21](#method-21) | | `enableActivityTracking(opts?)` | Track which apps produce audio |
| [22](#method-22) | | `disableActivityTracking()` | Stop tracking and clear cache |
| [23](#method-23) | | `getActivityInfo()` | Get tracking stats |

#### Static Methods

| # | Method | Description |
|---|--------|-------------|
| [S1](#method-s1) | `AudioCapture.verifyPermissions()` | Check screen recording permission |
| [S2](#method-s2) | `AudioCapture.bufferToFloat32Array(buf)` | Convert Buffer to Float32Array |
| [S3](#method-s3) | `AudioCapture.rmsToDb(rms)` | Convert RMS (0-1) to decibels |
| [S4](#method-s4) | `AudioCapture.peakToDb(peak)` | Convert peak (0-1) to decibels |
| [S5](#method-s5) | `AudioCapture.calculateDb(buf, method?)` | Calculate dB from audio buffer |
| [S6](#method-s6) | `AudioCapture.writeWav(buf, opts)` | Create WAV file from PCM data |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `'start'` | `CaptureInfo` | Capture started |
| `'audio'` | `AudioSample` | Audio data received |
| `'stop'` | `CaptureInfo` | Capture stopped |
| `'error'` | `AudioCaptureError` | Error occurred |

---

### Method Reference

#### Discovery Methods

<a id="method-1"></a>

##### [1] `getApplications(options?): ApplicationInfo[]`

List all capturable applications.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeEmpty` | boolean | `false` | Include apps with empty names (helpers, background services) |

```typescript
const apps = capture.getApplications();
const allApps = capture.getApplications({ includeEmpty: true });
```

---

<a id="method-2"></a>

##### [2] `getAudioApps(options?): ApplicationInfo[]`

List apps likely to produce audio. Filters system apps, utilities, and background processes.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeSystemApps` | boolean | `false` | Include system apps (Finder, etc.) |
| `includeEmpty` | boolean | `false` | Include apps with empty names |
| `sortByActivity` | boolean | `false` | Sort by recent audio activity (requires [21]) |
| `appList` | Array | `null` | Reuse prefetched app list |

```typescript
const audioApps = capture.getAudioApps();
// Returns: ['Spotify', 'Safari', 'Music', 'Zoom']
// Excludes: Finder, Terminal, System Preferences, etc.

// Sort by activity (most active first)
capture.enableActivityTracking();
const sorted = capture.getAudioApps({ sortByActivity: true });
```

---

<a id="method-3"></a>

##### [3] `findApplication(identifier): ApplicationInfo | null`

Find app by name or bundle ID (case-insensitive, partial match).

| Parameter | Type | Description |
|-----------|------|-------------|
| `identifier` | string | App name or bundle ID |

```typescript
const spotify = capture.findApplication('Spotify');
const safari = capture.findApplication('com.apple.Safari');
const partial = capture.findApplication('spot'); // Matches "Spotify"
```

---

<a id="method-4"></a>

##### [4] `findByName(name): ApplicationInfo | null`

Alias for `findApplication()`. Provided for semantic clarity.

---

<a id="method-5"></a>

##### [5] `getApplicationByPid(processId): ApplicationInfo | null`

Find app by process ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `processId` | number | Process ID |

```typescript
const app = capture.getApplicationByPid(12345);
```

---

<a id="method-6"></a>

##### [6] `getWindows(options?): WindowInfo[]`

List all capturable windows.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onScreenOnly` | boolean | `false` | Only include visible windows |
| `requireTitle` | boolean | `false` | Only include windows with titles |
| `processId` | number | - | Filter by owning process ID |

**Returns `WindowInfo`:**
- `windowId`: Unique window identifier
- `title`: Window title
- `owningProcessId`: PID of owning app
- `owningApplicationName`: App name
- `owningBundleIdentifier`: Bundle ID
- `frame`: `{ x, y, width, height }`
- `layer`: Window layer level
- `onScreen`: Whether visible
- `active`: Whether active

```typescript
const windows = capture.getWindows({ onScreenOnly: true, requireTitle: true });
windows.forEach(w => console.log(`${w.windowId}: ${w.title} (${w.owningApplicationName})`));
```

---

<a id="method-7"></a>

##### [7] `getDisplays(): DisplayInfo[]`

List all displays.

**Returns `DisplayInfo`:**
- `displayId`: Unique display identifier
- `width`: Display width in pixels
- `height`: Display height in pixels
- `frame`: `{ x, y, width, height }`
- `isMainDisplay`: Whether this is the primary display

```typescript
const displays = capture.getDisplays();
const main = displays.find(d => d.isMainDisplay);
```

---

#### Selection Method

<a id="method-8"></a>

##### [8] `selectApp(identifiers?, options?): ApplicationInfo | null`

Smart app selection with multiple fallback strategies.

| Parameter | Type | Description |
|-----------|------|-------------|
| `identifiers` | string \| number \| Array \| null | App name, PID, bundle ID, or array to try in order |

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `audioOnly` | boolean | `true` | Only search audio apps |
| `fallbackToFirst` | boolean | `false` | Return first app if no match |
| `throwOnNotFound` | boolean | `false` | Throw error instead of returning null |
| `sortByActivity` | boolean | `false` | Sort by recent activity (requires [21]) |
| `appList` | Array | `null` | Reuse prefetched app list |

```typescript
// Try multiple apps in order
const app = capture.selectApp(['Spotify', 'Music', 'Safari']);

// Get first audio app
const first = capture.selectApp();

// Fallback to first if none match
const fallback = capture.selectApp(['Spotify'], { fallbackToFirst: true });

// Throw on failure
try {
  const app = capture.selectApp(['Spotify'], { throwOnNotFound: true });
} catch (err) {
  console.log('Not found:', err.details.availableApps);
}
```

---

#### Capture Methods

All capture methods accept `CaptureOptions`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'float32'` \| `'int16'` | `'float32'` | Audio format |
| `channels` | 1 \| 2 | 2 | Mono or stereo |
| `sampleRate` | number | 48000 | Requested sample rate (system-dependent) |
| `bufferSize` | number | system | Buffer size in frames (affects latency) |
| `minVolume` | number | 0 | Min RMS threshold (0-1), filters silence |
| `excludeCursor` | boolean | `true` | Reserved for future video features |

**Buffer Size Guidelines:**
- `1024`: ~21ms latency, higher CPU
- `2048`: ~43ms latency, balanced (recommended)
- `4096`: ~85ms latency, lower CPU

---

<a id="method-9"></a>

##### [9] `startCapture(appIdentifier, options?): boolean`

Start capturing from an application.

| Parameter | Type | Description |
|-----------|------|-------------|
| `appIdentifier` | string \| number \| ApplicationInfo | App name, bundle ID, PID, or app object |

```typescript
capture.startCapture('Spotify');                  // By name
capture.startCapture('com.spotify.client');       // By bundle ID
capture.startCapture(12345);                      // By PID
capture.startCapture(app);                        // By object

// With options
capture.startCapture('Spotify', {
  format: 'int16',
  channels: 1,
  minVolume: 0.01
});
```

---

<a id="method-10"></a>

##### [10] `captureWindow(windowId, options?): boolean`

Capture audio from a specific window.

| Parameter | Type | Description |
|-----------|------|-------------|
| `windowId` | number | Window ID from `getWindows()` |

```typescript
const windows = capture.getWindows({ requireTitle: true });
const target = windows.find(w => w.title.includes('Safari'));
capture.captureWindow(target.windowId, { format: 'int16' });
```

---

<a id="method-11"></a>

##### [11] `captureDisplay(displayId, options?): boolean`

Capture audio from a display.

| Parameter | Type | Description |
|-----------|------|-------------|
| `displayId` | number | Display ID from `getDisplays()` |

```typescript
const displays = capture.getDisplays();
const main = displays.find(d => d.isMainDisplay);
capture.captureDisplay(main.displayId);
```

---

<a id="method-12"></a>

##### [12] `captureMultipleApps(appIdentifiers, options?): boolean`

Capture from multiple apps simultaneously. Audio is mixed into a single stream.

| Parameter | Type | Description |
|-----------|------|-------------|
| `appIdentifiers` | Array | App names, PIDs, bundle IDs, or ApplicationInfo objects |

| Additional Option | Type | Default | Description |
|-------------------|------|---------|-------------|
| `allowPartial` | boolean | `false` | Continue if some apps not found |

```typescript
// Capture game + Discord audio
capture.captureMultipleApps(['Minecraft', 'Discord'], {
  allowPartial: true,  // Continue even if one app not found
  format: 'int16'
});
```

---

<a id="method-13"></a>

##### [13] `captureMultipleWindows(windowIdentifiers, options?): boolean`

Capture from multiple windows. Audio is mixed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `windowIdentifiers` | Array | Window IDs or WindowInfo objects |

| Additional Option | Type | Default | Description |
|-------------------|------|---------|-------------|
| `allowPartial` | boolean | `false` | Continue if some windows not found |

```typescript
const windows = capture.getWindows({ requireTitle: true });
const browserWindows = windows.filter(w => /Safari|Chrome/.test(w.owningApplicationName));
capture.captureMultipleWindows(browserWindows.map(w => w.windowId));
```

---

<a id="method-14"></a>

##### [14] `captureMultipleDisplays(displayIdentifiers, options?): boolean`

Capture from multiple displays. Audio is mixed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `displayIdentifiers` | Array | Display IDs or DisplayInfo objects |

| Additional Option | Type | Default | Description |
|-------------------|------|---------|-------------|
| `allowPartial` | boolean | `false` | Continue if some displays not found |

```typescript
const displays = capture.getDisplays();
capture.captureMultipleDisplays(displays.map(d => d.displayId));
```

---

<a id="method-15"></a>

##### [15] `stopCapture(): void`

Stop the current capture session. Emits `'stop'` event.

---

<a id="method-16"></a>

##### [16] `isCapturing(): boolean`

Check if currently capturing.

```typescript
if (capture.isCapturing()) {
  capture.stopCapture();
}
```

---

<a id="method-17"></a>

##### [17] `getStatus(): CaptureStatus | null`

Get detailed capture status. Returns `null` if not capturing.

**Returns `CaptureStatus`:**
- `capturing`: Always `true` when not null
- `processId`: Process ID (may be null for display capture)
- `app`: ApplicationInfo or null
- `window`: WindowInfo or null
- `display`: DisplayInfo or null
- `targetType`: `'application'` | `'window'` | `'display'` | `'multi-app'`
- `config`: `{ minVolume, format }`

```typescript
const status = capture.getStatus();
if (status) {
  console.log(`Type: ${status.targetType}, App: ${status.app?.applicationName}`);
}
```

---

<a id="method-18"></a>

##### [18] `getCurrentCapture(): CaptureInfo | null`

Get current capture target info. Same as `getStatus()` but without config.

---

#### Stream Methods

<a id="method-19"></a>

##### [19] `createAudioStream(appIdentifier, options?): AudioStream`

Create a Node.js Readable stream for audio capture.

| Parameter | Type | Description |
|-----------|------|-------------|
| `appIdentifier` | string \| number | App name, bundle ID, or PID |

| Additional Option | Type | Default | Description |
|-------------------|------|---------|-------------|
| `objectMode` | boolean | `false` | Emit AudioSample objects instead of Buffers |

```typescript
// Raw buffer mode (for piping)
const stream = capture.createAudioStream('Spotify');
stream.pipe(myWritable);

// Object mode (for metadata access)
const stream = capture.createAudioStream('Spotify', { objectMode: true });
stream.on('data', (sample) => console.log(`RMS: ${sample.rms}`));

// Stop stream
stream.stop();
```

---

<a id="method-20"></a>

##### [20] `createSTTStream(appIdentifier?, options?): STTConverter`

Create stream pre-configured for Speech-to-Text engines.

| Parameter | Type | Description |
|-----------|------|-------------|
| `appIdentifier` | string \| number \| Array \| null | App identifier(s), null for auto-select |

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'int16'` \| `'float32'` | `'int16'` | Output format |
| `channels` | 1 \| 2 | 1 | Output channels (mono recommended) |
| `objectMode` | boolean | `false` | Emit objects with metadata |
| `autoSelect` | boolean | `true` | Auto-select first audio app if not found |
| `minVolume` | number | - | Silence filter threshold |

```typescript
// Auto-selects first audio app, converts to Int16 mono
const sttStream = capture.createSTTStream();
sttStream.pipe(yourSTTEngine);

// With fallback apps
const sttStream = capture.createSTTStream(['Zoom', 'Safari', 'Chrome']);

// Access selected app
console.log(`Selected: ${sttStream.app.applicationName}`);

// Stop
sttStream.stop();
```

---

#### Activity Tracking Methods

<a id="method-21"></a>

##### [21] `enableActivityTracking(options?): void`

Enable background tracking of audio activity. Useful for sorting apps by recent audio.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `decayMs` | number | 30000 | Remove apps from cache after this many ms of inactivity |

```typescript
capture.enableActivityTracking({ decayMs: 60000 }); // 60s decay
```

---

<a id="method-22"></a>

##### [22] `disableActivityTracking(): void`

Disable tracking and clear the cache.

```typescript
capture.disableActivityTracking();
```

---

<a id="method-23"></a>

##### [23] `getActivityInfo(): ActivityInfo`

Get activity tracking status and statistics.

**Returns `ActivityInfo`:**
- `enabled`: Whether tracking is enabled
- `trackedApps`: Number of apps in cache
- `recentApps`: Array of `ProcessActivityInfo`:
  - `processId`: Process ID
  - `lastSeen`: Timestamp of last audio
  - `ageMs`: Time since last audio
  - `avgRMS`: Average RMS level
  - `sampleCount`: Number of samples received

```typescript
const info = capture.getActivityInfo();
console.log(`Active apps: ${info.trackedApps}`);
info.recentApps.forEach(app => {
  console.log(`PID ${app.processId}: ${app.sampleCount} samples`);
});
```

---

### Static Method Reference

<a id="method-s1"></a>

##### [S1] `AudioCapture.verifyPermissions(): PermissionStatus`

Check screen recording permission before capture.

**Returns `PermissionStatus`:**
- `granted`: Whether permission is granted
- `message`: Human-readable status
- `apps`: Prefetched app list (reuse with `selectApp({ appList })`)
- `availableApps`: Number of apps found
- `remediation`: Fix instructions (if not granted)

```typescript
const status = AudioCapture.verifyPermissions();
if (!status.granted) {
  console.error(status.message);
  console.log(status.remediation);
  process.exit(1);
}

// Reuse apps list
const app = capture.selectApp(['Spotify'], { appList: status.apps });
```

---

<a id="method-s2"></a>

##### [S2] `AudioCapture.bufferToFloat32Array(buffer): Float32Array`

Convert Buffer to Float32Array for audio processing.

```typescript
capture.on('audio', (sample) => {
  const floats = AudioCapture.bufferToFloat32Array(sample.data);
  // Process individual samples
  for (let i = 0; i < floats.length; i++) {
    const value = floats[i]; // Range: -1.0 to 1.0
  }
});
```

---

<a id="method-s3"></a>

##### [S3] `AudioCapture.rmsToDb(rms): number`

Convert RMS value (0-1) to decibels.

```typescript
const db = AudioCapture.rmsToDb(0.5); // -6.02 dB
const db = AudioCapture.rmsToDb(sample.rms);
```

---

<a id="method-s4"></a>

##### [S4] `AudioCapture.peakToDb(peak): number`

Convert peak value (0-1) to decibels.

```typescript
const db = AudioCapture.peakToDb(sample.peak);
```

---

<a id="method-s5"></a>

##### [S5] `AudioCapture.calculateDb(buffer, method?): number`

Calculate dB level directly from audio buffer.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `buffer` | Buffer | - | Audio data buffer |
| `method` | `'rms'` \| `'peak'` | `'rms'` | Calculation method |

```typescript
capture.on('audio', (sample) => {
  const rmsDb = AudioCapture.calculateDb(sample.data, 'rms');
  const peakDb = AudioCapture.calculateDb(sample.data, 'peak');
});
```

---

<a id="method-s6"></a>

##### [S6] `AudioCapture.writeWav(buffer, options): Buffer`

Create a complete WAV file from PCM audio data.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `sampleRate` | number | ✓ | Sample rate in Hz |
| `channels` | number | ✓ | Number of channels |
| `format` | `'float32'` \| `'int16'` | | Audio format (default: `'float32'`) |

```typescript
import fs from 'fs';

capture.on('audio', (sample) => {
  const wav = AudioCapture.writeWav(sample.data, {
    sampleRate: sample.sampleRate,
    channels: sample.channels,
    format: sample.format
  });
  fs.writeFileSync('output.wav', wav);
});
```

---

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
    default:
      console.error('Error:', err.message);
  }
});
```

---

### Stream Classes

**`AudioStream`** - Readable stream extending Node.js `Readable`:
- `stop()` - Stop stream and capture
- `getCurrentCapture()` - Get current capture info

**`STTConverter`** - Transform stream extending Node.js `Transform`:
- `stop()` - Stop stream and capture
- `app` - The selected ApplicationInfo
- `captureOptions` - Options used for capture

---

### Low-Level API: `ScreenCaptureKit`

For advanced users who need direct access to the native binding:

```typescript
import { ScreenCaptureKit } from 'screencapturekit-audio-capture';

const captureKit = new ScreenCaptureKit();

// Get apps (returns basic ApplicationInfo array)
const apps = captureKit.getAvailableApps();

// Start capture (requires manual callback handling)
captureKit.startCapture(processId, config, (sample) => {
  // sample: { data, sampleRate, channelCount, timestamp }
  // No enhancement - raw native data
});

captureKit.stopCapture();
const isCapturing = captureKit.isCapturing();
```

**When to use:**
- Absolute minimal overhead needed
- Building your own wrapper
- Avoiding event emitter overhead

**Most users should use `AudioCapture` instead.**

---

## Events Reference

### Event: `'start'`

Emitted when capture starts.

```typescript
capture.on('start', ({ processId, app }) => {
  console.log(`Capturing from ${app?.applicationName}`);
});
```

### Event: `'audio'`

Emitted for each audio sample. See [Audio Sample Structure](#audio-sample-structure) for all properties.

```typescript
capture.on('audio', (sample: AudioSample) => {
  console.log(`${sample.durationMs}ms, RMS: ${sample.rms}`);
});
```

### Event: `'stop'`

Emitted when capture stops.

```typescript
capture.on('stop', ({ processId }) => {
  console.log('Capture stopped');
});
```

### Event: `'error'`

Emitted on errors.

```typescript
capture.on('error', (err: AudioCaptureError) => {
  console.error(`[${err.code}]:`, err.message);
});
```

---

## TypeScript

Full type definitions included. See [Module Exports](#module-exports) for import syntax.

### Available Types

| Type | Description |
|------|-------------|
| `AudioSample` | Audio sample with data and metadata |
| `ApplicationInfo` | App info (processId, bundleIdentifier, applicationName) |
| `WindowInfo` | Window info (windowId, title, frame, etc.) |
| `DisplayInfo` | Display info (displayId, width, height, etc.) |
| `CaptureInfo` | Current capture target info |
| `CaptureStatus` | Full capture status including config |
| `PermissionStatus` | Permission verification result |
| `ActivityInfo` | Activity tracking stats |
| `CaptureOptions` | Options for startCapture() |
| `AudioStreamOptions` | Options for createAudioStream() |
| `STTStreamOptions` | Options for createSTTStream() |
| `MultiAppCaptureOptions` | Options for captureMultipleApps() |
| `MultiWindowCaptureOptions` | Options for captureMultipleWindows() |
| `MultiDisplayCaptureOptions` | Options for captureMultipleDisplays() |
| `ErrorCode` | Enum of error codes |

---

## Working with Audio Data

### Buffer Format

Audio samples are Node.js `Buffer` objects containing Float32 PCM by default:

```typescript
capture.on('audio', (sample) => {
  // Use helper (recommended)
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);
  
  // Or manual
  const float32Manual = new Float32Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 4
  );
});
```

### Int16 Format

```typescript
capture.startCapture('Spotify', { format: 'int16' });

capture.on('audio', (sample) => {
  const int16 = new Int16Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 2
  );
});
```

### Filtering Silence

```typescript
capture.startCapture('Spotify', { minVolume: 0.01 });
// Only emits audio events when volume > 0.01 RMS
```

---

## Common Issues

### No applications available

**Solution:** Grant Screen Recording permission in **System Preferences → Privacy & Security → Screen Recording**, then restart your terminal.

### Application not found

**Solutions:**
1. Check if the app is running
2. Use `capture.getApplications()` to list available apps
3. Use bundle ID instead of name: `capture.startCapture('com.spotify.client')`

### No audio samples received

**Solutions:**
1. Ensure the app is playing audio
2. Check if audio is muted
3. Remove `minVolume` threshold for testing
4. Verify the app has visible windows

### Build errors

> **Note:** Most users won't see build errors since prebuilt binaries are included. These steps apply only if compilation is needed.

**Solutions:**
1. Install Xcode CLI Tools: `xcode-select --install`
2. Verify macOS 13.0+: `sw_vers`
3. Clean rebuild: `npm run clean && npm run build`

---

## Examples

> 📁 **All examples are in [`readme_examples/`](readme_examples/)**

### Basic Examples

| Example | File | Description |
|---------|------|-------------|
| Quick Start | [`01-quick-start.ts`](readme_examples/01-quick-start.ts) | Basic capture setup |
| STT Integration | [`02-stt-integration.ts`](readme_examples/02-stt-integration.ts) | Speech-to-text patterns |
| Voice Agent | [`03-voice-agent.ts`](readme_examples/03-voice-agent.ts) | Real-time voice processing |
| Recording | [`04-audio-recording.ts`](readme_examples/04-audio-recording.ts) | Record and save as WAV |
| Robust Capture | [`05-robust-capture.ts`](readme_examples/05-robust-capture.ts) | Production error handling |

### Stream & Processing

| Example | File | Description |
|---------|------|-------------|
| Stream Basics | [`06-stream-basics.ts`](readme_examples/06-stream-basics.ts) | Stream API fundamentals |
| Stream Processing | [`07-stream-processing.ts`](readme_examples/07-stream-processing.ts) | Transform streams |
| Visualizer | [`08-visualizer.ts`](readme_examples/08-visualizer.ts) | ASCII volume display |
| Volume Monitor | [`09-volume-monitor.ts`](readme_examples/09-volume-monitor.ts) | Level alerts |
| Int16 Capture | [`10-int16-capture.ts`](readme_examples/10-int16-capture.ts) | Int16 format |
| Find Apps | [`11-find-apps.ts`](readme_examples/11-find-apps.ts) | App discovery |
| Manual Processing | [`12-manual-processing.ts`](readme_examples/12-manual-processing.ts) | Buffer manipulation |

### Multi-Source & Advanced

| Example | File | Description |
|---------|------|-------------|
| Multi-App Capture | [`13-multi-app-capture.ts`](readme_examples/13-multi-app-capture.ts) | Multiple apps |
| Per-App Streams | [`14-per-app-streams.ts`](readme_examples/14-per-app-streams.ts) | Separate streams |
| Window Capture | [`15-window-capture.ts`](readme_examples/15-window-capture.ts) | Single window |
| Display Capture | [`16-display-capture.ts`](readme_examples/16-display-capture.ts) | Full display |
| Multi-Window | [`17-multi-window-capture.ts`](readme_examples/17-multi-window-capture.ts) | Multiple windows |
| Multi-Display | [`18-multi-display-capture.ts`](readme_examples/18-multi-display-capture.ts) | Multiple displays |
| Advanced Methods | [`19-advanced-methods.ts`](readme_examples/19-advanced-methods.ts) | Activity tracking |

**Run examples:**
```bash
npx tsx readme_examples/01-quick-start.ts
npm run test:readme  # Run all examples
```

**Targeting specific apps/windows/displays:**

Most examples support environment variables to target specific sources instead of using defaults:

| Env Variable | Type | Used By | Example |
|-------------|------|---------|---------|
| `TARGET_APP` | App name | 01-12, 19 | `TARGET_APP="Spotify" npx tsx readme_examples/01-quick-start.ts` |
| `TARGET_APPS` | Comma-separated | 13, 14 | `TARGET_APPS="Safari,Music" npx tsx readme_examples/13-multi-app-capture.ts` |
| `TARGET_WINDOW` | Window ID | 15, 17 | `TARGET_WINDOW=12345 npx tsx readme_examples/15-window-capture.ts` |
| `TARGET_DISPLAY` | Display ID | 16, 18 | `TARGET_DISPLAY=1 npx tsx readme_examples/16-display-capture.ts` |
| `VERIFY` | `1` or `true` | 13 | `VERIFY=1 npx tsx readme_examples/13-multi-app-capture.ts` |

> **Tip:** Run `npx tsx readme_examples/11-find-apps.ts` to list available apps and their names. Window/display IDs are printed when running the respective capture examples.
>
> **Important:** Environment variables must be placed **before** the command, not after. `TARGET_APP="Spotify" npx tsx ...` works, but `npx tsx ... TARGET_APP="Spotify"` does not.

---

## Platform Support

| macOS Version | Support | Notes |
|---------------|---------|-------|
| macOS 15+ (Sequoia) | ⚠️ Known issues | 10s timeout for capture start hangs |
| macOS 14+ (Sonoma) | ✅ Full | Recommended |
| macOS 13+ (Ventura) | ✅ Full | Minimum required |
| macOS 12.x and below | ❌ No | ScreenCaptureKit not available |
| Windows/Linux | ❌ No | macOS-only framework |

---

## Performance

**Typical (Apple Silicon M1):**
- CPU: <1% for stereo Float32
- Memory: ~10-20MB
- Latency: ~160ms (configurable)

**Optimization tips:**
- Use `minVolume` to filter silence
- Use `format: 'int16'` for 50% memory reduction
- Use `channels: 1` for another 50% reduction

---

## Contributing

```bash
git clone https://github.com/mrlionware/screencapturekit-audio-capture.git
cd screencapturekit-audio-capture
npm install
npm run build
npm test
```

---

## License

MIT License - see [LICENSE](LICENSE)

---

**Made with ❤️ for the Node.js and macOS developer community**
