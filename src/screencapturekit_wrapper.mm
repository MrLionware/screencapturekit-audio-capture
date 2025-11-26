#import "screencapturekit_wrapper.h"
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#include <thread>
#include <mutex>

// Objective-C delegate to handle audio samples
// NOTE: Manual reference counting (MRC) required for macOS 26.2+ ARC bug workaround (FB21107737)
@interface AudioCaptureDelegate : NSObject <SCStreamOutput, SCStreamDelegate> {
    void(^_audioCallback)(CMSampleBufferRef);
}
@property (nonatomic, copy) void(^audioCallback)(CMSampleBufferRef);
@end

@implementation AudioCaptureDelegate

@synthesize audioCallback = _audioCallback;

- (void)setAudioCallback:(void(^)(CMSampleBufferRef))audioCallback {
    if (_audioCallback != audioCallback) {
        [_audioCallback release];
        _audioCallback = [audioCallback copy];
    }
}

- (void)dealloc {
    [_audioCallback release];
    [super dealloc];
}

- (void)stream:(SCStream *)stream didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer ofType:(SCStreamOutputType)type {
    // Only process audio samples - video samples are discarded immediately
    // This is intentional for audio-only capture to minimize overhead
    if (type == SCStreamOutputTypeAudio && _audioCallback) {
        _audioCallback(sampleBuffer);
    }
    // SCStreamOutputTypeScreen samples are intentionally ignored and immediately discarded
}

- (void)stream:(SCStream *)stream didStopWithError:(NSError *)error {
    if (error) {
        NSLog(@"Stream stopped with error: %@", error.localizedDescription);
    }
}

@end

// Implementation class
// NOTE: Manual reference counting (MRC) required for macOS 26.2+ ARC bug workaround (FB21107737)
@interface ScreenCaptureKitImpl : NSObject {
    SCStream *_stream;
    AudioCaptureDelegate *_delegate;
    SCContentFilter *_contentFilter;
    BOOL _isCapturing;
}
@property (nonatomic, retain) SCStream *stream;
@property (nonatomic, retain) AudioCaptureDelegate *delegate;
@property (nonatomic, retain) SCContentFilter *contentFilter;
@property (nonatomic, assign) BOOL isCapturing;
@end

@implementation ScreenCaptureKitImpl

@synthesize stream = _stream;
@synthesize delegate = _delegate;
@synthesize contentFilter = _contentFilter;
@synthesize isCapturing = _isCapturing;

- (instancetype)init {
    self = [super init];
    if (self) {
        _isCapturing = NO;
        _stream = nil;
        _delegate = nil;
        _contentFilter = nil;
    }
    return self;
}

- (void)dealloc {
    [self stopCapture];
    [_stream release];
    [_delegate release];
    [_contentFilter release];
    [super dealloc];
}

- (void)setStream:(SCStream *)stream {
    if (_stream != stream) {
        [_stream release];
        _stream = [stream retain];
    }
}

- (void)setDelegate:(AudioCaptureDelegate *)delegate {
    if (_delegate != delegate) {
        [_delegate release];
        _delegate = [delegate retain];
    }
}

- (void)setContentFilter:(SCContentFilter *)contentFilter {
    if (_contentFilter != contentFilter) {
        [_contentFilter release];
        _contentFilter = [contentFilter retain];
    }
}

