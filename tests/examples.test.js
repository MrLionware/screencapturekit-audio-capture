const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runExample,
  createConsoleMock,
  createProcessMock,
  createFakeTimers,
  createFsMock,
  createAudioCaptureMock,
  MockAudioStream
} = require('./helpers/test-utils');

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

const mockApps = [
  {
    processId: 101,
    bundleIdentifier: 'com.spotify.client',
    applicationName: 'Spotify Player'
  },
  {
    processId: 102,
    bundleIdentifier: 'com.apple.Safari',
    applicationName: 'Safari'
  },
  {
    processId: 103,
    bundleIdentifier: 'com.company.Terminal',
    applicationName: 'Terminal'
  }
];

function createSampleChunk(overrides = {}) {
  const buffer = Buffer.alloc(16);
  buffer.writeFloatLE(0.25, 0);
  buffer.writeFloatLE(-0.5, 4);
  return {
    data: buffer,
    durationMs: overrides.durationMs ?? 1000,
    framesCount: overrides.framesCount ?? 960,
    sampleRate: overrides.sampleRate ?? 48000,
    channels: overrides.channels ?? 2,
    format: overrides.format ?? 'float32',
    timestamp: overrides.timestamp ?? 0,
    rms: overrides.rms ?? 0.5,
    peak: overrides.peak ?? 0.8
  };
}

function waitForEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

test('1-basic-usage captures samples and writes WAV output', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '1-basic-usage.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath]);
  const timers = createFakeTimers();
  const fsMock = createFsMock();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]]
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    mocks: { fs: fsMock }
  });

  const capture = AudioCaptureMock.instances[0];
  assert.ok(capture, 'Capture instance should be created');
  assert.equal(capture.startCalls.length, 1);
  assert.equal(capture.startCalls[0].identifier, mockApps[0].applicationName);
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

test('1-basic-usage reports missing applications with available list', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '1-basic-usage.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath], { exitThrows: true });
  const AudioCaptureMock = createAudioCaptureMock({
    apps: mockApps,
    findApplication: () => null
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
  assert.match(output, /Application "Spotify" not found/);
  assert.match(output, /Available applications/);
  assert.match(output, /Spotify Player/);
});

test('2-stream-api object mode example streams metadata and stops cleanly', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '2-stream-api.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '1']);
  const timers = createFakeTimers();
  const fsMock = createFsMock();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]],
    createAudioStream: (_, streamOptions) => new MockAudioStream({
      objectMode: streamOptions.objectMode,
      captureInfo: mockApps[0]
    })
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    mocks: { fs: fsMock }
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

test('2-stream-api normal mode example counts raw buffer chunks', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '2-stream-api.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '2']);
  const timers = createFakeTimers();
  const fsMock = createFsMock();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]],
    createAudioStream: (_, streamOptions) => new MockAudioStream({
      objectMode: streamOptions.objectMode
    })
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    mocks: { fs: fsMock }
  });

  const stream = AudioCaptureMock.instances[0].streams[0].stream;
  for (let i = 0; i < 25; i++) {
    stream.emitChunk(Buffer.alloc(64));
  }

  timers.runAllTimers();
  await waitForEventLoop();
  assert.equal(processMock.exitCalls.at(-1), 0);
  const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
  assert.match(output, /Chunk #25/);
});

test('2-stream-api pipeline example collects chunks and writes WAV file', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '2-stream-api.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '3']);
  const timers = createFakeTimers();
  const fsMock = createFsMock();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]],
    createAudioStream: () => new MockAudioStream()
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    mocks: { fs: fsMock }
  });

  const stream = AudioCaptureMock.instances[0].streams[0].stream;
  stream.emitChunk(Buffer.alloc(32));
  stream.emitChunk(Buffer.alloc(32));

  timers.runAllTimers();
  await waitForEventLoop();
  assert.equal(fsMock.writes.length, 1, 'Pipeline should write WAV output');
  assert.equal(AudioCaptureMock.writeWavCalls.length, 1);
  assert.equal(processMock.exitCalls.at(-1), 0);
});

