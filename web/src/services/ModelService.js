/**
 * Perch Web - Model Service
 * Google Perch v2 모델 로드 및 추론 (ONNX Runtime Web)
 * @module ModelService
 */

import { CONFIG } from '../config/index.js';
import { UI_TEXT, MODEL_SIZE_BYTES } from '../config/constants.js';
import stateManager from './StateManager.js';
import { AudioError, ModelError } from '../utils/errors.js';

// ============================================
// Tensor Utils
// ============================================

/**
 * Softmax 확률 변환
 * @param {Float32Array} logits
 */
function softmax(logits) {
    const maxLogit = Math.max(...logits);
    const exps = logits.map(l => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sumExps);
}

// ============================================
// Model Service
// ============================================

class ModelService {
    #session = null;
    #isLoaded = false;
    #labels = [];
    #koreanNames = {};
    #cache = new Map();
    #maxCacheSize = 10;

    // ============================================
    // Init
    // ============================================

    /**
     * 초기화 (레이블 및 모델 로드)
     * @param {Object} callbacks
     */
    async initialize({ onProgress, onStatusUpdate } = {}) {
        try {
            if (onStatusUpdate) onStatusUpdate(UI_TEXT.LOADING_LABELS);
            await this.#loadLabels();

            if (typeof ort !== 'undefined') {
                ort.env.wasm.wasmPaths = CONFIG.onnxWasmPath;
            }

            if (onStatusUpdate) onStatusUpdate(UI_TEXT.LOADING_MODEL);
            await this.#loadModelWithFallback(onProgress, onStatusUpdate);

            this.#isLoaded = true;
            console.log('ModelService 초기화 완료');

        } catch (error) {
            console.error('ModelService 초기화 실패:', error);
            this.#isLoaded = false;
            throw error;
        }
    }

    /**
     * 레이블 로드
     */
    async #loadLabels() {
        try {
            const response = await fetch(CONFIG.labelsPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data.labels && Array.isArray(data.labels)) {
                this.#labels = data.labels;
                this.#koreanNames = data.koreanNames || {};
            } else if (Array.isArray(data)) {
                this.#labels = data;
                this.#koreanNames = {};
            } else {
                throw new Error('Invalid labels format');
            }

            stateManager.set('labels', this.#labels);
            stateManager.set('koreanNames', this.#koreanNames);

        } catch (error) {
            throw new Error(UI_TEXT.ERROR_LABELS_NOT_FOUND);
        }
    }

    /**
     * 모델 로드 (Fallback 지원)
     */
    async #loadModelWithFallback(onProgress, onStatusUpdate) {
        let lastError = null;

        for (const url of CONFIG.modelUrls) {
            try {
                console.log(`모델 로드 시도: ${url}`);

                // 프로그레스 표시를 위해 먼저 다운로드
                await this.#fetchModelWithProgress(url, onProgress);

                if (onStatusUpdate) {
                    onStatusUpdate(UI_TEXT.LOADING_SESSION);
                }

                // URL을 직접 전달
                this.#session = await ort.InferenceSession.create(url, {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all',
                });

                stateManager.set('session', this.#session);
                return;

            } catch (error) {
                console.warn(`로드 실패 (${url}):`, error);
                lastError = error;
            }
        }

        throw lastError || new Error(UI_TEXT.ERROR_ALL_SOURCES_FAILED);
    }

    /**
     * 프로그레스 표시하며 모델 다운로드
     * @param {string} url
     * @param {function} [onProgress]
     */
    async #fetchModelWithProgress(url, onProgress) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : MODEL_SIZE_BYTES;

        const reader = response.body.getReader();
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
                receivedLength += value.length;
            }

            if (onProgress) {
                onProgress({
                    percent: Math.min((receivedLength / total) * 100, 99),
                    message: `${(receivedLength / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`
                });
            }
        }
    }

    // ============================================
    // Inference
    // ============================================

    /**
     * 분류 실행
     * @param {Float32Array} audioData
     */
    async classify(audioData) {
        if (!this.#session || !this.#isLoaded) {
            throw new Error(UI_TEXT.ERROR_MODEL_NOT_LOADED);
        }

        const cacheKey = this.#generateCacheKey(audioData);
        if (this.#cache.has(cacheKey)) {
            console.log('캐시된 결과 사용');
            return this.#cache.get(cacheKey);
        }

        try {
            const tensor = new ort.Tensor('float32', audioData, [1, audioData.length]);

            const inputName = this.#session.inputNames[0];
            const feeds = { [inputName]: tensor };

            const results = await this.#session.run(feeds);

            const outputName = this.#findOutputName();
            const outputTensor = results[outputName];
            const logits = outputTensor.data;

            const classificationResults = this.#processResults(logits);

            this.#addToCache(cacheKey, classificationResults);

            return classificationResults;

        } catch (error) {
            console.error('추론 오류:', error);
            throw AudioError.processingFailed(error);
        }
    }

    /**
     * 출력 노드 찾기
     */
    #findOutputName() {
        for (const name of this.#session.outputNames) {
            if (name.toLowerCase().includes('label') || name.toLowerCase().includes('logits')) {
                return name;
            }
        }
        return this.#session.outputNames[this.#session.outputNames.length - 1];
    }

    /**
     * 결과 후처리 (Softmax + Top-K)
     */
    #processResults(logits) {
        const probabilities = softmax(Array.from(logits));

        const indexedProbs = probabilities.map((prob, index) => ({
            index,
            confidence: prob,
            label: this.#labels[index] || `Unknown_${index}`,
            koreanName: this.#koreanNames[this.#labels[index]] || null
        }));

        const settings = stateManager.getSettings();
        const topK = settings.topK || CONFIG.defaultTopK;
        const threshold = settings.threshold || CONFIG.defaultThreshold;

        const filtered = indexedProbs
            .filter(item => item.confidence >= threshold)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, topK);

        return filtered.map(item => ({
            label: item.label,
            koreanName: item.koreanName,
            confidence: item.confidence,
            index: item.index
        }));
    }

    // ============================================
    // Cache
    // ============================================

    /**
     * 캐시 키 생성
     */
    #generateCacheKey(data) {
        let hash = 0;
        const step = Math.floor(data.length / 100);
        for (let i = 0; i < data.length; i += step) {
            hash += data[i];
        }
        return hash.toFixed(6);
    }

    #addToCache(key, value) {
        if (this.#cache.size >= this.#maxCacheSize) {
            const firstKey = this.#cache.keys().next().value;
            this.#cache.delete(firstKey);
        }
        this.#cache.set(key, value);
    }

    get isLoaded() { return this.#isLoaded; }
}

/** @type {ModelService} */
const modelService = new ModelService();

export { ModelService, modelService };
export default modelService;

