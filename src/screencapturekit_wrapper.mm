#import "screencapturekit_wrapper.h"
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#include <thread>
#include <mutex>

// Objective-C delegate to handle audio samples
@interface AudioCaptureDelegate : NSObject <SCStreamOutput, SCStreamDelegate>
@property (nonatomic, copy) void(^audioCallback)(CMSampleBufferRef);
@end

@implementation AudioCaptureDelegate

- (void)stream:(SCStream *)stream didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer ofType:(SCStreamOutputType)type {
    if (type == SCStreamOutputTypeAudio && self.audioCallback) {
        self.audioCallback(sampleBuffer);
    }
}

- (void)stream:(SCStream *)stream didStopWithError:(NSError *)error {
    if (error) {
        NSLog(@"Stream stopped with error: %@", error.localizedDescription);
    }
}

@end

// Implementation class
@interface ScreenCaptureKitImpl : NSObject
@property (nonatomic, strong) SCStream *stream;
@property (nonatomic, strong) AudioCaptureDelegate *delegate;
@property (nonatomic, strong) SCContentFilter *contentFilter;
@property (nonatomic, assign) BOOL isCapturing;
@end

@implementation ScreenCaptureKitImpl

- (instancetype)init {
    self = [super init];
    if (self) {
        _isCapturing = NO;
    }
    return self;
}

- (void)dealloc {
    [self stopCapture];
}

- (void)stopCapture {
    if (self.stream && self.isCapturing) {
        [self.stream stopCaptureWithCompletionHandler:^(NSError * _Nullable error) {
            if (error) {
                NSLog(@"Error stopping capture: %@", error.localizedDescription);
            }
        }];
        self.isCapturing = NO;
        self.stream = nil;
        self.delegate = nil;
    }
}

@end

namespace screencapturekit {

// Private implementation structure
struct WrapperImpl {
    ScreenCaptureKitImpl *objcImpl;
    std::function<void(const AudioSample&)> callback;
    std::mutex mutex;
};

namespace {

Rect RectFromCGRect(CGRect rect) {
    Rect result;
    result.x = rect.origin.x;
    result.y = rect.origin.y;
    result.width = rect.size.width;
    result.height = rect.size.height;
    return result;
}

void HandleSampleBuffer(CMSampleBufferRef sampleBuffer, WrapperImpl *wrapper) {
    if (!wrapper || !wrapper->callback) {
        return;
    }

    @try {
        // Get format description first
        CMFormatDescriptionRef formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer);
        if (!formatDescription) {
            NSLog(@"No format description available");
            return;
        }

        const AudioStreamBasicDescription *asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription);
        if (!asbd) {
            NSLog(@"No audio stream basic description available");
            return;
        }

