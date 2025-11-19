# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-11-15

  ### Fixed
  - Fixed binding.gyp to properly resolve node-addon-api includes
  - Added comprehensive error handling to prevent uncaught N-API exceptions
  - Package now builds correctly when installed from npm

## [1.0.1] - 2025-11-15

  ### Fixed
  - Fixed binding.gyp to properly resolve node-addon-api includes when installed as npm package
  - Package now builds correctly when installed from npm

## [1.0.0] - 2025-11-15

### Added
- Initial release
- Native Node.js addon using N-API
- ScreenCaptureKit integration for per-app audio capture
- Event-driven high-level API
- TypeScript definitions included
- Real-time audio streaming (48kHz, stereo, Float32 PCM)
- Built-in audio analysis (RMS, peak, dB calculations)
- Support for macOS 13.0 (Ventura) and later
- Comprehensive documentation and examples
- Memory-safe implementation with proper cleanup
- Thread-safe audio callbacks

### Features
- `AudioCapture` class with event-based API
- `getApplications()` - List all capturable apps
- `findApplication()` - Find app by name or bundle ID
- `startCapture()` - Begin audio capture
- `stopCapture()` - End capture session
- `isCapturing()` - Check capture status
- Static utility methods for audio analysis

### Technical
- Objective-C++ wrapper around ScreenCaptureKit
- N-API bindings for Node.js compatibility
- Automatic Reference Counting (ARC) for memory management
- ThreadSafeFunction for cross-thread callbacks
- Support for both Float32 and Int16 audio formats
- Comprehensive error handling

## [1.1.0] - 2025-11-16

### Added
- **New Helper Methods:**
  - `findByName(name)` - Case-insensitive app search by name
  - `getAudioApps()` - Filter apps likely to have audio (excludes system apps)
  - `AudioCapture.bufferToFloat32Array(buffer)` - Static helper for Buffer conversion

- **Volume Threshold Feature:**
  - `minVolume` option in `startCapture()` to filter silent audio
  - Only emit audio events when RMS volume exceeds threshold
  - Useful for detecting when audio playback starts/stops

- **Audio Format Options:**
  - `format` option in `startCapture()` to specify output format
  - Support for 'float32' (default) and 'int16' formats
  - Automatic conversion to Int16 when requested

- **New Example Files:**
  - `volume-threshold-example.js` - Demonstrates minVolume filtering
  - `int16-format-example.js` - Shows Int16 conversion and file saving
  - `buffer-conversion-example.js` - Buffer-to-Float32Array helper usage
  - `find-apps-example.js` - App discovery and filtering methods

### Improved
- **Error Messages:**
  - Detailed permission errors with System Preferences path
  - App not found errors now show list of available apps
  - Process ID validation with helpful error messages

- **Documentation:**
  - Comprehensive README update with accurate examples
  - New "Working with Audio Data" section
  - New "Common Issues" troubleshooting section
  - Updated API reference with all new methods and options
  - Fixed Quick Start to show correct property names

- **TypeScript Definitions:**
  - Added `CaptureOptions` interface
  - Updated `EnhancedAudioSample` with format field
  - Added signatures for all new methods

### Fixed
- Sample property access examples now match actual API
- Buffer conversion examples now use proper syntax

## [1.1.1] - 2025-11-17

### Fixed
- **Critical:** Fixed `sampleCount` calculation - was returning buffer bytes instead of actual sample count
- **Critical:** Fixed `durationMs` calculation to be accurate based on actual sample frames
- Fixed `isCapturing()` state synchronization - now uses internal state to prevent race conditions

### Added
- `framesCount` property to audio samples (number of frames/samples per channel)
- `AudioCaptureError` class with machine-readable error codes
- `ErrorCodes` constant for programmatic error handling:
  - `ERR_PERMISSION_DENIED` - Screen Recording permission not granted
  - `ERR_APP_NOT_FOUND` - Requested application not found
  - `ERR_INVALID_ARGUMENT` - Invalid argument provided
  - `ERR_ALREADY_CAPTURING` - Already capturing from another app
  - `ERR_CAPTURE_FAILED` - Native capture failed to start
  - `ERR_PROCESS_NOT_FOUND` - Process ID not found
- Error `details` property with actionable suggestions and context
- `includeSystemApps` option for `getAudioApps()` method
- Helpful hint when `getAudioApps()` returns empty array