- (void)stopCapture {
    if (_stream && _isCapturing) {
        [_stream stopCaptureWithCompletionHandler:^(NSError * _Nullable error) {
            if (error) {
                NSLog(@"Error stopping capture: %@", error.localizedDescription);
            }
        }];
        _isCapturing = NO;
        [_stream release];
        _stream = nil;
        [_delegate release];
        _delegate = nil;
        [_contentFilter release];
        _contentFilter = nil;
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

// Helper to run the main run loop until a condition is met or timeout
// This is required on macOS 26+ where SCKit dispatches completion handlers to main queue
void RunLoopUntilComplete(bool *completed, double timeoutSeconds) {
    CFAbsoluteTime deadline = CFAbsoluteTimeGetCurrent() + timeoutSeconds;
    while (!*completed && CFAbsoluteTimeGetCurrent() < deadline) {
        CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, true);
    }
}

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
    [filter release]; // Transfer ownership to contentFilter property

    SCStreamConfiguration *streamConfig = [[SCStreamConfiguration alloc] init];
    
    // Audio configuration
    streamConfig.capturesAudio = YES;
    streamConfig.sampleRate = config.sampleRate;
    streamConfig.channelCount = config.channels;
    streamConfig.excludesCurrentProcessAudio = YES;
    
    // Minimize video capture overhead for audio-only use case
    // ScreenCaptureKit requires video capture even for audio-only, so we minimize it:
    // - 2x2 pixels: smallest valid dimensions
    // - 1 frame per 10 seconds: very slow frame rate
    // - Minimal color format and queue depth
    streamConfig.width = 2;
    streamConfig.height = 2;
    streamConfig.minimumFrameInterval = CMTimeMake(10, 1); // 1 frame per 10 seconds
    streamConfig.showsCursor = NO;
    streamConfig.queueDepth = 1;
    streamConfig.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange; // Minimal color format
    streamConfig.scalesToFit = YES; // Scale down to 2x2

    AudioCaptureDelegate *delegate = [[AudioCaptureDelegate alloc] init];
    delegate.audioCallback = ^(CMSampleBufferRef sampleBuffer) {
        HandleSampleBuffer(sampleBuffer, wrapper);
    };
    wrapper->objcImpl.delegate = delegate;
    [delegate release]; // Transfer ownership to delegate property

    NSError *streamError = nil;
    SCStream *stream = [[SCStream alloc] initWithFilter:wrapper->objcImpl.contentFilter configuration:streamConfig delegate:wrapper->objcImpl.delegate];
    [streamConfig release];

    if (!stream) {
        NSLog(@"Failed to create stream");
        wrapper->objcImpl.contentFilter = nil;
        wrapper->objcImpl.delegate = nil;
        return false;
    }
    [stream autorelease]; // Will be retained by stream property
    
    // Store stream reference BEFORE starting capture (important for macOS 26+)
    wrapper->objcImpl.stream = stream;

    // Add audio output handler on high priority queue for low latency
    [stream addStreamOutput:wrapper->objcImpl.delegate
                       type:SCStreamOutputTypeAudio
         sampleHandlerQueue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0)
                     error:&streamError];

    if (streamError) {
        NSLog(@"Error adding audio stream output: %@", streamError.localizedDescription);
        wrapper->objcImpl.stream = nil;
        wrapper->objcImpl.contentFilter = nil;
        wrapper->objcImpl.delegate = nil;
        return false;
    }

    // Add screen output handler to properly drain video frames and prevent buffering
    // The delegate discards these frames immediately - this is required for proper audio-only capture
    [stream addStreamOutput:wrapper->objcImpl.delegate
                       type:SCStreamOutputTypeScreen
         sampleHandlerQueue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_LOW, 0)
                     error:&streamError];

    if (streamError) {
        // Non-fatal: audio capture can still work without screen output handler
        // Just log a warning and continue
        NSLog(@"Warning: Could not add screen output handler (audio-only mode): %@", streamError.localizedDescription);
        streamError = nil; // Clear error to continue with audio-only
    }

    // Start capture - caller is responsible for pumping the run loop
    // This is called from main queue context on macOS 26+
    __block bool success = false;
    __block bool startCompleted = false;

    [stream startCaptureWithCompletionHandler:^(NSError * _Nullable error) {
        if (error) {
            NSLog(@"Error starting capture: %@", error.localizedDescription);
            wrapper->objcImpl.isCapturing = NO;
            wrapper->objcImpl.stream = nil;
            wrapper->objcImpl.delegate = nil;
            wrapper->objcImpl.contentFilter = nil;
            success = false;
        } else {
            wrapper->objcImpl.isCapturing = YES;
            success = true;
        }
        startCompleted = true;
    }];

    // Pump run loop to allow completion handler delivery
    RunLoopUntilComplete(&startCompleted, 10.0);

    if (!startCompleted) {
        NSLog(@"Timeout waiting for capture to start (10s).");
        wrapper->objcImpl.isCapturing = NO;
        wrapper->objcImpl.stream = nil;
        wrapper->objcImpl.delegate = nil;
        wrapper->objcImpl.contentFilter = nil;
        return false;
    }

    return success;
}

