/**
 * Integration Tests: Activity Tracking
 *
 * Tests for audio activity tracking functionality:
 * - Enable/disable activity tracking
 * - Activity cache management
 * - Sort apps by recent audio activity
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSDKWithMock } = require('../helpers/test-utils');

const MOCK_APPS = [
  { processId: 100, bundleIdentifier: 'com.example.app', applicationName: 'Example App' },
  { processId: 200, bundleIdentifier: 'com.music.player', applicationName: 'Music Player' },
  { processId: 300, bundleIdentifier: 'com.apple.finder', applicationName: 'Finder' },
];

test('Activity Tracking', async (t) => {
  // Shared callback storage for tests
  let sharedCallback = null;

  const mockNative = {
    ScreenCaptureKit: class {
      constructor() {
        this._callback = null;
      }
      getAvailableApps() {
        return MOCK_APPS;
      }
      startCapture(pid, config, callback) {
        this._callback = callback;
        sharedCallback = callback; // Store in outer scope for test access
        return true;
      }
      stopCapture() {
        this._callback = null;
        sharedCallback = null;
      }
    }
  };

  const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });

  await t.test('should enable tracking', () => {
    const capture = new AudioCapture();
    capture.enableActivityTracking();
    assert.equal(capture._activityTrackingEnabled, true);
    assert.equal(capture._activityDecayMs, 30000); // Default decay
  });

  await t.test('should enable tracking with custom decay', () => {
    const capture = new AudioCapture();
    capture.enableActivityTracking({ decayMs: 60000 });
    assert.equal(capture._activityTrackingEnabled, true);
    assert.equal(capture._activityDecayMs, 60000);
  });

  await t.test('should disable and clear cache', () => {
    const capture = new AudioCapture();
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

    const info = capture.getActivityInfo();
    assert.equal(info.enabled, true);
    assert.equal(info.trackedApps, 0);
    assert.ok(Array.isArray(info.recentApps));
  });

  await t.test('should integrate with audio events', (t, done) => {
    const capture = new AudioCapture();
    capture.enableActivityTracking();

    // Test that activity tracking doesn't break audio emission
    capture.startCapture('Music Player');

    capture.once('audio', (sample) => {
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

    sharedCallback({
      data: buffer,
      sampleRate: 48000,
      channelCount: 2,
      timestamp: 123
    });
  });

  await t.test('should sort by recent activity', (t, done) => {
    const capture = new AudioCapture();
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

  await t.test('should handle apps without activity', (t, done) => {
    const capture = new AudioCapture();
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

  await t.test('should not affect performance when disabled', (t, done) => {
    const capture = new AudioCapture();
    capture.disableActivityTracking();
    capture.startCapture('Music Player');

    capture.once('audio', (sample) => {
      // Cache should remain empty when tracking is disabled
      assert.equal(capture._audioActivityCache.size, 0);
      capture.stopCapture();
      done();
    });

    const floatData = new Float32Array(100);
    floatData.fill(0.5);
    const buffer = Buffer.from(floatData.buffer);

    sharedCallback({
      data: buffer,
      sampleRate: 48000,
      channelCount: 2,
      timestamp: 123
    });
  });
});
