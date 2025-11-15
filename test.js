#!/usr/bin/env node

/**
 * Basic test to verify package functionality
 * Run: npm test
 */

const AudioCapture = require('./sdk');

console.log('ScreenCaptureKit Audio Capture - Basic Test\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

// Test 1: Module loads
test('Module loads successfully', () => {
  if (!AudioCapture) throw new Error('AudioCapture not exported');
});

// Test 2: Can create instance
let capture;
test('Can create AudioCapture instance', () => {
  capture = new AudioCapture();
  if (!capture) throw new Error('Failed to create instance');
});

// Test 3: Get applications
let apps;
test('Can get available applications', () => {
  apps = capture.getApplications();
  if (!Array.isArray(apps)) throw new Error('getApplications() did not return array');
});

// Test 4: Application structure
test('Applications have correct structure', () => {
  if (apps.length > 0) {
    const app = apps[0];
    if (typeof app.processId !== 'number') throw new Error('Missing processId');
    if (typeof app.bundleIdentifier !== 'string') throw new Error('Missing bundleIdentifier');
    if (typeof app.applicationName !== 'string') throw new Error('Missing applicationName');
  }
});

// Test 5: Static methods exist
test('Static methods exist', () => {
  if (typeof AudioCapture.rmsToDb !== 'function') throw new Error('Missing rmsToDb');
  if (typeof AudioCapture.peakToDb !== 'function') throw new Error('Missing peakToDb');
  if (typeof AudioCapture.calculateDb !== 'function') throw new Error('Missing calculateDb');
});

// Test 6: RMS to dB calculation
test('RMS to dB calculation works', () => {
  const db = AudioCapture.rmsToDb(0.5);
  if (typeof db !== 'number') throw new Error('rmsToDb did not return number');
  if (!isFinite(db)) throw new Error('rmsToDb returned invalid value');
  // 0.5 RMS should be approximately -6.02 dB
  if (Math.abs(db - (-6.02)) > 0.1) throw new Error('Incorrect calculation');
});

// Test 7: Instance methods exist
test('Instance methods exist', () => {
  if (typeof capture.getApplications !== 'function') throw new Error('Missing getApplications');
  if (typeof capture.findApplication !== 'function') throw new Error('Missing findApplication');
  if (typeof capture.startCapture !== 'function') throw new Error('Missing startCapture');
  if (typeof capture.stopCapture !== 'function') throw new Error('Missing stopCapture');
  if (typeof capture.isCapturing !== 'function') throw new Error('Missing isCapturing');
});

// Test 8: Initial state
test('Initial state is not capturing', () => {
  const capturing = capture.isCapturing();
  if (capturing !== false) throw new Error('Should not be capturing initially');
});

// Test 9: Find application
test('Can search for applications', () => {
  if (apps.length > 0) {
    const firstApp = apps[0];
    const found = capture.findApplication(firstApp.applicationName);
    if (!found) throw new Error('findApplication failed');
    if (found.processId !== firstApp.processId) throw new Error('Wrong app returned');
  }
});

// Print results
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);
console.log(`${'='.repeat(50)}\n`);

if (apps.length === 0) {
  console.warn('⚠️  Warning: No applications found.');
  console.warn('   Screen Recording permission may not be granted.');
  console.warn('   Grant permission in System Preferences → Privacy & Security');
} else {
  console.log(`✓ Found ${apps.length} available applications`);
  console.log('\nTo test audio capture, run:');
  console.log(`  node examples/example-sdk.js ${apps[0].applicationName}`);
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All basic tests passed!\n');
  process.exit(0);
}
