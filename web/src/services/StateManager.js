/**
 * Perch Web - State Manager
 * 옵저버 패턴 상태 관리자
 * @module StateManager
 */

import CONFIG from '../config/index.js';

// ============================================
// Types
// ============================================

/**
 * @typedef {Object} Settings
 * @property {number} topK - 상위 결과 수
 * @property {number} threshold - 임계값 (0-1)
 * @property {boolean} autoClassify - 자동 분류
 */

/**
 * @typedef {Object} AppState
 * @property {import('onnxruntime-web').InferenceSession | null} session
 * @property {string[] | null} labels
 * @property {Object<string, string> | null} koreanNames
 * @property {boolean} isModelLoaded
 * @property {boolean} isRecording
 * @property {AudioContext | null} audioContext
 * @property {MediaRecorder | null} mediaRecorder
 * @property {Blob[]} audioChunks
 * @property {AnalyserNode | null} analyser
 * @property {number | null} animationFrameId
 * @property {number | null} recordingStartTime
 * @property {Settings} settings
 */

/**
 * @typedef {'session' | 'labels' | 'koreanNames' | 'isModelLoaded' | 'isRecording' |
 *           'audioContext' | 'mediaRecorder' | 'audioChunks' | 'analyser' |
 *           'animationFrameId' | 'recordingStartTime' | 'settings'} StateKey
 */

/**
 * @callback StateChangeHandler
 * @param {any} newValue
 * @param {any} oldValue
 * @param {StateKey} key
 */

// ============================================
// State Manager
// ============================================

class StateManager {
    /** @type {AppState} */
    #state;
    /** @type {Map<StateKey, Set<StateChangeHandler>>} */
    #observers;
    /** @type {Set<StateChangeHandler>} */
    #globalObservers;

    constructor() {
        this.#state = this.#createInitialState();
        this.#observers = new Map();
        this.#globalObservers = new Set();
    }

    /**
     * 초기 상태 생성
     * @returns {AppState}
     */
    #createInitialState() {
        return {
            session: null,
            labels: null,
            koreanNames: null,
            isModelLoaded: false,
            isRecording: false,
            audioContext: null,
            mediaRecorder: null,
            audioChunks: [],
            analyser: null,
            animationFrameId: null,
            recordingStartTime: null,
            settings: {
                topK: CONFIG.defaultTopK,
                threshold: CONFIG.defaultThreshold,
                autoClassify: true,
            },
        };
    }

    // ============================================
    // Get
    // ============================================

    /**
     * 상태 조회
     * @template {StateKey} K
     * @param {K} key
     * @returns {AppState[K]}
     */
    get(key) {
        return this.#state[key];
    }

    /**
     * 스냅샷 반환 (Readonly)
     * @returns {Readonly<AppState>}
     */
    getSnapshot() {
        return Object.freeze({ ...this.#state });
    }

    /**
     * 설정 조회 (Readonly)
     * @returns {Readonly<Settings>}
     */
    getSettings() {
        return Object.freeze({ ...this.#state.settings });
    }

    // ============================================
    // Set
    // ============================================

    /**
     * 상태 설정
     * @template {StateKey} K
     * @param {K} key
     * @param {AppState[K]} value
     */
    set(key, value) {
        const oldValue = this.#state[key];

        if (oldValue === value) return;

        this.#state[key] = value;
        this.#notifyObservers(key, value, oldValue);
    }

    /**
     * 다중 상태 설정
     * @param {Partial<AppState>} updates
     */
    setMany(updates) {
        for (const [key, value] of Object.entries(updates)) {
            this.set(/** @type {StateKey} */(key), value);
        }
    }

    /**
     * 설정 업데이트
     * @param {Partial<Settings>} updates
     */
    updateSettings(updates) {
        const oldSettings = { ...this.#state.settings };
        const newSettings = { ...oldSettings, ...updates };

        this.#state.settings = newSettings;
        this.#notifyObservers('settings', newSettings, oldSettings);
    }

    // ============================================
    // Observer
    // ============================================

    /**
     * 구독
     * @param {StateKey} key
     * @param {StateChangeHandler} handler
     * @returns {() => void} 구독 해제
     */
    subscribe(key, handler) {
        if (!this.#observers.has(key)) {
            this.#observers.set(key, new Set());
        }

        this.#observers.get(key).add(handler);

        return () => {
            this.#observers.get(key)?.delete(handler);
        };
    }

    /**
     * 전체 구독
     * @param {StateChangeHandler} handler
     * @returns {() => void} 구독 해제
     */
    subscribeAll(handler) {
        this.#globalObservers.add(handler);

        return () => {
            this.#globalObservers.delete(handler);
        };
    }

    /**
     * 알림
     * @param {StateKey} key
     * @param {any} newValue
     * @param {any} oldValue
     */
    #notifyObservers(key, newValue, oldValue) {
        // 특정 키 옵저버
        const keyObservers = this.#observers.get(key);
        if (keyObservers) {
            for (const handler of keyObservers) {
                try {
                    handler(newValue, oldValue, key);
                } catch (error) {
                    console.error(`[StateManager] Observer error for "${key}":`, error);
                }
            }
        }

        // 전역 옵저버
        for (const handler of this.#globalObservers) {
            try {
                handler(newValue, oldValue, key);
            } catch (error) {
                console.error(`[StateManager] Global Observer error:`, error);
            }
        }
    }

    // ============================================
    // Utils
    // ============================================

    /**
     * 초기화 (Reset)
     */
    reset() {
        const oldState = { ...this.#state };
        this.#state = this.#createInitialState();

        for (const key of Object.keys(oldState)) {
            const typedKey = /** @type {StateKey} */ (key);
            if (oldState[typedKey] !== this.#state[typedKey]) {
                this.#notifyObservers(typedKey, this.#state[typedKey], oldState[typedKey]);
            }
        }
    }

    debug() {
        console.group('[StateManager] Current State');
        console.log('session:', this.#state.session ? '[Session]' : null);
        console.log('labels:', this.#state.labels?.length ?? 0);
        console.log('koreanNames:', Object.keys(this.#state.koreanNames ?? {}).length);
        console.log('isModelLoaded:', this.#state.isModelLoaded);
        console.log('isRecording:', this.#state.isRecording);
        console.log('settings:', this.#state.settings);
        console.groupEnd();
    }
}

/** @type {StateManager} */
const stateManager = new StateManager();

export { StateManager, stateManager };
export default stateManager;

