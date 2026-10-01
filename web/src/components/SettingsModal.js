/**
 * Perch Web - Settings Modal
 * 설정 모달 (Top K, 임계값, 자동 분류)
 * @module SettingsModal
 */

import domElements from './DOMElements.js';
import stateManager from '../services/StateManager.js';

// ============================================
// Settings Modal
// ============================================

class SettingsModal {
    #isOpen = false;

    // ============================================
    // Init
    // ============================================

    /**
     * 초기화
     */
    initialize() {
        this.#syncWithState();
        this.#bindEvents();
        console.log('SettingsModal 초기화 완료');
    }

    /**
     * UI 동기화
     */
    #syncWithState() {
        const settings = stateManager.getSettings();

        const topKSelect = domElements.topKSelect;
        const thresholdRange = domElements.thresholdRange;
        const thresholdValue = domElements.thresholdValue;
        const autoRecord = domElements.autoRecord;

        if (topKSelect) topKSelect.value = String(settings.topK);
        if (thresholdRange) thresholdRange.value = String(settings.threshold * 100);
        if (thresholdValue) thresholdValue.textContent = `${Math.round(settings.threshold * 100)}%`;
        if (autoRecord) autoRecord.checked = settings.autoClassify;
    }

    #bindEvents() {
        domElements.settingsBtn?.addEventListener('click', () => this.open());
        domElements.modalClose?.addEventListener('click', () => this.close());

        domElements.settingsModal?.querySelector('.modal-backdrop')
            ?.addEventListener('click', () => this.close());

        domElements.topKSelect?.addEventListener('change', (e) => {
            const value = parseInt(/** @type {HTMLSelectElement} */(e.target).value, 10);
            stateManager.updateSettings({ topK: value });
        });

        domElements.thresholdRange?.addEventListener('input', (e) => {
            const value = parseInt(/** @type {HTMLInputElement} */(e.target).value, 10);
            stateManager.updateSettings({ threshold: value / 100 });

            const thresholdValue = domElements.thresholdValue;
            if (thresholdValue) thresholdValue.textContent = `${value}%`;
        });

        domElements.autoRecord?.addEventListener('change', (e) => {
            const checked = /** @type {HTMLInputElement} */(e.target).checked;
            stateManager.updateSettings({ autoClassify: checked });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && this.#isOpen) {
                const controls = [...domElements.settingsModal.querySelectorAll('button, select, input, [tabindex="0"]')].filter(element => !element.disabled);
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
            if (e.key === 'Escape' && this.#isOpen) {
                this.close();
            }
        });
    }

    // ============================================
    // Control
    // ============================================

    open() {
        const modal = domElements.settingsModal;
        if (modal) {
            modal.classList.remove('hidden');
            this.#isOpen = true;

            const firstFocusable = modal.querySelector('select, input, button');
            if (firstFocusable) {
                /** @type {HTMLElement} */(firstFocusable).focus();
            }
        }
    }

    close() {
        const modal = domElements.settingsModal;
        if (modal) {
            modal.classList.add('hidden');
            this.#isOpen = false;
            domElements.settingsBtn?.focus();
        }
    }

    toggle() {
        if (this.#isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    get isOpen() {
        return this.#isOpen;
    }
}

/** @type {SettingsModal} */
const settingsModal = new SettingsModal();

export { SettingsModal, settingsModal };
export default settingsModal;

