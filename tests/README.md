# Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run specific category
npm run test:unit
npm run test:integration
npm run test:edge-cases

# Run README examples integration tests (requires audio source)
npm run test:readme

# Type-check tests without running
npm run typecheck:tests

# Run single file
npm test tests/unit/audio-processing.test.ts
```

> **Note:** Tests are written in TypeScript and run via `tsx` (TypeScript executor).

## Directory Structure

```
tests/
├── unit/                          # Unit tests (single component)
│   ├── app-selection.test.ts          # App discovery & selection
│   ├── audio-processing.test.ts       # RMS, peak, format conversion
│   ├── capture-control.test.ts        # Start/stop logic
│   ├── cleanup.test.ts                # Resource lifecycle & cleanup
│   ├── permission.test.ts             # Permission verification
│   ├── static-utilities.test.ts       # Static helper methods
│   ├── stream-api.test.ts             # AudioStream
│   └── stt-converter.test.ts          # STT conversion
│
├── integration/                   # Integration tests (multi-component)
│   ├── activity-tracking.test.ts      # Activity tracking
│   ├── capability-guards.test.ts      # Capability checks
│   └── window-display.test.ts         # Window/display capture
│
├── edge-cases/                    # Boundary & error cases
│   └── validation.test.ts             # Input validation
│
├── fixtures/                      # Shared test data
│   ├── mock-data.ts                   # Reusable mocks
│   └── mock-native.ts                 # Native layer mocks
│
├── helpers/                       # Test utilities
│   ├── test-utils.ts                  # VM-based SDK loader
│   ├── test-context.ts                # Context factories
│   ├── factories.ts                   # Data factories
│   └── assertions.ts                  # Custom assertions
│
├── tsconfig.json                  # TypeScript config for tests
└── .test-template.ts              # TypeScript template for new tests
```

## Test Organization Principles

### 1. Separation of Concerns
- **Unit tests** test individual functions/classes in isolation
- **Integration tests** test how components work together  
- **Edge case tests** cover boundary conditions and error scenarios
- **README examples** validate documentation examples work (see `readme_examples/`)

### 2. Modular Design
- Each test file focuses on ONE feature or component
- Files are small (< 300 lines) and focused
- Easy to find and modify tests for specific features
- No monolithic test files

### 3. Shared Resources
- Fixtures in `fixtures/` are reusable across all tests
- Helpers in `helpers/` provide common utilities
- No duplication of test data or mock setup
- Single source of truth for mock data

### 4. Discoverability
- File names clearly indicate what they test
- Tests are grouped by functionality
- Easy to find where to add new tests
- Clear patterns to follow

## Real-World Workflows

### Adding a New Feature

**Scenario:** Adding `exportToMP3()` method

1. **Write unit test first** (TDD):
```typescript
// tests/unit/mp3-export.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../helpers/test-context';

test('MP3 Export', async (t) => {
  await t.test('should export audio to MP3 format', () => {
    const { AudioCapture } = createTestContext();
    const capture = new AudioCapture();

    const mp3Data = capture.exportToMP3(audioBuffer);

    assert.ok(mp3Data instanceof Buffer);
    assert.ok(mp3Data.length > 0);
  });

  await t.test('should handle empty buffer', () => {
    const { AudioCapture } = createTestContext();
    const capture = new AudioCapture();

    assert.throws(() => {
      capture.exportToMP3(Buffer.alloc(0));
    });
  });
});
```

2. **Run test** (it fails - expected):
```bash
npm test tests/unit/mp3-export.test.ts
```

3. **Implement the feature** in `src/audio-capture.ts`

4. **Run test again** - should pass:
```bash
npm test tests/unit/mp3-export.test.ts
```

5. **Add integration test** if needed
6. **Run all tests** to ensure nothing broke:
```bash
npm test
```

### Fixing a Bug

**Scenario:** Bug where negative audio values crash the app

1. **Add failing test** that reproduces the bug:
```typescript
// tests/edge-cases/extreme-values.test.ts
await t.test('should handle negative audio values', (t, done) => {
  const { capture, native } = createCaptureContext();
  capture.startCapture(100, { minVolume: 0 });

  capture.once('audio', (sample) => {
    assert.ok(sample.rms >= 0); // Should not crash
    done();
  });

  // Simulate negative values
  const negativeBuffer = createAudioPattern('negative', 1024);
  native.simulateAudio({ data: negativeBuffer });
});
```

2. **Run test** - it fails (crashes)
3. **Fix the bug** in `src/audio-capture.ts`
4. **Run test again** - it passes
5. **Run all tests** to ensure no regression
6. **Keep the test** - it prevents the bug from returning

### Refactoring

**Scenario:** Refactoring `_calculateRMS()` for performance

1. **Run all tests BEFORE refactoring:**
```bash
npm test  # ✓ All tests pass
```

2. **Refactor the code**

3. **Run tests again:**
```bash
npm test
```

4. **Tests ensure behavior didn't change:**
   - ✅ If tests pass → Refactoring successful!
   - ❌ If tests fail → Fix code or update tests if API changed

## Test Helpers

### Creating Test Contexts

```typescript
import { createTestContext, createCaptureContext } from '../helpers/test-context';