// Static flag to ensure CoreGraphics is initialized once
static bool cgsInitialized = false;
static std::mutex cgsInitMutex;

// Initialize CoreGraphics connection to window server
// This must be called before any window/display enumeration
void EnsureCGSInitialized() {
    std::lock_guard<std::mutex> lock(cgsInitMutex);
    if (cgsInitialized) return;
    
    // Force window server connection by calling CGMainDisplayID
    // Use dispatch_async + run loop pumping to avoid deadlock with main queue
    if ([NSThread isMainThread]) {
        CGMainDisplayID();
        cgsInitialized = true;
    } else {
        __block bool completed = false;
        dispatch_async(dispatch_get_main_queue(), ^{
            CGMainDisplayID();
            completed = true;
        });
        // Pump run loop to allow the async block to execute
        RunLoopUntilComplete(&completed, 5.0);
        if (completed) {
            cgsInitialized = true;
        }
    }
}

} // namespace

ScreenCaptureKitWrapper::ScreenCaptureKitWrapper() {
    // Ensure CoreGraphics is initialized before any operations
    EnsureCGSInitialized();
    
    WrapperImpl *wrapper = new WrapperImpl();
    wrapper->objcImpl = [[ScreenCaptureKitImpl alloc] init];
    impl = wrapper;
}

ScreenCaptureKitWrapper::~ScreenCaptureKitWrapper() {
    if (impl) {
        WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
        [wrapper->objcImpl stopCapture];
        [wrapper->objcImpl release];
        delete wrapper;
        impl = nullptr;
    }
}

std::vector<AppInfo> ScreenCaptureKitWrapper::getAvailableApps() {
    __block std::vector<AppInfo> apps;
    __block bool completed = false;

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
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);

    return apps;
}

std::vector<WindowInfo> ScreenCaptureKitWrapper::getAvailableWindows() {
    __block std::vector<WindowInfo> windows;
    __block bool completed = false;

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
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    return windows;
}

std::vector<DisplayInfo> ScreenCaptureKitWrapper::getAvailableDisplays() {
    __block std::vector<DisplayInfo> displays;
    __block bool completed = false;
    CGDirectDisplayID mainDisplay = CGMainDisplayID();

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
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
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
    __block bool completed = false;
    __block SCShareableContent *capturedContent = nil;

    // macOS 26+ dispatches SCKit completion handlers to main queue.
    // Call directly and pump run loop to process completions.
    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            completed = true;
            return;
        }
        // Retain content to avoid macOS 26.2 ARC bug (FB21107737)
        capturedContent = [content retain];
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    
    if (!capturedContent) {
        return false;
    }

    // Find the application with matching process ID
    SCRunningApplication *targetApp = nil;
    for (SCRunningApplication *app in capturedContent.applications) {
        if (app.processID == processId) {
            targetApp = app;
            break;
        }
    }

    if (!targetApp) {
        NSLog(@"Could not find application with process ID: %d", processId);
        [capturedContent release];
        return false;
    }

    SCContentFilter *filter = nil;
    
    // Try window-based capture first - this allows concurrent captures from different processes
    // Per Apple WWDC: "When a single window filter is used, all the audio content from the 
    // application that contains the window will be captured"
    SCWindow *targetWindow = nil;
    for (SCWindow *window in capturedContent.windows) {
        if (window.owningApplication && window.owningApplication.processID == processId) {
            targetWindow = window;
            break;
        }
    }
    
    if (targetWindow) {
        // Use window-based capture - captures all audio from the owning app
        filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:targetWindow];
        NSLog(@"Using window-based capture for process %d (window ID: %u)", processId, (unsigned int)targetWindow.windowID);
    } else if (capturedContent.displays.count > 0) {
        // Fallback to display-based capture if no windows found
        NSLog(@"No windows found for process %d, falling back to display-based capture", processId);
        filter = [[SCContentFilter alloc] initWithDisplay:capturedContent.displays.firstObject
                                     includingApplications:@[targetApp]
                                        exceptingWindows:@[]];
    } else {
        NSLog(@"No displays or windows available for capture");
        [capturedContent release];
        return false;
    }

    success = StartStreamWithFilter(wrapper, filter, config);
    [capturedContent release];
    return success;
}

