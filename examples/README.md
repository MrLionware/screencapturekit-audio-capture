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
