/**
 * Shared Mock Data for Tests
 *
 * This file contains reusable mock data that can be imported by any test.
 * Centralizing mock data ensures consistency and makes it easy to update.
 */

import type { ApplicationInfo, WindowInfo, DisplayInfo } from '../../dist/core/types';

/**
 * Standard mock applications for testing
 */
export const MOCK_APPS: ApplicationInfo[] = [
  {
    processId: 100,
    bundleIdentifier: 'com.example.app',
    applicationName: 'Example App'
  },
  {
    processId: 200,
    bundleIdentifier: 'com.music.player',
    applicationName: 'Music Player'
  },
  {
    processId: 300,
    bundleIdentifier: 'com.apple.finder',
    applicationName: 'Finder'
  },
  {
    processId: 400,
    bundleIdentifier: '',
    applicationName: '' // Empty name (helper process)
  },
  {
    processId: 500,
    bundleIdentifier: 'com.helper.process',
    applicationName: '   ' // Whitespace only
  }
];

/**
 * Mock applications for example tests
 */
export const EXAMPLE_MOCK_APPS: ApplicationInfo[] = [
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

/**
 * Mock windows for testing window capture
 */
export const MOCK_WINDOWS: WindowInfo[] = [
  {
    windowId: 1000,
    layer: 0,
    frame: { x: 0, y: 0, width: 800, height: 600 },
    title: 'Example App – Main',
    onScreen: true,
    active: true,
    owningProcessId: 100,
    owningApplicationName: 'Example App',
    owningBundleIdentifier: 'com.example.app'
  },
  {
    windowId: 2000,
    layer: 0,
    frame: { x: 50, y: 50, width: 640, height: 480 },
    title: '',
    onScreen: true,
    active: false,
    owningProcessId: 200,
    owningApplicationName: 'Music Player',
    owningBundleIdentifier: 'com.music.player'
  },
  {
    windowId: 3000,
    layer: 0,
    frame: { x: 100, y: 100, width: 500, height: 400 },
    title: 'Offscreen Window',
    onScreen: false,
    active: false,
    owningProcessId: 0,
    owningApplicationName: '',
    owningBundleIdentifier: ''
  }
];

/**
 * Mock windows for example tests
 */
export const EXAMPLE_MOCK_WINDOWS: WindowInfo[] = [
  {
    windowId: 2001,
    layer: 0,
    frame: { x: 0, y: 0, width: 800, height: 600 },
    title: 'Spotify Player – Now Playing',
    onScreen: true,
    active: true,
    owningProcessId: 101,
    owningApplicationName: 'Spotify Player',
    owningBundleIdentifier: 'com.spotify.client'
  }
];

/**
 * Mock displays for testing display capture
 */
export const MOCK_DISPLAYS: DisplayInfo[] = [
  {
    displayId: 77,
    frame: { x: 0, y: 0, width: 1440, height: 900 },
    width: 1440,
    height: 900,
    isMainDisplay: true
  },
  {
    displayId: 88,
    frame: { x: 1440, y: 0, width: 1920, height: 1080 },
    width: 1920,
    height: 1080,
    isMainDisplay: false
  }
];

/**
 * Mock displays for example tests
 */
export const EXAMPLE_MOCK_DISPLAYS: DisplayInfo[] = [
  {
    displayId: 77,
    frame: { x: 0, y: 0, width: 1440, height: 900 },
    width: 1440,
    height: 900,
    isMainDisplay: true
  }
];
