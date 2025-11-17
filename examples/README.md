# Examples

This directory contains example code for using the ScreenCaptureKit Audio Capture package.

## Running Examples

All examples require Screen Recording permission to be granted in System Preferences.

### Example 1: Simple SDK Usage

```bash
node example-sdk.js Safari
```

Shows basic usage of the high-level SDK with event-based API.

### Example 2: Integration Demos

```bash
# Simple audio monitor
node demo-integration.js 1 Safari

# Record to buffer
node demo-integration.js 2 Music

# Volume meter with visualization
node demo-integration.js 3 Spotify

# Multi-app monitoring
node demo-integration.js 4

# Error handling example
node demo-integration.js 5 Safari
```

### Example 3: Finding and Filtering Apps

```bash
node find-apps-example.js
```

Demonstrates:
- Getting all available applications
- Filtering for audio apps only
- Finding apps by name (case-insensitive)
- Finding apps by bundle identifier
- Finding apps by process ID

### Example 4: Volume Threshold (Smart Audio Detection)

```bash
node volume-threshold-example.js
```

Shows how to use the `minVolume` option to only receive audio events when sound is actually present, filtering out silence. Great for:
- Saving CPU by not processing silent audio
- Detecting when audio playback starts/stops
- Reducing bandwidth when streaming

### Example 5: Int16 Format Conversion

```bash
node int16-format-example.js
```

Demonstrates capturing audio in Int16 format instead of Float32. This is useful when working with audio libraries that expect Int16 data. Also shows how to save the recorded audio to a file.

### Example 6: Buffer Conversion Helper

```bash
node buffer-conversion-example.js
```

Shows how to use `AudioCapture.bufferToFloat32Array()` to easily convert the Buffer data to Float32Array for audio processing. Includes examples of calculating audio metrics from the samples.

## Usage in Your Project

After installing the package:

```bash
npm install screencapturekit-audio-capture
```

Basic usage:

```javascript
const AudioCapture = require('screencapturekit-audio-capture');

const capture = new AudioCapture();

capture.on('audio', (sample) => {
  const db = AudioCapture.rmsToDb(sample.rms);
  console.log(`Volume: ${db.toFixed(1)} dB`);
});

capture.startCapture('Music');

setTimeout(() => capture.stopCapture(), 10000);
```

See the main README.md for complete API documentation.
