/**
 * Perch Web - Config
 * 환경 설정 검증
 * @module config
 */

import * as CONSTANTS from './constants.js';

// ============================================
// Environment
// ============================================

function detectEnvironment() {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
    }
    return 'production';
}

/** @type {'development' | 'production'} */
export const ENV = detectEnvironment();
export const IS_DEV = ENV === 'development';
export const IS_PROD = ENV === 'production';

// ============================================
// Config Object
// ============================================

/**
 * @typedef {Object} AppConfig
 * @property {number} sampleRate
 * @property {number} audioDuration
 * @property {number} audioSamples
 * @property {number} recordingDuration
 * @property {string[]} modelUrls
 * @property {string} onnxWasmPath
 * @property {string} labelsPath
 * @property {number} defaultTopK
 * @property {number} defaultThreshold
 * @property {number} waveformBars
 * @property {number} fftSize
 * @property {number} smoothingTimeConstant
 * @property {boolean} enableLogging
 */

/** @type {AppConfig} */
const CONFIG = Object.freeze({
    // Audio
    sampleRate: CONSTANTS.SAMPLE_RATE,
    audioDuration: CONSTANTS.AUDIO_DURATION_SECONDS,
    audioSamples: CONSTANTS.AUDIO_SAMPLES,
    recordingDuration: CONSTANTS.RECORDING_DURATION_MS,

    // Model
    modelUrls: CONSTANTS.MODEL_URLS,
    onnxWasmPath: CONSTANTS.ONNX_WASM_PATH,
    labelsPath: CONSTANTS.LABELS_PATH,

    // Classification
    defaultTopK: CONSTANTS.DEFAULT_TOP_K,
    defaultThreshold: CONSTANTS.DEFAULT_THRESHOLD,

    // Visualization
    waveformBars: CONSTANTS.WAVEFORM_BARS,
    fftSize: CONSTANTS.FFT_SIZE,
    smoothingTimeConstant: CONSTANTS.SMOOTHING_TIME_CONSTANT,

    // Development
    enableLogging: IS_DEV,
});

// ============================================
// Validation
// ============================================

/**
 * 설정 유효성 검사
 * @param {Partial<AppConfig>} config
 */
export function validateConfig(config) {
    const errors = [];

    if (config.sampleRate !== undefined) {
        if (typeof config.sampleRate !== 'number' || config.sampleRate <= 0) {
            errors.push('sampleRate must be a positive number');
        }
    }

    if (config.audioDuration !== undefined) {
        if (typeof config.audioDuration !== 'number' || config.audioDuration <= 0) {
            errors.push('audioDuration must be a positive number');
        }
    }

    if (config.defaultTopK !== undefined) {
        if (!Number.isInteger(config.defaultTopK) || config.defaultTopK < 1) {
            errors.push('defaultTopK must be a positive integer');
        }
    }

    if (config.defaultThreshold !== undefined) {
        if (typeof config.defaultThreshold !== 'number' ||
            config.defaultThreshold < 0 ||
            config.defaultThreshold > 1) {
            errors.push('defaultThreshold must be a number between 0 and 1');
        }
    }

    if (config.modelUrls !== undefined) {
        if (!Array.isArray(config.modelUrls) || config.modelUrls.length === 0) {
            errors.push('modelUrls must be a non-empty array');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * 설정 검증 (실패 시 에러)
 * @throws {Error}
 */
export function assertValidConfig(config) {
    const result = validateConfig(config);
    if (!result.valid) {
        throw new Error(`Invalid configuration: ${result.errors.join(', ')}`);
    }
}

export { CONFIG, CONSTANTS };
export default CONFIG;

