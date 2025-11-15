# ScreenCaptureKit Audio Capture

> Native Node.js addon for capturing per-application audio on macOS using the ScreenCaptureKit framework

[![npm version](https://badge.fury.io/js/screencapturekit-audio-capture.svg)](https://www.npmjs.com/package/screencapturekit-audio-capture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%2013.0%2B-blue.svg)](https://developer.apple.com/documentation/screencapturekit)

Capture real-time audio from any macOS application with a simple, event-driven API. Built with N-API for Node.js compatibility and ScreenCaptureKit for system-level audio access.

## Features

- 🎵 **Per-App Audio Capture** - Isolate audio from specific applications
- ⚡ **Real-Time Streaming** - Low-latency audio callbacks
- 🎯 **Event-Driven API** - Clean, modern Node.js patterns
- 📊 **Audio Analysis** - Built-in RMS, peak, and dB calculations
- 🔒 **Memory Safe** - No crashes, proper resource cleanup
- 📘 **TypeScript Support** - Full type definitions included
- 🚀 **Production Ready** - Thoroughly tested and documented

## Requirements

- macOS 13.0 (Ventura) or later
- Node.js 14.0.0 or later
- Xcode Command Line Tools
- Screen Recording permission (granted in System Preferences)

## Installation

```bash
npm install screencapturekit-audio-capture
```

The native addon will automatically compile during installation.

## Quick Start

```javascript
const AudioCapture = require('screencapturekit-audio-capture');

const capture = new AudioCapture();

// List available applications
const apps = capture.getApplications();
console.log('Available apps:', apps.map(a => a.applicationName));

// Start capturing from Spotify
capture.on('audio', (sample) => {
  const db = AudioCapture.rmsToDb(sample.rms);
  console.log(`Volume: ${db.toFixed(1)} dB`);
});

capture.startCapture('Spotify');

// Stop after 10 seconds
setTimeout(() => capture.stopCapture(), 10000);
```

## API Reference

### Class: `AudioCapture`

High-level event-based API (recommended).

#### Methods

##### `getApplications(): AppInfo[]`

Get list of all capturable applications.

```javascript
const apps = capture.getApplications();
// Returns: [{ processId, bundleIdentifier, applicationName }, ...]
```

##### `findApplication(identifier: string): AppInfo | null`

Find application by name or bundle ID (case-insensitive).

```javascript
const spotify = capture.findApplication('Spotify');
const safari = capture.findApplication('com.apple.Safari');
```

##### `startCapture(appIdentifier: string | number): boolean`

Start capturing audio. Accepts app name, bundle ID, or process ID.

```javascript
capture.startCapture('Music');          // By name
capture.startCapture('com.spotify.client'); // By bundle ID
capture.startCapture(12345);            // By PID
```

##### `stopCapture(): void`

Stop the current capture session.

##### `isCapturing(): boolean`

Check if currently capturing.

##### `getCurrentCapture(): CaptureInfo | null`

Get information about the current capture.

#### Static Methods

##### `AudioCapture.rmsToDb(rms: number): number`

Convert RMS value (0.0-1.0) to decibels.

```javascript
const db = AudioCapture.rmsToDb(0.5); // Returns: -6.02 dB
```

##### `AudioCapture.calculateDb(samples: Buffer, method?: 'rms' | 'peak'): number`

Calculate dB level from audio samples.

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
  // sample.data: Buffer (Float32 PCM audio)
  // sample.sampleRate: 48000
  // sample.channels: 2
  // sample.timestamp: seconds
  // sample.durationMs: milliseconds
  // sample.rms: volume level (0.0-1.0)
  // sample.peak: peak level (0.0-1.0)
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

## TypeScript

Full TypeScript support with included definitions:

```typescript
import AudioCapture, { EnhancedAudioSample, AppInfo } from 'screencapturekit-audio-capture';

const capture = new AudioCapture();

capture.on('audio', (sample: EnhancedAudioSample) => {
  const db: number = AudioCapture.rmsToDb(sample.rms);
  console.log(`Volume: ${db.toFixed(1)} dB`);
});

const app: AppInfo | null = capture.findApplication('Safari');
if (app) {
  capture.startCapture(app.processId);
}
```

## Examples

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

- **Sample Rate:** 48000 Hz
- **Channels:** 2 (Stereo)
- **Format:** 32-bit Float PCM
- **Chunk Duration:** ~160ms (7680 samples per channel)
- **Buffer Type:** Node.js Buffer containing Float32 values

## Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| macOS 13.0+ (Ventura) | ✅ Full | Audio capture requires macOS 13.0+ |
| macOS 12.x (Monterey) | ❌ No | ScreenCaptureKit audio APIs not available |
| Windows/Linux | ❌ No | macOS-only (ScreenCaptureKit framework) |

## Troubleshooting

### "No applications available"

- Ensure Screen Recording permission is granted
- Restart your terminal after granting permission
- Check System Preferences → Privacy & Security → Screen Recording

### "Failed to start capture"

- Ensure the target application is running
- Application must have visible windows
- Check that the app name or process ID is correct

### Build errors

- Install Xcode Command Line Tools: `xcode-select --install`
- Ensure you're on macOS 13.0+: `sw_vers`
- Clean and rebuild: `npm run clean && npm run build`

### No audio samples received

- Ensure the target application is actively playing audio
- Some apps may not expose audio through ScreenCaptureKit
- Check Console.app for ScreenCaptureKit errors

## Performance

- **Latency:** ~160ms (one buffer duration)
- **CPU Usage:** Minimal (<1% on Apple Silicon)
- **Memory:** ~10-20MB for typical usage
- **Thread Safety:** Audio callbacks run on dedicated thread, safely marshaled to JavaScript

## Architecture

```
┌─────────────────────┐
│   JavaScript API    │  (Event-based, high-level)
├─────────────────────┤
│   N-API Bindings    │  (Thread-safe callbacks)
├─────────────────────┤
│Objective-C++ Wrapper│
├─────────────────────┤
│   ScreenCaptureKit  │  (macOS System Framework)
└─────────────────────┘
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

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
