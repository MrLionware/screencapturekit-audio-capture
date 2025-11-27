#!/usr/bin/env node --experimental-strip-types
/**
 * README Examples Test Runner
 * ============================================================================
 * Tests all readme examples against the screencapturekit-audio-capture package
 * to catch regressions when changes are made to the SDK or native wrapper.
 *
 * Usage: node --experimental-strip-types run_all.ts [APP_NAME] [SECOND_APP_NAME]
 * Example: node --experimental-strip-types run_all.ts "Google Chrome"
 *          node --experimental-strip-types run_all.ts Spotify Safari
 *          node --experimental-strip-types run_all.ts           # Interactive selection
 * ============================================================================
 */

import { execa } from 'execa';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_DIR = __dirname;
const PROJECT_DIR = path.dirname(SCRIPT_DIR);
const LOG_DIR = path.join(SCRIPT_DIR, '.test-logs');
const TIMESTAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);

// Colors for output
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const BLUE = '\x1b[0;34m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m'; // No Color
const BOLD = '\x1b[1m';

// Test tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  errorHint?: string;
  logFile: string;
}

const testResults: TestResult[] = [];
const TOTAL_START_TIME = Date.now();

// Environment variables for tests
let TARGET_APP = '';
let TARGET_APP_2 = '';
let TARGET_APPS = '';
let TARGET_WINDOW = '';
let TARGET_DISPLAY = '';

// Create log directory
fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Run a node script and return stdout
 */