bool ScreenCaptureKitWrapper::startCaptureMultiApp(const std::vector<int>& processIds, const CaptureConfig& config, std::function<void(const AudioSample&)> callback) {
    if (!impl) return false;
    if (processIds.empty()) return false;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    if (wrapper->objcImpl.isCapturing) {
        return false; // Already capturing
    }

    wrapper->callback = callback;
    __block bool success = false;
    __block bool completed = false;
    __block SCShareableContent *capturedContent = nil;

    // macOS 26+ dispatches SCKit completion handlers to main queue.
    // Call directly and pump run loop to process completions.
    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            completed = true;
            return;
        }
        // Retain content to avoid macOS 26.2 ARC bug (FB21107737)
        capturedContent = [content retain];
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    
    if (!capturedContent) {
        return false;
    }

    // Find all applications with matching process IDs
    NSMutableArray<SCRunningApplication *> *targetApps = [NSMutableArray array];
    for (int processId : processIds) {
        for (SCRunningApplication *app in capturedContent.applications) {
            if (app.processID == processId) {
                [targetApps addObject:app];
                break;
            }
        }
    }

    if (targetApps.count == 0) {
        NSLog(@"Could not find any applications with the specified process IDs");
        [capturedContent release];
        return false;
    }

    if (targetApps.count < processIds.size()) {
        NSLog(@"Warning: Found %lu of %lu requested applications", (unsigned long)targetApps.count, (unsigned long)processIds.size());
    }

    SCContentFilter *filter = nil;
    if (capturedContent.displays.count > 0) {
        // Use includingApplications (whitelist) instead of excludingApplications (blacklist)
        // This allows multiple processes to capture different apps concurrently
        filter = [[SCContentFilter alloc] initWithDisplay:capturedContent.displays.firstObject
                                     includingApplications:targetApps
                                        exceptingWindows:@[]];
    } else {
        NSLog(@"No displays available for capture");
        [capturedContent release];
        return false;
    }

    success = StartStreamWithFilter(wrapper, filter, config);
    [capturedContent release];
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
    __block bool completed = false;
    __block SCShareableContent *capturedContent = nil;

    // macOS 26+ dispatches SCKit completion handlers to main queue.
    // Call directly and pump run loop to process completions.
    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            completed = true;
            return;
        }
        // Retain content to avoid macOS 26.2 ARC bug (FB21107737)
        capturedContent = [content retain];
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    
    if (!capturedContent) {
        return false;
    }

    SCWindow *targetWindow = nil;
    for (SCWindow *window in capturedContent.windows) {
        if (window.windowID == windowId) {
            targetWindow = window;
            break;
        }
    }

    if (!targetWindow) {
        NSLog(@"Could not find window with ID: %llu", (unsigned long long)windowId);
        [capturedContent release];
        return false;
    }

    SCContentFilter *filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:targetWindow];

    if (!filter) {
        NSLog(@"Failed to create content filter for window: %llu", (unsigned long long)windowId);
        [capturedContent release];
        return false;
    }

    success = StartStreamWithFilter(wrapper, filter, config);
    [capturedContent release];
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
    __block bool completed = false;
    __block SCShareableContent *capturedContent = nil;

    // macOS 26+ dispatches SCKit completion handlers to main queue.
    // Call directly and pump run loop to process completions.
    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            completed = true;
            return;
        }
        // Retain content to avoid macOS 26.2 ARC bug (FB21107737)
        capturedContent = [content retain];
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    
    if (!capturedContent) {
        return false;
    }

    SCDisplay *targetDisplay = nil;
    for (SCDisplay *display in capturedContent.displays) {
        if (display.displayID == displayId) {
            targetDisplay = display;
            break;
        }
    }

    if (!targetDisplay) {
        NSLog(@"Could not find display with ID: %u", (unsigned int)displayId);
        [capturedContent release];
        return false;
    }

    SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:targetDisplay
                                                 excludingApplications:@[]
                                                    exceptingWindows:@[]];

    success = StartStreamWithFilter(wrapper, filter, config);
    [capturedContent release];
    return success;
}

