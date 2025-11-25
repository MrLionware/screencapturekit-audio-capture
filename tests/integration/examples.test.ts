/**
 * Integration Tests: Examples
 *
 * Tests for the example scripts in the `examples/` directory.
 * These tests run the examples in a sandboxed VM environment to verify their behavior.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  runExample,
  createConsoleMock,
  createProcessMock,
  createFakeTimers,
  createFsMock,
  createAudioCaptureMock,
  MockAudioStream
} from '../helpers/test-utils';
import type { ApplicationInfo, AudioSample } from '../../dist/types';

const EXAMPLES_DIR = path.join(__dirname, '../../examples');

const exampleMockApps: ApplicationInfo[] = [
  { processId: 101, bundleIdentifier: 'com.spotify.client', applicationName: 'Spotify Player' },
  { processId: 102, bundleIdentifier: 'com.apple.Safari', applicationName: 'Safari' },
  { processId: 103, bundleIdentifier: 'com.company.Terminal', applicationName: 'Terminal' }
];

function createSampleChunk(overrides: Partial<AudioSample> = {}): AudioSample {
  const buffer = Buffer.alloc(16);
  buffer.writeFloatLE(0.25, 0);
  buffer.writeFloatLE(-0.5, 4);
  const framesCount = overrides.framesCount ?? 960;
  const channels = overrides.channels ?? 2;

  return {
    data: buffer,
    durationMs: overrides.durationMs ?? 1000,
    framesCount,
    sampleRate: overrides.sampleRate ?? 48000,
    channels,
    format: overrides.format ?? 'float32',
    timestamp: overrides.timestamp ?? 0,
    rms: overrides.rms ?? 0.5,
    peak: overrides.peak ?? 0.8,
    sampleCount: overrides.sampleCount ?? framesCount * channels
  };
}

function waitForEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

test('Example Integration Tests', async (t) => {
  await t.test('1-basic-usage captures samples and writes WAV output', async () => {
    const examplePath = path.join(EXAMPLES_DIR, '1-basic-usage.js');
    const consoleMock = createConsoleMock();
    const processMock = createProcessMock(['node', examplePath]);
    const timers = createFakeTimers();
    const fsMock = createFsMock();
    const AudioCaptureMock = createAudioCaptureMock({
      apps: [exampleMockApps[0]]
    });

    runExample(examplePath, {
      sdkClass: AudioCaptureMock,
      console: consoleMock,
      process: processMock,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      mocks: {
        fs: fsMock
      }
    });

    const capture = AudioCaptureMock.instances[0];
    assert.ok(capture, 'Capture instance should be created');
    assert.equal(capture.startCalls.length, 1);
    const startedIdentifier = capture.startCalls[0].identifier;
    const startedName = typeof startedIdentifier === 'object'
      ? startedIdentifier.applicationName
      : startedIdentifier;
    assert.equal(startedName, exampleMockApps[0].applicationName);
    assert.equal(capture.startCalls[0].options.minVolume, 0.01);

    // Emit a few audio samples to simulate capture output
    const sample = createSampleChunk();
    capture.emit('audio', sample);
    capture.emit('audio', sample);
    capture.emit('audio', sample);

    // Fire the scheduled stop timer
    timers.runAllTimers();

    assert.equal(capture.stopCalls, 1, 'Capture should be stopped once');
    assert.equal(AudioCaptureMock.writeWavCalls.length, 1, 'WAV writer should be invoked once');
    assert.equal(fsMock.writes.length, 1, 'WAV file should be written');
    assert.match(fsMock.writes[0].file, /^capture-\d+\.wav$/);
    assert.equal(processMock.exitCalls.at(-1), 0, 'Process should exit cleanly');

    const logOutput = consoleMock.entries.map(entry => entry.args.join(' ')).join('\n');
    assert.match(logOutput, /Saving to WAV file/);
    assert.match(logOutput, /Capture stopped/);
  });

  await t.test('1-basic-usage reports missing applications with available list', async () => {
    const examplePath = path.join(EXAMPLES_DIR, '1-basic-usage.js');
    const consoleMock = createConsoleMock();
    const processMock = createProcessMock(['node', examplePath], {
      exitThrows: true
    });
    const AudioCaptureMock = createAudioCaptureMock({
      apps: exampleMockApps,
      audioApps: []
    });

    assert.throws(() => {
      runExample(examplePath, {
        sdkClass: AudioCaptureMock,
        console: consoleMock,
        process: processMock
      });
    }, /Process exited with code 1/);

    assert.deepEqual(processMock.exitCalls, [1]);
    const output = consoleMock.entries.map(entry => entry.args.join(' ')).join('\n');
    assert.match(output, /No audio-capable applications/);
    assert.match(output, /Available applications/);
    assert.match(output, /Spotify Player/);
  });

  await t.test('2-stream-api object mode example streams metadata and stops cleanly', async () => {
    const examplePath = path.join(EXAMPLES_DIR, '2-stream-api.js');
    const consoleMock = createConsoleMock();
    const processMock = createProcessMock(['node', examplePath, '1']);
    const timers = createFakeTimers();
    const fsMock = createFsMock();
    const AudioCaptureMock = createAudioCaptureMock({
      apps: [exampleMockApps[0]],
      createAudioStream: (_: any, streamOptions: any) => new MockAudioStream({
        objectMode: streamOptions.objectMode,
        captureInfo: exampleMockApps[0]
      })
    });

    runExample(examplePath, {
      sdkClass: AudioCaptureMock,
      console: consoleMock,
      process: processMock,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      mocks: {
        fs: fsMock
      }
    });

    const capture = AudioCaptureMock.instances[0];
    const stream = capture.streams[0].stream;

    for (let i = 0; i < 25; i++) {
      stream.emitChunk({
        sampleRate: 48000,
        channels: 2,
        format: 'float32',
        durationMs: 10,
        rms: 0.5,
        peak: 0.8
      });
    }

    timers.runAllTimers();
    assert.equal(stream.stopCalls, 1, 'Stream stop should be triggered by timer');
    await waitForEventLoop();
    assert.equal(processMock.exitCalls.at(-1), 0);
    const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
    assert.match(output, /Sample #25/);
  });

  await t.test('2-stream-api normal mode example counts raw buffer chunks', async () => {
    const examplePath = path.join(EXAMPLES_DIR, '2-stream-api.js');
    const consoleMock = createConsoleMock();
    const processMock = createProcessMock(['node', examplePath, '2']);
    const timers = createFakeTimers();
    const fsMock = createFsMock();
    const AudioCaptureMock = createAudioCaptureMock({
      apps: [exampleMockApps[0]],
      createAudioStream: (_: any, streamOptions: any) => new MockAudioStream({
        objectMode: streamOptions.objectMode
      })
    });

    runExample(examplePath, {
      sdkClass: AudioCaptureMock,
      console: consoleMock,
      process: processMock,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      mocks: {
        fs: fsMock
      }
    });

    const capture = AudioCaptureMock.instances[0];
    const stream = capture.streams[0].stream;

    for (let i = 0; i < 15; i++) {
      stream.emitChunk(Buffer.alloc(1024));
    }

    timers.runAllTimers();
    assert.equal(stream.stopCalls, 1);
    await waitForEventLoop();
    assert.equal(processMock.exitCalls.at(-1), 0);
    const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
    assert.match(output, /Total chunks: 15/);
  });
});
