/**
 * Test Utilities
 *
 * Core utilities for testing including VM execution, mocks, and SDK loading.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import Module from 'node:module';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { AudioCapture } from '../../dist/audio-capture';
import type { AudioStream } from '../../dist/audio-stream';
import type { STTConverter } from '../../dist/stt-converter';
import type { AudioCaptureError, ErrorCode } from '../../dist/errors';
import type { MockScreenCaptureKit } from '../fixtures/mock-native';

/**
 * SDK exports interface
 */
export interface SDKExports {
  AudioCapture: typeof AudioCapture;
  AudioStream: typeof AudioStream;
  STTConverter: typeof STTConverter;
  AudioCaptureError: typeof AudioCaptureError;
  ErrorCode: typeof ErrorCode;
  ErrorCodes: Record<string, string>;
}

/**
 * Console mock with captured output
 */
export interface ConsoleMock {
  entries: Array<{ type: string; args: any[] }>;
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
}

/**
 * Process mock with exit tracking
 */
export interface ProcessMock extends EventEmitter {
  argv: string[];
  exitCalls: number[];
  exit: (code?: number) => void;
  stdout: {
    writes: any[];
    write: (chunk: any) => void;
  };
  env: Record<string, string>;
}

/**
 * Fake timers for controlling time in tests
 */
