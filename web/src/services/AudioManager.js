/**
 * Perch Web - Audio Manager
 * 오디오 녹음 및 처리 관리자
 * @module AudioManager
 */

import { SAMPLE_RATE, RECORDING_DURATION_MS, FFT_SIZE, SMOOTHING_TIME_CONSTANT } from '../config/constants.js';
import stateManager from './StateManager.js';
import { getSupportedMimeType, prepareFullAudio } from '../utils/audio-utils.js';
import { AudioError } from '../utils/errors.js';

// ============================================
// Types
// ============================================

/**
 * @typedef {Object} RecordingCallbacks
 * @property {(blob: Blob) => void} [onStop] - 녹음 종료 콜백
 * @property {(error: AudioError) => void} [onError] - 에러 콜백
 */

// ============================================
// Audio Manager
// ============================================

class AudioManager {
    /** @type {AudioContext | null} */
    #audioContext = null;

    /** @type {AnalyserNode | null} */
    #analyser = null;

    /** @type {MediaRecorder | null} */
    #mediaRecorder = null;

    /** @type {MediaStream | null} */
    #mediaStream = null;

    /** @type {Blob[]} */
    #audioChunks = [];

    /** @type {boolean} */
    #isRecording = false;

    /** @type {number | null} */
    #recordingStartTime = null;

    /** @type {number | null} */
    #autoStopTimeout = null;

    /** @type {RecordingCallbacks} */
    #callbacks = {};
    #starting = false;
    #stopPending = false;
    #generation = 0;
    #source = null;

    // ============================================
    // Initialization
    // ============================================

    /**
     * 오디오 컨텍스트 초기화
     */
    async initialize() {
        if (this.#audioContext) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.#audioContext = new AudioContextClass({
                sampleRate: SAMPLE_RATE,
            });

            this.#analyser = this.#audioContext.createAnalyser();
            this.#analyser.fftSize = FFT_SIZE;
            this.#analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

            stateManager.set('audioContext', this.#audioContext);
            stateManager.set('analyser', this.#analyser);

            console.log('[AudioManager] Initialized');
        } catch (error) {
            throw AudioError.contextInitFailed(error);
        }
    }

    // ============================================
    // Recording
    // ============================================

    /**
     * 녹음 시작
     * @param {RecordingCallbacks} [callbacks]
     */
    async startRecording(callbacks = {}) {
        if (this.#starting || this.#isRecording || this.#stopPending) return;
        this.#starting = true;
        const generation = ++this.#generation;
        this.#callbacks = callbacks;

        try {
            if (this.#audioContext?.state === 'suspended') {
                await this.#audioContext.resume();
            }

            this.#mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            if (generation !== this.#generation) {
                this.#mediaStream.getTracks().forEach(track => track.stop());
                this.#mediaStream = null;
                return;
            }
            this.#source = this.#audioContext.createMediaStreamSource(this.#mediaStream);
            this.#source.connect(this.#analyser);

            const mimeType = getSupportedMimeType();
            this.#mediaRecorder = new MediaRecorder(this.#mediaStream, mimeType ? { mimeType } : {});

            this.#audioChunks = [];

            this.#mediaRecorder.ondataavailable = (event) => {
                if (generation !== this.#generation) return;
                if (event.data.size > 0) {
                    this.#audioChunks.push(event.data);
                }
            };

            this.#mediaRecorder.onstop = () => {
                if (generation !== this.#generation) return;
                this.#handleRecordingStop();
            };

            this.#mediaRecorder.onerror = (event) => {
                if (generation !== this.#generation) return;
                console.error('[AudioManager] Record error:', event.error);
                const onError = this.#callbacks.onError;
                this.#callbacks = {}; // Never classify a failed or partial recorder error.
                this.stopRecording();
                onError?.(AudioError.recordingStartFailed(event.error));
            };

            this.#mediaRecorder.start();
            this.#isRecording = true;
            this.#recordingStartTime = Date.now();

            stateManager.set('isRecording', true);
            stateManager.set('recordingStartTime', this.#recordingStartTime);
            stateManager.set('mediaRecorder', this.#mediaRecorder);

            this.#autoStopTimeout = setTimeout(() => {
                if (this.#isRecording) {
                    this.stopRecording();
                }
            }, RECORDING_DURATION_MS);

        } catch (error) {
            this.#mediaStream?.getTracks().forEach(track => track.stop());
            this.#mediaStream = null;
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw AudioError.permissionDenied();
            }
            throw AudioError.recordingStartFailed(error);
        } finally {
            this.#starting = false;
        }
    }

    /**
     * 녹음 중지
     */
    stopRecording() {
        if (this.#mediaRecorder && this.#isRecording) {
            if (this.#autoStopTimeout) {
                clearTimeout(this.#autoStopTimeout);
                this.#autoStopTimeout = null;
            }

            this.#stopPending = true;
            if (this.#mediaRecorder.state !== 'inactive') this.#mediaRecorder.stop();
            else this.#handleRecordingStop();
            this.#isRecording = false;

            stateManager.set('isRecording', false);
        }
    }

    #handleRecordingStop() {
        this.#stopPending = false;
        this.#isRecording = false;
        stateManager.set('isRecording', false);
        clearTimeout(this.#autoStopTimeout);
        this.#autoStopTimeout = null;
        if (this.#mediaStream) {
            this.#mediaStream.getTracks().forEach(track => track.stop());
            this.#mediaStream = null;
        }

        this.#source?.disconnect();
        this.#source = null;
        const audioBlob = new Blob(this.#audioChunks, { type: this.#mediaRecorder?.mimeType || this.#audioChunks[0]?.type || '' });
        this.#audioChunks = [];

        this.#callbacks.onStop?.(audioBlob);
    }

    // ============================================
    // Processing
    // ============================================

    /**
     * Blob -> Float32Array 변환
     */
    async processBlob(blob) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
            return prepareFullAudio(audioBuffer);
        } catch (error) {
            throw AudioError.processingFailed(error);
        }
    }

    /**
     * File -> Float32Array 변환
     */
    async processFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
            return prepareFullAudio(audioBuffer);
        } catch (error) {
            throw AudioError.processingFailed(error);
        }
    }

    // ============================================
    // Getters
    // ============================================

    get analyser() { return this.#analyser; }
    get isRecording() { return this.#isRecording; }
    get recordingStartTime() { return this.#recordingStartTime; }
    get audioContext() { return this.#audioContext; }

    dispose() {
        ++this.#generation;
        this.#callbacks = {};
        this.stopRecording();
        this.#mediaStream?.getTracks().forEach(track => track.stop());
        this.#mediaStream = null;
        this.#source?.disconnect();
        this.#source = null;

        if (this.#audioContext) {
            this.#audioContext.close();
            this.#audioContext = null;
        }

        this.#analyser = null;
        this.#mediaRecorder = null;
        this.#audioChunks = [];

        console.log('[AudioManager] Disposed');
    }
}

/** @type {AudioManager} */
const audioManager = new AudioManager();

export { AudioManager, audioManager };
export default audioManager;


