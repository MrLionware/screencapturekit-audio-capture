/**
 * Test Context Factory
 *
 * Provides a consistent way to create test contexts with mocked dependencies.
 * This makes tests more maintainable and reduces boilerplate.
 */

import type { EventEmitter } from 'node:events';
import { loadSDKWithMock, type SDKExports } from './test-utils';
import { createNativeMock, type CreateNativeMockOptions, type MockScreenCaptureKit, type NativeScreenCaptureKitClass } from '../fixtures/mock-native';
import type { AudioCapture } from '../../dist/capture/audio-capture';
import type { AppIdentifier, AudioStreamOptions } from '../../dist/core/types';

/**
 * Create a test context with SDK and mocks
 *
 * @example
 * const { AudioCapture, ErrorCodes } = createTestContext();
 * const capture = new AudioCapture();
 */
export function createTestContext(
  nativeMock: { ScreenCaptureKit: NativeScreenCaptureKitClass } | null = null,
  options: CreateNativeMockOptions = {}
): SDKExports {
  const mock = nativeMock || createNativeMock(options);
  return loadSDKWithMock({ nativeMock: mock });
}

/**
 * Context for capture testing
 */
export interface CaptureContext {
  capture: AudioCapture;
  native: MockScreenCaptureKit | null;
  AudioCapture: typeof AudioCapture;
}

/**
 * Create a test context for capture testing
 *
 * @example
 * const { capture, native } = createCaptureContext();
 * capture.startCapture(100);
 * native.simulateAudio();
 */
export function createCaptureContext(options: CreateNativeMockOptions = {}): CaptureContext {
  let nativeInstance: MockScreenCaptureKit | null = null;

  const nativeMock = {
    ScreenCaptureKit: class extends (createNativeMock(options).ScreenCaptureKit) {
      constructor() {
        super();
        nativeInstance = this;
      }
    }
  };

  const { AudioCapture } = loadSDKWithMock({ nativeMock });
  const capture = new AudioCapture();

  return {
    capture,
    native: nativeInstance,
    AudioCapture
  };
}

/**
 * Context for stream testing
 */
export interface StreamContext {
  capture: AudioCapture;
  native: MockScreenCaptureKit | null;
  createStream: (identifier: AppIdentifier, streamOptions?: AudioStreamOptions) => any;
  simulateAudio: (data?: any) => void;
}

/**
 * Create a test context for stream testing
 */
export function createStreamContext(options: CreateNativeMockOptions = {}): StreamContext {
  const { capture, native } = createCaptureContext(options);

  return {
    capture,
    native,
    createStream: (identifier: AppIdentifier, streamOptions?: AudioStreamOptions) => {
      return capture.createAudioStream(identifier, streamOptions);
    },
    simulateAudio: (data?: any) => native?.simulateAudio(data)
  };
}

/**
 * Wait for event loop to clear
 * Useful for async operations in tests
 */
export function waitForEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Wait for a specific event with timeout
 */
export function waitForEvent(emitter: EventEmitter, event: string, timeout: number = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event '${event}'`));
    }, timeout);

    emitter.once(event, (data: any) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Run code with timeout protection
 */
export function withTimeout<T>(fn: () => Promise<T>, timeout: number = 5000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    )
  ]);
}
