/**
 * Perch Web - Audio Utilities
 * 오디오 처리 유틸리티
 * @module audio-utils
 */

import { SAMPLE_RATE, AUDIO_SAMPLES, SUPPORTED_MIME_TYPES } from '../config/constants.js';

// ============================================
// Resampling
// ============================================

/**
 * 선형 보간 리샘플링
 * @param {Float32Array} data - 입력 데이터
 * @param {number} fromRate
 * @param {number} toRate
 */
export function resampleAudio(data, fromRate, toRate) {
    if (fromRate === toRate) {
        return data;
    }

    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1);
        const t = srcIndex - srcIndexFloor;

        result[i] = data[srcIndexFloor] * (1 - t) + data[srcIndexCeil] * t;
    }

    return result;
}

// ============================================
// Buffer Processing
// ============================================

/**
 * AudioBuffer 전처리 (1채널, 리샘플링, 패딩)
 * @param {AudioBuffer} audioBuffer
 * @param {number} [targetSampleRate]
 * @param {number} [targetLength]
 */
export function processAudioBuffer(audioBuffer, targetSampleRate = SAMPLE_RATE, targetLength = AUDIO_SAMPLES) {
    const channelData = audioBuffer.getChannelData(0);

    let samples;
    if (audioBuffer.sampleRate !== targetSampleRate) {
        samples = resampleAudio(channelData, audioBuffer.sampleRate, targetSampleRate);
    } else {
        samples = channelData;
    }

    const result = new Float32Array(targetLength);

    if (samples.length >= targetLength) {
        const start = Math.floor((samples.length - targetLength) / 2);
        result.set(samples.slice(start, start + targetLength));
    } else {
        const offset = Math.floor((targetLength - samples.length) / 2);
        result.set(samples, offset);
    }

    return result;
}

// ============================================
// MIME Type
// ============================================

/**
 * 지원 MIME 타입 확인
 */
export function getSupportedMimeType() {
    for (const mimeType of SUPPORTED_MIME_TYPES) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }
    return ''; // Let the browser choose when no advertised MIME type matches.
}

/**
 * 확장자로 MIME 타입 추론
 * @param {string} filename
 */
export function getMimeTypeFromExtension(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();

    const mimeMap = {
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'webm': 'audio/webm',
        'flac': 'audio/flac',
    };

    return mimeMap[ext] ?? null;
}

// ============================================
// Formatting
// ============================================

/**
 * 시간 포맷 변환 (MM:SS)
 * @param {number} ms
 */
export function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);

    return `${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
}

/**
 * 바이트 단위 변환 (자동 스케일링)
 * @param {number} bytes
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================
// Validation
// ============================================

/**
 * 오디오 파일 검증 (크기, 타입)
 * @param {File} file
 */
export function validateAudioFile(file) {
    if (!file) {
        return { valid: false, error: '파일 없음' };
    }

    if (!file.type.startsWith('audio/') && !getMimeTypeFromExtension(file.name)) {
        return { valid: false, error: '오디오 파일 아님' };
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: '50MB 초과' };
    }

    return { valid: true };
}

// ============================================
// Normalization
// ============================================

/**
 * 정규화 (-1 ~ 1)
 * @param {Float32Array} data
 */
export function normalizeAudio(data) {
    let maxAbs = 0;
    for (const sample of data) maxAbs = Math.max(maxAbs, Math.abs(sample));

    if (maxAbs === 0) {
        return data;
    }

    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] / maxAbs;
    }

    return result;
}


/** Mix every channel and resample the entire recording with the browser's audio resampler. */
export async function prepareFullAudio(audioBuffer) {
    if (!audioBuffer.length || !Number.isFinite(audioBuffer.duration)) throw new Error('비어 있는 오디오입니다');
    if (audioBuffer.duration > 20 * 60) throw new Error('한 번에 최대 20분까지 분석할 수 있습니다. 파일을 나누어 주세요');
    const length = Math.ceil(audioBuffer.duration * SAMPLE_RATE);
    const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const context = new OfflineContext(1, length, SAMPLE_RATE);
    const mono = context.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
    const target = mono.getChannelData(0);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const input = audioBuffer.getChannelData(channel);
        for (let i = 0; i < input.length; i++) target[i] += input[i] / audioBuffer.numberOfChannels;
    }
    const source = context.createBufferSource();
    source.buffer = mono;
    source.connect(context.destination);
    source.start();
    return (await context.startRendering()).getChannelData(0);
}
