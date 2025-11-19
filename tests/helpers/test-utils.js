const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');

/**
 * Execute an example file inside an isolated VM context with custom globals.
 * @param {string} examplePath Absolute path to example file
 * @param {Object} options Options for the VM run
 * @param {Object} options.mocks Map of module name -> mock implementation
 * @param {Function} options.sdkClass Mock AudioCapture class to use
 * @param {Object} options.console Console mock
 * @param {Object} options.process Process mock
 * @param {Function} options.setTimeout Replacement setTimeout
 * @param {Function} options.clearTimeout Replacement clearTimeout
 * @returns {Object} VM context for further inspection
 */
function runExample(examplePath, options = {}) {
  const absolutePath = path.resolve(examplePath);
  const code = fs.readFileSync(absolutePath, 'utf8');
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    __filename: absolutePath,
    __dirname: path.dirname(absolutePath),
    console: options.console || console,
    process: options.process || process,
    setTimeout: options.setTimeout || setTimeout,
    clearTimeout: options.clearTimeout || clearTimeout,
    Buffer,
  };

  const requireOverrides = { ...(options.mocks || {}) };
  if (options.sdkClass) {
    requireOverrides['../sdk'] = options.sdkClass;
  }

  context.require = createCustomRequire(absolutePath, requireOverrides);
  context.global = context;

  const script = new vm.Script(code, { filename: absolutePath });
  script.runInNewContext(context);

  return context;
}

function createCustomRequire(fromFilename, overrides) {
  const baseRequire = Module.createRequire(fromFilename);

  return function customRequire(request) {
    if (Object.prototype.hasOwnProperty.call(overrides, request)) {
      return overrides[request];
    }

    return baseRequire(request);
  };
}

function createConsoleMock() {
  const entries = [];
  const make = (type) => (...args) => {
    entries.push({ type, args });
  };

  return {
    entries,
    log: make('log'),
    error: make('error'),
    warn: make('warn'),
    debug: make('debug'),
    info: make('info')
  };
}

function createProcessMock(argv = ['node', 'script'], options = {}) {
  const proc = new EventEmitter();
  proc.argv = argv;
  proc.exitCalls = [];
  proc.exit = (code = 0) => {
    proc.exitCalls.push(code);
    if (options.exitThrows) {
      const error = new Error(`Process exited with code ${code}`);
      error.code = code;
      throw error;
    }
    if (typeof options.onExit === 'function') {
      options.onExit(code);
    }
  };
  proc.stdout = {
    writes: [],
    write(chunk) {
      this.writes.push(chunk);
    }
  };
  proc.env = {};
  return proc;
}

function createFakeTimers() {
  let idCounter = 0;
  const tasks = new Map();

  const fakeSetTimeout = (fn, delay) => {
    const id = ++idCounter;
    tasks.set(id, { fn, delay });
    return id;
  };

  const fakeClearTimeout = (id) => {
    tasks.delete(id);
  };

  const runAll = () => {
    const pending = Array.from(tasks.entries());
    tasks.clear();
    pending.forEach(([, task]) => task.fn());
  };

  const runNext = () => {
    const iterator = tasks.entries().next();
    if (!iterator.done) {
      const [id, task] = iterator.value;
      tasks.delete(id);
      task.fn();
    }
  };

  return {
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    runAllTimers: runAll,
    runNextTimer: runNext,
    pendingCount: () => tasks.size
  };
}

function createFsMock() {
  const writes = [];
  return {
    writes,
    writeFileSync(file, data) {
      writes.push({ file, data });
    }
  };
}

class MockAudioStream extends Readable {
  constructor(options = {}) {
    super({ objectMode: options.objectMode || false });
    this.captureInfo = options.captureInfo || null;
    this.stopCalls = 0;
  }

  _read() { }

  emitChunk(chunk) {
    this.push(chunk);
  }

  endStream() {
    this.push(null);
  }

  stop() {
    this.stopCalls += 1;
    this.destroyed = true;
    this.endStream();
  }

  getCurrentCapture() {
    return this.captureInfo;
  }
}

