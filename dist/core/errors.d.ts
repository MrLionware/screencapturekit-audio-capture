/**
 * Error handling for ScreenCaptureKit Audio Capture SDK
 * Provides machine-readable error codes and structured error details
 */
/**
 * Error codes for machine-readable error handling
 */
export declare enum ErrorCode {
    PERMISSION_DENIED = "ERR_PERMISSION_DENIED",
    APP_NOT_FOUND = "ERR_APP_NOT_FOUND",
    INVALID_ARGUMENT = "ERR_INVALID_ARGUMENT",
    ALREADY_CAPTURING = "ERR_ALREADY_CAPTURING",
    CAPTURE_FAILED = "ERR_CAPTURE_FAILED",
    PROCESS_NOT_FOUND = "ERR_PROCESS_NOT_FOUND"
}
/**
 * Backwards compatibility - export as object for existing code
 * @deprecated Use ErrorCode enum instead
 */
export declare const ErrorCodes: {
    readonly PERMISSION_DENIED: ErrorCode.PERMISSION_DENIED;
    readonly APP_NOT_FOUND: ErrorCode.APP_NOT_FOUND;
    readonly INVALID_ARGUMENT: ErrorCode.INVALID_ARGUMENT;
    readonly ALREADY_CAPTURING: ErrorCode.ALREADY_CAPTURING;
    readonly CAPTURE_FAILED: ErrorCode.CAPTURE_FAILED;
    readonly PROCESS_NOT_FOUND: ErrorCode.PROCESS_NOT_FOUND;
};
/**
 * Custom error class with machine-readable error codes and structured details
 */
export declare class AudioCaptureError extends Error {
    /**
     * Machine-readable error code
     */
    readonly code: ErrorCode;
    /**
     * Additional error details for debugging
     */
    readonly details: Readonly<Record<string, unknown>>;
    /**
     * Create a new AudioCaptureError
     * @param message - Human-readable error message
     * @param code - Machine-readable error code
     * @param details - Additional error details
     */
    constructor(message: string, code: ErrorCode, details?: Record<string, unknown>);
    /**
     * Type guard to check if an error is an AudioCaptureError
     */
    static isAudioCaptureError(error: unknown): error is AudioCaptureError;
    /**
     * Create a permission denied error
     */
    static permissionDenied(availableApps?: number): AudioCaptureError;
    /**
     * Create an app not found error
     */
    static appNotFound(identifier: unknown, availableApps: string[]): AudioCaptureError;
    /**
     * Create a process not found error
     */
    static processNotFound(processId: number): AudioCaptureError;
    /**
     * Create an invalid argument error
     */
    static invalidArgument(message: string, details?: Record<string, unknown>): AudioCaptureError;
    /**
     * Create an already capturing error
     */
    static alreadyCapturing(currentInfo: Record<string, unknown>): AudioCaptureError;
    /**
     * Create a capture failed error
     */
    static captureFailed(message?: string, details?: Record<string, unknown>): AudioCaptureError;
}
//# sourceMappingURL=errors.d.ts.map