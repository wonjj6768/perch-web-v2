/**
 * Perch Web - DOM Elements
 * DOM 요소 관리 (Lazy Loading)
 * @module DOMElements
 */

// ============================================
// Element IDs
// ============================================

const ELEMENT_IDS = Object.freeze({
    // 로딩
    LOADING_OVERLAY: 'loading-overlay',
    LOADING_PROGRESS: 'loading-progress',
    LOADING_BAR_FILL: 'loading-bar-fill',
    LOADING_TIP: 'loading-tip',

    // 파형
    WAVEFORM_CANVAS: 'waveform-canvas',
    TIME_DISPLAY: 'time-display',

    // 녹음
    RECORD_BTN: 'record-btn',
    RECORD_ICON: 'record-icon',
    STOP_ICON: 'stop-icon',
    RECORD_HINT: 'record-hint',

    // 업로드
    UPLOAD_AREA: 'upload-area',
    FILE_INPUT: 'file-input',

    // 결과
    RESULTS_SECTION: 'results-section',
    RESULTS_LIST: 'results-list',
    RETRY_BTN: 'retry-btn',

    // 설정
    SETTINGS_BTN: 'settings-btn',
    SETTINGS_MODAL: 'settings-modal',
    MODAL_CLOSE: 'modal-close',
    TOP_K_SELECT: 'top-k-select',
    THRESHOLD_RANGE: 'threshold-range',
    THRESHOLD_VALUE: 'threshold-value',
    AUTO_RECORD: 'auto-record',
});

// ============================================
// DOMElements Class
// ============================================

class DOMElements {
    #cache = new Map();
    #initialized = false;

    // ============================================
    // Getters
    // ============================================

    /**
     * 요소 가져오기 (캐시)
     * @param {string} id
     */
    #getElement(id) {
        if (!this.#cache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.#cache.set(id, element);
            }
            return element;
        }
        return this.#cache.get(id);
    }

    // 로딩
    get loadingOverlay() { return this.#getElement(ELEMENT_IDS.LOADING_OVERLAY); }
    get loadingProgress() { return this.#getElement(ELEMENT_IDS.LOADING_PROGRESS); }
    get loadingBarFill() { return this.#getElement(ELEMENT_IDS.LOADING_BAR_FILL); }
    get loadingTip() { return this.#getElement(ELEMENT_IDS.LOADING_TIP); }

    // 파형
    get waveformCanvas() { return /** @type {HTMLCanvasElement} */ (this.#getElement(ELEMENT_IDS.WAVEFORM_CANVAS)); }
    get timeDisplay() { return this.#getElement(ELEMENT_IDS.TIME_DISPLAY); }

    // 녹음
    get recordBtn() { return this.#getElement(ELEMENT_IDS.RECORD_BTN); }
    get recordIcon() { return this.#getElement(ELEMENT_IDS.RECORD_ICON); }
    get stopIcon() { return this.#getElement(ELEMENT_IDS.STOP_ICON); }
    get recordHint() { return this.#getElement(ELEMENT_IDS.RECORD_HINT); }

    // 업로드
    get uploadArea() { return this.#getElement(ELEMENT_IDS.UPLOAD_AREA); }
    get fileInput() { return /** @type {HTMLInputElement} */ (this.#getElement(ELEMENT_IDS.FILE_INPUT)); }

    // 결과
    get resultsSection() { return this.#getElement(ELEMENT_IDS.RESULTS_SECTION); }
    get resultsList() { return this.#getElement(ELEMENT_IDS.RESULTS_LIST); }
    get retryBtn() { return this.#getElement(ELEMENT_IDS.RETRY_BTN); }

    // 설정
    get settingsBtn() { return this.#getElement(ELEMENT_IDS.SETTINGS_BTN); }
    get settingsModal() { return this.#getElement(ELEMENT_IDS.SETTINGS_MODAL); }
    get modalClose() { return this.#getElement(ELEMENT_IDS.MODAL_CLOSE); }
    get topKSelect() { return /** @type {HTMLSelectElement} */ (this.#getElement(ELEMENT_IDS.TOP_K_SELECT)); }
    get thresholdRange() { return /** @type {HTMLInputElement} */ (this.#getElement(ELEMENT_IDS.THRESHOLD_RANGE)); }
    get thresholdValue() { return this.#getElement(ELEMENT_IDS.THRESHOLD_VALUE); }
    get autoRecord() { return /** @type {HTMLInputElement} */ (this.#getElement(ELEMENT_IDS.AUTO_RECORD)); }

    // ============================================
    // Utils
    // ============================================

    /**
     * 요소 프리로드
     */
    preload() {
        if (this.#initialized) return;

        Object.values(ELEMENT_IDS).forEach(id => {
            this.#getElement(id);
        });

        this.#initialized = true;
        console.log('DOM 요소 프리로드 완료');
    }

    clearCache() {
        this.#cache.clear();
        this.#initialized = false;
    }

    exists(id) {
        return this.#getElement(id) !== null;
    }

    getMissingElements() {
        return Object.values(ELEMENT_IDS).filter(id => !document.getElementById(id));
    }
}

/** @type {DOMElements} */
const domElements = new DOMElements();

export { DOMElements, domElements, ELEMENT_IDS };
export default domElements;

