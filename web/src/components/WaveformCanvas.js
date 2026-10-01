/**
 * Perch Web - Waveform Canvas
 * 오디오 파형 시각화
 * @module WaveformCanvas
 */

import { WAVEFORM_BARS, COLORS } from '../config/constants.js';
import domElements from './DOMElements.js';
import stateManager from '../services/StateManager.js';
import { formatTime } from '../utils/audio-utils.js';

// ============================================
// Waveform Canvas
// ============================================

class WaveformCanvas {
    /** @type {HTMLCanvasElement | null} */
    #canvas = null;
    /** @type {CanvasRenderingContext2D | null} */
    #ctx = null;
    #animationFrameId = null;
    #isAnimating = false;
    #onResize = () => this.#handleResize();

    // ============================================
    // Init
    // ============================================

    initialize() {
        this.#canvas = domElements.waveformCanvas;
        if (!this.#canvas) {
            console.error('Waveform canvas not found');
            return;
        }

        this.#ctx = this.#canvas.getContext('2d');
        this.resize();
        this.drawIdle();

        window.addEventListener('resize', this.#onResize);

        console.log('WaveformCanvas 초기화 완료');
    }

    // ============================================
    // Canvas
    // ============================================

    resize() {
        if (!this.#canvas || !this.#ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = this.#canvas.getBoundingClientRect();

        this.#canvas.width = rect.width * dpr;
        this.#canvas.height = rect.height * dpr;

        this.#ctx.scale(dpr, dpr);
    }

    #handleResize() {
        this.resize();
        if (!this.#isAnimating) {
            this.drawIdle();
        }
    }

    // ============================================
    // Draw
    // ============================================

    /**
     * 유휴 상태 그리기
     */
    drawIdle() {
        if (!this.#canvas || !this.#ctx) return;

        const width = this.#canvas.clientWidth;
        const height = this.#canvas.clientHeight;
        const barWidth = width / WAVEFORM_BARS;
        const centerY = height / 2;

        this.#ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < WAVEFORM_BARS; i++) {
            const barHeight = 4 + Math.sin(i * 0.2) * 2;
            const x = i * barWidth + barWidth / 4;

            const gradient = this.#ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
            gradient.addColorStop(0, COLORS.WAVEFORM_IDLE.START);
            gradient.addColorStop(0.5, COLORS.WAVEFORM_IDLE.MID);
            gradient.addColorStop(1, COLORS.WAVEFORM_IDLE.END);

            this.#ctx.fillStyle = gradient;
            this.#ctx.fillRect(x, centerY - barHeight, barWidth / 2, barHeight * 2);
        }
    }

    /**
     * 시각화 시작
     */
    startVisualization() {
        const analyser = stateManager.get('analyser');
        if (!analyser) {
            console.warn('Analyser not available');
            return;
        }

        this.#isAnimating = true;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
            if (!this.#isAnimating || !stateManager.get('isRecording')) {
                this.stopVisualization();
                return;
            }

            this.#animationFrameId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            this.#drawRecordingWaveform(dataArray);
            this.#updateTimeDisplay();
        };

        draw();
    }

    #drawRecordingWaveform(dataArray) {
        if (!this.#canvas || !this.#ctx) return;

        const width = this.#canvas.clientWidth;
        const height = this.#canvas.clientHeight;
        const barWidth = width / WAVEFORM_BARS;
        const centerY = height / 2;

        this.#ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < WAVEFORM_BARS; i++) {
            const dataIndex = Math.floor(i * dataArray.length / WAVEFORM_BARS);
            const value = dataArray[dataIndex] / 255;
            const barHeight = Math.max(4, value * height * 0.4);
            const x = i * barWidth + barWidth / 4;

            const gradient = this.#ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
            gradient.addColorStop(0, COLORS.WAVEFORM_RECORDING.START);
            gradient.addColorStop(0.5, COLORS.WAVEFORM_RECORDING.MID);
            gradient.addColorStop(1, COLORS.WAVEFORM_RECORDING.END);

            this.#ctx.fillStyle = gradient;
            this.#ctx.fillRect(x, centerY - barHeight, barWidth / 2, barHeight * 2);
        }
    }

    #updateTimeDisplay() {
        const startTime = stateManager.get('recordingStartTime');
        if (!startTime) return;

        const elapsed = Date.now() - startTime;
        const timeDisplay = domElements.timeDisplay;
        if (timeDisplay) {
            timeDisplay.textContent = formatTime(elapsed);
        }
    }

    stopVisualization() {
        this.#isAnimating = false;

        if (this.#animationFrameId) {
            cancelAnimationFrame(this.#animationFrameId);
            this.#animationFrameId = null;
        }

        stateManager.set('animationFrameId', null);

        const timeDisplay = domElements.timeDisplay;
        if (timeDisplay) {
            timeDisplay.textContent = '00:00';
        }

        this.drawIdle();
    }

    // ============================================
    // Cleanup
    // ============================================

    dispose() {
        this.stopVisualization();
        window.removeEventListener('resize', this.#onResize);
        this.#canvas = null;
        this.#ctx = null;
    }
}

/** @type {WaveformCanvas} */
const waveformCanvas = new WaveformCanvas();

export { WaveformCanvas, waveformCanvas };
export default waveformCanvas;