        AudioSample sample;
        sample.sampleRate = (int)asbd->mSampleRate;
        sample.channelCount = (int)asbd->mChannelsPerFrame;
        sample.timestamp = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer));

        UInt32 expectedBuffers = (asbd->mFormatFlags & kAudioFormatFlagIsNonInterleaved)
            ? asbd->mChannelsPerFrame
            : 1;

        if (expectedBuffers > 16) {
            expectedBuffers = 16;
        }

        size_t audioBufferListSize = offsetof(AudioBufferList, mBuffers[0]) + (sizeof(AudioBuffer) * expectedBuffers);
        AudioBufferList *audioBufferList = (AudioBufferList *)malloc(audioBufferListSize);
        if (!audioBufferList) {
            NSLog(@"Failed to allocate AudioBufferList for %u buffers", (unsigned int)expectedBuffers);
            return;
        }

        CMBlockBufferRef blockBuffer = NULL;
        OSStatus status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            NULL,
            audioBufferList,
            audioBufferListSize,
            NULL,
            NULL,
            0,
            &blockBuffer
        );

        if (status != noErr) {
            NSLog(@"Failed to get audio buffer list: %d", (int)status);
            free(audioBufferList);
            return;
        }

        if (audioBufferList->mNumberBuffers > expectedBuffers) {
            NSLog(@"Warning: AudioBufferList has %u buffers but we allocated for %u. Data may be truncated.",
                  (unsigned int)audioBufferList->mNumberBuffers, (unsigned int)expectedBuffers);
        }

        bool isPlanar = (asbd->mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0;
        bool isFloat = (asbd->mFormatFlags & kAudioFormatFlagIsFloat) != 0;
        bool isInt = (asbd->mFormatFlags & kAudioFormatFlagIsSignedInteger) != 0;

        if (isPlanar) {
            if (audioBufferList->mNumberBuffers == 0) {
                free(audioBufferList);
                if (blockBuffer) CFRelease(blockBuffer);
                return;
            }

            size_t framesPerBuffer = 0;
            if (isFloat) {
                framesPerBuffer = audioBufferList->mBuffers[0].mDataByteSize / sizeof(float);
            } else if (isInt) {
                framesPerBuffer = audioBufferList->mBuffers[0].mDataByteSize / sizeof(int16_t);
            }

            for (size_t frame = 0; frame < framesPerBuffer; frame++) {
                for (UInt32 channel = 0; channel < audioBufferList->mNumberBuffers && channel < expectedBuffers; channel++) {
                    AudioBuffer audioBuffer = audioBufferList->mBuffers[channel];
                    if (!audioBuffer.mData) continue;

                    if (isFloat) {
                        float *bufferData = (float *)audioBuffer.mData;
                        sample.data.push_back(bufferData[frame]);
                    } else if (isInt) {
                        int16_t *bufferData = (int16_t *)audioBuffer.mData;
                        float normalized = bufferData[frame] / 32768.0f;
                        sample.data.push_back(normalized);
                    }
                }
            }
        } else {
            for (UInt32 i = 0; i < audioBufferList->mNumberBuffers && i < expectedBuffers; i++) {
                AudioBuffer audioBuffer = audioBufferList->mBuffers[i];

                if (!audioBuffer.mData || audioBuffer.mDataByteSize == 0) {
                    continue;
                }

                if (isFloat) {
                    float *bufferData = (float *)audioBuffer.mData;
                    size_t bufferSize = audioBuffer.mDataByteSize / sizeof(float);
                    sample.data.insert(sample.data.end(), bufferData, bufferData + bufferSize);
                } else if (isInt) {
                    int16_t *bufferData = (int16_t *)audioBuffer.mData;
                    size_t bufferSize = audioBuffer.mDataByteSize / sizeof(int16_t);
                    for (size_t j = 0; j < bufferSize; j++) {
                        float normalized = bufferData[j] / 32768.0f;
                        sample.data.push_back(normalized);
                    }
                }
            }
        }

        free(audioBufferList);
        if (blockBuffer) {
            CFRelease(blockBuffer);
        }

        if (sample.data.size() > 0) {
            wrapper->callback(sample);
        }
    } @catch (NSException *exception) {
        NSLog(@"Exception in audio callback: %@", exception);
    }
}

