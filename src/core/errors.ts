/**
 * Error handling for ScreenCaptureKit Audio Capture SDK
 * Provides machine-readable error codes and structured error details
 */

/**
 * Error codes for machine-readable error handling
 */
export enum ErrorCode {
  PERMISSION_DENIED = 'ERR_PERMISSION_DENIED',
  APP_NOT_FOUND = 'ERR_APP_NOT_FOUND',
  INVALID_ARGUMENT = 'ERR_INVALID_ARGUMENT',
  ALREADY_CAPTURING = 'ERR_ALREADY_CAPTURING',
  CAPTURE_FAILED = 'ERR_CAPTURE_FAILED',
  PROCESS_NOT_FOUND = 'ERR_PROCESS_NOT_FOUND',
}

/**
 * Backwards compatibility - export as object for existing code
 * @deprecated Use ErrorCode enum instead
 */
export const ErrorCodes = {
  PERMISSION_DENIED: ErrorCode.PERMISSION_DENIED,
  APP_NOT_FOUND: ErrorCode.APP_NOT_FOUND,
  INVALID_ARGUMENT: ErrorCode.INVALID_ARGUMENT,
  ALREADY_CAPTURING: ErrorCode.ALREADY_CAPTURING,
  CAPTURE_FAILED: ErrorCode.CAPTURE_FAILED,
  PROCESS_NOT_FOUND: ErrorCode.PROCESS_NOT_FOUND,
} as const;

/**
 * Custom error class with machine-readable error codes and structured details
 */
export class AudioCaptureError extends Error {
  /**
   * Machine-readable error code
   */
  public readonly code: ErrorCode;

  /**
   * Additional error details for debugging
   */
  public readonly details: Readonly<Record<string, unknown>>;

  /**
   * Create a new AudioCaptureError
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   * @param details - Additional error details
   */
  constructor(message: string, code: ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AudioCaptureError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Type guard to check if an error is an AudioCaptureError
   */
  static isAudioCaptureError(error: unknown): error is AudioCaptureError {
    return error instanceof AudioCaptureError;
  }

  /**
   * Create a permission denied error
   */
  static permissionDenied(availableApps: number = 0): AudioCaptureError {
    return new AudioCaptureError(
      'Screen Recording permission is not granted or no applications are available.\n' +
      'Please ensure Screen Recording permission is granted in:\n' +
      'System Preferences → Privacy & Security → Screen Recording',
      ErrorCode.PERMISSION_DENIED,
      {
        suggestion: 'Grant Screen Recording permission in System Preferences → Privacy & Security → Screen Recording',
        availableApps,
      }
    );
  }

  /**
   * Create an app not found error
   */
  static appNotFound(
    identifier: unknown,
    availableApps: string[]
  ): AudioCaptureError {
    const identifierStr = Array.isArray(identifier) ? identifier.join(', ') : String(identifier);
    const suggestion = availableApps.length > 0
      ? `Try one of: ${availableApps.slice(0, 5).join(', ')}${availableApps.length > 5 ? '...' : ''}`
      : 'No applications available';

    return new AudioCaptureError(
      `No application found matching: ${identifierStr}`,
      ErrorCode.APP_NOT_FOUND,
      {
        requestedIdentifiers: Array.isArray(identifier) ? identifier : [identifier],
        availableApps,
        suggestion,
      }
    );
  }

  /**
   * Create a process not found error
   */
  static processNotFound(processId: number): AudioCaptureError {
    return new AudioCaptureError(
      `No application found with process ID ${processId}.`,
      ErrorCode.PROCESS_NOT_FOUND,
      {
        requestedPid: processId,
        suggestion: 'The application may have terminated or may not be capturable.',
      }
    );
  }

  /**
   * Create an invalid argument error
   */
  static invalidArgument(
    message: string,
    details: Record<string, unknown> = {}
  ): AudioCaptureError {
    return new AudioCaptureError(message, ErrorCode.INVALID_ARGUMENT, details);
  }

  /**
   * Create an already capturing error
   */
  static alreadyCapturing(currentInfo: Record<string, unknown>): AudioCaptureError {
    return new AudioCaptureError(
      'Already capturing. Stop current capture first.',
      ErrorCode.ALREADY_CAPTURING,
      currentInfo
    );
  }

  /**
   * Create a capture failed error
   */
  static captureFailed(
    message: string = 'Failed to start capture',
    details: Record<string, unknown> = {}
  ): AudioCaptureError {
    const macOSHangHint =
      'If you are testing on macOS 15+, ScreenCaptureKit may never call startCaptureWithCompletionHandler when capturesAudio=true. ' +
      'The native layer now times out instead of hanging indefinitely.';

    return new AudioCaptureError(message, ErrorCode.CAPTURE_FAILED, {
      ...details,
      hint: macOSHangHint,
    });
  }
}
