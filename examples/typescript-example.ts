/**
 * TypeScript SDK Example
 * Demonstrates type-safe usage of the ScreenCaptureKit Audio Capture SDK
 */

import {
  AudioCapture,
  AudioCaptureError,
  ErrorCode,
  type AudioSample,
  type ApplicationInfo,
  type PermissionStatus,
} from '../dist/index';

// Example 1: Type-safe permission verification
function checkPermissions(): void {
  const status: PermissionStatus = AudioCapture.verifyPermissions();

  if (!status.granted) {
    console.error('Permission denied:', status.message);
    if (status.remediation) {
      console.log(status.remediation);
    }
    return;
  }

  console.log(`✓ ${status.message}`);
}

// Example 2: Type-safe application discovery
function discoverApplications(capture: AudioCapture): void {
  // Get all applications with type safety
  const allApps: ApplicationInfo[] = capture.getApplications();
  console.log(`Found ${allApps.length} applications`);

  // Get audio-capable apps only
  const audioApps: ApplicationInfo[] = capture.getAudioApps();
  console.log(`Found ${audioApps.length} audio apps`);

  // Smart app selection with type inference
  const app: ApplicationInfo | null = capture.selectApp(['Spotify', 'Music', 'Safari']);
  if (app) {
    console.log(`Selected: ${app.applicationName} (PID: ${app.processId})`);
  }
}

// Example 3: Type-safe error handling
function handleErrors(capture: AudioCapture): void {
  try {
    // TypeScript knows this can throw AudioCaptureError
    capture.startCapture('NonexistentApp');
  } catch (error) {
    // Type guard for error checking
    if (AudioCaptureError.isAudioCaptureError(error)) {
      switch (error.code) {
        case ErrorCode.APP_NOT_FOUND:
          console.error('App not found:', error.message);
          console.log('Available apps:', error.details.availableApps);
          break;
        case ErrorCode.PERMISSION_DENIED:
          console.error('Permission denied:', error.message);
          console.log('Suggestion:', error.details.suggestion);
          break;
        default:
          console.error('Unexpected error:', error.message);
      }
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Example 4: Type-safe audio capture (not called in main to avoid actual capture)
function _captureAudio(capture: AudioCapture): void {
  // Event handler with typed parameters
  capture.on('audio', (sample: AudioSample) => {
    // TypeScript knows all properties of AudioSample
    console.log(`Received audio: ${sample.durationMs.toFixed(2)}ms, RMS: ${sample.rms.toFixed(4)}`);

    // Type-safe format checking
    if (sample.format === 'float32') {
      const float32: Float32Array = AudioCapture.bufferToFloat32Array(sample.data);
      console.log(`Float32 samples: ${float32.length}`);
    }
  });

  // Start capture with typed options
  const app = capture.selectApp(['Safari']);
  if (app) {
    capture.startCapture(app, {
      minVolume: 0.01,
      format: 'float32', // TypeScript ensures only valid formats
      sampleRate: 48000,
      channels: 2, // TypeScript ensures only 1 or 2
    });
  }
}

// Example 5: Type-safe streaming API (not called in main to avoid actual capture)
async function _streamAudio(capture: AudioCapture): Promise<void> {
  const app = capture.selectApp(['Safari']);
  if (!app) {
    throw new Error('No audio app found');
  }

  // Create type-safe audio stream
  const audioStream = capture.createAudioStream(app, {
    minVolume: 0.01,
    objectMode: true, // Get full sample objects
  });

  // Create type-safe STT stream (example - not used to keep demo simple)
  const _sttStream = capture.createSTTStream(['Safari', 'Chrome'], {
    format: 'int16', // TypeScript ensures correct format
    channels: 1, // Mono for STT
    autoSelect: true,
  });

  // Type-safe stream handling
  audioStream.on('data', (sample: AudioSample) => {
    console.log(`Stream sample: ${sample.sampleRate}Hz, ${sample.channels}ch`);
  });

  audioStream.on('error', (error: Error) => {
    console.error('Stream error:', error.message);
  });
}

// Example 6: Type-safe utility methods
function audioUtils(): void {
  // Type-safe RMS to dB conversion
  const rms = 0.5;
  const db: number = AudioCapture.rmsToDb(rms);
  console.log(`RMS ${rms} = ${db.toFixed(2)} dB`);

  // Type-safe WAV file creation
  const sampleBuffer = Buffer.allocUnsafe(48000 * 4); // 1 second of float32 stereo
  const wavBuffer: Buffer = AudioCapture.writeWav(sampleBuffer, {
    sampleRate: 48000,
    channels: 2,
    format: 'float32',
  });
  console.log(`WAV file size: ${wavBuffer.length} bytes`);
}

// Example 7: Activity tracking with types
function trackActivity(capture: AudioCapture): void {
  // Enable activity tracking
  capture.enableActivityTracking({ decayMs: 30000 });

  // Get typed activity info
  const activityInfo = capture.getActivityInfo();
  console.log(`Tracking ${activityInfo.trackedApps} apps`);

  activityInfo.recentApps.forEach((activity) => {
    console.log(
      `PID ${activity.processId}: ${activity.sampleCount} samples, ` +
      `avg RMS: ${activity.avgRMS.toFixed(4)}, age: ${activity.ageMs}ms`
    );
  });
}

// Main function demonstrating type safety
function main(): void {
  console.log('=== TypeScript SDK Example ===\n');

  // Create typed capture instance
  const capture: AudioCapture = new AudioCapture();

  // All examples with full type safety
  checkPermissions();
  discoverApplications(capture);
  handleErrors(capture);
  audioUtils();
  trackActivity(capture);

  // Type checking prevents invalid usage at compile time:
  // capture.startCapture(123, { format: 'invalid' }); // ❌ Compile error
  // capture.startCapture('Safari', { channels: 3 }); // ❌ Compile error
  // const wrongType: string = capture.getApplications(); // ❌ Compile error
}

// Export for use in other TypeScript files
export { main };

// Run if executed directly
if (require.main === module) {
  main();
}
