"use strict";
/**
 * Error handling for ScreenCaptureKit Audio Capture SDK
 * Provides machine-readable error codes and structured error details
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioCaptureError = exports.ErrorCodes = exports.ErrorCode = void 0;
/**
 * Error codes for machine-readable error handling
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["PERMISSION_DENIED"] = "ERR_PERMISSION_DENIED";
    ErrorCode["APP_NOT_FOUND"] = "ERR_APP_NOT_FOUND";
    ErrorCode["INVALID_ARGUMENT"] = "ERR_INVALID_ARGUMENT";
    ErrorCode["ALREADY_CAPTURING"] = "ERR_ALREADY_CAPTURING";
    ErrorCode["CAPTURE_FAILED"] = "ERR_CAPTURE_FAILED";
    ErrorCode["PROCESS_NOT_FOUND"] = "ERR_PROCESS_NOT_FOUND";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Backwards compatibility - export as object for existing code
 * @deprecated Use ErrorCode enum instead
 */
exports.ErrorCodes = {
    PERMISSION_DENIED: ErrorCode.PERMISSION_DENIED,
    APP_NOT_FOUND: ErrorCode.APP_NOT_FOUND,
    INVALID_ARGUMENT: ErrorCode.INVALID_ARGUMENT,
    ALREADY_CAPTURING: ErrorCode.ALREADY_CAPTURING,
    CAPTURE_FAILED: ErrorCode.CAPTURE_FAILED,
    PROCESS_NOT_FOUND: ErrorCode.PROCESS_NOT_FOUND,
};
/**
 * Custom error class with machine-readable error codes and structured details
 */
class AudioCaptureError extends Error {
    /**
     * Create a new AudioCaptureError
     * @param message - Human-readable error message
     * @param code - Machine-readable error code
     * @param details - Additional error details
     */
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'AudioCaptureError';
        this.code = code;
        this.details = Object.freeze({ ...details });
        Error.captureStackTrace(this, this.constructor);
    }
    /**
     * Type guard to check if an error is an AudioCaptureError
     */
    static isAudioCaptureError(error) {
        return error instanceof AudioCaptureError;
    }
    /**
     * Create a permission denied error
     */
    static permissionDenied(availableApps = 0) {
        return new AudioCaptureError('Screen Recording permission is not granted or no applications are available.\n' +
            'Please ensure Screen Recording permission is granted in:\n' +
            'System Preferences → Privacy & Security → Screen Recording', ErrorCode.PERMISSION_DENIED, {
            suggestion: 'Grant Screen Recording permission in System Preferences → Privacy & Security → Screen Recording',
            availableApps,
        });
    }
    /**
     * Create an app not found error
     */
    static appNotFound(identifier, availableApps) {
        const identifierStr = Array.isArray(identifier) ? identifier.join(', ') : String(identifier);
        const suggestion = availableApps.length > 0
            ? `Try one of: ${availableApps.slice(0, 5).join(', ')}${availableApps.length > 5 ? '...' : ''}`
            : 'No applications available';
        return new AudioCaptureError(`No application found matching: ${identifierStr}`, ErrorCode.APP_NOT_FOUND, {
            requestedIdentifiers: Array.isArray(identifier) ? identifier : [identifier],
            availableApps,
            suggestion,
        });
    }
    /**
     * Create a process not found error
     */
    static processNotFound(processId) {
        return new AudioCaptureError(`No application found with process ID ${processId}.`, ErrorCode.PROCESS_NOT_FOUND, {
            requestedPid: processId,
            suggestion: 'The application may have terminated or may not be capturable.',
        });
    }
    /**
     * Create an invalid argument error
     */
    static invalidArgument(message, details = {}) {
        return new AudioCaptureError(message, ErrorCode.INVALID_ARGUMENT, details);
    }
    /**
     * Create an already capturing error
     */
    static alreadyCapturing(currentInfo) {
        return new AudioCaptureError('Already capturing. Stop current capture first.', ErrorCode.ALREADY_CAPTURING, currentInfo);
    }
    /**
     * Create a capture failed error
     */
    static captureFailed(message = 'Failed to start capture', details = {}) {
        const macOSHangHint = 'If you are testing on macOS 15+, ScreenCaptureKit may never call startCaptureWithCompletionHandler when capturesAudio=true. ' +
            'The native layer now times out instead of hanging indefinitely.';
        return new AudioCaptureError(message, ErrorCode.CAPTURE_FAILED, {
            ...details,
            hint: macOSHangHint,
        });
    }
}
exports.AudioCaptureError = AudioCaptureError;
//# sourceMappingURL=errors.js.map