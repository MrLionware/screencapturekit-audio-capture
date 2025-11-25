#include <napi.h>
#include "screencapturekit_wrapper.h"
#include <memory>
#include <map>

using namespace screencapturekit;

namespace {

Napi::Object RectToJSObject(Napi::Env env, const Rect& rect) {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("x", Napi::Number::New(env, rect.x));
    obj.Set("y", Napi::Number::New(env, rect.y));
    obj.Set("width", Napi::Number::New(env, rect.width));
    obj.Set("height", Napi::Number::New(env, rect.height));
    return obj;
}

}

// Class to wrap the ScreenCaptureKit functionality
class ScreenCaptureAddon : public Napi::ObjectWrap<ScreenCaptureAddon> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    ScreenCaptureAddon(const Napi::CallbackInfo& info);
    ~ScreenCaptureAddon();

private:
    static Napi::FunctionReference constructor;

    void ReleaseTSFN();

    Napi::Value GetAvailableApps(const Napi::CallbackInfo& info);
    Napi::Value GetAvailableWindows(const Napi::CallbackInfo& info);
    Napi::Value GetAvailableDisplays(const Napi::CallbackInfo& info);
    Napi::Value StartCapture(const Napi::CallbackInfo& info);
    Napi::Value StartCaptureMultiApp(const Napi::CallbackInfo& info);
    Napi::Value StartCaptureForWindow(const Napi::CallbackInfo& info);
    Napi::Value StartCaptureMultiWindow(const Napi::CallbackInfo& info);
    Napi::Value StartCaptureForDisplay(const Napi::CallbackInfo& info);
    Napi::Value StartCaptureMultiDisplay(const Napi::CallbackInfo& info);
    Napi::Value StopCapture(const Napi::CallbackInfo& info);
    Napi::Value IsCapturing(const Napi::CallbackInfo& info);

    using NativeStartFunction = std::function<bool(const CaptureConfig&, const std::function<void(const AudioSample&)>&)>;
    Napi::Value StartCaptureWithConfig(const Napi::CallbackInfo& info, const NativeStartFunction& starter);
    static CaptureConfig ParseCaptureConfig(Napi::Env env, const Napi::Object& configObj);

    std::unique_ptr<ScreenCaptureKitWrapper> wrapper_;
    Napi::ThreadSafeFunction tsfn_;
};

Napi::FunctionReference ScreenCaptureAddon::constructor;

Napi::Object ScreenCaptureAddon::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "ScreenCaptureKit", {
        InstanceMethod("getAvailableApps", &ScreenCaptureAddon::GetAvailableApps),
        InstanceMethod("getAvailableWindows", &ScreenCaptureAddon::GetAvailableWindows),
        InstanceMethod("getAvailableDisplays", &ScreenCaptureAddon::GetAvailableDisplays),
        InstanceMethod("startCapture", &ScreenCaptureAddon::StartCapture),
        InstanceMethod("startCaptureMultiApp", &ScreenCaptureAddon::StartCaptureMultiApp),
        InstanceMethod("startCaptureForWindow", &ScreenCaptureAddon::StartCaptureForWindow),
        InstanceMethod("startCaptureMultiWindow", &ScreenCaptureAddon::StartCaptureMultiWindow),
        InstanceMethod("startCaptureForDisplay", &ScreenCaptureAddon::StartCaptureForDisplay),
        InstanceMethod("startCaptureMultiDisplay", &ScreenCaptureAddon::StartCaptureMultiDisplay),
        InstanceMethod("stopCapture", &ScreenCaptureAddon::StopCapture),
        InstanceMethod("isCapturing", &ScreenCaptureAddon::IsCapturing),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("ScreenCaptureKit", func);
    return exports;
}

