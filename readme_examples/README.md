# Examples

Comprehensive examples demonstrating the ScreenCaptureKit Audio Capture SDK.

## Quick Start

```bash
# Run a single example
npx tsx readme_examples/basics/01-quick-start.ts

# Run with a specific target app
TARGET_APP="Spotify" npx tsx readme_examples/basics/01-quick-start.ts

# Run all examples (interactive)
npx tsx readme_examples/run_all.ts

# Run all examples with specific app
npx tsx readme_examples/run_all.ts "Google Chrome"
```

---

## 📁 basics/

Getting started examples for audio capture fundamentals.

| Example | Description |
|---------|-------------|
| [01-quick-start.ts](basics/01-quick-start.ts) | Basic capture setup, listing apps, receiving audio events |
| [05-robust-capture.ts](basics/05-robust-capture.ts) | Error handling, retry logic, and recovery patterns |
| [11-find-apps.ts](basics/11-find-apps.ts) | Finding applications by name, bundle ID, or process ID |

**Start here** if you're new to the SDK:
```bash
npx tsx readme_examples/basics/01-quick-start.ts
```

---

## 📁 voice/

Speech-to-text integration and voice-controlled applications.

| Example | Description |
|---------|-------------|
| [02-stt-integration.ts](voice/02-stt-integration.ts) | Converting audio for STT services (Whisper, Google, etc.) |
| [03-voice-agent.ts](voice/03-voice-agent.ts) | Building a voice-controlled agent |
| [04-audio-recording.ts](voice/04-audio-recording.ts) | Recording audio to WAV files |

**Key Concepts:**
- `STTConverter` transform stream for format conversion
- Float32 to Int16 conversion for STT compatibility
- Stereo to mono downmixing

---

## 📁 streams/

Stream-based API examples using Node.js streams.

| Example | Description |
|---------|-------------|
| [06-stream-basics.ts](streams/06-stream-basics.ts) | AudioStream fundamentals and event handling |
| [07-stream-processing.ts](streams/07-stream-processing.ts) | Transform streams, piping, and backpressure |

**Key Concepts:**
- `AudioStream` extends Node.js Readable stream
- Object mode vs buffer mode
- Piping to transform streams and writable destinations

---

## 📁 processing/

Audio analysis and format conversion examples.

| Example | Description |
|---------|-------------|
| [08-visualizer.ts](processing/08-visualizer.ts) | Real-time audio visualization (RMS, peak levels) |
| [09-volume-monitor.ts](processing/09-volume-monitor.ts) | Volume level monitoring and thresholds |
| [10-int16-capture.ts](processing/10-int16-capture.ts) | Capturing in Int16 format |
| [12-manual-processing.ts](processing/12-manual-processing.ts) | Manual sample processing and analysis |

**Key Concepts:**
- RMS and peak level calculation
- dB conversion utilities (`rmsToDb`, `peakToDb`, `calculateDb`)
- Float32 to Int16 format conversion
- Sample rate and channel handling

---

## 📁 capture-targets/

Capturing audio from different sources (apps, windows, displays).

| Example | Description |
|---------|-------------|
| [13-multi-app-capture.ts](capture-targets/13-multi-app-capture.ts) | Capture from multiple applications simultaneously |
| [14-per-app-streams.ts](capture-targets/14-per-app-streams.ts) | Separate audio streams for each application |
| [15-window-capture.ts](capture-targets/15-window-capture.ts) | Capture from specific windows |
| [16-display-capture.ts](capture-targets/16-display-capture.ts) | Capture from displays (all audio on screen) |
| [17-multi-window-capture.ts](capture-targets/17-multi-window-capture.ts) | Multiple window capture |
| [18-multi-display-capture.ts](capture-targets/18-multi-display-capture.ts) | Multiple display capture |

**Capture Target Types:**

| Type | Method | Use Case |
|------|--------|----------|
| Application | `startCapture()` | Single app audio |
| Multi-App | `captureMultipleApps()` | Game + Discord |
| Window | `captureWindow()` | Specific window |
| Display | `captureDisplay()` | All screen audio |

---

## 📁 advanced/

Advanced SDK features and architecture patterns.

| Example | Description |
|---------|-------------|
| [19-advanced-methods.ts](advanced/19-advanced-methods.ts) | Activity tracking, static utilities, detailed APIs |
| [20-capture-service.ts](advanced/20-capture-service.ts) | WebSocket client/server for distributed capture |
| [21-graceful-cleanup.ts](advanced/21-graceful-cleanup.ts) | Resource lifecycle, disposal, and cleanup |

**Key Concepts:**

| Feature | Description |
|---------|-------------|
| Activity Tracking | Track which apps are producing audio for smart filtering |
| Capture Service | Work around macOS single-process capture limitation |
| Graceful Cleanup | `dispose()`, `cleanupAll()`, automatic SIGINT/SIGTERM handling |

---

## Difficulty Progression

| Level | Examples |
|-------|----------|
| **Beginner** | `basics/01-quick-start.ts` → `basics/11-find-apps.ts` → `streams/06-stream-basics.ts` |
| **Intermediate** | `processing/09-volume-monitor.ts` → `voice/02-stt-integration.ts` → `basics/05-robust-capture.ts` |
| **Advanced** | `capture-targets/13-multi-app-capture.ts` → `advanced/20-capture-service.ts` → `advanced/21-graceful-cleanup.ts` |

---

## Test Logs

Test logs are stored in `.test-logs/` when running `run_all.ts`.
