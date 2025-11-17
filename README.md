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

##### `findByName(name: string): AppInfo | null`

Find application by name (alias for `findApplication`, case-insensitive search).

```javascript
const app = capture.findByName('Spotify');
if (app) {
  console.log(`Found: ${app.applicationName} (PID: ${app.processId})`);
}
```

##### `getAudioApps(): AppInfo[]`

Get only applications likely to produce audio. Filters out system apps and utilities.

```javascript
const audioApps = capture.getAudioApps();
console.log('Audio apps:', audioApps.map(a => a.applicationName));
// Example output: ['Spotify', 'Safari', 'Music', 'Zoom']
// (excludes Finder, Terminal, System Preferences, etc.)
```

##### `startCapture(appIdentifier: string | number, options?: object): boolean`

Start capturing audio. Accepts app name, bundle ID, or process ID.

**Options:**
- `minVolume` (number): Minimum RMS volume threshold (0.0-1.0). Only emit audio when volume exceeds this level.
- `format` (string): Audio format - `'float32'` (default) or `'int16'`

```javascript
// Basic usage
capture.startCapture('Music');                    // By name
capture.startCapture('com.spotify.client');       // By bundle ID
capture.startCapture(12345);                      // By PID

// With volume threshold (only emit when audio is present)
capture.startCapture('Spotify', { minVolume: 0.01 });

// Convert to Int16 format
capture.startCapture('Spotify', { format: 'int16' });

// Combine options
capture.startCapture('Spotify', {
  minVolume: 0.01,
  format: 'int16'
});
```

##### `stopCapture(): void`

Stop the current capture session.

##### `isCapturing(): boolean`

Check if currently capturing.

##### `getCurrentCapture(): CaptureInfo | null`

Get information about the current capture.

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

##### `AudioCapture.calculateDb(samples: Buffer, method?: 'rms' | 'peak'): number`

Calculate dB level from audio samples.

```javascript
capture.on('audio', (sample) => {
  const rmsDb = AudioCapture.calculateDb(sample.data, 'rms');
  const peakDb = AudioCapture.calculateDb(sample.data, 'peak');
  console.log(`RMS: ${rmsDb.toFixed(1)} dB, Peak: ${peakDb.toFixed(1)} dB`);
});
```

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

- **Sample Rate:** 48000 Hz
- **Channels:** 2 (Stereo)
- **Format:** 32-bit Float PCM (default) or 16-bit Int PCM (optional)
- **Chunk Duration:** ~160ms (7680 samples per channel)
- **Buffer Type:** Node.js Buffer containing Float32 or Int16 values (depending on format option)
- **Sample Range:** Float32: -1.0 to 1.0, Int16: -32768 to 32767

## Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| macOS 13.0+ (Ventura) | ✅ Full | Audio capture requires macOS 13.0+ |
| macOS 12.x (Monterey) | ❌ No | ScreenCaptureKit audio APIs not available |
| Windows/Linux | ❌ No | macOS-only (ScreenCaptureKit framework) |

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
