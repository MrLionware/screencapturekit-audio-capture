import { AudioCapture, AudioCaptureError, ErrorCode, type AudioSample, type ApplicationInfo, type CaptureStatus } from '../src/index';

class RobustAudioCapture {
    private appName: string;
    private capture: AudioCapture;

    constructor(appName: string) {
        this.appName = appName;
        this.capture = new AudioCapture();
        this.setupHandlers();
    }

    async start(): Promise<void> {
        // Verify permissions first
        const perms = AudioCapture.verifyPermissions();
        if (!perms.granted) {
            throw new Error(`Permissions not granted: ${perms.message}`);
        }

        // Start with error handling
        try {
            this.capture.startCapture(this.appName, {
                minVolume: 0.01,
                format: 'int16',
                channels: 1
            });

            // Verify we're actually capturing
            const status: CaptureStatus | null = this.capture.getStatus();
            console.log(`Started capturing from: ${status?.app?.applicationName}`);

        } catch (err) {
            if (AudioCaptureError.isAudioCaptureError(err) && err.code === ErrorCode.APP_NOT_FOUND) {
                // Try to find similar app
                const apps: ApplicationInfo[] = this.capture.getApplications();
                const similar = apps.find((app) =>
                    app.applicationName.toLowerCase().includes(this.appName.toLowerCase())
                );

                if (similar) {
                    console.log(`Trying ${similar.applicationName} instead...`);
                    this.capture.startCapture(similar.applicationName);
                } else {
                    // Fallback to any audio app for this example to ensure it runs
                    const audioApps = this.capture.getAudioApps();
                    if (audioApps.length > 0) {
                        console.log(`Requested app not found. Fallback to: ${audioApps[0].applicationName}`);
                        this.capture.startCapture(audioApps[0].applicationName);
                    } else {
                        throw new Error(`App not found. Available: ${err.details?.availableApps?.join(', ')}`);
                    }
                }
            } else {
                throw err;
            }
        }
    }

    private setupHandlers(): void {
        this.capture.on('audio', (sample: AudioSample) => this.handleAudio(sample));
        this.capture.on('error', (err: Error) => this.handleError(err));
        this.capture.on('start', ({ app }) => console.log(`Started: ${app?.applicationName}`));
        this.capture.on('stop', ({ app }) => console.log(`Stopped: ${app?.applicationName}`));
    }

    private handleAudio(sample: AudioSample): void {
        // Your audio processing here
        if (Math.random() < 0.01) console.log(`[Robust] Received audio chunk`);
    }

    private handleError(err: Error): void {
        console.error('Capture error:', err.message);
        // Implement retry logic, logging, etc.
    }

    stop(): void {
        if (this.capture.isCapturing()) {
            this.capture.stopCapture();
        }
    }
}

// Usage
// Try to capture 'Safari' or fallback
const capture = new RobustAudioCapture('Safari');
capture.start().catch(console.error);

setTimeout(() => {
    console.log('Stopping robust capture...');
    capture.stop();
}, 5000);
