/**
 * Integration Tests: Activity Tracking
 *
 * Tests for audio activity tracking functionality:
 * - Enable/disable activity tracking
 * - Activity cache management
 * - Sort apps by recent audio activity
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { loadSDKWithMock } from '../helpers/test-utils';
import type { AudioSample, ApplicationInfo, ActivityInfo } from '../../dist/core/types';
import type { NativeAudioSample } from '../fixtures/mock-native';

const MOCK_APPS: ApplicationInfo[] = [
  { processId: 100, bundleIdentifier: 'com.example.app', applicationName: 'Example App' },
  { processId: 200, bundleIdentifier: 'com.music.player', applicationName: 'Music Player' },
  { processId: 300, bundleIdentifier: 'com.apple.finder', applicationName: 'Finder' },
];

type ActivityCacheEntry = { lastSeen: number; avgRMS: number; sampleCount: number };

test('Activity Tracking', async (t) => {
  // Shared callback storage for tests
  let sharedCallback: ((sample: NativeAudioSample) => void) | null = null;

  const mockNative = {
    ScreenCaptureKit: class {
      private _callback: ((sample: NativeAudioSample) => void) | null = null;
      getAvailableApps(): ApplicationInfo[] {
        return MOCK_APPS;
      }
      startCapture(_pid: number, _config: any, callback: (sample: NativeAudioSample) => void): boolean {
        this._callback = callback;
        sharedCallback = callback; // Store in outer scope for test access
        return true;
      }
      stopCapture(): void {
        this._callback = null;
        sharedCallback = null;
      }
    }
  };

  const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative }) as { AudioCapture: any };

  await t.test('should enable tracking', () => {
    const capture = new AudioCapture() as InstanceType<typeof AudioCapture> & {
      _activityTrackingEnabled: boolean;
      _activityDecayMs: number;
    };
    capture.enableActivityTracking();
    assert.equal(capture._activityTrackingEnabled, true);
    assert.equal(capture._activityDecayMs, 30000); // Default decay
  });

  await t.test('should enable tracking with custom decay', () => {
    const capture = new AudioCapture() as InstanceType<typeof AudioCapture> & {
      _activityTrackingEnabled: boolean;
      _activityDecayMs: number;
    };
    capture.enableActivityTracking({ decayMs: 60000 });
    assert.equal(capture._activityTrackingEnabled, true);
    assert.equal(capture._activityDecayMs, 60000);
  });

  await t.test('should disable and clear cache', () => {
    const capture = new AudioCapture() as InstanceType<typeof AudioCapture> & {
      _activityTrackingEnabled: boolean;
      _audioActivityCache: Map<number, ActivityCacheEntry>;
    };
    capture.enableActivityTracking();
    // Add some fake data to cache
    capture._audioActivityCache.set(100, {
      lastSeen: Date.now(),
      avgRMS: 0.5,
      sampleCount: 10
    });

    capture.disableActivityTracking();
    assert.equal(capture._activityTrackingEnabled, false);
    assert.equal(capture._audioActivityCache.size, 0);
  });

  await t.test('should return correct activity info', () => {
    const capture = new AudioCapture();
    capture.enableActivityTracking();

    const info = capture.getActivityInfo() as ActivityInfo;
    assert.equal(info.enabled, true);
    assert.equal(info.trackedApps, 0);
    assert.ok(Array.isArray(info.recentApps));
  });

  await t.test('should integrate with audio events', (t: TestContext, done: () => void) => {
    const capture = new AudioCapture();
    capture.enableActivityTracking();

    // Test that activity tracking doesn't break audio emission
    capture.startCapture('Music Player');

    capture.once('audio', (sample: AudioSample) => {
      // Verify audio event works with activity tracking enabled
      assert.ok(sample.data instanceof Buffer);
      assert.ok(sample.rms >= 0);

      // Verify getActivityInfo() returns valid data structure
      const info = capture.getActivityInfo();
      assert.equal(info.enabled, true);
      assert.ok(typeof info.trackedApps === 'number');
      assert.ok(Array.isArray(info.recentApps));

      capture.stopCapture();
      done();
    });

    // Simulate audio callback
    const floatData = new Float32Array(100);
    floatData.fill(0.5);
    const buffer = Buffer.from(floatData.buffer);

    sharedCallback?.({
      data: buffer,
      sampleRate: 48000,
      channelCount: 2,
      timestamp: 123
    });
  });

  await t.test('should sort by recent activity', (t: TestContext, done: () => void) => {
    const capture = new AudioCapture() as any;
    capture.enableActivityTracking();

    // Manually add activity for different apps
    const now = Date.now();
    capture._audioActivityCache.set(100, {
      lastSeen: now - 10000,
      avgRMS: 0.5,
      sampleCount: 10
    }); // Old
    capture._audioActivityCache.set(200, {
      lastSeen: now - 100,
      avgRMS: 0.7,
      sampleCount: 20
    }); // Recent

    const apps = capture.getAudioApps({ sortByActivity: true });

    // Music Player (PID 200) should be first because it's more recent
    assert.equal(apps[0].processId, 200, 'Most recent app should be first');
    assert.equal(apps[1].processId, 100, 'Older app should be second');

    done();
  });

  await t.test('should handle apps without activity', (t: TestContext, done: () => void) => {
    const capture = new AudioCapture() as any;
    capture.enableActivityTracking();

    // Add activity for only one app
    capture._audioActivityCache.set(200, {
      lastSeen: Date.now(),
      avgRMS: 0.5,
      sampleCount: 10
    });

    const apps = capture.getAudioApps({ sortByActivity: true });

    // Music Player should be first, others follow
    assert.equal(apps[0].processId, 200);
    assert.ok(apps.length >= 1);

    done();
  });

  await t.test('should not affect performance when disabled', (t: TestContext, done: () => void) => {
    const capture = new AudioCapture() as any;
    capture.disableActivityTracking();
    capture.startCapture('Music Player');

    capture.once('audio', () => {
      // Cache should remain empty when tracking is disabled
      assert.equal(capture._audioActivityCache.size, 0);
      capture.stopCapture();
      done();
    });

    const floatData = new Float32Array(100);
    floatData.fill(0.5);
    const buffer = Buffer.from(floatData.buffer);

    sharedCallback?.({
      data: buffer,
      sampleRate: 48000,
      channelCount: 2,
      timestamp: 123
    });
  });

  await t.test('should remove stale entries during sortByActivity', (t: TestContext, done: () => void) => {
    const capture = new AudioCapture() as any;
    capture.enableActivityTracking({ decayMs: 1000 }); // Short decay for testing

    // Add stale activity (older than decay threshold)
    const now = Date.now();
    capture._audioActivityCache.set(100, {
      lastSeen: now - 5000, // 5 seconds ago, older than 1s decay
      avgRMS: 0.5,
      sampleCount: 10
    });
    capture._audioActivityCache.set(200, {
      lastSeen: now - 500, // 0.5 seconds ago, within decay
      avgRMS: 0.7,
      sampleCount: 20
    });

    // This should trigger cleanup of stale entries
    const apps = capture.getAudioApps({ sortByActivity: true });

    // Verify stale entry was removed
    assert.ok(!capture._audioActivityCache.has(100), 'Stale entry should be removed');
    assert.ok(capture._audioActivityCache.has(200), 'Fresh entry should remain');
    assert.ok(apps.length > 0);

    done();
  });

  await t.test('should add hint when all apps are filtered out', (t: TestContext, done: () => void) => {
    // Create mock with only system apps that will all be filtered
    const systemOnlyApps: ApplicationInfo[] = [
      { processId: 300, bundleIdentifier: 'com.apple.finder', applicationName: 'Finder' },
      { processId: 301, bundleIdentifier: 'com.apple.systempreferences', applicationName: 'System Preferences' }
    ];

    const mockNativeFiltered = {
      ScreenCaptureKit: class {
        getAvailableApps(): ApplicationInfo[] {
          return systemOnlyApps;
        }
        startCapture(): boolean {
          return true;
        }
        stopCapture(): void { }
      }
    };

    const sdk = loadSDKWithMock({ nativeMock: mockNativeFiltered });
    const capture = new sdk.AudioCapture();

    // Get audio apps - all should be filtered (system apps)
    const audioApps = capture.getAudioApps();

    // Result should be empty array with _hint property
    assert.equal(audioApps.length, 0);
    assert.ok((audioApps as any)._hint, 'Should have _hint property when all filtered');
    assert.ok((audioApps as any)._hint.includes('getAudioApps'), 'Hint should mention getAudioApps alternative');

    done();
  });
});
