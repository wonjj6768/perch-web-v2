/**
 * Perch Web - Loading UI
 * 로딩 오버레이 및 팁 표시
 * @module LoadingUI
 */

import { LOADING_TIPS, TIP_ROTATION_INTERVAL } from '../config/constants.js';
import domElements from './DOMElements.js';
import { formatBytes } from '../utils/audio-utils.js';

// ============================================
// Loading UI
// ============================================

class LoadingUI {
    #tipInterval = null;
    #currentTipIndex = 0;
    #timerInterval = null;

    // ============================================
    // Overlay
    // ============================================

    show() {
        const overlay = domElements.loadingOverlay;
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hide() {
        const overlay = domElements.loadingOverlay;
        if (overlay) {
            overlay.classList.add('hidden');
        }
        this.stopTipRotation();
    }

    // ============================================
    // Progress
    // ============================================

    /**
     * 텍스트 업데이트
     * @param {string} message
     */
    updateProgress(message) {
        const progressEl = domElements.loadingProgress;
        if (progressEl) {
            progressEl.textContent = message;
        }
    }

    /**
     * 바 업데이트 (0-100)
     * @param {number} percent
     */
    updateProgressBar(percent) {
        const barFill = domElements.loadingBarFill;
        if (barFill) {
            barFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    /**
     * 다운로드 상세 업데이트
     * @param {Object} stats
     */
    updateDownloadProgress(stats) {
        this.updateProgressBar(stats.percent);

        if (stats.message) {
            this.updateProgress(stats.message);
            return;
        }

        const loadedMB = formatBytes(stats.loaded);
        const speedMBps = (stats.speed / 1024 / 1024).toFixed(1);

        if (stats.total > 0) {
            const totalMB = formatBytes(stats.total);
            this.updateProgress(`${loadedMB} / ${totalMB} (${speedMBps} MB/s)`);
        } else {
            this.updateProgress(`${loadedMB} (${speedMBps} MB/s)`);
        }
    }

    resetProgressBar() {
        this.updateProgressBar(0);
    }

    // ============================================
    // Tips
    // ============================================

    startTipRotation() {
        if (this.#tipInterval) return;

        this.#currentTipIndex = 0;
        this.#showTip(this.#currentTipIndex);

        this.#tipInterval = setInterval(() => {
            this.#currentTipIndex = (this.#currentTipIndex + 1) % LOADING_TIPS.length;
            this.#showTip(this.#currentTipIndex);
        }, TIP_ROTATION_INTERVAL);
    }

    stopTipRotation() {
        if (this.#tipInterval) {
            clearInterval(this.#tipInterval);
            this.#tipInterval = null;
        }

        const tipEl = domElements.loadingTip;
        if (tipEl) {
            tipEl.textContent = '';
        }
    }

    #showTip(index) {
        const tipEl = domElements.loadingTip;
        if (!tipEl) return;

        tipEl.style.opacity = '0';

        setTimeout(() => {
            tipEl.textContent = LOADING_TIPS[index];
            tipEl.style.opacity = '1';
        }, 300);
    }

    // ============================================
    // Timer
    // ============================================

    startLoadingTimer(baseMessage) {
        this.stopLoadingTimer();
        const startTime = Date.now();

        this.updateProgress(`${baseMessage} (0s)`);

        this.#timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            this.updateProgress(`${baseMessage} (${elapsed}s)`);
        }, 1000);
    }

    stopLoadingTimer() {
        if (this.#timerInterval) {
            clearInterval(this.#timerInterval);
            this.#timerInterval = null;
        }
    }

    // ============================================
    // Cleanup
    // ============================================

    dispose() {
        this.stopTipRotation();
        this.stopLoadingTimer();
    }
}

/** @type {LoadingUI} */
const loadingUI = new LoadingUI();

export { LoadingUI, loadingUI };
export default loadingUI;

