/**
 * Perch Web - Record Button
 * 녹음 버튼 및 단축키(Space) 제어
 * @module RecordButton
 */

import { UI_TEXT } from '../config/constants.js';
import domElements from './DOMElements.js';
import stateManager from '../services/StateManager.js';

// ============================================
// Record Button
// ============================================

class RecordButton {
    #onRecordStart = null;
    #onRecordStop = null;

    // ============================================
    // Init
    // ============================================

    /**
     * 초기화 및 이벤트
     * @param {Object} callbacks
     */
    initialize({ onStart, onStop }) {
        this.#onRecordStart = onStart;
        this.#onRecordStop = onStop;

        this.#bindEvents();

        stateManager.subscribe('isRecording', (isRecording) => {
            this.#updateUI(isRecording);
        });

        console.log('RecordButton 초기화 완료');
    }

    #bindEvents() {
        domElements.recordBtn?.addEventListener('click', () => {
            this.toggle();
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat && !this.#isInputFocused(e) && !document.querySelector('[role=dialog]:not(.hidden)')) {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    #isInputFocused(e) {
        const target = /** @type {HTMLElement} */(e.target);
        return target.closest('input, select, textarea, button, a, [role=button], [contenteditable=true]');
    }

    // ============================================
    // Control
    // ============================================

    startRecording() {
        if (!domElements.recordBtn?.disabled && !stateManager.get('isRecording')) {
            this.#onRecordStart?.();
        }
    }

    stopRecording() {
        if (stateManager.get('isRecording')) {
            this.#onRecordStop?.();
        }
    }

    toggle() {
        if (stateManager.get('isRecording')) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    // ============================================
    // UI
    // ============================================

    #updateUI(isRecording) {
        const recordBtn = domElements.recordBtn;
        const recordIcon = domElements.recordIcon;
        const stopIcon = domElements.stopIcon;
        const recordHint = domElements.recordHint;

        if (isRecording) {
            recordBtn?.classList.add('recording');
            recordIcon?.classList.add('hidden');
            stopIcon?.classList.remove('hidden');

            if (recordHint) recordHint.textContent = UI_TEXT.RECORD_HINT_RECORDING;
        } else {
            recordBtn?.classList.remove('recording');
            recordIcon?.classList.remove('hidden');
            stopIcon?.classList.add('hidden');

            if (recordHint) recordHint.textContent = UI_TEXT.RECORD_HINT_IDLE;
        }
    }

    setDisabled(disabled) {
        const recordBtn = domElements.recordBtn;
        if (recordBtn) {
            /** @type {HTMLButtonElement} */(recordBtn).disabled = disabled;
            recordBtn.style.opacity = disabled ? '0.5' : '1';
            recordBtn.style.pointerEvents = disabled ? 'none' : 'auto';
        }
    }
}

/** @type {RecordButton} */
const recordButton = new RecordButton();

export { RecordButton, recordButton };
export default recordButton;

