/**
 * Unit Tests: Application Selection
 *
 * Tests for application discovery and selection logic:
 * - getApplications() with filtering
 * - findApplication() search
 * - selectApp() smart selection
 * - getAudioApps() filtering
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestContext } = require('../helpers/test-context');
const { createMockApp } = require('../helpers/factories');
const { createNativeMock } = require('../fixtures/mock-native');
const { loadSDKWithMock } = require('../helpers/test-utils');
const { MOCK_APPS } = require('../fixtures/mock-data');

test('Application Selection', async (t) => {
  await t.test('getApplications()', async (t) => {
    await t.test('should filter empty names by default', () => {
      // Use all MOCK_APPS (including empty ones)
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const apps = capture.getApplications();

      // Should exclude apps with empty/whitespace names (PIDs 400, 500)
      assert.equal(apps.length, 3);
      assert.ok(!apps.find(a => a.processId === 400));
      assert.ok(!apps.find(a => a.processId === 500));
    });

    await t.test('should include empty names when requested', () => {
      // Use all MOCK_APPS (including empty ones)
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const apps = capture.getApplications({ includeEmpty: true });

      assert.equal(apps.length, 5);
      assert.ok(apps.find(a => a.processId === 400));
      assert.ok(apps.find(a => a.processId === 500));
    });
  });

  await t.test('findApplication()', async (t) => {
    await t.test('should find by exact name', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.findApplication('Music Player');

      assert.ok(app);
      assert.equal(app.applicationName, 'Music Player');
      assert.equal(app.processId, 200);
    });

    await t.test('should find by partial name (case-insensitive)', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.findApplication('music');

      assert.ok(app);
      assert.equal(app.applicationName, 'Music Player');
    });

    await t.test('should find by bundle ID', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.findApplication('com.example.app');

      assert.ok(app);
      assert.equal(app.applicationName, 'Example App');
    });

    await t.test('should return undefined for non-existent app', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.findApplication('NonExistent');

      assert.equal(app, undefined);
    });
  });

  await t.test('selectApp()', async (t) => {
    await t.test('should find by PID', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp(100);

      assert.equal(app.processId, 100);
      assert.equal(app.applicationName, 'Example App');
    });

    await t.test('should find by name', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp('Music Player');

      assert.equal(app.applicationName, 'Music Player');
    });

    await t.test('should try multiple identifiers in order', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp(['NonExistent', 'Music Player', 'Example App']);

      // Should find first match (Music Player)
      assert.equal(app.applicationName, 'Music Player');
    });

    await t.test('should return first audio app when no identifier given', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp();

      assert.ok(app);
      assert.equal(app.processId, 100); // First non-system app
    });

    await t.test('should skip empty string identifiers', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp('');

      // Should fallback to first app
      assert.ok(app);
      assert.equal(app.processId, 100);
    });

    await t.test('should skip whitespace identifiers', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp('   ');

      assert.ok(app);
      assert.equal(app.processId, 100);
    });

    await t.test('should handle empty array', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp([]);

      assert.ok(app);
      assert.equal(app.processId, 100);
    });

    await t.test('should return null when app not found', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.selectApp('NonExistent');

      assert.equal(app, null);
    });

    await t.test('should throw when throwOnNotFound is true', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture, ErrorCodes } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      assert.throws(() => {
        capture.selectApp('NonExistent', { throwOnNotFound: true });
      }, (err) => {
        assert.equal(err.code, ErrorCodes.APP_NOT_FOUND);
        return true;
      });
    });

    await t.test('should respect audioOnly=false option', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();

      // Finder is filtered by default
      const app1 = capture.selectApp('Finder');
      assert.equal(app1, null);

      // But can be found with audioOnly=false
      const app2 = capture.selectApp('Finder', { audioOnly: false });
      assert.equal(app2.applicationName, 'Finder');
    });
  });

  await t.test('getAudioApps()', async (t) => {
    await t.test('should filter system apps by default', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const apps = capture.getAudioApps();

      // Should exclude Finder (system app)
      assert.ok(!apps.find(a => a.applicationName === 'Finder'));
      assert.ok(apps.find(a => a.applicationName === 'Example App'));
      assert.ok(apps.find(a => a.applicationName === 'Music Player'));
    });

    await t.test('should include system apps when requested', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const apps = capture.getAudioApps({ includeSystemApps: true });

      assert.ok(apps.find(a => a.applicationName === 'Finder'));
    });

    await t.test('should still filter empty names even with includeSystemApps', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const apps = capture.getAudioApps({ includeSystemApps: true });

      assert.ok(!apps.find(a => a.processId === 400));
      assert.ok(!apps.find(a => a.processId === 500));
    });
  });

  await t.test('getApplicationByPid()', async (t) => {
    await t.test('should find app by process ID', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.getApplicationByPid(200);

      assert.equal(app.processId, 200);
      assert.equal(app.applicationName, 'Music Player');
    });

    await t.test('should return undefined for invalid PID', () => {
      const mockNative = createNativeMock({ apps: MOCK_APPS });
      const { AudioCapture } = loadSDKWithMock({ nativeMock: mockNative });
      const capture = new AudioCapture();
      const app = capture.getApplicationByPid(99999);

      assert.equal(app, undefined);
    });
  });
});
