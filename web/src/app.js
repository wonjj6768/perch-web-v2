/**
 * Perch Web - Main App
 * 애플리케이션 진입점 및 조정
 * @module app
 */

import { UI_TEXT } from './config/constants.js';
import { stateManager, audioManager, modelService } from './services/index.js';
import {
    domElements,
    waveformCanvas,
    resultRenderer,
    loadingUI,
    settingsModal,
    recordButton,
    uploadArea,
} from './components/index.js';

// ============================================
// App Definition
// ============================================

class App {
    /** @type {boolean} */
    #initialized = false;

    // ============================================
    // Init
    // ============================================

    /**
     * 애플리케이션 초기화
     */
    async initialize() {
        if (this.#initialized) {
            console.warn('이미 초기화됨');
            return;
        }

        try {
            domElements.preload();

            loadingUI.updateProgress(UI_TEXT.LOADING_AUDIO_CONTEXT);
            await audioManager.initialize();

            loadingUI.updateProgress(UI_TEXT.LOADING_LABELS);
            await modelService.initialize({
                onProgress: (stats) => loadingUI.updateDownloadProgress(stats),
                onStatusUpdate: (message) => {
                    if (message === UI_TEXT.LOADING_SESSION) {
                        loadingUI.startLoadingTimer(message);
                    } else {
                        loadingUI.stopLoadingTimer();
                        loadingUI.updateProgress(message);
                    }
                }
            });

            loadingUI.stopLoadingTimer();
            loadingUI.stopTipRotation();

            loadingUI.updateProgress(UI_TEXT.LOADING_UI);
            this.#initializeComponents();

            loadingUI.hide();
            stateManager.set('isModelLoaded', true);

            this.#initialized = true;
            console.log('Perch Web 초기화 완료');

        } catch (error) {
            console.error('초기화 실패:', error);
            loadingUI.updateProgress(`오류: ${error.message}`);
            loadingUI.stopTipRotation();
        }
    }

    /**
     * 컴포넌트 초기화
     */
    #initializeComponents() {
        waveformCanvas.initialize();
        settingsModal.initialize();

        recordButton.initialize({
            onStart: () => this.#handleRecordStart(),
            onStop: () => this.#handleRecordStop(),
        });

        uploadArea.initialize((file) => this.#handleFileUpload(file));

        domElements.retryBtn?.addEventListener('click', () => {
            resultRenderer.hideResults();
        });
    }

    // ============================================
    // Handlers
    // ============================================

    async #handleRecordStart() {
        try {
            await audioManager.startRecording({
                onStop: (blob) => this.#classifyAudioBlob(blob),
                onError: (error) => {
                    console.error('녹음 오류:', error);
                    resultRenderer.showError(error.message);
                },
            });

            waveformCanvas.startVisualization();

        } catch (error) {
            console.error('녹음 시작 실패:', error);
            alert(error.message);
        }
    }

    #handleRecordStop() {
        audioManager.stopRecording();
        waveformCanvas.stopVisualization();
    }

    async #handleFileUpload(file) {
        await this.#classifyAudioFile(file);
    }

    // ============================================
    // Classification
    // ============================================

    /**
     * 오디오 Blob 분류
     */
    async #classifyAudioBlob(blob) {
        try {
            resultRenderer.showLoading(UI_TEXT.CLASSIFYING);

            const audioData = await audioManager.processBlob(blob);
            const results = await modelService.classify(audioData);

            resultRenderer.displayResults(results);

        } catch (error) {
            console.error('분류 실패:', error);
            resultRenderer.showError(UI_TEXT.ERROR_CLASSIFICATION);
        }
    }

    /**
     * 오디오 파일 분류
     */
    async #classifyAudioFile(file) {
        try {
            resultRenderer.showLoading(UI_TEXT.PROCESSING_FILE);

            const audioData = await audioManager.processFile(file);
            const results = await modelService.classify(audioData);

            resultRenderer.displayResults(results);

        } catch (error) {
            console.error('파일 분류 실패:', error);
            resultRenderer.showError(UI_TEXT.ERROR_FILE_PROCESSING);
        }
    }

    // ============================================
    // Service Worker
    // ============================================

    /**
     * Service Worker 등록
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./service-worker.js');
                console.log('SW 등록:', registration.scope);
            } catch (error) {
                console.warn('SW 에러:', error);
            }
        }
    }

    // ============================================
    // Cleanup
    // ============================================

    dispose() {
        audioManager.dispose();
        waveformCanvas.dispose();
        loadingUI.dispose();
        stateManager.reset();
        this.#initialized = false;
    }
}

// ============================================
// Entry Point
// ============================================

const app = new App();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
    app.initialize();
}

app.registerServiceWorker();

export { App, app };
export default app;