### Improved
- Error messages now include machine-readable codes for UI localization
- Error details include available apps, suggestions, and context
- Better error handling for edge cases

## [1.1.2] - 2025-11-17

### Fixed - CRITICAL
- **SECURITY:** Fixed buffer overflow in native code AudioBufferList allocation
  - Was hard-coded to allocate only 2 buffers but could receive more
  - Now dynamically allocates based on format flags and channel count
  - Added safety cap at 16 channels to prevent excessive allocation
  - Prevents potential crashes and memory corruption with multi-channel audio

- **CRITICAL:** Fixed planar vs interleaved audio handling in native code
  - Now correctly detects format using `kAudioFormatFlagIsNonInterleaved` flag
  - Properly interleaves planar audio (separate buffers per channel)
  - Correctly handles interleaved audio (all channels in one buffer)
  - Fixes crashes with certain audio formats and devices

- Fixed format field reporting to reflect actual buffer format
  - Was showing requested format instead of actual format after conversion
  - Now accurately reports 'float32' or 'int16' based on actual data

### Improved
- Added validation warning if received buffers exceed expected count
- Better handling of Float32 and Int16 formats in both planar and interleaved modes
- More robust audio processing that works with various audio configurations

## [1.2.0] - 2025-11-18

### Added - Stream API
- **Stream-Based API:** New `createAudioStream()` method for Node.js Readable stream support
  - `AudioStream` class extending Node.js Readable
  - Object mode support for streaming sample objects with metadata
  - Normal mode for streaming raw audio buffers
  - Proper backpressure handling
  - Compatible with `pipeline()` and standard stream utilities
  - `stop()` method for graceful stream termination

### Added - Advanced Configuration
- **Native Configuration Support:** Configure audio capture at the native layer
  - `sampleRate` option (requested rate, system-dependent)
  - `channels` option (1 = mono, 2 = stereo)
  - `bufferSize` option for latency control (frames)
  - `excludeCursor` option (reserved for future video features)
- **Configuration passed to ScreenCaptureKit:** Direct control over capture parameters

### Added - Examples Reorganization
- **New Numbered Examples:**
  - `1-basic-usage.js` - Event-based API with WAV export
  - `2-stream-api.js` - Stream API with 4 different scenarios
  - `3-advanced-config.js` - Configuration presets and custom settings
  - `4-finding-apps.js` - App discovery and filtering
- **Enhanced Examples README:** Detailed walkthrough of each example
- **Removed Legacy Examples:** Consolidated old examples into new numbered format

### Added - Testing Infrastructure
- **Split Test Commands:**
  - `npm test` - Mock tests using Node.js test runner (requires Node 18+)
  - `npm run test:integration` - Real capture tests (macOS only)
- **Test Directory:** Added `tests/` with example validation

### Added - Documentation
- **Comprehensive README Update:** 478 lines of new content
  - Module exports reference with all available exports
  - Build requirements section (Xcode, frameworks, SDK)
  - Package contents explanation
  - Version recommendations with security notices
  - Low-level ScreenCaptureKit API documentation
  - Native layer implementation details
  - Enhanced error handling examples with ErrorCodes
  - Debugging & troubleshooting guide
  - Migration guides (v1.0.x → v1.1.x, v1.1.1 → v1.1.2)
  - Performance benchmarks table
  - Platform support compatibility matrix
  - Stream API best practices and troubleshooting

### Added - TypeScript
- **Stream API Types:**
  - `AudioStream` class definition
  - `StreamOptions` interface extending `CaptureOptions`
  - `objectMode` property for stream configuration
- **Enhanced CaptureOptions:**
  - `sampleRate`, `channels`, `bufferSize`, `excludeCursor` properties
  - Detailed JSDoc comments explaining each option
- **New Static Method Types:**
  - `writeWav()` method signature

### Improved
- **API Consistency:** Configuration now passed to native layer instead of JS-only processing
- **Documentation Quality:** 100% API coverage with architecture transparency
- **Developer Experience:** Better examples, debugging tools, migration guides

### Technical
- Native layer now accepts `CaptureConfig` struct
- Stream implementation uses proper Node.js Readable patterns
- Configuration validation and defaults in both JS and native layers

## [Unreleased]

### Planned
- Multiple simultaneous captures
- Stream recording to file
- WebSocket streaming support
- Audio effects/filters
