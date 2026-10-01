/**
 * Perch Web - Main App
 * 애플리케이션 진입점 및 조정
 * @module app
 */

import { UI_TEXT, AUDIO_SAMPLES, SAMPLE_RATE } from './config/constants.js';
import { analyzeSegments, exportCSV } from './utils/analysis-utils.js';
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
    #controller = null;
    #generation = 0;
    #source = null;
    #sourceURL = null;
    #report = null;
    #playbackEnd = null;
    #recordStarting = false;
    #disposed = false;

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
            loadingUI.stopLoadingTimer();
            const retry = document.getElementById('model-retry');
            if (retry) { retry.hidden = false; retry.onclick = () => location.reload(); }
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

        domElements.retryBtn?.addEventListener('click', () => this.#analyzeSource());
        document.getElementById('cancel-analysis').addEventListener('click', () => {
            this.#controller?.abort();
            this.#setStatus('중지 요청됨 · 실행 중인 구간이 끝나면 중지합니다');
        });
        document.getElementById('export-json').addEventListener('click', () => this.#export('json'));
        document.getElementById('export-csv').addEventListener('click', () => this.#export('csv'));
        const player = document.getElementById('audio-player');
        player.addEventListener('timeupdate', () => {
            if (this.#playbackEnd !== null && player.currentTime >= this.#playbackEnd) {
                player.pause(); this.#playbackEnd = null;
            }
        });
        player.addEventListener('seeking', () => {
            if (this.#playbackEnd !== null && player.currentTime > this.#playbackEnd) this.#playbackEnd = null;
        });
        window.addEventListener('pagehide', () => this.dispose(), { once: true });
        window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
    }

    // ============================================
    // Handlers
    // ============================================

    async #handleRecordStart() {
        if (this.#recordStarting || this.#controller || this.#disposed) return;
        this.#recordStarting = true;
        recordButton.setDisabled(true);
        uploadArea.setDisabled(true);
        this.#setActions(true);
        try {
            await audioManager.startRecording({
                onStop: blob => {
                    if (this.#disposed) return;
                    recordButton.setDisabled(false);
                    waveformCanvas.stopVisualization();
                    uploadArea.setDisabled(false);
                    this.#setSource(blob, '마이크 녹음');
                    if (stateManager.getSettings().autoClassify) this.#analyzeSource();
                    else {
                        resultRenderer.showLoading('녹음이 준비됐습니다. 듣고 분석 시작을 눌러 주세요');
                        this.#setStatus('녹음 준비 완료');
                        this.#setActions(false);
                    }
                },
                onError: error => {
                    waveformCanvas.stopVisualization();
                    recordButton.setDisabled(false);
                    uploadArea.setDisabled(false);
                    this.#setActions(false);
                    resultRenderer.showError(error.message);
                },
            });
            if (!this.#disposed && audioManager.isRecording) waveformCanvas.startVisualization();
        } catch (error) {
            resultRenderer.showError(error.message);
            uploadArea.setDisabled(false);
            this.#setActions(false);
        } finally {
            this.#recordStarting = false;
            recordButton.setDisabled(false);
        }
    }

    #handleRecordStop() {
        recordButton.setDisabled(true);
        audioManager.stopRecording();
        waveformCanvas.stopVisualization();
    }

    async #handleFileUpload(file) {
        this.#setSource(file, file.name);
        await this.#analyzeSource();
    }

    #setSource(blob, name) {
        this.#controller?.abort();
        ++this.#generation;
        this.#source = { blob, name };
        this.#report = null;
        const player = document.getElementById('audio-player');
        player.pause(); this.#playbackEnd = null;
        if (this.#sourceURL) URL.revokeObjectURL(this.#sourceURL);
        this.#sourceURL = URL.createObjectURL(blob);
        player.src = this.#sourceURL;
        document.getElementById('source-name').textContent = name;
        document.getElementById('analysis-progress').value = 0;
        document.getElementById('analysis-panel').classList.remove('hidden');
        this.#setActions(false);
    }

    #setStatus(text) { document.getElementById('analysis-status').textContent = text; }

    #setActions(busy) {
        document.getElementById('cancel-analysis').hidden = !busy || !this.#controller;
        domElements.retryBtn.disabled = busy || !this.#source;
        domElements.retryBtn.textContent = this.#report ? '현재 설정으로 다시 분석' : '분석 시작';
        for (const id of ['export-json', 'export-csv']) document.getElementById(id).disabled = busy || !this.#report;
    }

    async #analyzeSource() {
        if (!this.#source || this.#disposed) return;
        this.#controller?.abort();
        const controller = new AbortController();
        this.#controller = controller;
        const generation = ++this.#generation;
        const source = this.#source;
        const settings = stateManager.getSettings();
        this.#report = null;
        this.#setActions(true);
        recordButton.setDisabled(true);
        resultRenderer.showLoading('전체 오디오를 준비하고 있습니다…');
        this.#setStatus('오디오 디코딩 중 · 최대 20분 / 50MB');
        document.getElementById('analysis-progress').value = 0;
        let report;
        try {
            const samples = await audioManager.processFile(source.blob);
            controller.signal.throwIfAborted();
            report = {
                schemaVersion: 1, name: source.name, model: 'Google Perch v2 (ONNX)',
                scoreType: 'softmax (uncalibrated)', sampleRate: SAMPLE_RATE,
                duration: samples.length / SAMPLE_RATE, windowSeconds: AUDIO_SAMPLES / SAMPLE_RATE,
                settings, createdAt: new Date().toISOString(), status: 'running',
                totalSegments: Math.ceil(samples.length / AUDIO_SAMPLES), segments: [],
            };
            await analyzeSegments(samples, audio => modelService.classify(audio, settings), {
                signal: controller.signal,
                onProgress: ({ completed, total, segments }) => {
                    if (generation !== this.#generation) return;
                    report.segments = segments.slice();
                    document.getElementById('analysis-progress').value = completed / total;
                    this.#setStatus(`전체 구간 분석 중 · ${completed} / ${total} (${Math.round(completed / total * 100)}%)`);
                },
            });
            controller.signal.throwIfAborted();
            if (generation !== this.#generation || this.#disposed) return;
            report.status = 'completed';
            this.#setStatus(`분석 완료 · ${report.totalSegments}개 구간`);
        } catch (error) {
            if (generation !== this.#generation || this.#disposed) return;
            if (controller.signal.aborted) {
                if (report) report.status = 'cancelled';
                this.#setStatus(`분석 중지 · ${report?.segments.length || 0}개 완료 구간만 표시`);
            } else {
                if (report) report.status = 'failed';
                this.#setStatus(`분석 실패: ${error.message}`);
            }
            if (!report?.segments.length) resultRenderer.showError(controller.signal.aborted ? '분석을 중지했습니다. 다시 시작할 수 있습니다' : error.message);
        } finally {
            if (generation === this.#generation && !this.#disposed) {
                this.#controller = null;
                this.#report = report?.segments.length ? report : null;
                if (this.#report) resultRenderer.displayReport(this.#report, segment => this.#playSegment(segment));
                recordButton.setDisabled(false);
                this.#setActions(false);
            }
        }
    }

    async #playSegment(segment) {
        const player = document.getElementById('audio-player');
        player.currentTime = segment.start;
        this.#playbackEnd = segment.end;
        try { await player.play(); }
        catch { this.#setStatus('재생할 수 없습니다. 오디오 플레이어의 재생 버튼을 눌러 주세요'); }
    }

    #export(format) {
        if (!this.#report) return;
        const content = format === 'json' ? JSON.stringify(this.#report, null, 2) : exportCSV(this.#report);
        const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a'); anchor.href = url;
        anchor.download = `${this.#report.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}-perch.${format}`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        this.#disposed = true;
        ++this.#generation;
        this.#controller?.abort();
        document.getElementById('audio-player')?.pause();
        if (this.#sourceURL) URL.revokeObjectURL(this.#sourceURL);
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

