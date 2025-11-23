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
    this._objectMode = Boolean(options.objectMode);
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

class MockSTTStream extends Readable {
  constructor(options = {}) {
    super({ objectMode: Boolean(options.objectMode || true) });
    this.app = options.app || null;
    this.stopped = false;
  }

  _read() { }

  emitSample(sample) {
    this.push(sample);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.push(null);
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
  const windows = options.windows || [{
    windowId: 9001,
    layer: 0,
    frame: { x: 0, y: 0, width: 800, height: 600 },
    title: 'Mock Player Window',
    onScreen: true,
    active: true,
    owningProcessId: apps[0]?.processId || 101,
    owningApplicationName: apps[0]?.applicationName || 'Mock Player',
    owningBundleIdentifier: apps[0]?.bundleIdentifier || 'com.example.mock'
  }];
  const displays = options.displays || [{
    displayId: 77,
    frame: { x: 0, y: 0, width: 1440, height: 900 },
    width: 1440,
    height: 900,
    isMainDisplay: true
  }];

  class MockAudioCapture extends EventEmitter {
    constructor() {
      super();
      this.startCalls = [];
      this.stopCalls = 0;
      this.streams = [];
      this.capturing = false;
      this.apps = apps;
      this.audioApps = audioApps;
      this.windows = windows;
      this.displays = displays;
      this.currentApp = null;
      this.currentProcessId = null;
      this._currentTarget = null;
      this.captureOptions = { minVolume: 0, format: 'float32' };
      this._activityTrackingEnabled = false;
      this._activityDecayMs = 30000;
      this._activityEntries = [];
      MockAudioCapture.instances.push(this);
    }

    enableActivityTracking(options = {}) {
      const { decayMs = 30000 } = options;
      this._activityTrackingEnabled = true;
      this._activityDecayMs = decayMs;
    }

    disableActivityTracking() {
      this._activityTrackingEnabled = false;
      this._activityEntries = [];
    }

    getActivityInfo() {
      return {
        enabled: this._activityTrackingEnabled,
        trackedApps: this._activityEntries.length,
        recentApps: [...this._activityEntries]
      };
    }

    getApplications() {
      return [...this.apps];
    }

    getAudioApps(opts = {}) {
      const source = Array.isArray(opts.appList) ? opts.appList : null;
      const list = source || this.audioApps;

      // Simulate "apps visible but none audio-capable" by honoring an empty audioApps list
      if (source && this.audioApps.length === 0 && !opts.includeSystemApps) {
        return [];
      }

      if (opts.includeSystemApps) {
        return [...(source || this.apps)];
      }
      if (opts.includeEmpty) {
        return [...list];
      }
      return list.filter(app => app.applicationName && app.applicationName.trim().length > 0);
    }

    getWindows(options = {}) {
      const { onScreenOnly = false, requireTitle = false, processId } = options;
      return this.windows.filter((window) => {
        if (onScreenOnly && !window.onScreen) return false;
        if (requireTitle && (!window.title || window.title.trim().length === 0)) return false;
        if (typeof processId === 'number' && window.owningProcessId !== processId) return false;
        return true;
      });
    }

    getDisplays() {
      return [...this.displays];
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

    selectApp(identifiers = null, opts = {}) {
      const { audioOnly = true, throwOnNotFound = false, appList = null, fallbackToFirst = false } = opts;
      const candidates = appList
        ? (audioOnly ? this.getAudioApps({ appList }) : [...appList])
        : (audioOnly ? this.getAudioApps() : this.getApplications());
      const hasIdentifiers = identifiers !== null && identifiers !== undefined;
      const normalized = Array.isArray(identifiers)
        ? identifiers
        : hasIdentifiers ? [identifiers] : [];

      if (!hasIdentifiers) {
        return candidates[0] || null;
      }

      for (const identifier of normalized) {
        if (typeof identifier === 'number') {
          const app = candidates.find(a => a.processId === identifier);
          if (app) return app;
          continue;
        }

        const search = String(identifier).toLowerCase();
        const exact = candidates.find(a => a.applicationName.toLowerCase() === search || a.bundleIdentifier.toLowerCase() === search);
        if (exact) return exact;

        const partial = candidates.find(a => a.applicationName.toLowerCase().includes(search));
        if (partial) return partial;
      }

      if (!hasIdentifiers && fallbackToFirst && candidates.length > 0) {
        return candidates[0];
      }
      if (fallbackToFirst && candidates.length > 0) {
        return candidates[0];
      }

      if (throwOnNotFound) {
        throw new Error('Mock selectApp could not find requested app');
      }
      return null;
    }

    startCapture(identifier, captureOptions = {}) {
      let processId;
      let targetApp;

      if (typeof identifier === 'object' && identifier && typeof identifier.processId === 'number') {
        processId = identifier.processId;
        targetApp = identifier;
      } else if (typeof identifier === 'number') {
        processId = identifier;
        targetApp = this.getApplicationByPid(identifier);
      } else {
        processId = this.findApplication(identifier)?.processId;
        targetApp = this.findApplication(identifier);
      }

      const target = {
        type: 'application',
        identifier,
        processId: processId || 0,
        app: targetApp || null,
        window: null,
        display: null
      };

      return this._beginCapture(target, captureOptions);
    }

    captureWindow(windowId, captureOptions = {}) {
      const windowInfo = this.getWindows().find(win => win.windowId === windowId);
      if (!windowInfo) {
        throw new Error(`Window ${windowId} not found`);
      }

      const target = {
        type: 'window',
        identifier: windowId,
        processId: windowInfo.owningProcessId || 0,
        app: this.getApplicationByPid(windowInfo.owningProcessId) || null,
        window: windowInfo,
        display: null
      };

      return this._beginCapture(target, captureOptions);
    }

    captureDisplay(displayId, captureOptions = {}) {
      const displayInfo = this.getDisplays().find(display => display.displayId === displayId);
      if (!displayInfo) {
        throw new Error(`Display ${displayId} not found`);
      }

      const target = {
        type: 'display',
        identifier: displayId,
        processId: null,
        app: null,
        window: null,
        display: displayInfo
      };

      return this._beginCapture(target, captureOptions);
    }

    _beginCapture(target, captureOptions) {
      this.captureOptions = {
        minVolume: captureOptions.minVolume || 0,
        format: captureOptions.format || 'float32'
      };
      this.startCalls.push({ identifier: target.identifier, options: captureOptions, targetType: target.type });
      this.capturing = true;
      this.currentApp = target.app;
      this.currentProcessId = target.processId || null;
      this._currentTarget = target;

      if (options.onStart) {
        options.onStart({ identifier: target.identifier, captureOptions, instance: this });
      }

      if (target.app && this._activityTrackingEnabled) {
        this._activityEntries.push({
          processId: target.app.processId,
          lastSeen: Date.now(),
          ageMs: 0,
          avgRMS: 0.5,
          sampleCount: 1
        });
      }

      this.emit('start', {
        processId: this.currentProcessId,
        app: this.currentApp,
        window: target.window,
        display: target.display,
        targetType: target.type
      });

      return options.startCaptureResult !== undefined ? options.startCaptureResult : true;
    }

    stopCapture() {
      if (!this.capturing) {
        return;
      }

      this.stopCalls += 1;
      this.capturing = false;
      const snapshot = this.getStatus();
      this.currentProcessId = null;
      this.currentApp = null;
      this._currentTarget = null;
      this.emit('stop', snapshot || { processId: null });
    }

    isCapturing() {
      return this.capturing;
    }

    getStatus() {
      if (!this.capturing || !this._currentTarget) {
        return null;
      }

      return {
        capturing: true,
        processId: this._currentTarget.processId,
        app: this._currentTarget.app,
        window: this._currentTarget.window,
        display: this._currentTarget.display,
        targetType: this._currentTarget.type,
        config: { ...this.captureOptions }
      };
    }

    getCurrentCapture() {
      const status = this.getStatus();
      if (!status) {
        return null;
      }
      return {
        processId: status.processId,
        app: status.app,
        window: status.window,
        display: status.display,
        targetType: status.targetType
      };
    }

    createAudioStream(identifier, streamOptions = {}) {
      const stream = options.createAudioStream
        ? options.createAudioStream(identifier, streamOptions)
        : new MockAudioStream({
          objectMode: Boolean(streamOptions.objectMode),
          captureInfo: this._currentTarget
        });

      this.streams.push({ identifier, options: streamOptions, stream });
      return stream;
    }

    createSTTStream(identifier, sttOptions = {}) {
      const stream = this.createAudioStream(identifier || this.audioApps[0]?.applicationName, {
        objectMode: true,
        minVolume: sttOptions.minVolume || 0,
        format: 'float32'
      });

      const sttStream = new MockSTTStream({ objectMode: true });
      sttStream.app = this.selectApp(identifier) || this.audioApps[0] || null;

      stream.on('data', (sample) => {
        const converted = {
          ...sample,
          format: sttOptions.format || 'int16',
          channels: sttOptions.channels || 1
        };
        sttStream.emitSample(converted);
      });

      stream.on('end', () => sttStream.stop());
      stream.on('error', (err) => sttStream.destroy(err));
      sttStream.stop = () => {
        stream.stop?.();
        sttStream.emit('end');
      };

      return sttStream;
    }
  }

  MockAudioCapture.instances = [];
  MockAudioCapture.MockAudioStream = MockAudioStream;
  MockAudioCapture.MockSTTStream = MockSTTStream;
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

  MockAudioCapture.verifyPermissions = () => ({
    granted: true,
    message: `Mock permission granted (${apps.length} apps visible)`,
    availableApps: apps.length,
    apps: [...apps]
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
  MockSTTStream,
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
