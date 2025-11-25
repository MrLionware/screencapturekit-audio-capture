/**
 * STTConverter - Transform stream for converting audio to STT-ready format
 * Handles common conversions: Float32 to Int16, stereo to mono, resampling
 */
import { Transform, TransformCallback } from 'stream';
import type { AudioFormat, AudioSample } from './types';
/**
 * Options for creating an STTConverter
 */
export interface STTConverterOptions {
    /**
     * Output format ('int16' or 'float32')
     * @default 'int16'
     */
    readonly format?: AudioFormat;
    /**
     * Output channels (1 = mono, 2 = stereo)
     * @default 1
     */
    readonly channels?: 1 | 2;
    /**
     * Pass through full sample objects with converted data
     * @default false
     */
    readonly objectMode?: boolean;
}
/**
 * Transform stream for converting audio to STT-ready format
 * Handles common conversions: Float32 to Int16, stereo to mono, resampling
 */
export declare class STTConverter extends Transform {
    /**
     * Target output format
     */
    readonly targetFormat: AudioFormat;
    /**
     * Target output channels
     */
    readonly targetChannels: 1 | 2;
    private readonly _objectMode;
    /**
     * Create a new STTConverter
     * @param options - Conversion options
     * @internal
     */
    constructor(options?: STTConverterOptions);
    /**
     * Convert Float32 buffer to Int16
     * @internal
     */
    private _convertToInt16;
    /**
     * Convert stereo to mono by averaging channels
     * @internal
     */
    private _stereoToMono;
    /**
     * Transform audio data
     * @internal
     */
    _transform(chunk: AudioSample | Buffer, _encoding: BufferEncoding, callback: TransformCallback): void;
}
//# sourceMappingURL=stt-converter.d.ts.map