export interface FakeTimers {
  setTimeout: (fn: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
  runAllTimers: () => void;
  runNextTimer: () => void;
  pendingCount: () => number;
}

/**
 * File system mock
 */
export interface FsMock {
  writes: Array<{ file: string; data: any }>;
  writeFileSync: (file: string, data: any) => void;
}

/**
 * Options for running examples in VM
 */
export interface RunExampleOptions {
  mocks?: Record<string, any>;
  sdkClass?: any;
  console?: ConsoleMock | typeof console;
  process?: ProcessMock | typeof process;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

/**
 * Execute an example file inside an isolated VM context with custom globals.
 */
export function runExample(examplePath: string, options: RunExampleOptions = {}): vm.Context {
  const absolutePath = path.resolve(examplePath);
  const code = fs.readFileSync(absolutePath, 'utf8');
  const module = { exports: {} };
  const context: any = {
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

  const requireOverrides: Record<string, any> = { ...(options.mocks || {}) };
  if (options.sdkClass) {
    requireOverrides['../sdk'] = options.sdkClass;
  }

  context.require = createCustomRequire(absolutePath, requireOverrides);
  context.global = context;

  const script = new vm.Script(code, { filename: absolutePath });
  script.runInNewContext(context);

  return context;
}

function createCustomRequire(fromFilename: string, overrides: Record<string, any>): NodeRequire {
  const baseRequire = Module.createRequire(fromFilename);

  return function customRequire(request: string): any {
    if (Object.prototype.hasOwnProperty.call(overrides, request)) {
      return overrides[request];
    }

    return baseRequire(request);
  } as NodeRequire;
}

export function createConsoleMock(): ConsoleMock {
  const entries: Array<{ type: string; args: any[] }> = [];
  const make = (type: string) => (...args: any[]) => {
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

/**
 * Options for creating process mock
 */
export interface CreateProcessMockOptions {
  exitThrows?: boolean;
  onExit?: (code: number) => void;
}

export function createProcessMock(argv: string[] = ['node', 'script'], options: CreateProcessMockOptions = {}): ProcessMock {
  const proc = new EventEmitter() as ProcessMock;
  proc.argv = argv;
  proc.exitCalls = [];
  proc.exit = (code: number = 0) => {
    proc.exitCalls.push(code);
    if (options.exitThrows) {
      const error: any = new Error(`Process exited with code ${code}`);
      error.code = code;
      throw error;
    }
    if (typeof options.onExit === 'function') {
      options.onExit(code);
    }
  };
  proc.stdout = {
    writes: [],
    write(chunk: any) {
      this.writes.push(chunk);
    }
  };
  proc.env = {};
  return proc;
}

export function createFakeTimers(): FakeTimers {
  let idCounter = 0;
  const tasks = new Map<number, { fn: () => void; delay: number }>();

  const fakeSetTimeout = (fn: () => void, delay: number): number => {
    const id = ++idCounter;
    tasks.set(id, { fn, delay });
    return id;
  };

  const fakeClearTimeout = (id: number): void => {
    tasks.delete(id);
  };

  const runAll = (): void => {
    const pending = Array.from(tasks.entries());
    tasks.clear();
    pending.forEach(([, task]) => task.fn());
  };

  const runNext = (): void => {
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

export function createFsMock(): FsMock {
  const writes: Array<{ file: string; data: any }> = [];
  return {
    writes,
    writeFileSync(file: string, data: any) {
      writes.push({ file, data });
    }
  };
}

export class MockAudioStream extends Readable {
  public captureInfo: any;
  public stopCalls: number = 0;
  private _objectMode: boolean;

  constructor(options: { objectMode?: boolean; captureInfo?: any } = {}) {
    super({ objectMode: options.objectMode || false });
    this.captureInfo = options.captureInfo || null;
    this._objectMode = Boolean(options.objectMode);
  }

  override _read(): void { }

  emitChunk(chunk: any): void {
    this.push(chunk);
  }

  endStream(): void {
    this.push(null);
  }

  stop(): void {
    this.stopCalls += 1;
    this.destroyed = true;
    this.endStream();
  }

  getCurrentCapture(): any {
    return this.captureInfo;
  }
}

export class MockSTTStream extends Readable {
  public app: any;
  public stopped: boolean = false;

  constructor(options: { objectMode?: boolean; app?: any } = {}) {
    super({ objectMode: Boolean(options.objectMode || true) });
    this.app = options.app || null;
  }

  override _read(): void { }

  emitSample(sample: any): void {
    this.push(sample);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.push(null);
  }
}

/**
 * Options for creating audio capture mock
 */
export interface CreateAudioCaptureMockOptions {
  apps?: any[];
  audioApps?: any[];
  windows?: any[];
  displays?: any[];
  findApplication?: (identifier: any) => any;
  createAudioStream?: (identifier: any, streamOptions?: any) => any;
  bufferToFloat32Array?: (buffer: Buffer) => Float32Array;
  rmsToDb?: (value: number) => number;
  peakToDb?: (value: number) => number;
  onStart?: (info: any) => void;
  startCaptureResult?: boolean;
}

export function createAudioCaptureMock(options: CreateAudioCaptureMockOptions = {}): any {
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
    static instances: MockAudioCapture[] = [];
    static MockAudioStream = MockAudioStream;
    static MockSTTStream = MockSTTStream;
    static writeWavCalls: any[] = [];

    static bufferToFloat32Array = options.bufferToFloat32Array || ((buffer: Buffer): Float32Array => {
      const floats: number[] = [];
      for (let i = 0; i < buffer.length; i += 4) {
        floats.push(buffer.readFloatLE(i));
      }
      return new Float32Array(floats);
    });

    static rmsToDb = options.rmsToDb || ((value: number): number => {
      if (value <= 0) {
        return -Infinity;
      }
      return 20 * Math.log10(value);
    });

    static peakToDb = options.peakToDb || ((value: number): number => {
      if (value <= 0) {
        return -Infinity;
      }
      return 20 * Math.log10(value);
    });

    static verifyPermissions = () => ({
      granted: true,
      message: `Mock permission granted (${apps.length} apps visible)`,
      availableApps: apps.length,
      apps: [...apps]
    });

    static writeWav = (buffer: Buffer, wavOptions: any): Buffer => {
      const wavBuffer = Buffer.alloc(44 + buffer.length);
      MockAudioCapture.writeWavCalls.push({ buffer, options: wavOptions, result: wavBuffer });
      return wavBuffer;
    };

    public startCalls: any[] = [];
    public stopCalls: number = 0;
    public streams: any[] = [];
    public capturing: boolean = false;
    public apps: any[];
    public audioApps: any[];
    public windows: any[];
    public displays: any[];
    public currentApp: any = null;
    public currentProcessId: number | null = null;
    public _currentTarget: any = null;
    public captureOptions: any = { minVolume: 0, format: 'float32' };
    private _activityTrackingEnabled: boolean = false;
    private _activityDecayMs: number = 30000;
    private _activityEntries: any[] = [];

    constructor() {
      super();
      this.apps = apps;
      this.audioApps = audioApps;
      this.windows = windows;
      this.displays = displays;
      MockAudioCapture.instances.push(this);
    }

    enableActivityTracking(opts: { decayMs?: number } = {}): void {
      const { decayMs = 30000 } = opts;
      this._activityTrackingEnabled = true;
      this._activityDecayMs = decayMs;
    }

    disableActivityTracking(): void {
      this._activityTrackingEnabled = false;
      this._activityEntries = [];
    }

    getActivityInfo(): any {
      return {
        enabled: this._activityTrackingEnabled,
        trackedApps: this._activityEntries.length,
        recentApps: [...this._activityEntries]
      };
    }

    getApplications(): any[] {
      return [...this.apps];
    }

    getAudioApps(opts: any = {}): any[] {
      const source = Array.isArray(opts.appList) ? opts.appList : null;
      const list = source || this.audioApps;

      if (source && this.audioApps.length === 0 && !opts.includeSystemApps) {
        return [];
      }

      if (opts.includeSystemApps) {
        return [...(source || this.apps)];
      }
      if (opts.includeEmpty) {
        return [...list];
      }
      return list.filter((app: any) => app.applicationName && app.applicationName.trim().length > 0);
    }

    getWindows(windowOptions: any = {}): any[] {
      const { onScreenOnly = false, requireTitle = false, processId } = windowOptions;
      return this.windows.filter((window: any) => {
        if (onScreenOnly && !window.onScreen) return false;
        if (requireTitle && (!window.title || window.title.trim().length === 0)) return false;
        if (typeof processId === 'number' && window.owningProcessId !== processId) return false;
        return true;
      });
    }

    getDisplays(): any[] {
      return [...this.displays];
    }

    findApplication(identifier: any): any {
      if (options.findApplication) {
        return options.findApplication(identifier);
      }

      const search = String(identifier).toLowerCase();
      return this.apps.find((app: any) =>
        app.applicationName.toLowerCase().includes(search) ||
        app.bundleIdentifier.toLowerCase().includes(search)
      ) || null;
    }

    findByName(name: string): any {
      return this.findApplication(name);
    }

    getApplicationByPid(pid: number): any {
      return this.apps.find((app: any) => app.processId === pid) || null;
    }

    selectApp(identifiers: any = null, opts: any = {}): any {
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
          const app = candidates.find((a: any) => a.processId === identifier);
          if (app) return app;
          continue;
        }

        const search = String(identifier).toLowerCase();
        const exact = candidates.find((a: any) => a.applicationName.toLowerCase() === search || a.bundleIdentifier.toLowerCase() === search);
        if (exact) return exact;

        const partial = candidates.find((a: any) => a.applicationName.toLowerCase().includes(search));
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

    startCapture(identifier: any, captureOptions: any = {}): boolean {
      let processId: number;
      let targetApp: any;

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

    captureWindow(windowId: number, captureOptions: any = {}): boolean {
      const windowInfo = this.getWindows().find((win: any) => win.windowId === windowId);
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

    captureDisplay(displayId: number, captureOptions: any = {}): boolean {
      const displayInfo = this.getDisplays().find((display: any) => display.displayId === displayId);
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

    _beginCapture(target: any, captureOptions: any): boolean {
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

    stopCapture(): void {
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

    isCapturing(): boolean {
      return this.capturing;
    }

    getStatus(): any {
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

    getCurrentCapture(): any {
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

    createAudioStream(identifier: any, streamOptions: any = {}): any {
      const stream = options.createAudioStream
        ? options.createAudioStream(identifier, streamOptions)
        : new MockAudioStream({
          objectMode: Boolean(streamOptions.objectMode),
          captureInfo: this._currentTarget
        });

      this.streams.push({ identifier, options: streamOptions, stream });
      return stream;
    }

    createSTTStream(identifier: any, sttOptions: any = {}): any {
      const stream = this.createAudioStream(identifier || this.audioApps[0]?.applicationName, {
        objectMode: true,
        minVolume: sttOptions.minVolume || 0,
        format: 'float32'
      });

      const sttStream = new MockSTTStream({ objectMode: true });
      sttStream.app = this.selectApp(identifier) || this.audioApps[0] || null;

      stream.on('data', (sample: any) => {
        const converted = {
          ...sample,
          format: sttOptions.format || 'int16',
          channels: sttOptions.channels || 1
        };
        sttStream.emitSample(converted);
      });

      stream.on('end', () => sttStream.stop());
      stream.on('error', (err: Error) => sttStream.destroy(err));
      sttStream.stop = () => {
        stream.stop?.();
        sttStream.emit('end');
      };

      return sttStream;
    }
  }

  return MockAudioCapture;
}

/**
 * Options for loading SDK with mock
 */
export interface LoadSDKWithMockOptions {
  nativeMock?: { ScreenCaptureKit: typeof MockScreenCaptureKit };
}

/**
 * Load the SDK with a mocked native ScreenCaptureKit addon
 * Note: Uses sdk.js (the original JS implementation) for VM-based mocking.
 * The TypeScript source compiles to dist/ but tests validate behavior via sdk.js
 * which maintains the same API contract.
 */
export function loadSDKWithMock(options: LoadSDKWithMockOptions = {}): SDKExports {
  // Use sdk.js for VM-based testing as it can be loaded and executed in isolation
  // The TypeScript dist/ output has the same API but sdk.js is more suitable for VM mocking
  const sdkPath = path.resolve(__dirname, '../../sdk.js');
  const code = fs.readFileSync(sdkPath, 'utf8');

  const nativeMock = options.nativeMock || {
    ScreenCaptureKit: class MockScreenCaptureKit {
      getAvailableApps(): any[] { return []; }
      startCapture(): boolean { return true; }
      stopCapture(): void { }
    }
  };

  // Create a mock require function that intercepts './index'
  const requireMock = (id: string): any => {
    if (id === './index') {
      return nativeMock;
    }
    return require(id);
  };

  const module = { exports: {} };
  const context: any = {
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

  return module.exports as SDKExports;
}