// Simple context
const { AudioCapture, ErrorCode } = createTestContext();

// Capture context with native mock access
const { capture, native } = createCaptureContext();
capture.startCapture(100);
native.simulateAudio(); // Trigger audio callback

// Wait for events
await waitForEvent(capture, 'audio');
```

### Using Factories

```typescript
import { createAudioSample, createMockApp } from '../helpers/factories';
import type { AudioSample, ApplicationInfo } from '../../dist';

// Create audio sample with defaults
const sample: AudioSample = createAudioSample();

// Create custom sample
const customSample: AudioSample = createAudioSample({
  format: 'int16',
  channels: 1,
  rms: 0.8
});

// Create mock app
const app: ApplicationInfo = createMockApp({
  processId: 999,
  applicationName: 'Custom App'
});
```

### Custom Assertions

```typescript
import { assertAudioSample, assertCaptureState } from '../helpers/assertions';

// Assert audio sample properties
assertAudioSample(sample, {
  format: 'int16',
  channels: 2,
  minRMS: 0.1,
  maxRMS: 1.0
});

// Assert capture state
assertCaptureState(capture, {
  capturing: true,
  processId: 100,
  targetType: 'window'
});
```

### Using Fixtures

```typescript
import { MOCK_APPS, MOCK_WINDOWS } from '../fixtures/mock-data';
import { createNativeMock } from '../fixtures/mock-native';

// Use standard mocks
const nativeMock = createNativeMock({
  apps: MOCK_APPS,
  windows: MOCK_WINDOWS
});

// Customize behavior
const customMock = createNativeMock({
  apps: MOCK_APPS,
  onStart: (config) => {
    console.log('Capture started with', config);
  }
});
```

## Test Organization Guidelines

### When to Create a New Test File

**Create a new file when:**
- ✅ Testing a NEW feature/component
- ✅ File would exceed 300 lines
- ✅ Tests belong to different category
- ✅ Tests have different setup needs

**Don't create a new file when:**
- ❌ Adding 1-2 tests to existing feature
- ❌ Tests are closely related to existing file
- ❌ It would create a file with < 20 lines

### File Naming Convention

```
tests/
  unit/
    feature-name.test.ts          # Kebab-case
    audio-processing.test.ts      # Clear, descriptive
    app-selection.test.ts         # One feature per file

  integration/
    feature-workflow.test.ts      # End-to-end flows

  edge-cases/
    feature-validation.test.ts    # Boundary tests
```

### Test Naming Convention

```typescript
import test from 'node:test';

test('Feature Name', async (t) => {
  // Pattern: should <action> when <condition>
  await t.test('should calculate RMS when audio has silence', () => {});
  await t.test('should throw APP_NOT_FOUND when app missing', () => {});
  await t.test('should filter empty names by default', () => {});
});
```

## Common Test Patterns

### Standard Test Structure (Arrange-Act-Assert)

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../helpers/test-context';

test('Feature Name', async (t) => {
  await t.test('should do something', () => {
    // Arrange - Set up test data
    const { AudioCapture } = createTestContext();
    const capture = new AudioCapture();

    // Act - Perform the action
    const result = capture.someMethod();

    // Assert - Verify the result
    assert.equal(result, expectedValue);
  });
});
```

### Testing Async Operations

```typescript
await t.test('async operation', (t, done) => {
  const { capture, native } = createCaptureContext();

  capture.once('audio', (sample) => {
    assert.ok(sample);
    capture.stopCapture();
    done();
  });

  capture.startCapture(100);
  native.simulateAudio();
});
```

### Testing Events