function createAudioCaptureMock(options = {}) {
  const apps = options.apps || [
    {
      processId: 101,
      bundleIdentifier: 'com.example.mock',
      applicationName: 'Mock Player'
    }
  ];
  const audioApps = options.audioApps || apps;

  class MockAudioCapture extends EventEmitter {
    constructor() {
      super();
      this.startCalls = [];
      this.stopCalls = 0;
      this.streams = [];
      this.capturing = false;
      this.apps = apps;
      this.audioApps = audioApps;
      this.currentApp = null;
      this.currentProcessId = null;
      MockAudioCapture.instances.push(this);
    }

    getApplications() {
      return [...this.apps];
    }

    getAudioApps(opts = {}) {
      if (opts.includeSystemApps) {
        return [...this.apps];
      }
      return [...this.audioApps];
    }

    findApplication(identifier) {
      if (options.findApplication) {
        return options.findApplication(identifier);
      }

      const search = String(identifier).toLowerCase();
      return this.apps.find(app =>
        app.applicationName.toLowerCase().includes(search) ||
        app.bundleIdentifier.toLowerCase().includes(search)
      ) || null;
    }

    findByName(name) {
      return this.findApplication(name);
    }

    getApplicationByPid(pid) {
      return this.apps.find(app => app.processId === pid) || null;
    }

    startCapture(identifier, captureOptions = {}) {
      this.startCalls.push({ identifier, options: captureOptions });
      this.capturing = true;

      const appInfo = typeof identifier === 'number'
        ? this.getApplicationByPid(identifier)
        : this.findApplication(identifier);

      this.currentApp = appInfo || null;
      this.currentProcessId = (appInfo && appInfo.processId) || (typeof identifier === 'number' ? identifier : 0);

      if (options.onStart) {
        options.onStart({ identifier, captureOptions, instance: this });
      }

      const startEvent = {
        processId: this.currentProcessId,
        app: this.currentApp
      };
      this.emit('start', startEvent);

      return options.startCaptureResult !== undefined ? options.startCaptureResult : true;
    }

    stopCapture() {
      if (!this.capturing) {
        return;
      }

      this.stopCalls += 1;
      this.capturing = false;
      const processId = this.currentProcessId;
      this.currentProcessId = null;
      this.emit('stop', { processId });
    }

    isCapturing() {
      return this.capturing;
    }

    getCurrentCapture() {
      if (!this.capturing || !this.currentApp) {
        return null;
      }
      return {
        processId: this.currentApp.processId,
        app: this.currentApp
      };
    }

    createAudioStream(identifier, streamOptions = {}) {
      const stream = options.createAudioStream
        ? options.createAudioStream(identifier, streamOptions)
        : new MockAudioStream({
          objectMode: Boolean(streamOptions.objectMode),
          captureInfo: this.currentApp
        });

      this.streams.push({ identifier, options: streamOptions, stream });
      return stream;
    }
  }

  MockAudioCapture.instances = [];
  MockAudioCapture.MockAudioStream = MockAudioStream;
  MockAudioCapture.writeWavCalls = [];

  MockAudioCapture.bufferToFloat32Array = options.bufferToFloat32Array || ((buffer) => {
    const floats = [];
    for (let i = 0; i < buffer.length; i += 4) {
      floats.push(buffer.readFloatLE(i));
    }
    return new Float32Array(floats);
  });

  MockAudioCapture.rmsToDb = options.rmsToDb || ((value) => {
    if (value <= 0) {
      return -Infinity;
    }
    return 20 * Math.log10(value);
  });

  MockAudioCapture.peakToDb = options.peakToDb || ((value) => {
    if (value <= 0) {
      return -Infinity;
    }
    return 20 * Math.log10(value);
  });

  MockAudioCapture.writeWav = (buffer, wavOptions) => {
    const wavBuffer = Buffer.alloc(44 + buffer.length);
    MockAudioCapture.writeWavCalls.push({ buffer, options: wavOptions, result: wavBuffer });
    return wavBuffer;
  };

  return MockAudioCapture;
}

module.exports = {
  runExample,
  createConsoleMock,
  createProcessMock,
  createFakeTimers,
  createFsMock,
  createAudioCaptureMock,
  MockAudioStream,
  loadSDKWithMock
};

/**
 * Load the SDK with a mocked native ScreenCaptureKit addon
 * @param {Object} options
 * @param {Object} options.nativeMock Mock implementation of the native addon
 * @returns {Object} The loaded SDK module exports
 */
function loadSDKWithMock(options = {}) {
  const sdkPath = path.resolve(__dirname, '../../sdk.js');
  const code = fs.readFileSync(sdkPath, 'utf8');

  const nativeMock = options.nativeMock || {
    ScreenCaptureKit: class MockScreenCaptureKit {
      getAvailableApps() { return []; }
      startCapture() { return true; }
      stopCapture() { }
    }
  };

  // Create a mock require function that intercepts './index'
  const requireMock = (id) => {
    if (id === './index') {
      return nativeMock;
    }
    return require(id);
  };

  const module = { exports: {} };
  const context = {
    require: requireMock,
    module,
    exports: module.exports,
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    Float32Array,
    Int16Array,
    Error,
    Math
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  return module.exports;
}