bool StartStreamWithFilter(WrapperImpl *wrapper, SCContentFilter *filter, const CaptureConfig& config) {
    if (!wrapper || !filter) {
        return false;
    }

    wrapper->objcImpl.contentFilter = filter;

    SCStreamConfiguration *streamConfig = [[SCStreamConfiguration alloc] init];
    streamConfig.capturesAudio = YES;
    streamConfig.sampleRate = config.sampleRate;
    streamConfig.channelCount = config.channels;
    streamConfig.excludesCurrentProcessAudio = YES;

    if (config.bufferSize > 0) {
        double bufferDuration = (double)config.bufferSize / (double)config.sampleRate;
        streamConfig.minimumFrameInterval = CMTimeMake((int64_t)(bufferDuration * 1000000), 1000000);
    }

    AudioCaptureDelegate *delegate = [[AudioCaptureDelegate alloc] init];
    delegate.audioCallback = ^(CMSampleBufferRef sampleBuffer) {
        HandleSampleBuffer(sampleBuffer, wrapper);
    };
    wrapper->objcImpl.delegate = delegate;

    NSError *streamError = nil;
    SCStream *stream = [[SCStream alloc] initWithFilter:filter configuration:streamConfig delegate:delegate];

    if (!stream) {
        NSLog(@"Failed to create stream");
        wrapper->objcImpl.contentFilter = nil;
        wrapper->objcImpl.delegate = nil;
        return false;
    }

    [stream addStreamOutput:delegate
                       type:SCStreamOutputTypeAudio
         sampleHandlerQueue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0)
                     error:&streamError];

    if (streamError) {
        NSLog(@"Error adding stream output: %@", streamError.localizedDescription);
        wrapper->objcImpl.contentFilter = nil;
        wrapper->objcImpl.delegate = nil;
        return false;
    }

    __block bool success = false;
    dispatch_semaphore_t startSemaphore = dispatch_semaphore_create(0);

    [stream startCaptureWithCompletionHandler:^(NSError * _Nullable error) {
        if (error) {
            NSLog(@"Error starting capture: %@", error.localizedDescription);
            wrapper->objcImpl.isCapturing = NO;
            wrapper->objcImpl.stream = nil;
            wrapper->objcImpl.delegate = nil;
            wrapper->objcImpl.contentFilter = nil;
            success = false;
        } else {
            wrapper->objcImpl.stream = stream;
            wrapper->objcImpl.isCapturing = YES;
            success = true;
        }
        dispatch_semaphore_signal(startSemaphore);
    }];

    dispatch_semaphore_wait(startSemaphore, DISPATCH_TIME_FOREVER);

    return success;
}

} // namespace

ScreenCaptureKitWrapper::ScreenCaptureKitWrapper() {
    WrapperImpl *wrapper = new WrapperImpl();
    wrapper->objcImpl = [[ScreenCaptureKitImpl alloc] init];
    impl = wrapper;
}

ScreenCaptureKitWrapper::~ScreenCaptureKitWrapper() {
    if (impl) {
        WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
        [wrapper->objcImpl stopCapture];
        delete wrapper;
        impl = nullptr;
    }
}

std::vector<AppInfo> ScreenCaptureKitWrapper::getAvailableApps() {
    __block std::vector<AppInfo> apps;

    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
        } else if (content) {
            for (SCRunningApplication *app in content.applications) {
                if (app.applicationName && app.bundleIdentifier) {
                    AppInfo info;
                    info.processId = app.processID;
                    info.bundleIdentifier = std::string([app.bundleIdentifier UTF8String]);
                    info.applicationName = std::string([app.applicationName UTF8String]);
                    apps.push_back(info);
                }
            }
        }
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);

    return apps;
}

std::vector<WindowInfo> ScreenCaptureKitWrapper::getAvailableWindows() {
    __block std::vector<WindowInfo> windows;

    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error) {
            NSLog(@"Error getting shareable windows: %@", error.localizedDescription);
        } else if (content) {
            for (SCWindow *window in content.windows) {
                WindowInfo info;
                info.windowId = window.windowID;
                info.frame = RectFromCGRect(window.frame);
                info.layer = (int)window.windowLayer;
                info.onScreen = window.isOnScreen;
                BOOL isActive = NO;
                if ([window respondsToSelector:@selector(isActive)]) {
                    isActive = window.isActive;
                }
                info.active = isActive;
                info.title = window.title ? std::string([window.title UTF8String]) : "";

                if (window.owningApplication) {
                    info.owningProcessId = window.owningApplication.processID;
                    info.owningApplicationName = window.owningApplication.applicationName
                        ? std::string([window.owningApplication.applicationName UTF8String])
                        : "";
                    info.owningBundleIdentifier = window.owningApplication.bundleIdentifier
                        ? std::string([window.owningApplication.bundleIdentifier UTF8String])
                        : "";
                } else {
                    info.owningProcessId = 0;
                    info.owningApplicationName.clear();
                    info.owningBundleIdentifier.clear();
                }

                windows.push_back(info);
            }
        }
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    return windows;
}

