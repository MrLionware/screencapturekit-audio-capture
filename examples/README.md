# Examples

This directory contains focused examples demonstrating the key features of ScreenCaptureKit Audio Capture.

## Quick Start

Run any example:
```bash
node examples/1-basic-usage.js
```

## Examples Overview

### 1. Basic Usage (`1-basic-usage.js`)
**What it covers:**
- Permission verification and best-practice error handling
- Smart app selection with fallbacks
- Starting/stopping capture via events
- Volume threshold filtering
- Working with audio buffers (Buffer → Float32Array)
- Calculating RMS/Peak/dB levels
- Saving captured audio to WAV files
- Activity tracking snapshot

**Use this when:** You're getting started or want to use the event-based API.

```bash
node examples/1-basic-usage.js               # Auto-selects a running audio app
node examples/1-basic-usage.js "Spotify"     # Force a specific app (case-insensitive)
```

---

### 2. Stream API (`2-stream-api.js`)
**What it covers:**
- Using Node.js Readable streams for audio
- Object mode vs normal mode
- Piping to transforms and writable streams
- Using `pipeline()` for error handling
- Real-time audio processing with transforms
- Live volume meter example
- `createSTTStream()` helper for Speech-to-Text engines

**Use this when:** You want composable, stream-based audio processing.

**Run different examples:**
```bash
node examples/2-stream-api.js 1  # Object mode with metadata
node examples/2-stream-api.js 2  # Normal mode (raw buffers)
node examples/2-stream-api.js 3  # Pipeline with WAV file
node examples/2-stream-api.js 4  # Real-time volume meter
node examples/2-stream-api.js 5  # STT-ready Int16 mono stream
```

---

### 3. Advanced Configuration (`3-advanced-config.js`)
**What it covers:**
- Sample rate configuration (with system limitations explained)
- Channel configuration (mono/stereo)
- Buffer size control (latency vs CPU trade-off)
- Format selection (float32 vs int16)
- Data reduction strategies
- Application/window/display targeting
- Configuration presets

**Use this when:** You need to optimize for latency, bandwidth, or CPU usage.

**Configuration presets:**
```bash
node examples/3-advanced-config.js 1              # Low latency
node examples/3-advanced-config.js 2 display      # Efficient, display capture
node examples/3-advanced-config.js 3 window       # High quality, window capture
node examples/3-advanced-config.js 4 app ...      # Custom settings
```

**Custom settings:**
```bash
node examples/3-advanced-config.js 4 app 48000 1 2048 int16
#                                             │  │  │  └─ format
#                                             │  │  └─ buffer size
#                                             │  └─ channels
#                                             └─ sample rate
```

---

### 4. Finding Applications (`4-finding-apps.js`)
**What it covers:**
- Permission verification / troubleshooting
- Getting all capturable applications (including helper processes)
- Filtering to audio-likely apps, sorting by activity
- Searching by name, bundle ID, and PID lookup
- Smart selection with `selectApp()`
- Activity tracking statistics
- Custom filtering strategies

**Use this when:** You need to discover or filter available applications.

```bash
node examples/4-finding-apps.js
```

---

### 5. STT Integration (`5-stt-integration.js`)
**What it covers:**
- Dedicated Speech-to-Text integration pipeline
- `createSTTStream()` helper usage
- Automatic format conversion (Float32 → Int16)
- Automatic channel downmixing (Stereo → Mono)
- Simulating data streaming to an external service

**Use this when:** You want to feed audio into a speech recognition engine (Deepgram, Whisper, Google Speech, etc.).

```bash
node examples/5-stt-integration.js
```

---

## Example Progression

**Recommended learning path:**

1. Start with `1-basic-usage.js` to understand the event-based API
2. Explore `2-stream-api.js` for stream-based processing
3. Review `4-finding-apps.js` to learn app discovery
4. Use `3-advanced-config.js` when you need optimization

## Common Patterns

### Capture audio for 5 seconds and save to WAV
```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const fs = require('fs');

const capture = new AudioCapture();
const chunks = [];

capture.on('audio', (sample) => {
  chunks.push(sample.data);
});

capture.on('stop', () => {
  const combined = Buffer.concat(chunks);
  const wav = AudioCapture.writeWav(combined, {
    sampleRate: 48000,
    channels: 2,
    format: 'float32'
  });
  fs.writeFileSync('output.wav', wav);
});

capture.startCapture('Spotify', { minVolume: 0.01 });
setTimeout(() => capture.stopCapture(), 5000);
```

### Stream audio with custom processing
```javascript
const AudioCapture = require('screencapturekit-audio-capture');
const { Transform } = require('stream');

const capture = new AudioCapture();

const processor = new Transform({
  objectMode: true,
  transform(sample, encoding, callback) {
    // Process sample
    console.log(`RMS: ${sample.rms}`);
    this.push(sample);
    callback();
  }
});

capture.createAudioStream('Spotify', { objectMode: true })
  .pipe(processor);
```

### Efficient configuration (minimize bandwidth)
```javascript
capture.startCapture('Spotify', {
  channels: 1,       // Mono: -50% data
  format: 'int16',   // Int16: -50% data
  bufferSize: 4096,  // Larger buffer: lower CPU
  minVolume: 0.01    // Filter silence
});
// Result: 75% less data than default
```

## Tips

- **Change the app name**: All examples use `'Spotify'` by default. Change this to any running app on your system.
- **Volume threshold**: Use `minVolume: 0.01` to filter out silence and save CPU.
- **Check available apps**: Run `4-finding-apps.js` to see what's available on your system.
- **Permissions**: Ensure Screen Recording permission is granted in System Preferences → Privacy & Security.

## Testing Examples

To test if examples work with your system:

```bash
# First, check what apps are available
node examples/4-finding-apps.js

# Then try basic capture
node examples/1-basic-usage.js

# Play some audio in the target app (e.g., Spotify)
```

## Need Help?

- Check the main README for API documentation
- Review `TEST-REPORT.md` for implementation details
- See `test-suite.js` for comprehensive testing examples
