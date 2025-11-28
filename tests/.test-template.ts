/**
 * Unit Tests: [Feature Name]
 *
 * Brief description of what this test file covers. Include:
 * - Main functionality being tested
 * - Key behaviors and edge cases
 * - Any important dependencies or context
 *
 * @example
 * Tests for audio stream lifecycle including:
 * - Stream creation and initialization
 * - Event handling and data flow
 * - Error conditions and cleanup
 */

import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureContext, createTestContext } from './helpers/test-context';
import { assertAudioSample, assertNear, assertAudioCaptureError } from './helpers/assertions';
import { createAudioPattern } from './helpers/factories';
import type { AudioSample } from '../dist/core/types';

/**
 * Main test suite
 *
 * Organize tests into logical groups using nested test blocks.
 * Each group should test a specific aspect of the feature.
 */
test('[Feature Name]', async (t) => {
  /**
   * Test Group: [Specific Functionality]
   *
   * Description of what this group of tests covers
   */
  await t.test('[Specific Functionality]', async (t) => {
    /**
     * Individual test case with clear description
     * Format: "should [expected behavior] when [condition]"
     */
    await t.test('should [do something] when [condition]', (t: TestContext, done: () => void) => {
      // Arrange: Set up test context and dependencies
      const { capture, native } = createCaptureContext();
      const expectedValue = 42;

      // Act: Perform the action being tested
      capture.startCapture(100, { minVolume: 0 });

      // Assert: Verify the expected behavior
      capture.once('audio', (sample: AudioSample) => {
        assert.equal(sample.sampleRate, expectedValue);
        assertAudioSample(sample, { format: 'float32' });

        // Cleanup
        capture.stopCapture();
        done();
      });

      // Trigger the test scenario
      native?.simulateAudio();
    });

    /**
     * Synchronous test example (no done callback needed)
     */
    await t.test('should handle synchronous operations', () => {
      // Arrange
      const { AudioCapture } = createTestContext();
      const capture = new AudioCapture();

      // Act
      const isCapturing = capture.isCapturing();

      // Assert
      assert.equal(isCapturing, false);
    });
  });

  /**
   * Test Group: Edge Cases
   *
   * Test boundary conditions, error handling, and unusual scenarios
   */
  await t.test('Edge Cases', async (t) => {
    await t.test('should handle invalid input gracefully', () => {
      const { AudioCapture } = createTestContext();
      const capture = new AudioCapture();

      // Assert that error is thrown
      assert.throws(
        () => capture.startCapture(-1),
        (err: any) => {
          assertAudioCaptureError(err, {
            code: 'INVALID_PARAMETER',
            message: /invalid.*interval/i
          });
          return true;
        }
      );
    });

    await t.test('should handle null or undefined values', () => {
      // Test null/undefined handling
      const value = null;
      assert.strictEqual(value, null);
    });

    await t.test('should handle extreme values', (t: TestContext, done: () => void) => {
      const { capture, native } = createCaptureContext();
      capture.startCapture(100, { minVolume: 0 });

      capture.once('audio', (sample: AudioSample) => {
        // Use assertNear for floating point comparisons
        assertNear(sample.rms, 0.5, 0.01, 'RMS should be approximately 0.5');
        capture.stopCapture();
        done();
      });

      native?.simulateAudio({
        data: createAudioPattern('extreme', 1024),
        sampleRate: 48000,
        channelCount: 2,
        timestamp: 0
      });
    });
  });

  /**
   * Test Group: Error Handling
   *
   * Verify proper error handling and recovery
   */
  await t.test('Error Handling', async (t) => {
    await t.test('should emit error event on failure', (t: TestContext, done: () => void) => {
      const { capture } = createCaptureContext({ shouldFail: true });

      capture.once('error', (error: any) => {
        assertAudioCaptureError(error);
        done();
      });

      capture.startCapture(100);
    });

    await t.test('should clean up resources after error', () => {
      const { capture } = createCaptureContext();

      try {
        // Trigger error condition
        capture.startCapture(-1);
      } catch (error) {
        // Verify cleanup occurred
        assert.equal(capture.isCapturing(), false);
      }
    });
  });

  /**
   * Test Group: Cleanup and Resource Management
   *
   * Ensure proper cleanup of resources
   */
  await t.test('Cleanup', async (t) => {
    await t.test('should clean up listeners on stop', (t: TestContext, done: () => void) => {
      const { capture } = createCaptureContext();

      capture.startCapture(100);
      const initialListeners = capture.listenerCount('audio');

      capture.stopCapture();
      const finalListeners = capture.listenerCount('audio');

      // Verify listeners were cleaned up
      assert.ok(finalListeners <= initialListeners);
      done();
    });
  });
});

/**
 * TESTING BEST PRACTICES:
 *
 * 1. Test Organization:
 *    - Group related tests using nested test blocks
 *    - Use descriptive names: "should [expected] when [condition]"
 *    - Order tests from simple to complex
 *
 * 2. Test Structure:
 *    - Follow AAA pattern: Arrange, Act, Assert
 *    - Keep tests focused on one behavior
 *    - Make tests independent (no shared state)
 *
 * 3. Assertions:
 *    - Use domain-specific assertions (assertAudioSample, etc.)
 *    - Use assertNear for floating point comparisons
 *    - Provide clear assertion messages
 *
 * 4. Async Testing:
 *    - Use done() callback for event-driven tests
 *    - Always call done() exactly once
 *    - Clean up in callbacks (stopCapture, etc.)
 *
 * 5. Type Safety:
 *    - Import types from dist/ folder
 *    - Use TestContext type for test parameter
 *    - Type callback parameters
 *
 * 6. Mocking:
 *    - Use createCaptureContext() for capture tests
 *    - Use createTestContext() for SDK-only tests
 *    - Configure mocks via options parameter
 *
 * 7. Documentation:
 *    - Add JSDoc comments for test groups
 *    - Explain complex test scenarios
 *    - Document expected behavior
 */
