#include <napi.h>
#include "screencapturekit_wrapper.h"
#include <memory>
#include <map>

using namespace screencapturekit;

// Class to wrap the ScreenCaptureKit functionality
class ScreenCaptureAddon : public Napi::ObjectWrap<ScreenCaptureAddon> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    ScreenCaptureAddon(const Napi::CallbackInfo& info);
    ~ScreenCaptureAddon();

private:
    static Napi::FunctionReference constructor;

    Napi::Value GetAvailableApps(const Napi::CallbackInfo& info);
    Napi::Value StartCapture(const Napi::CallbackInfo& info);
    Napi::Value StopCapture(const Napi::CallbackInfo& info);
    Napi::Value IsCapturing(const Napi::CallbackInfo& info);

    std::unique_ptr<ScreenCaptureKitWrapper> wrapper_;
    Napi::ThreadSafeFunction tsfn_;
};

Napi::FunctionReference ScreenCaptureAddon::constructor;

Napi::Object ScreenCaptureAddon::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "ScreenCaptureKit", {
        InstanceMethod("getAvailableApps", &ScreenCaptureAddon::GetAvailableApps),
        InstanceMethod("startCapture", &ScreenCaptureAddon::StartCapture),
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
    Napi::Env env = info.Env();

    wrapper_ = std::make_unique<ScreenCaptureKitWrapper>();
}

ScreenCaptureAddon::~ScreenCaptureAddon() {
    if (wrapper_) {
        wrapper_->stopCapture();
    }

    if (tsfn_) {
        tsfn_.Release();
    }
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

Napi::Value ScreenCaptureAddon::StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: processId and callback").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsNumber()) {
        Napi::TypeError::New(env, "First argument must be a number (processId)").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[1].IsFunction()) {
        Napi::TypeError::New(env, "Second argument must be a function (callback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    int processId = info[0].As<Napi::Number>().Int32Value();
    Napi::Function callback = info[1].As<Napi::Function>();

    // Create thread-safe function for callback
    if (tsfn_) {
        tsfn_.Release();
    }

    tsfn_ = Napi::ThreadSafeFunction::New(
        env,
        callback,
        "AudioCallback",
        0,      // Unlimited queue
        1,      // Only one thread will use this
        [](Napi::Env) {}  // Finalizer
    );

    // Start capture with callback
    bool success = wrapper_->startCapture(processId, [this](const AudioSample& sample) {
        // Call JavaScript callback from worker thread
        auto callback = [sample](Napi::Env env, Napi::Function jsCallback) {
            Napi::Object sampleObj = Napi::Object::New(env);

            // Convert audio data to Buffer
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
        };

        if (tsfn_) {
            tsfn_.BlockingCall(callback);
        }
    });

    return Napi::Boolean::New(env, success);
}

Napi::Value ScreenCaptureAddon::StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!wrapper_) {
        Napi::TypeError::New(env, "Wrapper not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    wrapper_->stopCapture();

    if (tsfn_) {
        tsfn_.Release();
    }

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
