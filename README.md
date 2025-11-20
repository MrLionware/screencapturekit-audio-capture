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
  - [Build Requirements](#build-requirements)
  - [Package Contents](#package-contents)
  - [Version Recommendations](#version-recommendations)
- [Quick Start](#quick-start)
- **[Quick Integration Guide](#quick-integration-guide)** 🚀
  - [Speech-to-Text (STT) Integration](#speech-to-text-stt-integration)
  - [Voice Agent / Real-Time Processing](#voice-agent--real-time-processing)
  - [Audio Monitoring / Recording](#audio-monitoring--recording)
  - [Error-Resilient Production Setup](#error-resilient-production-setup)
  - [Audio Sample Structure Reference](#audio-sample-structure-reference)
- [Module Exports](#module-exports)
- [Testing](#testing)
- **[Stream-Based API](#stream-based-api)** ⭐
  - [Stream Object Mode](#stream-object-mode)
  - [When to Use Streams vs Events](#when-to-use-streams-vs-events)
  - [Stream API Best Practices](#stream-api-best-practices)
    - [1. Always Handle Errors](#1-always-handle-errors)
    - [2. Use pipeline() for Complex Flows](#2-use-pipeline-for-complex-flows)
    - [3. Clean Up Resources](#3-clean-up-resources)
    - [4. Choose the Right Mode](#4-choose-the-right-mode)
    - [5. Stream Must Flow to Start Capture](#5-stream-must-flow-to-start-capture)
  - [Troubleshooting Stream Issues](#troubleshooting-stream-issues)
  - [Stream Performance Tips](#stream-performance-tips)
  - [Complete Working Example](#complete-working-example)
- **[API Reference](#api-reference)**
  - [Class: AudioCapture](#class-audiocapture)
    - [Methods](#methods)
    - [Window & Display Selection](#window--display-selection)
    - [Activity Tracking](#enableactivitytrackingoptions-object-void)
    - [Static Methods](#static-methods)
    - [Events](#events)
  - [Error Handling](#error-handling)
  - [Class: AudioStream](#class-audiostream)
  - [Low-Level API: ScreenCaptureKit](#low-level-api-screencapturekit)
- [TypeScript](#typescript)
- [Working with Audio Data](#working-with-audio-data)
  - [Understanding the Buffer Format](#understanding-the-buffer-format)
  - [Converting to Int16 Format](#converting-to-int16-format)
  - [Filtering Silent Audio](#filtering-silent-audio)
- **[Common Issues](#common-issues)** 🔧
  - [No applications available](#no-applications-available)
  - [Application not found](#application-not-found)
  - [No audio samples received](#no-audio-samples-received)
  - [How to work with the Buffer data](#how-to-work-with-the-buffer-data)
  - [Stream API Issues](#stream-api-issues)
  - [Build errors during installation](#build-errors-during-installation)
- **[Examples](#examples)** 💡
- [System Permissions](#system-permissions)
- [Audio Format](#audio-format)
- [Platform Support](#platform-support)
- [Performance](#performance)
- [Architecture](#architecture)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Migrating from Older Versions](#migrating-from-older-versions)
  - [From v1.1.x to v1.2.x](#from-v11x-to-v12x)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)
- [Related Projects](#related-projects)
- [Author](#author)
- [Support](#support)

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
- 📘 **TypeScript Support** - Full type definitions included
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
- `src/` - Native C++/Objective-C++ source code
- `binding.gyp` - Native build configuration
- `sdk.js` - High-level JavaScript wrapper
- `index.js` - Native addon loader
- `index.d.ts` - TypeScript definitions
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

```javascript
const AudioCapture = require('screencapturekit-audio-capture');

const capture = new AudioCapture();

// List available applications
const apps = capture.getApplications();
apps.forEach(app => {
  console.log(`${app.applicationName} (PID: ${app.processId})`);
  console.log(`  Bundle ID: ${app.bundleIdentifier}`);
});

// Start capturing from Spotify
capture.on('audio', (sample) => {
  // Convert Buffer to Float32Array for easier processing
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  console.log(`Got ${float32.length} samples at ${sample.sampleRate}Hz`);
  console.log(`Volume: ${AudioCapture.rmsToDb(sample.rms).toFixed(1)} dB`);
});

capture.startCapture('Spotify');

// Stop after 10 seconds
setTimeout(() => capture.stopCapture(), 10000);
```

## Quick Integration Guide

Common patterns for integrating audio capture into your application:

### Speech-to-Text (STT) Integration

**Simple approach with createSTTStream():**

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const { pipeline } = require('stream');

const capture = new AudioCapture();

// One-line STT stream with auto-conversion to Int16 mono
const sttStream = capture.createSTTStream(['Safari', 'Chrome', 'Zoom'], {
  minVolume: 0.01      // Filter silence
});

// Pipe directly to your STT engine
pipeline(
  sttStream,
  yourSTTWritableStream,
  (err) => {
    if (err) console.error('STT pipeline error:', err);
  }
);

// Which app was selected?
console.log(`Capturing from: ${sttStream.app.applicationName}`);

// Stop when done
setTimeout(() => sttStream.stop(), 30000);
```

**Event-based approach with manual configuration:**

```javascript
const AudioCapture = require('screencapturekit-audio-capture');

const capture = new AudioCapture();

// Check permissions first
const perms = AudioCapture.verifyPermissions();
if (!perms.granted) {
  console.error(perms.message);
  console.log(perms.remediation);
  process.exit(1);
}

// Smart app selection with fallback
const app = capture.selectApp(['Safari', 'Chrome', 'Zoom']);
if (!app) {
  console.error('No suitable app found');
  process.exit(1);
}

capture.startCapture(app.processId, {
  format: 'int16',      // Most STT engines expect Int16
  channels: 1,          // Mono reduces bandwidth by 50%
  minVolume: 0.01      // Filter silence
});

capture.on('audio', (sample) => {
  // sample.data is Int16 Buffer, ready for STT
  sendToSTTEngine(sample.data, sample.sampleRate, sample.channels);
});

capture.on('error', (err) => console.error('Capture error:', err));
```

### Voice Agent / Real-Time Processing

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const { pipeline } = require('stream');

const capture = new AudioCapture();

// Stream API for backpressure handling
const audioStream = capture.createAudioStream('Zoom', {
  objectMode: true,      // Get metadata with each chunk
  minVolume: 0.005,      // Voice activity detection threshold
  format: 'int16',
  channels: 1,
  bufferSize: 1024       // Low latency (~21ms)
});

// Process with streams for better flow control
pipeline(
  audioStream,
  yourVoiceProcessor,
  yourResponseGenerator,
  (err) => {
    if (err) console.error('Pipeline error:', err);
  }
);

// Check status anytime
const status = capture.getStatus();
if (status) {
  console.log(`Capturing from: ${status.app.applicationName}`);
  console.log(`Config: ${status.config.format}, ${status.config.minVolume} threshold`);
}
```

### Audio Monitoring / Recording

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const fs = require('fs');

const capture = new AudioCapture();
const chunks = [];

// Efficient configuration for recording
capture.startCapture('Music', {
  format: 'int16',       // 50% smaller than float32
  channels: 2,           // Preserve stereo
  bufferSize: 4096      // Larger buffer = lower CPU
});

capture.on('audio', (sample) => {
  chunks.push(sample.data);

  // Monitor levels
  const db = AudioCapture.rmsToDb(sample.rms);
  console.log(`Level: ${db.toFixed(1)} dB`);
});

capture.on('stop', () => {
  // Save as WAV file
  const combined = Buffer.concat(chunks);
  const wav = AudioCapture.writeWav(combined, {
    sampleRate: 48000,
    channels: 2,
    format: 'int16'
  });
  fs.writeFileSync('recording.wav', wav);
  console.log('Saved recording.wav');
});

// Stop after 30 seconds
setTimeout(() => capture.stopCapture(), 30000);
```

### Error-Resilient Production Setup

```javascript
const { AudioCapture, ErrorCodes } = require('screencapturekit-audio-capture');

class RobustAudioCapture {
  constructor(appName) {
    this.appName = appName;
    this.capture = new AudioCapture();
    this.setupHandlers();
  }

  async start() {
    // Verify permissions first
    const perms = AudioCapture.verifyPermissions();
    if (!perms.granted) {
      throw new Error(`Permissions not granted: ${perms.message}`);
    }

    // Start with error handling
    try {
      this.capture.startCapture(this.appName, {
        minVolume: 0.01,
        format: 'int16',
        channels: 1
      });

      // Verify we're actually capturing
      const status = this.capture.getStatus();
      console.log(`Started capturing from: ${status.app.applicationName}`);

    } catch (err) {
      if (err.code === ErrorCodes.APP_NOT_FOUND) {
        // Try to find similar app
        const apps = this.capture.getApplications();
        const similar = apps.find(app =>
          app.applicationName.toLowerCase().includes(this.appName.toLowerCase())
        );

        if (similar) {
          console.log(`Trying ${similar.applicationName} instead...`);
          this.capture.startCapture(similar.applicationName);
        } else {
          throw new Error(`App not found. Available: ${err.details.availableApps.join(', ')}`);
        }
      } else {
        throw err;
      }
    }
  }

  setupHandlers() {
    this.capture.on('audio', (sample) => this.handleAudio(sample));
    this.capture.on('error', (err) => this.handleError(err));
    this.capture.on('start', ({ app }) => console.log(`Started: ${app.applicationName}`));
    this.capture.on('stop', ({ app }) => console.log(`Stopped: ${app.applicationName}`));
  }

  handleAudio(sample) {
    // Your audio processing here
  }

  handleError(err) {
    console.error('Capture error:', err.message);
    // Implement retry logic, logging, etc.
  }

  stop() {
    if (this.capture.isCapturing()) {
      this.capture.stopCapture();
    }
  }
}

// Usage
const capture = new RobustAudioCapture('Safari');
capture.start().catch(console.error);
```

### Audio Sample Structure Reference

All audio samples include these properties:

```javascript
{
  data: Buffer,           // Audio data (Float32 or Int16 depending on format option)
  sampleRate: 48000,      // Sample rate in Hz
  channels: 2,            // Number of channels (1 = mono, 2 = stereo)
  timestamp: 123.45,      // Timestamp in seconds
  format: 'float32',      // 'float32' or 'int16'
  sampleCount: 15360,     // Total sample values across all channels
  framesCount: 7680,      // Frames per channel
  durationMs: 160,        // Duration in milliseconds
  rms: 0.123,            // RMS volume (0.0 to 1.0)
  peak: 0.456            // Peak volume (0.0 to 1.0)
}
```

## Module Exports

The package provides multiple exports for different use cases:

```javascript
// Default export - High-level API (recommended)
const AudioCapture = require('screencapturekit-audio-capture');

// OR destructure specific exports:
const {
  AudioCapture,          // High-level SDK wrapper
  AudioStream,           // Readable stream class
  STTConverter,          // STT conversion transform stream
  ScreenCaptureKit,      // Low-level native binding
  AudioCaptureError,     // Custom error class
  ErrorCodes            // Error code constants
} = require('screencapturekit-audio-capture');
```

**Available Exports:**

| Export | Description | Use Case |
|--------|-------------|----------|
| `AudioCapture` | High-level event-based API | Most users (recommended) |
| `AudioStream` | Readable stream class | Created via `createAudioStream()` |
| `STTConverter` | Transform stream for STT | Created via `createSTTStream()` |
| `AudioCaptureError` | Custom error class with codes/details | Structured error handling |
| `ErrorCodes` | Machine-readable error codes | Branching without string matching |
| `ScreenCaptureKit` | Low-level native binding | Advanced users, minimal overhead |

## Testing

**Note:** Test files are available in the [GitHub repository](https://github.com/mrlionware/screencapturekit-audio-capture) but are not included in the npm package.

Tests live under `tests/` and use Node's built-in test runner (**Node 18+**). See `tests/README.md` for layout and migration notes.

- `npm test` — Runs every suite in `tests/**` (unit, integration, examples, edge-cases) against the mocked ScreenCaptureKit layer; works cross-platform.
- `npm run test:unit` — Fast coverage for utilities, audio metrics, selection, and capture control.
- `npm run test:integration` — Multi-component flows (window/display capture, activity tracking, capability guards) using the shared mock.
- `npm run test:examples` — Example validation scaffolding (mirrors the runnable scripts).
- `npm run test:edge-cases` — Boundary/error handling coverage.

For true hardware validation, run the example scripts on macOS with Screen Recording permission enabled.

## Stream-Based API

In addition to the event-based API, you can use Node.js Readable streams for a more composable approach:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const { pipeline } = require('stream');
const fs = require('fs');

const capture = new AudioCapture();

// Create a readable stream
const audioStream = capture.createAudioStream('Spotify', {
  minVolume: 0.01,
  format: 'float32'
});

// Pipe to any writable stream
audioStream.pipe(myProcessor);

// Or use pipeline for better error handling
pipeline(
  audioStream,
  myTransform,
  fs.createWriteStream('output.raw'),
  (err) => {
    if (err) console.error('Pipeline failed:', err);
    else console.log('Pipeline succeeded');
  }
);

// Stop the stream
setTimeout(() => audioStream.stop(), 10000);
```

### Stream Object Mode

Enable object mode to receive full sample objects with metadata instead of just raw buffers:

```javascript
const audioStream = capture.createAudioStream('Spotify', {
  objectMode: true  // Receive full sample objects
});

audioStream.on('data', (sample) => {
  // Full sample object with metadata
  console.log({
    sampleRate: sample.sampleRate,
    channels: sample.channels,
    format: sample.format,
    rms: sample.rms,
    peak: sample.peak,
    durationMs: sample.durationMs
  });
});
```

### When to Use Streams vs Events

**Use the Stream API when:**
- You want to pipe audio through transform streams
- You need backpressure handling
- You're composing multiple stream operations
- You prefer functional stream composition

**Use the Event API when:**
- You need maximum simplicity
- You want to broadcast to multiple listeners
- You're building event-driven architectures
- You don't need stream composition

Both APIs use the same underlying capture mechanism and have identical performance.

### Stream API Best Practices

#### 1. Always Handle Errors

Streams require explicit error handling. Unhandled stream errors can crash your application.

```javascript
const audioStream = capture.createAudioStream('Spotify');

// REQUIRED: Always attach an error handler
audioStream.on('error', (error) => {
  console.error('Stream error:', error.message);

  // Check error code for specific handling
  if (error.code === 'ERR_APP_NOT_FOUND') {
    console.log('Application not found. Available apps:');
    capture.getApplications().forEach(app => {
      console.log(`  - ${app.applicationName}`);
    });
  }
});

audioStream.on('data', (chunk) => {
  // Process audio
});
```

#### 2. Use pipeline() for Complex Flows

For multiple stream operations, use `pipeline()` instead of chaining `.pipe()` for better error handling:

```javascript
const { pipeline } = require('stream');

// Good: Centralized error handling
pipeline(
  audioStream,
  transformStream1,
  transformStream2,
  writableStream,
  (err) => {
    if (err) {
      console.error('Pipeline failed:', err);
      // All streams are automatically destroyed
    } else {
      console.log('Pipeline completed successfully');
    }
  }
);

// Avoid: No centralized error handling
audioStream
  .pipe(transformStream1)
  .pipe(transformStream2)
  .pipe(writableStream);
```

#### 3. Clean Up Resources

Always stop streams when done to free resources:

```javascript
// Set a timeout
const audioStream = capture.createAudioStream('Spotify');
setTimeout(() => {
  audioStream.stop();
}, 30000);

// Or handle graceful shutdown
process.on('SIGINT', () => {
  audioStream.stop();
  process.exit(0);
});

// Listen for end event
audioStream.on('end', () => {
  console.log('Stream ended, resources cleaned up');
});
```

#### 4. Choose the Right Mode

**Normal Mode (default):** Use when you only need raw audio data

```javascript
// Returns raw Buffer objects - more memory efficient
const audioStream = capture.createAudioStream('Spotify');

audioStream.on('data', (buffer) => {
  // buffer is a Buffer containing audio samples
  // No metadata included - smaller memory footprint
  processRawAudio(buffer);
});
```

**Object Mode:** Use when you need metadata (RMS, peak, timestamps)

```javascript
// Returns full sample objects with metadata
const audioStream = capture.createAudioStream('Spotify', {
  objectMode: true
});

audioStream.on('data', (sample) => {
  // sample contains both data and metadata
  if (sample.rms > 0.1) {
    console.log(`Loud audio detected: ${sample.rms}`);
    processAudio(sample.data);
  }
});
```

#### 5. Stream Must Flow to Start Capture

The stream only starts capturing when it begins flowing. Attach a 'data' or 'readable' listener:

```javascript
const audioStream = capture.createAudioStream('Spotify');

// Won't start capturing - stream is paused
audioStream.on('error', (err) => console.error(err));

// Will start capturing - stream flows
audioStream.on('data', (chunk) => {
  // Process audio
});
```

### Troubleshooting Stream Issues

#### Issue: "Application not found" Error

**Symptom:** Stream emits error immediately after creation

```javascript
const audioStream = capture.createAudioStream('Spotify');
// Error: Application "Spotify" not found
```

**Solutions:**

1. **Verify the app is running:**
```javascript
const app = capture.findApplication('Spotify');
if (!app) {
  console.log('Spotify is not running. Available apps:');
  capture.getApplications().forEach(a => console.log(`  - ${a.applicationName}`));
} else {
  const audioStream = capture.createAudioStream(app.applicationName);
}
```

2. **Use fallback apps:**
```javascript
function createStreamWithFallback(preferredApp) {
  let app = capture.findApplication(preferredApp);

  if (!app) {
    // Try audio apps first
    const audioApps = capture.getAudioApps();
    if (audioApps.length > 0) {
      app = audioApps[0];
      console.log(`Using ${app.applicationName} instead`);
    }
  }

  return app ? capture.createAudioStream(app.applicationName) : null;
}

const stream = createStreamWithFallback('Spotify');
```

#### Issue: No Data Events Emitted

**Symptom:** Stream created successfully but no 'data' events fire

**Common Causes:**

1. **Application not producing audio:**
```javascript
const audioStream = capture.createAudioStream('Spotify', { objectMode: true });

let dataReceived = false;
const timeout = setTimeout(() => {
  if (!dataReceived) {
    console.log('No audio received. Is Spotify playing?');
    audioStream.stop();
  }
}, 5000);

audioStream.on('data', (sample) => {
  dataReceived = true;
  clearTimeout(timeout);
  console.log(`Audio received: RMS=${sample.rms}, Peak=${sample.peak}`);
});
```

2. **Volume threshold too high:**
```javascript
// May filter out all audio if threshold is too high
const audioStream = capture.createAudioStream('Spotify', {
  minVolume: 0.5  // Very high - most audio will be filtered
});

// Solution: Lower or remove threshold
const audioStream = capture.createAudioStream('Spotify', {
  minVolume: 0.01  // Lower threshold
});

// Or remove completely for testing
const audioStream = capture.createAudioStream('Spotify');
```

#### Issue: "stream.push() after EOF" Error

**Symptom:** Error when stopping stream in a pipeline

```javascript
// This can happen when stopping abruptly
setTimeout(() => audioStream.stop(), 1000);
// Error: stream.push() after EOF
```

**Solution:** Let pipeline handle cleanup or add small delay

```javascript
const { pipeline } = require('stream');

// Option 1: Let pipeline handle it
pipeline(audioStream, transform, writable, (err) => {
  // Pipeline handles cleanup
  if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
    console.error('Pipeline error:', err);
  }
});

// Option 2: Use end event for cleanup
audioStream.on('end', () => {
  console.log('Stream ended cleanly');
});
```

#### Issue: Multiple Streams from Same Capture

**Symptom:** Second stream fails with "Already capturing" error

```javascript
const capture = new AudioCapture();
const stream1 = capture.createAudioStream('Spotify');
const stream2 = capture.createAudioStream('Safari');
// Error: Already capturing
```

**Solution:** Use separate AudioCapture instances

```javascript
// Each capture instance can only capture one app at a time
const capture1 = new AudioCapture();
const capture2 = new AudioCapture();

const spotifyStream = capture1.createAudioStream('Spotify');
const safariStream = capture2.createAudioStream('Safari');

// Now both streams work independently
```

#### Issue: Memory Usage Growing

**Symptom:** Memory consumption increases over time

**Causes & Solutions:**

1. **Not consuming stream data (backpressure):**
```javascript
// Bad: Stream buffers data indefinitely
const audioStream = capture.createAudioStream('Spotify');
// No data consumption - memory grows!

// Good: Consume the data
audioStream.on('data', (chunk) => {
  // Process or discard chunks
});
```

2. **Accumulating data without limits:**
```javascript
// Bad: Unbounded accumulation
const chunks = [];
audioStream.on('data', (chunk) => {
  chunks.push(chunk); // Grows forever
});

// Good: Use a circular buffer or limit
const MAX_CHUNKS = 100;
const chunks = [];
audioStream.on('data', (chunk) => {
  chunks.push(chunk);
  if (chunks.length > MAX_CHUNKS) {
    chunks.shift(); // Remove oldest
  }
});
```

3. **Not stopping stream when done:**
```javascript
// Always stop streams when done
audioStream.stop();
```

### Stream Performance Tips

#### 1. Use Normal Mode for Better Performance

Object mode has small overhead due to metadata calculation:

```javascript
// Faster: Normal mode (if you don't need metadata)
const stream = capture.createAudioStream('Spotify');

// Slightly slower: Object mode (includes RMS, peak calculation)
const stream = capture.createAudioStream('Spotify', { objectMode: true });
```

#### 2. Process Data Efficiently

```javascript
const { Transform } = require('stream');

class EfficientProcessor extends Transform {
  constructor() {
    super({ objectMode: true });
    this.buffer = [];
  }

  _transform(sample, encoding, callback) {
    // Batch processing is more efficient than per-sample processing
    this.buffer.push(sample);

    if (this.buffer.length >= 10) {
      this.processBatch(this.buffer);
      this.buffer = [];
    }

    callback();
  }

  processBatch(samples) {
    // Process multiple samples at once
  }
}
```

#### 3. Use Appropriate highWaterMark

```javascript
// Default is good for most cases
const stream = capture.createAudioStream('Spotify', { objectMode: true });

// For high-throughput scenarios, you can adjust (advanced)
const stream = capture.createAudioStream('Spotify', {
  objectMode: true,
  // Note: highWaterMark is set internally, but you can access via stream properties
});
```

### Complete Working Example

Here's a complete, production-ready example with all best practices:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const { Transform, pipeline } = require('stream');

class AudioProcessor extends Transform {
  constructor() {
    super({ objectMode: true });
    this.sampleCount = 0;
  }

  _transform(sample, encoding, callback) {
    this.sampleCount++;

    // Only process audio above threshold
    if (sample.rms > 0.01) {
      const db = AudioCapture.rmsToDb(sample.rms);
      console.log(`Sample ${this.sampleCount}: ${db.toFixed(1)} dB`);

      // Process the audio data
      this.processAudio(sample.data);
    }

    // Pass through for next stage
    this.push(sample);
    callback();
  }

  processAudio(buffer) {
    // Your audio processing logic here
  }
}

function main() {
  const capture = new AudioCapture();

  // Find app with fallback
  let app = capture.findApplication('Spotify');
  if (!app) {
    const audioApps = capture.getAudioApps();
    if (audioApps.length === 0) {
      console.error('No applications available');
      process.exit(1);
    }
    app = audioApps[0];
    console.log(`Using ${app.applicationName} instead of Spotify`);
  }

  // Create stream with options
  const audioStream = capture.createAudioStream(app.applicationName, {
    objectMode: true,
    minVolume: 0.01,
    format: 'float32'
  });

  const processor = new AudioProcessor();

  // Use pipeline for proper error handling
  pipeline(
    audioStream,
    processor,
    (err) => {
      if (err) {
        console.error('Pipeline error:', err.message);
      } else {
        console.log('Pipeline completed successfully');
      }
    }
  );

  // Handle errors
  audioStream.on('error', (error) => {
    console.error('Stream error:', error.message);
    if (error.code === 'ERR_APP_NOT_FOUND') {
      console.log('Available apps:',
        capture.getApplications().map(a => a.applicationName).join(', ')
      );
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    audioStream.stop();
  });

  // Auto-stop after duration
  setTimeout(() => {
    console.log('Stopping after 30 seconds');
    audioStream.stop();
  }, 30000);
}

main();
```

## API Reference

### Class: `AudioCapture`

High-level event-based API (recommended).

#### Methods

##### `getApplications(options?: object): AppInfo[]`

Get list of all capturable applications. By default, filters out apps with empty names (helper processes).

**Options:**
- `includeEmpty` (boolean): Include apps with empty `applicationName` (default: `false`)

```javascript
// Get all apps (filters empty names by default)
const apps = capture.getApplications();
// Returns: [{ processId, bundleIdentifier, applicationName }, ...]

// Include apps with empty names (helper processes, background services)
const allApps = capture.getApplications({ includeEmpty: true });
```

##### `findApplication(identifier: string): AppInfo | null`

Find application by name or bundle ID (case-insensitive).

```javascript
const spotify = capture.findApplication('Spotify');
const safari = capture.findApplication('com.apple.Safari');
```

##### `findByName(name: string): AppInfo | null`

Find application by name (alias for `findApplication`, case-insensitive search).

```javascript
const app = capture.findByName('Spotify');
if (app) {
  console.log(`Found: ${app.applicationName} (PID: ${app.processId})`);
}
```

##### `getAudioApps(options?: object): AppInfo[]`

Get only applications likely to produce audio. Filters out system apps and utilities, and optionally sorts by recent activity.

**Options:**
- `includeSystemApps` (boolean): Include system apps (default: `false`)
- `includeEmpty` (boolean): Include apps with empty names (default: `false`)
- `sortByActivity` (boolean): Sort by recent audio activity (requires `enableActivityTracking()`, default: `false`)

```javascript
// Get audio apps (filters system apps and empty names)
const audioApps = capture.getAudioApps();
console.log('Audio apps:', audioApps.map(a => a.applicationName));
// Example output: ['Spotify', 'Safari', 'Music', 'Zoom']
// (excludes Finder, Terminal, System Preferences, etc.)

// Sort by recent audio activity (shows actively playing apps first)
capture.enableActivityTracking();
const activeApps = capture.getAudioApps({ sortByActivity: true });
// Apps currently producing audio appear first
```


##### `getApplicationByPid(processId: number): AppInfo | null`

Get application info by process ID.

```javascript
const app = capture.getApplicationByPid(12345);
if (app) {
  console.log(`Found ${app.applicationName}`);
}
```

##### Window & Display Selection

Need to capture audio from a single window or an entire display instead of a whole application? Use the new helpers to inspect available targets and start a capture against them:

```javascript
// List windows (filter to on-screen windows that have a title)
const windows = capture.getWindows({ onScreenOnly: true, requireTitle: true });
windows.forEach(win => {
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

##### `selectApp(identifiers?: string | number | Array, options?: Object): AppInfo | null`

Smart app selection with multiple fallback strategies. Tries exact name, PID, bundle ID, and partial matches.

**Parameters:**
- `identifiers` - App name, PID, bundle ID, or array to try in order. `null`/`undefined` returns first audio app
- `options.audioOnly` (boolean) - Only search audio apps (default: `true`)
- `options.throwOnNotFound` (boolean) - Throw error if no app found (default: `false`)

**Returns:** Application info or `null` (unless `throwOnNotFound` is `true`)

```javascript
// Try multiple apps in order
const app = capture.selectApp(['Spotify', 'Music', 'Safari']);

// Get first available audio app
const app = capture.selectApp();

// Try PID or name with error throw
const app = capture.selectApp(12345, { throwOnNotFound: true });

// Partial name matching works
const app = capture.selectApp('spot'); // Finds "Spotify"

// Include system apps
const app = capture.selectApp('Terminal', { audioOnly: false });
```

##### `enableActivityTracking(options?: object): void`

Enable background tracking of audio activity for smarter app filtering and sorting.

**Options:**
- `decayMs` (number): Remove apps from cache after this many ms of inactivity (default: `30000`)

```javascript
// Enable tracking
capture.enableActivityTracking();

// Later, get apps sorted by recent audio activity
const apps = capture.getAudioApps({ sortByActivity: true });
// Apps currently producing audio appear first

// Custom decay time (remove from cache after 1 minute of silence)
capture.enableActivityTracking({ decayMs: 60000 });
```

##### `disableActivityTracking(): void`

Disable activity tracking and clear the cache.

```javascript
capture.disableActivityTracking();
```

##### `getActivityInfo(): Object`

Get activity tracking status and statistics about recently active apps.

**Returns:**
- `enabled` (boolean): Whether tracking is enabled
- `trackedApps` (number): Number of apps currently in cache
- `recentApps` (Array): Recently active apps with metadata

```javascript
const info = capture.getActivityInfo();
console.log(`Tracking enabled: ${info.enabled}`);
console.log(`Active apps: ${info.trackedApps}`);

info.recentApps.forEach(app => {
  console.log(`PID ${app.processId}: avg RMS ${app.avgRMS.toFixed(3)}, ` +
              `last seen ${app.ageMs}ms ago`);
});
```

##### `AudioCapture.verifyPermissions(): Object` (Static)

Verify screen recording permissions before attempting capture. Returns a status object with remediation steps if permissions are not granted.

**Returns:**
- `granted` (boolean): Whether permission is granted
- `message` (string): Human-readable status message
- `remediation` (string, optional): Instructions to fix permission issues
- `availableApps` (number, optional): Number of apps found (if granted)

```javascript
const status = AudioCapture.verifyPermissions();
if (!status.granted) {
  console.error(status.message);
  console.log(status.remediation);
  process.exit(1);
} else {
  console.log(status.message); // "Screen Recording permission granted. Found X applications."
}
```

##### `getStatus(): Object | null`

Get detailed status of the current capture session. Returns `null` if not capturing.

**Returns (when capturing):**
- `capturing` (boolean): Always `true` when not null
- `processId` (number | null): Process ID being captured (may be `null` for display capture)
- `app` (AppInfo | null): Application info (if available)
- `window` (WindowInfo | null): Window info when capturing a single window
- `display` (DisplayInfo | null): Display info when capturing a display
- `targetType` (`'application' | 'window' | 'display'`): Target kind
- `config` (Object): Current capture configuration
  - `minVolume` (number): Volume threshold
  - `format` (string): Audio format ('float32' or 'int16')

```javascript
const status = capture.getStatus();
if (status) {
  console.log(`Capturing type: ${status.targetType}`);
  if (status.app) {
    console.log(`Application: ${status.app.applicationName}`);
  }
  if (status.window) {
    console.log(`Window: ${status.window.title}`);
  }
  if (status.display) {
    console.log(`Display: ${status.display.displayId}`);
  }
  console.log(`Format: ${status.config.format}`);
  console.log(`Min volume: ${status.config.minVolume}`);
} else {
  console.log('Not currently capturing');
}
```

##### `startCapture(appIdentifier: string | number, options?: object): boolean`

Start capturing audio. Accepts app name, bundle ID, or process ID.

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

```javascript
// Basic usage
capture.startCapture('Music');                    // By name
capture.startCapture('com.spotify.client');       // By bundle ID
capture.startCapture(12345);                      // By PID

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
  if (err.code === ErrorCodes.APP_NOT_FOUND) {
    console.log('Available apps:', err.details.availableApps);
  } else if (err.code === ErrorCodes.PERMISSION_DENIED) {
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
- `minVolume` (number): Minimum RMS volume threshold (0.0-1.0)
- `format` (string): Audio format - `'float32'` (default) or `'int16'`
- `objectMode` (boolean): Enable object mode to receive full sample objects instead of just raw audio data (default: false)

*Advanced Configuration Options:*
- `sampleRate` (number): Requested sample rate in Hz (e.g., 44100, 48000). Default: 48000 (see note in `startCapture`)
- `channels` (number): Number of audio channels: 1 (mono) or 2 (stereo). Default: 2 ✅
- `bufferSize` (number): Buffer size for audio processing in frames. Smaller values = lower latency but higher CPU usage. Default: system default
- `excludeCursor` (boolean): Exclude cursor from capture (reserved for future video features). Default: true

**Returns:** `AudioStream` - A Node.js Readable stream

```javascript
// Basic usage - stream raw audio buffers
const audioStream = capture.createAudioStream('Spotify');
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

```javascript
const { pipeline } = require('stream');

// Simple - auto-converts to Int16 mono
const sttStream = capture.createSTTStream('Safari');
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

```javascript
capture.on('audio', (sample) => {
  // Convert Buffer to Float32Array
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  // Now you can easily process the audio samples
  console.log(`Got ${float32.length} samples`);
  console.log(`First sample value: ${float32[0]}`);

  // Calculate custom metrics
  let sum = 0;
  for (let i = 0; i < float32.length; i++) {
    sum += Math.abs(float32[i]);
  }
  const avgAmplitude = sum / float32.length;
  console.log(`Average amplitude: ${avgAmplitude}`);
});
```

##### `AudioCapture.rmsToDb(rms: number): number`

Convert RMS value (0.0-1.0) to decibels.

```javascript
const db = AudioCapture.rmsToDb(0.5); // Returns: -6.02 dB
```

##### `AudioCapture.peakToDb(peak: number): number`

Convert peak value (0.0-1.0) to decibels.

```javascript
const peakDb = AudioCapture.peakToDb(0.5); // Returns: -6.02 dB
```

##### `AudioCapture.calculateDb(samples: Buffer, method?: 'rms' | 'peak'): number`

Calculate dB level from audio samples.

```javascript
capture.on('audio', (sample) => {
  const rmsDb = AudioCapture.calculateDb(sample.data, 'rms');
  const peakDb = AudioCapture.calculateDb(sample.data, 'peak');
  console.log(`RMS: ${rmsDb.toFixed(1)} dB, Peak: ${peakDb.toFixed(1)} dB`);
});
```

##### `AudioCapture.writeWav(buffer: Buffer, options: object): Buffer`

Create a WAV file from PCM audio data. Returns a complete WAV file buffer that can be written directly to disk.

**Options:**
- `sampleRate` (number, required): Sample rate in Hz (e.g., 48000)
- `channels` (number, required): Number of channels (e.g., 2 for stereo)
- `format` (string): Audio format - `'float32'` (default) or `'int16'`

```javascript
const fs = require('fs');

capture.on('audio', (sample) => {
  // Create WAV file from audio sample
  const wavBuffer = AudioCapture.writeWav(sample.data, {
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

```javascript
capture.on('start', ({ processId, app }) => {
  console.log(`Capturing from ${app.applicationName}`);
});
```

##### Event: `'audio'`

Emitted for each audio sample (typically 160ms chunks at 48kHz).

```javascript
capture.on('audio', (sample) => {
  // sample.data: Buffer (Float32 or Int16 PCM audio, depending on format option)
  // sample.sampleRate: 48000
  // sample.channels: 2
  // sample.timestamp: seconds (timestamp of the audio sample)
  // sample.format: 'float32' or 'int16'
  // sample.sampleCount: total number of samples in buffer
  // sample.durationMs: duration in milliseconds
  // sample.rms: RMS volume level (0.0-1.0)
  // sample.peak: peak volume level (0.0-1.0)

  // Working with the audio data:
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);
  console.log(`Got ${float32.length} samples`);
});
```

##### Event: `'stop'`

Emitted when capture stops.

```javascript
capture.on('stop', ({ processId }) => {
  console.log('Capture stopped');
});
```

##### Event: `'error'`

Emitted on errors.

```javascript
capture.on('error', (err) => {
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

```javascript
const { ErrorCodes } = require('screencapturekit-audio-capture');

capture.on('error', (err) => {
  if (err.code === ErrorCodes.APP_NOT_FOUND) {
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

```javascript
const { ErrorCodes } = require('screencapturekit-audio-capture');

capture.on('error', (err) => {
  switch (err.code) {
    case ErrorCodes.PERMISSION_DENIED:
      console.log('Grant Screen Recording permission');
      break;
    case ErrorCodes.APP_NOT_FOUND:
      console.log('App not found:', err.details.requestedApp);
      console.log('Available:', err.details.availableApps);
      break;
    case ErrorCodes.ALREADY_CAPTURING:
      console.log('Stop current capture first');
      capture.stopCapture();
      break;
    case ErrorCodes.PROCESS_NOT_FOUND:
      console.log('Process ID not found:', err.details.requestedPid);
      break;
    case ErrorCodes.CAPTURE_FAILED:
      console.log('Native capture failed:', err.details.suggestion);
      break;
    case ErrorCodes.INVALID_ARGUMENT:
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

```javascript
const audioStream = capture.createAudioStream('Spotify');
// ... use the stream
audioStream.stop();
```

##### `getCurrentCapture(): CaptureInfo | null`

Get information about the current capture (same structure as `AudioCapture#getCurrentCapture`).

```javascript
const info = audioStream.getCurrentCapture();
if (info) {
  console.log(`Target type: ${info.targetType}`);
}
```

#### Stream Events

AudioStream extends Node.js Readable, so it emits all standard stream events:

```javascript
const audioStream = capture.createAudioStream('Spotify');

audioStream.on('data', (chunk) => {
  // Chunk is a Buffer (or sample object if objectMode is true)
  console.log(`Received ${chunk.length} bytes`);
});

audioStream.on('error', (error) => {
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

```javascript
const { ScreenCaptureKit } = require('screencapturekit-audio-capture');
const captureKit = new ScreenCaptureKit();

// Get apps (returns basic AppInfo array)
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
const isCapturing = captureKit.isCapturing();
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

Full TypeScript support with included definitions:

```typescript
import AudioCapture, {
  AudioStream,
  STTConverter,
  EnhancedAudioSample,
  AppInfo,
  WindowInfo,
  DisplayInfo,
  CaptureInfo,
  StreamOptions,
  CaptureOptions,
  ErrorCodes,
  AudioCaptureError
} from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

// Event-based API
capture.on('audio', (sample: EnhancedAudioSample) => {
  const db: number = AudioCapture.rmsToDb(sample.rms);
  console.log(`Volume: ${db.toFixed(1)} dB`);
});

// Stream-based API
const streamOptions: StreamOptions = {
  minVolume: 0.01,
  format: 'float32',
  objectMode: true
};

const audioStream: AudioStream = capture.createAudioStream('Spotify', streamOptions);

audioStream.on('data', (sample: EnhancedAudioSample) => {
  console.log(`RMS: ${sample.rms}, Peak: ${sample.peak}`);
});

// Finding apps
const app: AppInfo | null = capture.findApplication('Safari');
if (app) {
  capture.startCapture(app.processId);
}

// Window/display helpers are fully typed
const windows: WindowInfo[] = capture.getWindows({ onScreenOnly: true });
const displays: DisplayInfo[] = capture.getDisplays();
const status: CaptureInfo | null = capture.getStatus();

// Error handling with types
capture.on('error', (err: AudioCaptureError) => {
  if (err.code === ErrorCodes.APP_NOT_FOUND) {
    console.log('Available apps:', err.details.availableApps);
  }
});
```

## Working with Audio Data

### Understanding the Buffer Format

Audio samples are provided as Node.js `Buffer` objects containing Float32 PCM audio data by default. Here's how to work with them:

```javascript
capture.on('audio', (sample) => {
  // Method 1: Use the helper (recommended)
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

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

```javascript
capture.startCapture('Spotify', { format: 'int16' });

capture.on('audio', (sample) => {
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

```javascript
// Only emit audio events when RMS volume > 0.01
capture.startCapture('Spotify', { minVolume: 0.01 });

capture.on('audio', (sample) => {
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
```javascript
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
   ```javascript
   const apps = capture.getApplications();
   console.log('Available:', apps.map(a => a.applicationName).join(', '));
   ```
4. **Use bundle ID instead:**
   ```javascript
   // More reliable than app name
   capture.startCapture('com.spotify.client');
   ```
5. **Filter for audio apps only:**
   ```javascript
   const audioApps = capture.getAudioApps();
   console.log('Audio apps:', audioApps.map(a => a.applicationName));
   ```

### No audio samples received

**Symptom:** Capture starts successfully but no `'audio'` events are emitted

**Solutions:**
1. **Ensure the app is actively playing audio** - Not all running apps produce audio
2. **Check if audio is muted** - Muted applications may not emit audio samples
3. **Verify the app has visible windows** - Some ScreenCaptureKit limitations require windows
4. **Try a different app** - Test with Music, Safari, or Spotify to verify your setup
5. **Check volume threshold:** If you set `minVolume`, ensure audio is loud enough
   ```javascript
   // Remove volume threshold for testing
   capture.startCapture('Spotify');  // No options
   ```

### How to work with the Buffer data

**Symptom:** Confused about how to process `sample.data`

**Solution:** Use the helper method:
```javascript
capture.on('audio', (sample) => {
  // Convert Buffer to Float32Array
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  // Now you can work with it like a normal array
  for (let i = 0; i < float32.length; i++) {
    const sampleValue = float32[i];  // Range: -1.0 to 1.0
    // Process audio...
  }
});
```

### Stream API Issues

**Symptom:** Stream-related errors or unexpected behavior

**Common Issues & Solutions:**

1. **Stream doesn't start capturing:**
   ```javascript
   // Won't start - missing data listener
   const stream = capture.createAudioStream('Spotify');
   stream.on('error', (err) => console.error(err));

   // Will start - has data listener
   stream.on('data', (chunk) => { /* process */ });
   ```

2. **"Already capturing" error when creating multiple streams:**
   ```javascript
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
   ```javascript
   // Problem: Not consuming data
   const stream = capture.createAudioStream('Spotify');
   // No data handler = buffering

   // Solution: Always consume
   stream.on('data', (chunk) => {
     // Process or discard
   });
   ```

4. **"stream.push() after EOF" error:**
   ```javascript
   // Use pipeline for proper cleanup
   const { pipeline } = require('stream');

   pipeline(stream, transform, writable, (err) => {
     if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
       console.error(err);
     }
   });
   ```

5. **No data events in object mode:**
   ```javascript
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

## Examples

The repository ships with runnable example scripts under [`examples/`](examples/README.md) that mirror the snippets below.

**Note:** Examples are available in the [GitHub repository](https://github.com/mrlionware/screencapturekit-audio-capture/tree/main/examples) but are not included in the npm package to reduce installation size.

**Run examples:**
- `node examples/1-basic-usage.js [appName]`
- `node examples/2-stream-api.js [1-5]`
- `node examples/3-advanced-config.js [preset] [app|window|display] [...custom]`
- `node examples/4-finding-apps.js`
- `node examples/5-stt-integration.js`

See [`examples/README.md`](examples/README.md) for a deeper walkthrough of each scenario.

### Stream-Based Audio Processing

Use the stream API to pipe audio through transform streams:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const { Transform, pipeline } = require('stream');
const fs = require('fs');

const capture = new AudioCapture();

// Create a transform stream to process audio
class VolumeAnalyzer extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(sample, encoding, callback) {
    const db = AudioCapture.rmsToDb(sample.rms);
    console.log(`Volume: ${db.toFixed(1)} dB`);

    // Pass the sample through
    this.push(sample);
    callback();
  }
}

// Create audio stream in object mode
const audioStream = capture.createAudioStream('Spotify', {
  objectMode: true,
  minVolume: 0.01
});

const analyzer = new VolumeAnalyzer();

// Use pipeline for proper error handling
pipeline(audioStream, analyzer, (err) => {
  if (err) console.error('Error:', err);
  else console.log('Stream ended');
});

// Stop after 10 seconds
setTimeout(() => audioStream.stop(), 10000);
```

### Audio Visualizer

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

capture.on('audio', (sample) => {
  const db = AudioCapture.rmsToDb(sample.rms);
  const width = 50;
  const normalized = Math.max(0, (db + 60) / 60);
  const bars = '█'.repeat(Math.floor(normalized * width));

  console.log(`[${bars}] ${db.toFixed(1)} dB`);
});

capture.startCapture('Music');
```

### Record to File

```javascript
const fs = require('fs');
const AudioCapture = require('screencapturekit-audio-capture');

const capture = new AudioCapture();
const chunks = [];

capture.on('audio', (sample) => {
  chunks.push(Buffer.from(sample.data));
});

capture.on('stop', () => {
  const audioData = Buffer.concat(chunks);
  fs.writeFileSync('recording.raw', audioData);

  // Metadata for playback (Float32 PCM, 48kHz, Stereo)
  const metadata = { format: 'f32le', sampleRate: 48000, channels: 2 };
  fs.writeFileSync('recording.json', JSON.stringify(metadata));

  console.log(`Saved ${(audioData.length / 1024 / 1024).toFixed(2)} MB`);
});

capture.startCapture('Spotify');
setTimeout(() => capture.stopCapture(), 30000); // 30 seconds
```

### Save as WAV File

Use the `writeWav()` helper to save audio as standard WAV files:

```javascript
const fs = require('fs');
const AudioCapture = require('screencapturekit-audio-capture');

const capture = new AudioCapture();
const audioChunks = [];

capture.on('audio', (sample) => {
  // Accumulate audio chunks
  audioChunks.push({
    data: sample.data,
    sampleRate: sample.sampleRate,
    channels: sample.channels,
    format: sample.format
  });
});

capture.on('stop', () => {
  if (audioChunks.length === 0) return;

  // Combine all chunks
  const combinedBuffer = Buffer.concat(audioChunks.map(c => c.data));

  // Create WAV file
  const wavBuffer = AudioCapture.writeWav(combinedBuffer, {
    sampleRate: audioChunks[0].sampleRate,
    channels: audioChunks[0].channels,
    format: audioChunks[0].format
  });

  // Save to file
  fs.writeFileSync('recording.wav', wavBuffer);
  console.log(`Saved ${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB WAV file`);
});

capture.startCapture('Spotify');
setTimeout(() => capture.stopCapture(), 30000); // 30 seconds
```

### Volume Monitor with Alerts

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

const LOUD_THRESHOLD = -10; // dB
let loudCount = 0;

capture.on('audio', (sample) => {
  const db = AudioCapture.rmsToDb(sample.rms);

  if (db > LOUD_THRESHOLD) {
    loudCount++;
    if (loudCount > 5) {
      console.warn('⚠️ Audio has been loud for a while!');
      loudCount = 0;
    }
  } else {
    loudCount = 0;
  }
});

capture.startCapture('Music');
```

### Smart Audio Detection (with Volume Threshold)

Only process audio when sound is actually present, saving CPU and bandwidth:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

// Only emit audio events when RMS > 0.01 (filters out silence)
capture.startCapture('Spotify', { minVolume: 0.01 });

capture.on('audio', (sample) => {
  // This only fires when audio is actively playing
  const db = AudioCapture.rmsToDb(sample.rms);
  console.log(`🔊 Audio detected: ${db.toFixed(1)} dB`);

  // Process the audio...
});

capture.on('start', ({ app }) => {
  console.log(`Monitoring ${app.applicationName} (only when audio > threshold)`);
});
```

### Convert to Int16 for Audio Libraries

Many audio libraries expect Int16 format. Here's how to capture in that format:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

// Get audio in Int16 format instead of Float32
capture.startCapture('Spotify', { format: 'int16' });

capture.on('audio', (sample) => {
  // sample.data is now Int16 format
  const int16 = new Int16Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.byteLength / 2
  );

  console.log(`Format: ${sample.format}`);  // 'int16'
  console.log(`Samples: ${int16.length}`);
  console.log(`Range: -32768 to 32767`);

  // Use with audio libraries that expect Int16
  // sendToAudioLibrary(sample.data);
});
```

### Finding and Filtering Apps

Use helper methods to easily find audio applications:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

// Get only apps likely to have audio (excludes system apps)
const audioApps = capture.getAudioApps();
console.log('Audio apps:', audioApps.map(a => a.applicationName));

// Find specific app by name
const spotify = capture.findByName('spotify');  // Case-insensitive
if (spotify) {
  console.log(`Found: ${spotify.applicationName}`);
  console.log(`PID: ${spotify.processId}`);
  console.log(`Bundle ID: ${spotify.bundleIdentifier}`);

  capture.startCapture(spotify.processId);
} else {
  console.log('Spotify not running');
}

// List all apps with their properties
const allApps = capture.getApplications();
allApps.forEach(app => {
  console.log(`${app.applicationName}`);
  console.log(`  PID: ${app.processId}`);
  console.log(`  Bundle: ${app.bundleIdentifier}`);
});
```

### Processing Audio Samples

Work with audio data using the Buffer conversion helper:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

capture.on('audio', (sample) => {
  // Convert Buffer to Float32Array
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);

  // Calculate custom audio metrics
  let sum = 0;
  let maxVal = 0;
  for (let i = 0; i < float32.length; i++) {
    const abs = Math.abs(float32[i]);
    sum += abs;
    if (abs > maxVal) maxVal = abs;
  }

  const avgAmplitude = sum / float32.length;

  console.log(`Samples: ${float32.length}`);
  console.log(`Average amplitude: ${avgAmplitude.toFixed(4)}`);
  console.log(`Peak: ${maxVal.toFixed(4)}`);
  console.log(`RMS: ${sample.rms.toFixed(4)}`);
  console.log(`Duration: ${sample.durationMs.toFixed(1)}ms`);
});

capture.startCapture('Music');
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

```javascript
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
| macOS 14+ (Sonoma) | ✅ Full | ✅ Fully tested | Recommended |
| macOS 13+ (Ventura) | ✅ Full | ✅ Supported | Minimum required version |
| macOS 12.x (Monterey) | ⚠️ Limited | ❌ No audio API | Screen capture only, no audio |
| macOS 11.x (Big Sur) | ❌ Not available | ❌ No | Use older AVFoundation methods |
| Windows/Linux | ❌ Not available | ❌ No | macOS-only framework |

**Why macOS 13.0+?**

ScreenCaptureKit's audio capture APIs were introduced in macOS 13.0 (Ventura). Earlier versions of the framework don't support per-application audio isolation.

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

```javascript
try {
  const AudioCapture = require('screencapturekit-audio-capture');
  console.log('✓ Native addon loaded successfully');

  const capture = new AudioCapture();
  console.log('✓ AudioCapture instance created');
} catch (err) {
  console.error('❌ Failed to load native addon:', err.message);
  console.error('Try: npm rebuild screencapturekit-audio-capture');
}
```

### Verify Permissions Programmatically

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();
const apps = capture.getApplications();

if (apps.length === 0) {
  console.error('❌ No apps available - likely a permission issue');
  console.error('Check: System Preferences → Privacy & Security → Screen Recording');
  console.error('Make sure your terminal app is listed and enabled');
} else {
  console.log(`✓ Permissions OK - found ${apps.length} apps`);
  console.log('Available apps:', apps.map(a => a.applicationName).join(', '));
}
```

### Test Basic Capture

```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const capture = new AudioCapture();

// Find any available app
const apps = capture.getAudioApps();
if (apps.length === 0) {
  console.error('No audio apps running');
  process.exit(1);
}

const app = apps[0];
console.log(`Testing with: ${app.applicationName}`);

let receivedSamples = 0;

capture.on('audio', (sample) => {
  receivedSamples++;
  if (receivedSamples === 1) {
    console.log('✓ First sample received!');
    console.log(`  Sample rate: ${sample.sampleRate}Hz`);
    console.log(`  Channels: ${sample.channels}`);
    console.log(`  Format: ${sample.format}`);
    console.log(`  RMS: ${sample.rms.toFixed(4)}`);
  }
});

capture.on('error', (err) => {
  console.error('❌ Capture error:', err.message);
  console.error('Code:', err.code);
  if (err.details) {
    console.error('Details:', err.details);
  }
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

## Migrating from Older Versions

### From v1.1.x to v1.2.x

**New capabilities:**
- Window/display capture APIs: `getWindows()`, `getDisplays()`, `captureWindow()`, `captureDisplay()`
- `createSTTStream()` helper with `STTConverter` for STT-ready Int16/mono streams
- Activity tracking + smarter selection (`enableActivityTracking()`, `getActivityInfo()`, `selectApp()` fallbacks)
- Enhanced sample metadata (duration, frame counts, peaks/rms) exposed in object mode and streams
- Modularized test suite under `tests/` (unit, integration, edge-cases, examples)

**Action:** Update to `^1.2.0`. No breaking changes; older capture calls continue to work, but new helpers simplify configuration.

### From v1.0.x to v1.1.x

**New Features:**
- `minVolume` option for filtering silence
- `format` option for Int16 conversion
- `getAudioApps()` filtering method
- `bufferToFloat32Array()` helper
- Error codes with `ErrorCodes` constant
- `peakToDb()` static method
- Enhanced error details with suggestions

**Breaking Changes:** None - fully backward compatible

**Recommended Updates:**
```javascript
// Old way
capture.on('audio', (sample) => {
  const float32 = new Float32Array(
    sample.data.buffer,
    sample.data.byteOffset,
    sample.data.length / 4
  );
});

// New way (cleaner)
capture.on('audio', (sample) => {
  const float32 = AudioCapture.bufferToFloat32Array(sample.data);
});
```

```javascript
// Old error handling
capture.on('error', (err) => {
  console.error('Error:', err.message);
});

// New error handling (with codes)
const { ErrorCodes } = require('screencapturekit-audio-capture');

capture.on('error', (err) => {
  if (err.code === ErrorCodes.APP_NOT_FOUND) {
    console.log('Try one of:', err.details.availableApps);
  }
});
```

### From v1.1.1 to v1.1.2

**Critical Fixes:**
- **Security:** Buffer overflow vulnerability fixed
- **Stability:** Audio format handling improved
- **Compatibility:** Multi-channel audio support fixed

**Action Required:**

Update immediately if using multi-channel audio or experiencing crashes:

```bash
npm update screencapturekit-audio-capture
```

**What Changed:**
- Native buffer allocation is now dynamic and safe
- Planar vs interleaved audio detection is more robust
- Multi-channel configurations (>2 channels) now work correctly

**No API Changes:** Your existing code will work without modifications.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

**Development Setup:**

```bash
git clone https://github.com/mrlionware/screencapturekit-audio-capture.git
cd screencapturekit-audio-capture
npm install
npm run build
```

**Running Tests:**

```bash
# Full suite (cross-platform, mocked native)
npm test

# Focused suites
npm run test:unit
npm run test:integration
npm run test:edge-cases
npm run test:examples
```

**Code Structure:**
- `src/addon.mm` - N-API bindings
- `src/screencapturekit_wrapper.mm` - Objective-C++ wrapper
- `src/screencapturekit_wrapper.h` - C++ header
- `sdk.js` - High-level JavaScript API
- `index.d.ts` - TypeScript definitions
- `examples/` - Example scripts

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
