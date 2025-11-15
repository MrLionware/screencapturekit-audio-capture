#ifndef SCREENCAPTUREKIT_WRAPPER_H
#define SCREENCAPTUREKIT_WRAPPER_H

#include <string>
#include <vector>
#include <functional>

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

class ScreenCaptureKitWrapper {
public:
    ScreenCaptureKitWrapper();
    ~ScreenCaptureKitWrapper();

    // Get list of running applications
    std::vector<AppInfo> getAvailableApps();

    // Start capturing audio from a specific app
    bool startCapture(int processId, std::function<void(const AudioSample&)> callback);

    // Stop capturing
    void stopCapture();

    // Check if currently capturing
    bool isCapturing() const;

private:
    void* impl; // Opaque pointer to Objective-C implementation
};

} // namespace screencapturekit

#endif // SCREENCAPTUREKIT_WRAPPER_H