bool ScreenCaptureKitWrapper::startCaptureMultiWindow(const std::vector<uint64_t>& windowIds, const CaptureConfig& config, std::function<void(const AudioSample&)> callback) {
    if (!impl) return false;
    if (windowIds.empty()) return false;

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    if (wrapper->objcImpl.isCapturing) {
        return false; // Already capturing
    }

    wrapper->callback = callback;
    __block bool success = false;
    __block bool completed = false;
    __block SCShareableContent *capturedContent = nil;

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            completed = true;
            return;
        }
        capturedContent = [content retain];
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    
    if (!capturedContent) {
        return false;
    }

    // Find all windows with matching IDs
    NSMutableArray<SCWindow *> *targetWindows = [NSMutableArray array];
    for (uint64_t windowId : windowIds) {
        for (SCWindow *window in capturedContent.windows) {
            if (window.windowID == windowId) {
                [targetWindows addObject:window];
                break;
            }
        }
    }

    if (targetWindows.count == 0) {
        NSLog(@"Could not find any windows with the specified IDs");
        [capturedContent release];
        return false;
    }

    if (targetWindows.count < windowIds.size()) {
        NSLog(@"Warning: Found %lu of %lu requested windows", (unsigned long)targetWindows.count, (unsigned long)windowIds.size());
    }

    // Create filter including only the target windows
    // Use the first display as the base, then filter to only include these windows
    SCContentFilter *filter = nil;
    if (capturedContent.displays.count > 0) {
        filter = [[SCContentFilter alloc] initWithDisplay:capturedContent.displays.firstObject
                                                 includingWindows:targetWindows];
    } else {
        NSLog(@"No displays available for capture");
        [capturedContent release];
        return false;
    }

    success = StartStreamWithFilter(wrapper, filter, config);
    [capturedContent release];
    return success;
}

bool ScreenCaptureKitWrapper::startCaptureMultiDisplay(const std::vector<uint32_t>& displayIds, const CaptureConfig& config, std::function<void(const AudioSample&)> callback) {
    if (!impl) return false;
    if (displayIds.empty()) return false;

    // Note: ScreenCaptureKit does not support capturing multiple displays in a single stream.
    // For multi-display capture, we capture the first display and include all windows from all requested displays.
    // This is a workaround - true multi-display would require multiple SCStream instances.

    WrapperImpl *wrapper = static_cast<WrapperImpl*>(impl);
    std::lock_guard<std::mutex> lock(wrapper->mutex);

    if (wrapper->objcImpl.isCapturing) {
        return false; // Already capturing
    }

    wrapper->callback = callback;
    __block bool success = false;
    __block bool completed = false;
    __block SCShareableContent *capturedContent = nil;

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable content, NSError * _Nullable error) {
        if (error || !content) {
            NSLog(@"Error getting shareable content: %@", error.localizedDescription);
            completed = true;
            return;
        }
        capturedContent = [content retain];
        completed = true;
    }];

    RunLoopUntilComplete(&completed, 10.0);
    
    if (!capturedContent) {
        return false;
    }

    // Find all displays with matching IDs
    NSMutableArray<SCDisplay *> *targetDisplays = [NSMutableArray array];
    for (uint32_t displayId : displayIds) {
        for (SCDisplay *display in capturedContent.displays) {
            if (display.displayID == displayId) {
                [targetDisplays addObject:display];
                break;
            }
        }
    }

    if (targetDisplays.count == 0) {
        NSLog(@"Could not find any displays with the specified IDs");
        [capturedContent release];
        return false;
    }

    if (targetDisplays.count < displayIds.size()) {
        NSLog(@"Warning: Found %lu of %lu requested displays", (unsigned long)targetDisplays.count, (unsigned long)displayIds.size());
    }

    // For multi-display, we use the first display as the primary and exclude nothing
    // This effectively captures audio from all apps on all displays
    // Note: True multi-display video capture would need different approach
    SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:targetDisplays.firstObject
                                                 excludingApplications:@[]
                                                    exceptingWindows:@[]];

    success = StartStreamWithFilter(wrapper, filter, config);
    [capturedContent release];
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
