# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Planned
- Multiple simultaneous captures
- Audio format conversion options
- Stream recording to file
- WebSocket streaming support
- Audio effects/filters
