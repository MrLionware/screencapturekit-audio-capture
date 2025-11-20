#ifndef SCREENCAPTUREKIT_WRAPPER_H
#define SCREENCAPTUREKIT_WRAPPER_H

#include <string>
#include <vector>
#include <functional>
#include <cstdint>

namespace screencapturekit {

struct AudioSample {
    std::vector<float> data;
    int sampleRate;
    int channelCount;
    double timestamp;
};

struct AppInfo {
    int processId;
    std::string bundleIdentifier;
    std::string applicationName;
};

struct Rect {
    double x;
    double y;
    double width;
    double height;
};

struct WindowInfo {
    uint64_t windowId;
    Rect frame;
    int layer;
    bool onScreen;
    bool active;
    std::string title;
    int owningProcessId;
    std::string owningApplicationName;
    std::string owningBundleIdentifier;
};

struct DisplayInfo {
    uint32_t displayId;
    Rect frame;
    int width;
    int height;
    bool isMainDisplay;
};

struct CaptureConfig {
    int sampleRate;          // Sample rate in Hz (e.g., 44100, 48000)
    int channels;            // Number of channels (1 = mono, 2 = stereo)
    int bufferSize;          // Buffer size for audio processing (0 = system default)
    bool excludeCursor;      // Exclude cursor from capture (for future video features)

    // Constructor with defaults
    CaptureConfig()
        : sampleRate(48000)
        , channels(2)
        , bufferSize(0)
        , excludeCursor(true) {}
};

class ScreenCaptureKitWrapper {
public:
    ScreenCaptureKitWrapper();
    ~ScreenCaptureKitWrapper();

    // Get list of running applications
    std::vector<AppInfo> getAvailableApps();

    // Get list of capturable windows
    std::vector<WindowInfo> getAvailableWindows();

    // Get list of displays
    std::vector<DisplayInfo> getAvailableDisplays();

    // Start capturing audio from a specific app
    bool startCapture(int processId, const CaptureConfig& config, std::function<void(const AudioSample&)> callback);

    // Start capturing audio from a specific window
    bool startCaptureForWindow(uint64_t windowId, const CaptureConfig& config, std::function<void(const AudioSample&)> callback);

    // Start capturing audio from a display
    bool startCaptureForDisplay(uint32_t displayId, const CaptureConfig& config, std::function<void(const AudioSample&)> callback);

    // Stop capturing
    void stopCapture();

    // Check if currently capturing
    bool isCapturing() const;

private:
    void* impl; // Opaque pointer to Objective-C implementation
};

} // namespace screencapturekit

#endif // SCREENCAPTUREKIT_WRAPPER_H