async function runNodeScript(script: string): Promise<string> {
  try {
    const { stdout } = await execa('node', ['-e', script], {
      cwd: PROJECT_DIR,
      timeout: 10000,
      reject: false,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Check if app is producing audio
 */
async function checkAudio(appName: string): Promise<string> {
  const script = `
const {AudioCapture} = require('${PROJECT_DIR}/dist');
const capture = new AudioCapture();
const apps = capture.getAudioApps();
const app = apps.find(a => a.applicationName === '${appName}');
if (!app) { console.log('APP_NOT_FOUND'); process.exit(0); }

let hasAudio = false;
let sampleCount = 0;

capture.on('audio', (sample) => {
    sampleCount++;
    if (sample.rms > 0.001) hasAudio = true;
});

capture.startCapture(app.processId);

setTimeout(() => {
    capture.stopCapture();
    if (hasAudio) {
        console.log('AUDIO_DETECTED');
    } else if (sampleCount > 0) {
        console.log('SILENCE_DETECTED');
    } else {
        console.log('NO_SAMPLES');
    }
    process.exit(0);
}, 3000);
`;
  return runNodeScript(script);
}

/**
 * Get list of audio apps
 */
async function getAudioApps(): Promise<string[]> {
  const script = `
const {AudioCapture} = require('${PROJECT_DIR}/dist');
const capture = new AudioCapture();
const apps = capture.getAudioApps();
console.log(JSON.stringify(apps.map(a => a.applicationName)));
`;
  const result = await runNodeScript(script);
  if (!result || result === '[]') return [];
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

/**
 * Get list of windows
 */
async function getWindows(): Promise<Array<{ id: number; app: string; title: string }>> {
  const script = `
const {AudioCapture} = require('${PROJECT_DIR}/dist');
const capture = new AudioCapture();
const windows = capture.getWindows().filter(w => w.title && w.title.length > 0).slice(0, 20);
console.log(JSON.stringify(windows.map(w => ({id: w.windowId, app: w.owningApplicationName || 'Unknown', title: w.title}))));
`;
  const result = await runNodeScript(script);
  if (!result || result === '[]') return [];
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

/**
 * Get list of displays
 */
async function getDisplays(): Promise<Array<{ id: number; width: number; height: number; main: boolean }>> {
  const script = `
const {AudioCapture} = require('${PROJECT_DIR}/dist');
const capture = new AudioCapture();
const displays = capture.getDisplays();
console.log(JSON.stringify(displays.map(d => ({id: d.displayId, width: d.width, height: d.height, main: d.isMainDisplay}))));
`;
  const result = await runNodeScript(script);
  if (!result || result === '[]') return [];
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

/**
 * Interactive app selection
 */
async function selectAppInteractive(rl: readline.Interface): Promise<string> {
  console.log('=========================================');
  console.log('📱 Available apps with audio capability:');
  console.log('=========================================');

  const apps = await getAudioApps();
  if (apps.length === 0) {
    console.log('❌ No audio apps found. Make sure to build first: npm run build:ts');
    process.exit(1);
  }

  apps.forEach((app, i) => console.log(`  ${i + 1}) ${app}`));
  console.log('');
  console.log('  0) Cancel');
  console.log('');

  const selection = await rl.question(`Select an app (1-${apps.length}): `);

  if (selection === '0' || !selection) {
    console.log('Cancelled.');
    process.exit(0);
  }

  const idx = parseInt(selection, 10);
  if (isNaN(idx) || idx < 1 || idx > apps.length) {
    console.log('❌ Invalid selection.');
    process.exit(1);
  }

  const selected = apps[idx - 1];
  console.log('');
  console.log(`✅ Selected: ${selected}`);
  return selected;
}

/**
 * Interactive second app selection for multi-app tests
 */
async function selectSecondAppInteractive(rl: readline.Interface, excludeApp: string): Promise<string | null> {
  console.log('');
  console.log('=========================================');
  console.log('📱 Select a SECOND app for multi-app tests:');
  console.log('=========================================');

  const allApps = await getAudioApps();
  const apps = allApps.filter((a) => a !== excludeApp);

  if (apps.length === 0) {
    console.log('⚠️  No other audio apps available. Multi-app tests will use fallback.');
    return null;
  }

  apps.forEach((app, i) => console.log(`  ${i + 1}) ${app}`));
  console.log('');
  console.log('  0) Skip (use fallback for multi-app tests)');
  console.log('');

  const selection = await rl.question(`Select second app (1-${apps.length}, or 0 to skip): `);

  if (selection === '0' || !selection) {
    console.log('Skipped. Multi-app tests will use fallback.');
    return null;
  }

  const idx = parseInt(selection, 10);
  if (isNaN(idx) || idx < 1 || idx > apps.length) {
    console.log('⚠️  Invalid selection. Multi-app tests will use fallback.');
    return null;
  }

  const selected = apps[idx - 1];
  console.log('');
  console.log(`✅ Second app selected: ${selected}`);
  return selected;
}

/**
 * Interactive window selection
 */
async function selectWindowInteractive(rl: readline.Interface): Promise<string | null> {
  console.log('');
  console.log('=========================================');
  console.log('🪟  Select a WINDOW for window capture tests:');
  console.log('=========================================');

  const windows = await getWindows();

  if (windows.length === 0) {
    console.log('⚠️  No windows found. Window tests will use auto-selection.');
    return null;
  }

  windows.forEach((w, i) => {
    let title = w.title;
    if (title.length > 40) title = title.slice(0, 37) + '...';
    console.log(`  ${i + 1}) [${w.app}] ${title}`);
  });
  console.log('');
  console.log('  0) Skip (use auto-selection)');
  console.log('');

  const selection = await rl.question(`Select window (1-${windows.length}, or 0 to skip): `);

  if (selection === '0' || !selection) {
    console.log('Skipped. Window tests will use auto-selection.');
    return null;
  }

  const idx = parseInt(selection, 10);
  if (isNaN(idx) || idx < 1 || idx > windows.length) {
    console.log('⚠️  Invalid selection. Window tests will use auto-selection.');
    return null;
  }

  const selected = windows[idx - 1].id.toString();
  console.log('');
  console.log(`✅ Window selected: ID ${selected}`);
  return selected;
}

/**
 * Interactive display selection
 */
async function selectDisplayInteractive(rl: readline.Interface): Promise<string | null> {
  console.log('');
  console.log('=========================================');
  console.log('🖥️  Select a DISPLAY for display capture tests:');
  console.log('=========================================');

  const displays = await getDisplays();

  if (displays.length === 0) {
    console.log('⚠️  No displays found. Display tests will use auto-selection.');
    return null;
  }

  displays.forEach((d, i) => {
    const mainBadge = d.main ? ' ★ Main' : '';
    console.log(`  ${i + 1}) Display ${d.id} - ${d.width}x${d.height}${mainBadge}`);
  });
  console.log('');
  console.log('  0) Skip (use auto-selection)');
  console.log('');

  const selection = await rl.question(`Select display (1-${displays.length}, or 0 to skip): `);

  if (selection === '0' || !selection) {
    console.log('Skipped. Display tests will use auto-selection.');
    return null;
  }

  const idx = parseInt(selection, 10);
  if (isNaN(idx) || idx < 1 || idx > displays.length) {
    console.log('⚠️  Invalid selection. Display tests will use auto-selection.');
    return null;
  }

  const selected = displays[idx - 1].id.toString();
  console.log('');
  console.log(`✅ Display selected: ID ${selected}`);
  return selected;
}

/**
 * Run a single test and track results
 */
async function runTest(testName: string, testFile: string): Promise<void> {
  const logFile = path.join(LOG_DIR, `${testName}_${TIMESTAMP}.log`);

  process.stdout.write(`${BLUE}▶${NC} Running ${BOLD}${testName}${NC}...`);

  const startTime = Date.now();

  const env: Record<string, string> = {
    ...process.env,
    TARGET_APP,
  };
  if (TARGET_APP_2) env.TARGET_APP_2 = TARGET_APP_2;
  if (TARGET_APPS) env.TARGET_APPS = TARGET_APPS;
  if (TARGET_WINDOW) env.TARGET_WINDOW = TARGET_WINDOW;
  if (TARGET_DISPLAY) env.TARGET_DISPLAY = TARGET_DISPLAY;

  let exitCode = 0;
  let outputText = '';

  try {
    const result = await execa('npx', ['tsx', testFile], {
      cwd: PROJECT_DIR,
      env,
      timeout: 60000,
      all: true,
    });
    outputText = result.all || '';
  } catch (error) {
    const err = error as { exitCode?: number; all?: string; message?: string };
    exitCode = err.exitCode ?? 1;
    outputText = err.all || err.message || String(error);
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // Save full output to log file
  const logContent = `=== Test: ${testName} ===
File: ${testFile}
Target App: ${TARGET_APP}
Exit Code: ${exitCode}
Duration: ${duration}s
Timestamp: ${new Date().toISOString()}
---
${outputText}`;

  fs.writeFileSync(logFile, logContent);

  if (exitCode === 0) {
    console.log(`\r${GREEN}✓${NC} ${BOLD}${testName}${NC} ${CYAN}(${duration}s)${NC}                    `);
    testResults.push({ name: testName, passed: true, duration, logFile });
  } else {
    // Extract error hint
    const lines = outputText.split('\n');
    const errorLines = lines.filter((l) => /error|exception|failed|cannot|undefined|null/i.test(l)).slice(0, 3);
    const errorHint = errorLines.length > 0 ? errorLines.join('\n') : lines.slice(-5).join('\n');

    console.log(`\r${RED}✗${NC} ${BOLD}${testName}${NC} ${RED}FAILED${NC} ${CYAN}(${duration}s)${NC}     `);
    console.log(`  ${YELLOW}Log: ${logFile}${NC}`);
    testResults.push({ name: testName, passed: false, duration, errorHint, logFile });
  }
}

/**
 * Print test summary
 */
function printSummary(): number {
  const totalEndTime = Date.now();
  const totalDuration = Math.round((totalEndTime - TOTAL_START_TIME) / 1000);
  const passed = testResults.filter((t) => t.passed);
  const failed = testResults.filter((t) => !t.passed);

  console.log('');
  console.log('==============================================');
  console.log(`${BOLD}📊 TEST SUMMARY${NC}`);
  console.log('==============================================');
  console.log('');
  console.log(`Target App:    ${CYAN}${TARGET_APP}${NC}`);
  console.log(`Total Tests:   ${BOLD}${testResults.length}${NC}`);
  console.log(`Passed:        ${GREEN}${passed.length}${NC}`);
  console.log(`Failed:        ${RED}${failed.length}${NC}`);
  console.log(`Duration:      ${CYAN}${totalDuration}s${NC}`);
  console.log('');

  if (passed.length > 0) {
    console.log(`${GREEN}✓ Passed Tests:${NC}`);
    for (const test of passed) {
      console.log(`  ${GREEN}•${NC} ${test.name}`);
    }
    console.log('');
  }

  if (failed.length > 0) {
    console.log(`${RED}✗ Failed Tests:${NC}`);
    for (const test of failed) {
      console.log(`  ${RED}•${NC} ${test.name}`);
      if (test.errorHint) {
        console.log(`    ${YELLOW}Hint:${NC}`);
        test.errorHint.split('\n').forEach((line) => console.log(`      ${line}`));
      }
    }
    console.log('');
    console.log(`${YELLOW}📁 Full logs available in: ${LOG_DIR}${NC}`);
    console.log('');
  }

  if (failed.length === 0) {
    console.log('==============================================');
    console.log(`${GREEN}${BOLD}✅ ALL TESTS PASSED${NC}`);
    console.log('==============================================');
    return 0;
  } else {
    console.log('==============================================');
    console.log(`${RED}${BOLD}❌ ${failed.length} TEST(S) FAILED${NC}`);
    console.log('==============================================');
    console.log('');
    console.log('To debug a failed test, check the log file or run it directly:');
    console.log(`  ${CYAN}TARGET_APP="${TARGET_APP}" node --experimental-strip-types readme_examples/<example>.ts${NC}`);
    return 1;
  }
}

/**
 * List available apps
 */
async function listAvailableApps(): Promise<void> {
  const script = `
const {AudioCapture} = require('${PROJECT_DIR}/dist');
const c = new AudioCapture();
c.getAudioApps().forEach(a => console.log('  - ' + a.applicationName));
`;
  const result = await runNodeScript(script);
  console.log(result);
}

// Test categories
const TEST_CATEGORIES = [
  {
    name: 'Basics',
    tests: [
      ['01-quick-start', 'readme_examples/basics/01-quick-start.ts'],
      ['05-robust-capture', 'readme_examples/basics/05-robust-capture.ts'],
      ['11-find-apps', 'readme_examples/basics/11-find-apps.ts'],
    ],
  },
  {
    name: 'Voice & STT',
    tests: [
      ['02-stt-integration', 'readme_examples/voice/02-stt-integration.ts'],
      ['03-voice-agent', 'readme_examples/voice/03-voice-agent.ts'],
      ['04-audio-recording', 'readme_examples/voice/04-audio-recording.ts'],
    ],
  },
  {
    name: 'Streams',
    tests: [
      ['06-stream-basics', 'readme_examples/streams/06-stream-basics.ts'],
      ['07-stream-processing', 'readme_examples/streams/07-stream-processing.ts'],
    ],
  },
  {
    name: 'Processing',
    tests: [
      ['08-visualizer', 'readme_examples/processing/08-visualizer.ts'],
      ['09-volume-monitor', 'readme_examples/processing/09-volume-monitor.ts'],
      ['10-int16-capture', 'readme_examples/processing/10-int16-capture.ts'],
      ['12-manual-processing', 'readme_examples/processing/12-manual-processing.ts'],
    ],
  },
  {
    name: 'Capture Targets',
    tests: [
      ['13-multi-app-capture', 'readme_examples/capture-targets/13-multi-app-capture.ts'],
      ['14-per-app-streams', 'readme_examples/capture-targets/14-per-app-streams.ts'],
      ['15-window-capture', 'readme_examples/capture-targets/15-window-capture.ts'],
      ['16-display-capture', 'readme_examples/capture-targets/16-display-capture.ts'],
      ['17-multi-window-capture', 'readme_examples/capture-targets/17-multi-window-capture.ts'],
      ['18-multi-display-capture', 'readme_examples/capture-targets/18-multi-display-capture.ts'],
    ],
  },
  {
    name: 'Advanced',
    tests: [
      ['19-advanced-methods', 'readme_examples/advanced/19-advanced-methods.ts'],
      ['20-capture-service', 'readme_examples/advanced/20-capture-service.ts'],
      ['21-graceful-cleanup', 'readme_examples/advanced/21-graceful-cleanup.ts'],
    ],
  },
];

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Create readline interface for interactive input
  const rl = readline.createInterface({ input, output });

  try {
    // Handle app selection
    if (args[0]) {
      TARGET_APP = args[0];
      console.log('=========================================');
      console.log(`🎯 Target app: ${TARGET_APP}`);
      console.log('=========================================');

      if (args[1]) {
        TARGET_APP_2 = args[1];
        TARGET_APPS = `${TARGET_APP},${TARGET_APP_2}`;
        console.log(`🎯 Second app: ${TARGET_APP_2}`);
        console.log(`🎯 TARGET_APPS: ${TARGET_APPS}`);
        console.log('=========================================');
      }
    } else {
      TARGET_APP = await selectAppInteractive(rl);
    }

    // If no second app specified, ask interactively
    if (!TARGET_APPS) {
      const secondApp = await selectSecondAppInteractive(rl, TARGET_APP);
      if (secondApp) {
        TARGET_APP_2 = secondApp;
        TARGET_APPS = `${TARGET_APP},${TARGET_APP_2}`;
        console.log(`✅ TARGET_APPS=${TARGET_APPS}`);
      }
    }

    // Select window and display
    const selectedWindow = await selectWindowInteractive(rl);
    if (selectedWindow) TARGET_WINDOW = selectedWindow;

    const selectedDisplay = await selectDisplayInteractive(rl);
    if (selectedDisplay) TARGET_DISPLAY = selectedDisplay;

    console.log('');
    console.log(`🔊 Checking if "${TARGET_APP}" is producing audio (3 seconds)...`);

    const audioStatus = await checkAudio(TARGET_APP);

    switch (audioStatus) {
      case 'APP_NOT_FOUND':
        console.log(`❌ App "${TARGET_APP}" not found in running applications.`);
        console.log('');
        console.log('Available apps:');
        await listAvailableApps();
        process.exit(1);
      case 'SILENCE_DETECTED':
        console.log(`⚠️  App "${TARGET_APP}" is not producing audio.`);
        console.log('   Please play some audio in the app and try again.');
        process.exit(1);
      case 'NO_SAMPLES':
        console.log(`⚠️  Could not get audio samples from "${TARGET_APP}".`);
        console.log('   Make sure the app is running and has audio permissions.');
        process.exit(1);
      case 'AUDIO_DETECTED':
        console.log(`✅ Audio detected from "${TARGET_APP}"!`);
        console.log('');
        break;
      default:
        console.log(`⚠️  Unexpected result: ${audioStatus}`);
        console.log('   Continuing anyway...');
        console.log('');
        break;
    }

    console.log('=========================================');
    console.log(`🚀 ${BOLD}Starting Test Suite${NC}`);
    console.log('=========================================');
    console.log(`Target App:   ${CYAN}${TARGET_APP}${NC}`);
    if (TARGET_APPS) {
      console.log(`Multi-App:    ${CYAN}${TARGET_APPS}${NC}`);
    }
    if (TARGET_WINDOW) {
      console.log(`Window ID:    ${CYAN}${TARGET_WINDOW}${NC}`);
    }
    if (TARGET_DISPLAY) {
      console.log(`Display ID:   ${CYAN}${TARGET_DISPLAY}${NC}`);
    }
    console.log(`Log Dir:      ${CYAN}${LOG_DIR}${NC}`);
    console.log('=========================================');
    console.log('');

    // Run all tests by category
    for (const category of TEST_CATEGORIES) {
      console.log('');
      console.log(`${BOLD}📁 Category: ${category.name}${NC}`);
      console.log('-------------------------------------------');

      for (const [testName, testFile] of category.tests) {
        await runTest(testName, testFile);
      }
    }

    // Print summary and exit
    const exitCode = printSummary();
    process.exit(exitCode);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
