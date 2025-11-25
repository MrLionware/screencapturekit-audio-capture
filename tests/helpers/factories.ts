/**
 * Test Data Factories
 *
 * Factory functions for creating test data with sensible defaults.
 * Makes tests more readable and maintainable.
 */

import type { AudioSample, ApplicationInfo, WindowInfo, DisplayInfo, AudioFormat } from '../../dist/types';

/**
 * Options for creating audio samples
 */
export interface CreateAudioSampleOptions {
  data?: Buffer;
  bufferSize?: number;
  durationMs?: number;
  framesCount?: number;
  sampleRate?: number;
  channels?: 1 | 2;
  format?: AudioFormat;
  timestamp?: number;
  rms?: number;
  peak?: number;
  sampleCount?: number;
}

/**
 * Create a mock audio sample
 */
export function createAudioSample(overrides: CreateAudioSampleOptions = {}): AudioSample {
  const buffer = Buffer.alloc(overrides.bufferSize || 16);
  if (!overrides.data) {
    buffer.writeFloatLE(0.25, 0);
    buffer.writeFloatLE(-0.5, 4);
  }

  return {
    data: overrides.data || buffer,
    durationMs: overrides.durationMs ?? 1000,
    framesCount: overrides.framesCount ?? 960,
    sampleRate: overrides.sampleRate ?? 48000,
    channels: overrides.channels ?? 2,
    format: overrides.format ?? 'float32',
    timestamp: overrides.timestamp ?? 0,
    rms: overrides.rms ?? 0.5,
    peak: overrides.peak ?? 0.8,
    sampleCount: overrides.sampleCount ?? 1920
  };
}

/**
 * Options for creating mock applications
 */
export interface CreateMockAppOptions {
  processId?: number;
  bundleIdentifier?: string;
  applicationName?: string;
}

/**
 * Create a mock application
 */
export function createMockApp(overrides: CreateMockAppOptions = {}): ApplicationInfo {
  return {
    processId: overrides.processId ?? 100,
    bundleIdentifier: overrides.bundleIdentifier ?? 'com.test.app',
    applicationName: overrides.applicationName ?? 'Test App'
  };
}

/**
 * Options for creating mock windows
 */
export interface CreateMockWindowOptions {
  windowId?: number;
  layer?: number;
  frame?: { x: number; y: number; width: number; height: number };
  title?: string;
  onScreen?: boolean;
  active?: boolean;
  owningProcessId?: number;
  owningApplicationName?: string;
  owningBundleIdentifier?: string;
}

/**
 * Create a mock window
 */
export function createMockWindow(overrides: CreateMockWindowOptions = {}): WindowInfo {
  return {
    windowId: overrides.windowId ?? 1000,
    layer: overrides.layer ?? 0,
    frame: overrides.frame ?? { x: 0, y: 0, width: 800, height: 600 },
    title: overrides.title ?? 'Test Window',
    onScreen: overrides.onScreen ?? true,
    active: overrides.active ?? true,
    owningProcessId: overrides.owningProcessId ?? 100,
    owningApplicationName: overrides.owningApplicationName ?? 'Test App',
    owningBundleIdentifier: overrides.owningBundleIdentifier ?? 'com.test.app'
  };
}

/**
 * Options for creating mock displays
 */
export interface CreateMockDisplayOptions {
  displayId?: number;
  frame?: { x: number; y: number; width: number; height: number };
  width?: number;
  height?: number;
  isMainDisplay?: boolean;
}

/**
 * Create a mock display
 */
export function createMockDisplay(overrides: CreateMockDisplayOptions = {}): DisplayInfo {
  return {
    displayId: overrides.displayId ?? 77,
    frame: overrides.frame ?? { x: 0, y: 0, width: 1440, height: 900 },
    width: overrides.width ?? 1440,
    height: overrides.height ?? 900,
    isMainDisplay: overrides.isMainDisplay ?? true
  };
}

/**
 * Create a Float32 audio buffer
 */
export function createFloat32Buffer(length: number = 1024, value: number = 0.5): Buffer {
  const floatData = new Float32Array(length);
  floatData.fill(value);
  return Buffer.from(floatData.buffer);
}

/**
 * Create an Int16 audio buffer
 */
export function createInt16Buffer(length: number = 1024, value: number = 16384): Buffer {
  const intData = new Int16Array(length);
  intData.fill(value);
  return Buffer.from(intData.buffer);
}

/**
 * Audio pattern types
 */
export type AudioPattern = 'sine' | 'silence' | 'noise' | 'extreme' | 'nan' | 'constant';

/**
 * Create a buffer with specific audio pattern
 */
export function createAudioPattern(pattern: AudioPattern, length: number = 1024): Buffer {
  const floatData = new Float32Array(length);

  switch (pattern) {
    case 'sine':
      for (let i = 0; i < length; i++) {
        floatData[i] = Math.sin(i * 0.1);
      }
      break;
    case 'silence':
      floatData.fill(0);
      break;
    case 'noise':
      for (let i = 0; i < length; i++) {
        floatData[i] = Math.random() * 2 - 1;
      }
      break;
    case 'extreme':
      floatData.fill(999999);
      break;
    case 'nan':
      floatData.fill(NaN);
      break;
    case 'constant':
      floatData.fill(0.5);
      break;
    default:
      floatData.fill(0.5);
  }

  return Buffer.from(floatData.buffer);
}