```typescript
import { waitForEvent } from '../helpers/test-context';

await t.test('event emission', async () => {
  const { capture } = createCaptureContext();

  const startPromise = waitForEvent(capture, 'start');
  capture.startCapture(100);

  const data = await startPromise;
  assert.equal(data.processId, 100);
});
```

### Testing Errors

```typescript
import { assertAudioCaptureError } from '../helpers/assertions';
import { ErrorCode } from '../../dist';

await t.test('error handling', () => {
  const { AudioCapture } = createTestContext();
  const capture = new AudioCapture();

  assert.throws(() => {
    capture.startCapture('NonExistent');
  }, (err) => {
    assertAudioCaptureError(err, {
      code: ErrorCode.APP_NOT_FOUND
    });
    return true;
  });
});
```

## Best Practices

### DO ✅

- Write tests FIRST or alongside implementation (TDD)
- Keep test files focused (< 300 lines)
- Use helpers and fixtures to reduce duplication
- Test both success and error paths
- Use descriptive test names
- Make tests independent (no shared state)
- Run tests before committing

### DON'T ❌

- Write monolithic test files
- Test implementation details
- Skip failing tests
- Copy-paste test code
- Write tests that depend on others
- Mock everything unnecessarily
- Leave commented-out tests

## Maintenance

### When Tests Fail

1. **Don't skip the test** - Understand why it failed
2. **Is it a real bug?** - Fix the code
3. **Did requirements change?** - Update the test
4. **Document breaking changes** - Update CHANGELOG

### Monthly Review Checklist

- [ ] Run `npm test` - all tests passing?
- [ ] Review test coverage - any gaps?
- [ ] Remove obsolete tests
- [ ] Refactor duplicated test code
- [ ] Update documentation if needed
- [ ] Check for flaky tests
- [ ] Review helpers - can they be improved?

### When Dependencies Change

1. Run tests: `npm test`
2. Fix failing tests
3. Update mocks if needed
4. Document breaking changes

### When Adding Team Members

Point new team members to:
1. **tests/README.md** (this file) - Complete testing guide
2. **tests/.test-template.ts** - TypeScript template for new tests
3. **tests/fixtures/mock-data.ts** - Available test data
4. **tests/helpers/** - Available utilities (TypeScript)

Have them:
- Read the "Real-World Workflows" section
- Follow existing test patterns
- Ask questions about test organization

## Future-Proofing

This framework is designed to scale. As your project grows:

### Easy to Add New Categories

```bash
mkdir tests/performance
# Add benchmark tests

mkdir tests/e2e
# Add end-to-end tests
```

### Easy to Add New Helpers

```typescript
// tests/helpers/performance.ts
export function measureExecutionTime(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}
```

### Easy to Add New Fixtures

```typescript
// tests/fixtures/audio-samples.ts
export const SAMPLE_PATTERNS = {
  sine: createSineWave(),
  square: createSquareWave(),
  noise: createWhiteNoise()
};
```

### Easy to Integrate New Tools

The framework easily integrates with:
- **Coverage reporting**: `c8`, `nyc`
- **Mutation testing**: `stryker`
- **Parallel execution**: Node.js `--test-concurrency`
- **CI/CD**: GitHub Actions, GitLab CI, Jenkins
- **Test reporting**: TAP reporters, JSON output
- **Benchmark tools**: Custom performance helpers

## Questions?

**Where should I add my test?**
- Testing a single function? → `unit/`
- Testing multiple components? → `integration/`
- Testing edge cases? → `edge-cases/`
- Testing README examples? → `readme_examples/` (run with `npm run test:readme`)

**How do I run just my tests?**
```bash
npm test tests/unit/my-test.test.ts
```

**How do I create mock data?**
```typescript
import { createMockApp } from '../helpers/factories';
const app = createMockApp({ processId: 999 });
```

**How do I simulate audio?**
```typescript
import { createCaptureContext } from '../helpers/test-context';
const { capture, native } = createCaptureContext();
native.simulateAudio();
```

---

## Conclusion

This testing framework is designed for the **long term**. It:

✅ **Scales** - Add files as features grow
✅ **Maintains** - Easy to find and update tests
✅ **Guides** - Clear patterns for new tests
✅ **Adapts** - Flexible architecture for changes
✅ **Performs** - Fast, parallelizable tests
✅ **Documents** - Tests serve as living documentation

**The goal:** Make testing a joy, not a burden. When tests are well-organized and easy to write, developers write MORE tests, leading to better software.

**Remember:** A good test suite is an investment that pays dividends throughout the project's lifetime. This framework provides the foundation for that investment.