std::vector<DisplayInfo> ScreenCaptureKitWrapper::getAvailableDisplays() {
    __block std::vector<DisplayInfo> displays;
    CGDirectDisplayID mainDisplay = CGMainDisplayID();

    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error) {
            NSLog(@"Error getting displays: %@", error.localizedDescription);
        } else if (content) {
            for (SCDisplay *display in content.displays) {
                DisplayInfo info;
                info.displayId = display.displayID;
                info.frame = RectFromCGRect(display.frame);
                info.width = (int)display.width;
                info.height = (int)display.height;
                info.isMainDisplay = (display.displayID == mainDisplay);
                displays.push_back(info);
            }
        }
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    return displays;
}


bool ScreenCaptureKitWrapper::startCapture(int processId, const CaptureConfig& config, std::function<void(const AudioSample&)> callback) {
    if (!impl) return false;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    if (wrapper->objcImpl.isCapturing) {
        return false; // Already capturing
    }

    wrapper->callback = callback;
    __block bool success = false;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        // Find the application with matching process ID
        SCRunningApplication *targetApp = nil;
        for (SCRunningApplication *app in content.applications) {
            if (app.processID == processId) {
                targetApp = app;
                break;
            }
        }

        if (!targetApp) {
            NSLog(@"Could not find application with process ID: %d", processId);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        SCContentFilter *filter = nil;
        if (content.displays.count > 0) {
            NSMutableArray *excludedApps = [NSMutableArray arrayWithArray:content.applications];
            [excludedApps removeObject:targetApp];
            filter = [[SCContentFilter alloc] initWithDisplay:content.displays.firstObject
                                         excludingApplications:excludedApps
                                            exceptingWindows:@[]];
        } else {
            NSLog(@"No displays available for capture");
            dispatch_semaphore_signal(semaphore);
            return;
        }

        success = StartStreamWithFilter(wrapper, filter, config);
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);

    return success;
}

bool ScreenCaptureKitWrapper::startCaptureForWindow(uint64_t windowId, const CaptureConfig& config, std::function<void(const AudioSample&)> callback) {
    if (!impl) return false;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    if (wrapper->objcImpl.isCapturing) {
        return false; // Already capturing
    }

    wrapper->callback = callback;
    __block bool success = false;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        SCWindow *targetWindow = nil;
        for (SCWindow *window in content.windows) {
            if (window.windowID == windowId) {
                targetWindow = window;
                break;
            }
        }

        if (!targetWindow) {
            NSLog(@"Could not find window with ID: %llu", (unsigned long long)windowId);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        SCContentFilter *filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:targetWindow];

        if (!filter) {
            NSLog(@"Failed to create content filter for window: %llu", (unsigned long long)windowId);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        success = StartStreamWithFilter(wrapper, filter, config);
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    return success;
}

bool ScreenCaptureKitWrapper::startCaptureForDisplay(uint32_t displayId, const CaptureConfig& config, std::function<void(const AudioSample&)> callback) {
    if (!impl) return false;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    if (wrapper->objcImpl.isCapturing) {
        return false; // Already capturing
    }

    wrapper->callback = callback;
    __block bool success = false;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        SCDisplay *targetDisplay = nil;
        for (SCDisplay *display in content.displays) {
            if (display.displayID == displayId) {
                targetDisplay = display;
                break;
            }
        }

        if (!targetDisplay) {
            NSLog(@"Could not find display with ID: %u", (unsigned int)displayId);
            dispatch_semaphore_signal(semaphore);
            return;
        }

        SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:targetDisplay
                                                     excludingApplications:@[]
                                                        exceptingWindows:@[]];

        success = StartStreamWithFilter(wrapper, filter, config);
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    return success;
}

void ScreenCaptureKitWrapper::stopCapture() {
    if (!impl) return;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    [wrapper->objcImpl stopCapture];
    wrapper->callback = nullptr;
}

bool ScreenCaptureKitWrapper::isCapturing() const {
    if (!impl) return false;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    return wrapper->objcImpl.isCapturing;
}

} // namespace screencapturekit