test('2-stream-api transform example renders volume meter output', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '2-stream-api.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '4']);
  const timers = createFakeTimers();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]],
    createAudioStream: (_, streamOptions) => new MockAudioStream({
      objectMode: streamOptions.objectMode,
      captureInfo: mockApps[0]
    })
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });

  const stream = AudioCaptureMock.instances[0].streams[0].stream;
  stream.emitChunk({
    rms: 0.6,
    sampleRate: 48000,
    channels: 2,
    durationMs: 25,
    format: 'float32',
    peak: 0.8
  });
  stream.emitChunk({
    rms: 0.2,
    sampleRate: 48000,
    channels: 2,
    durationMs: 25,
    format: 'float32',
    peak: 0.4
  });

  timers.runAllTimers();
  await waitForEventLoop();
  assert.equal(processMock.exitCalls.at(-1), 0);
  assert.ok(processMock.stdout.writes.some(write => /dB/.test(write)), 'Volume meter should write dB output');
});

test('3-advanced-config preset 1 reports applied configuration and statistics', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '3-advanced-config.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '1']);
  const timers = createFakeTimers();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]]
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });

  const capture = AudioCaptureMock.instances[0];
  assert.equal(capture.startCalls[0].options.sampleRate, 48000);
  assert.equal(capture.startCalls[0].options.channels, 2);
  assert.equal(capture.startCalls[0].options.bufferSize, 1024);
  assert.equal(capture.startCalls[0].options.format, 'float32');

  const sample = createSampleChunk({ durationMs: 15, framesCount: 720 });
  for (let i = 0; i < 5; i++) {
    capture.emit('audio', sample);
  }

  timers.runAllTimers();
  assert.equal(processMock.exitCalls.at(-1), 0);
  const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
  assert.match(output, /Low Latency Configuration/);
  assert.match(output, /Statistics after 5 samples/);
});

test('3-advanced-config preset 2 uses efficient settings', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '3-advanced-config.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '2']);
  const timers = createFakeTimers();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]]
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });

  const capture = AudioCaptureMock.instances[0];
  const { options } = capture.startCalls[0];
  assert.equal(options.channels, 1);
  assert.equal(options.format, 'int16');
  assert.equal(options.bufferSize, 4096);

  timers.runAllTimers();
  assert.equal(processMock.exitCalls.at(-1), 0);
});

test('3-advanced-config preset 3 runs high quality configuration', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '3-advanced-config.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '3']);
  const timers = createFakeTimers();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]]
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });

  const capture = AudioCaptureMock.instances[0];
  const { options } = capture.startCalls[0];
  assert.equal(options.channels, 2);
  assert.equal(options.sampleRate, 48000);
  assert.equal(options.bufferSize, 2048);
  assert.equal(options.format, 'float32');

  const sample = createSampleChunk({ durationMs: 20, framesCount: 960 });
  capture.emit('audio', sample);

  timers.runAllTimers();
  await waitForEventLoop();
  assert.equal(processMock.exitCalls.at(-1), 0);
  const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
  assert.match(output, /High Quality Configuration/);
});

test('3-advanced-config preset 4 honors custom CLI overrides', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '3-advanced-config.js');
  const consoleMock = createConsoleMock();
  const processMock = createProcessMock(['node', examplePath, '4', '44100', '1', '2048', 'int16']);
  const timers = createFakeTimers();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: [mockApps[0]]
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock,
    process: processMock,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  });

  const capture = AudioCaptureMock.instances[0];
  const { options } = capture.startCalls[0];
  assert.equal(options.sampleRate, 44100);
  assert.equal(options.channels, 1);
  assert.equal(options.bufferSize, 2048);
  assert.equal(options.format, 'int16');

  timers.runAllTimers();
  assert.equal(processMock.exitCalls.at(-1), 0);
  const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
  assert.match(output, /Custom settings: 44100Hz, 1ch, buffer=2048, int16/);
});

test('4-finding-apps lists applications and finds best candidate', async () => {
  const examplePath = path.join(EXAMPLES_DIR, '4-finding-apps.js');
  const consoleMock = createConsoleMock();
  const AudioCaptureMock = createAudioCaptureMock({
    apps: mockApps,
    audioApps: [mockApps[0], mockApps[1]]
  });

  runExample(examplePath, {
    sdkClass: AudioCaptureMock,
    console: consoleMock
  });

  const output = consoleMock.entries.map(e => e.args.join(' ')).join('\n');
  assert.match(output, /All Capturable Applications/);
  assert.match(output, /Audio-Likely Applications/);
  assert.match(output, /Search by Name/);
  assert.match(output, /Search by Bundle ID/);
  assert.match(output, /Lookup by Process ID/);
  assert.match(output, /Practical Example - Find and Capture/);
  assert.match(output, /✓ Found audio app/);
  assert.match(output, /Custom Filtering/);
});