ScreenCaptureAddon::ScreenCaptureAddon(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ScreenCaptureAddon>(info) {
    wrapper_ = std::make_unique<ScreenCaptureKitWrapper>();
}

void ScreenCaptureAddon::ReleaseTSFN() {
    if (tsfn_) {
        tsfn_.Release();
        tsfn_ = Napi::ThreadSafeFunction(); // Reset to avoid double-release on teardown
    }
}

ScreenCaptureAddon::~ScreenCaptureAddon() {
    if (wrapper_) {
        wrapper_->stopCapture();
    }

    ReleaseTSFN();
}

Napi::Value ScreenCaptureAddon::GetAvailableApps(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        Napi::TypeError::New(env, "Wrapper not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<AppInfo> apps = wrapper_->getAvailableApps();

    Napi::Array result = Napi::Array::New(env, apps.size());

    for (size_t i = 0; i < apps.size(); i++) {
        Napi::Object appObj = Napi::Object::New(env);
        appObj.Set("processId", Napi::Number::New(env, apps[i].processId));
        appObj.Set("bundleIdentifier", Napi::String::New(env, apps[i].bundleIdentifier));
        appObj.Set("applicationName", Napi::String::New(env, apps[i].applicationName));
        result[i] = appObj;
    }

    return result;
}

Napi::Value ScreenCaptureAddon::GetAvailableWindows(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        Napi::Error::New(env, "Wrapper not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<WindowInfo> windows = wrapper_->getAvailableWindows();
    Napi::Array result = Napi::Array::New(env, windows.size());

    for (size_t i = 0; i < windows.size(); i++) {
        const WindowInfo& window = windows[i];
        Napi::Object windowObj = Napi::Object::New(env);
        windowObj.Set("windowId", Napi::Number::New(env, static_cast<double>(window.windowId)));
        windowObj.Set("layer", Napi::Number::New(env, window.layer));
        windowObj.Set("frame", RectToJSObject(env, window.frame));
        windowObj.Set("onScreen", Napi::Boolean::New(env, window.onScreen));
        windowObj.Set("active", Napi::Boolean::New(env, window.active));
        windowObj.Set("title", Napi::String::New(env, window.title));
        windowObj.Set("owningProcessId", Napi::Number::New(env, window.owningProcessId));
        windowObj.Set("owningApplicationName", Napi::String::New(env, window.owningApplicationName));
        windowObj.Set("owningBundleIdentifier", Napi::String::New(env, window.owningBundleIdentifier));
        result[i] = windowObj;
    }

    return result;
}

Napi::Value ScreenCaptureAddon::GetAvailableDisplays(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        Napi::Error::New(env, "Wrapper not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<DisplayInfo> displays = wrapper_->getAvailableDisplays();
    Napi::Array result = Napi::Array::New(env, displays.size());

    for (size_t i = 0; i < displays.size(); i++) {
        const DisplayInfo& display = displays[i];
        Napi::Object displayObj = Napi::Object::New(env);
        displayObj.Set("displayId", Napi::Number::New(env, display.displayId));
        displayObj.Set("frame", RectToJSObject(env, display.frame));
        displayObj.Set("width", Napi::Number::New(env, display.width));
        displayObj.Set("height", Napi::Number::New(env, display.height));
        displayObj.Set("isMainDisplay", Napi::Boolean::New(env, display.isMainDisplay));
        result[i] = displayObj;
    }

    return result;
}

CaptureConfig ScreenCaptureAddon::ParseCaptureConfig(Napi::Env env, const Napi::Object& configObj) {
    CaptureConfig config;

    if (configObj.Has("sampleRate")) {
        Napi::Value val = configObj.Get("sampleRate");
        if (val.IsNumber()) {
            config.sampleRate = val.As<Napi::Number>().Int32Value();
        }
    }
    if (configObj.Has("channels")) {
        Napi::Value val = configObj.Get("channels");
        if (val.IsNumber()) {
            config.channels = val.As<Napi::Number>().Int32Value();
        }
    }
    if (configObj.Has("bufferSize")) {
        Napi::Value bufferSizeVal = configObj.Get("bufferSize");
        if (!bufferSizeVal.IsUndefined() && bufferSizeVal.IsNumber()) {
            config.bufferSize = bufferSizeVal.As<Napi::Number>().Int32Value();
        }
    }
    if (configObj.Has("excludeCursor")) {
        Napi::Value val = configObj.Get("excludeCursor");
        if (val.IsBoolean()) {
            config.excludeCursor = val.As<Napi::Boolean>().Value();
        }
    }

    return config;
}

Napi::Value ScreenCaptureAddon::StartCaptureWithConfig(const Napi::CallbackInfo& info, const NativeStartFunction& starter) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        Napi::Error::New(env, "Wrapper not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: targetId, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[1].IsObject()) {
        Napi::TypeError::New(env, "Second argument must be an object (config)").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[2].IsFunction()) {
        Napi::TypeError::New(env, "Third argument must be a function (callback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object configObj = info[1].As<Napi::Object>();
    CaptureConfig config = ParseCaptureConfig(env, configObj);
    Napi::Function callback = info[2].As<Napi::Function>();

    ReleaseTSFN();

    tsfn_ = Napi::ThreadSafeFunction::New(
        env,
        callback,
        "AudioCallback",
        0,
        1,
        [](Napi::Env) {}
    );

    auto nativeCallback = [this](const AudioSample& sample) {
        auto callback = [sample](Napi::Env env, Napi::Function jsCallback) {
            Napi::HandleScope scope(env);

            try {
                Napi::Object sampleObj = Napi::Object::New(env);

                Napi::Buffer<float> buffer = Napi::Buffer<float>::Copy(
                    env,
                    sample.data.data(),
                    sample.data.size()
                );

                sampleObj.Set("data", buffer);
                sampleObj.Set("sampleRate", Napi::Number::New(env, sample.sampleRate));
                sampleObj.Set("channelCount", Napi::Number::New(env, sample.channelCount));
                sampleObj.Set("timestamp", Napi::Number::New(env, sample.timestamp));

                jsCallback.Call({sampleObj});

                if (env.IsExceptionPending()) {
                    Napi::Error error = env.GetAndClearPendingException();
                    fprintf(stderr, "Error in audio callback: %s\n", error.Message().c_str());
                }
            } catch (const Napi::Error& e) {
                fprintf(stderr, "N-API Error in audio callback: %s\n", e.Message().c_str());
            } catch (const std::exception& e) {
                fprintf(stderr, "C++ Exception in audio callback: %s\n", e.what());
            } catch (...) {
                fprintf(stderr, "Unknown exception in audio callback\n");
            }
        };

        if (tsfn_) {
            tsfn_.BlockingCall(callback);
        }
    };

    bool success = starter(config, nativeCallback);
    return Napi::Boolean::New(env, success);
}


Napi::Value ScreenCaptureAddon::StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: processId, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsNumber()) {
        Napi::TypeError::New(env, "First argument must be a number (processId)").ThrowAsJavaScriptException();
        return env.Null();
    }

    int processId = info[0].As<Napi::Number>().Int32Value();
    auto starter = [this, processId](const CaptureConfig& config, const std::function<void(const AudioSample&)>& cb) {
        return wrapper_->startCapture(processId, config, cb);
    };

    return StartCaptureWithConfig(info, starter);
}

Napi::Value ScreenCaptureAddon::StartCaptureMultiApp(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: processIds array, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsArray()) {
        Napi::TypeError::New(env, "First argument must be an array of process IDs").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array processIdsArray = info[0].As<Napi::Array>();
    std::vector<int> processIds;
    processIds.reserve(processIdsArray.Length());

    for (uint32_t i = 0; i < processIdsArray.Length(); i++) {
        Napi::Value val = processIdsArray.Get(i);
        if (!val.IsNumber()) {
            Napi::TypeError::New(env, "All elements in processIds array must be numbers").ThrowAsJavaScriptException();
            return env.Null();
        }
        processIds.push_back(val.As<Napi::Number>().Int32Value());
    }

    if (processIds.empty()) {
        Napi::TypeError::New(env, "processIds array must not be empty").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto starter = [this, processIds](const CaptureConfig& config, const std::function<void(const AudioSample&)>& cb) {
        return wrapper_->startCaptureMultiApp(processIds, config, cb);
    };

    return StartCaptureWithConfig(info, starter);
}

Napi::Value ScreenCaptureAddon::StartCaptureForWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: windowId, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsNumber()) {
        Napi::TypeError::New(env, "First argument must be a number (windowId)").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint64_t windowId = static_cast<uint64_t>(info[0].As<Napi::Number>().Int64Value());
    auto starter = [this, windowId](const CaptureConfig& config, const std::function<void(const AudioSample&)>& cb) {
        return wrapper_->startCaptureForWindow(windowId, config, cb);
    };

    return StartCaptureWithConfig(info, starter);
}

Napi::Value ScreenCaptureAddon::StartCaptureMultiWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: windowIds array, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsArray()) {
        Napi::TypeError::New(env, "First argument must be an array of window IDs").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array windowIdsArray = info[0].As<Napi::Array>();
    std::vector<uint64_t> windowIds;
    windowIds.reserve(windowIdsArray.Length());

    for (uint32_t i = 0; i < windowIdsArray.Length(); i++) {
        Napi::Value val = windowIdsArray.Get(i);
        if (!val.IsNumber()) {
            Napi::TypeError::New(env, "All elements in windowIds array must be numbers").ThrowAsJavaScriptException();
            return env.Null();
        }
        windowIds.push_back(static_cast<uint64_t>(val.As<Napi::Number>().Int64Value()));
    }

    if (windowIds.empty()) {
        Napi::TypeError::New(env, "windowIds array must not be empty").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto starter = [this, windowIds](const CaptureConfig& config, const std::function<void(const AudioSample&)>& cb) {
        return wrapper_->startCaptureMultiWindow(windowIds, config, cb);
    };

    return StartCaptureWithConfig(info, starter);
}

Napi::Value ScreenCaptureAddon::StartCaptureForDisplay(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: displayId, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsNumber()) {
        Napi::TypeError::New(env, "First argument must be a number (displayId)").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint32_t displayId = info[0].As<Napi::Number>().Uint32Value();
    auto starter = [this, displayId](const CaptureConfig& config, const std::function<void(const AudioSample&)>& cb) {
        return wrapper_->startCaptureForDisplay(displayId, config, cb);
    };

    return StartCaptureWithConfig(info, starter);
}

Napi::Value ScreenCaptureAddon::StartCaptureMultiDisplay(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: displayIds array, config, and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsArray()) {
        Napi::TypeError::New(env, "First argument must be an array of display IDs").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array displayIdsArray = info[0].As<Napi::Array>();
    std::vector<uint32_t> displayIds;
    displayIds.reserve(displayIdsArray.Length());

    for (uint32_t i = 0; i < displayIdsArray.Length(); i++) {
        Napi::Value val = displayIdsArray.Get(i);
        if (!val.IsNumber()) {
            Napi::TypeError::New(env, "All elements in displayIds array must be numbers").ThrowAsJavaScriptException();
            return env.Null();
        }
        displayIds.push_back(val.As<Napi::Number>().Uint32Value());
    }

    if (displayIds.empty()) {
        Napi::TypeError::New(env, "displayIds array must not be empty").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto starter = [this, displayIds](const CaptureConfig& config, const std::function<void(const AudioSample&)>& cb) {
        return wrapper_->startCaptureMultiDisplay(displayIds, config, cb);
    };

    return StartCaptureWithConfig(info, starter);
}

Napi::Value ScreenCaptureAddon::StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        Napi::TypeError::New(env, "Wrapper not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    wrapper_->stopCapture();

    ReleaseTSFN();

    return env.Undefined();
}

Napi::Value ScreenCaptureAddon::IsCapturing(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        return Napi::Boolean::New(env, false);
    }

    return Napi::Boolean::New(env, wrapper_->isCapturing());
}

// Initialize the addon
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return ScreenCaptureAddon::Init(env, exports);
}

NODE_API_MODULE(screencapturekit_addon, Init)
