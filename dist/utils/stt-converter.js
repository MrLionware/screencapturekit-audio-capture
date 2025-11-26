"use strict";
/**
 * STTConverter - Transform stream for converting audio to STT-ready format
 * Handles common conversions: Float32 to Int16, stereo to mono, resampling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STTConverter = void 0;
const stream_1 = require("stream");
/**
 * Transform stream for converting audio to STT-ready format
 * Handles common conversions: Float32 to Int16, stereo to mono, resampling
 */
class STTConverter extends stream_1.Transform {
    /**
     * Create a new STTConverter
     * @param options - Conversion options
     * @internal
     */
    constructor(options = {}) {
        const { format = 'int16', channels = 1, objectMode = false } = options;
        // Input side (writable) always accepts objects from AudioStream
        // Output side (readable) respects the objectMode parameter
        super({
            writableObjectMode: true,
            readableObjectMode: objectMode,
        });
        this.targetFormat = format;
        this.targetChannels = channels;
        this._objectMode = objectMode;
    }
    /**
     * Convert Float32 buffer to Int16
     * @internal
     */
    _convertToInt16(buffer) {
        const float32 = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return Buffer.from(int16.buffer);
    }
    /**
     * Convert stereo to mono by averaging channels
     * @internal
     */
    _stereoToMono(buffer, format) {
        const bytesPerSample = format === 'int16' ? 2 : 4;
        const frameCount = buffer.length / bytesPerSample / 2; // 2 channels
        const mono = Buffer.allocUnsafe(frameCount * bytesPerSample);
        if (format === 'int16') {
            const stereo = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
            const monoView = new Int16Array(mono.buffer, mono.byteOffset, frameCount);
            for (let i = 0; i < frameCount; i++) {
                monoView[i] = Math.floor((stereo[i * 2] + stereo[i * 2 + 1]) / 2);
            }
        }
        else {
            const stereo = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
            const monoView = new Float32Array(mono.buffer, mono.byteOffset, frameCount);
            for (let i = 0; i < frameCount; i++) {
                monoView[i] = (stereo[i * 2] + stereo[i * 2 + 1]) / 2;
            }
        }
        return mono;
    }
    /**
     * Transform audio data
     * @internal
     */
    _transform(chunk, _encoding, callback) {
        try {
            // Handle both object input (from AudioStream) and buffer input (for testing/flexibility)
            // Check if chunk has a 'data' property to determine if it's an object or buffer
            const sample = chunk && typeof chunk === 'object' && 'data' in chunk
                ? chunk
                : {
                    data: chunk,
                    format: 'float32',
                    channels: 2,
                };
            let data = sample.data;
            let currentFormat = sample.format || 'float32';
            let currentChannels = sample.channels || 2;
            // Convert format if needed
            if (currentFormat === 'float32' && this.targetFormat === 'int16') {
                data = this._convertToInt16(data);
                currentFormat = 'int16';
            }
            // Convert channels if needed
            if (currentChannels === 2 && this.targetChannels === 1) {
                data = this._stereoToMono(data, currentFormat);
                currentChannels = 1;
            }
            // Output based on mode
            if (this._objectMode) {
                // Pass through modified sample object
                this.push({
                    ...sample,
                    data,
                    format: currentFormat,
                    channels: currentChannels,
                });
            }
            else {
                // Just push the converted buffer
                this.push(data);
            }
            callback();
        }
        catch (err) {
            callback(err);
        }
    }
}
exports.STTConverter = STTConverter;
//# sourceMappingURL=stt-converter.js.map