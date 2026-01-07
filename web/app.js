/**
 * Perch Web - AI 새 소리 분류기
 * 애플리케이션 진입점
 * @module app
 */

import { state } from './js/state.js';
import { elements, initializeUI, updateLoadingProgress, showLoadingState, showError, displayResults, resizeCanvas, drawIdleWaveform } from './js/ui.js';
import { initializeAudioContext, startRecording, stopRecording, processAudioBuffer } from './js/audio.js';
import { loadModel, loadLabels, runInference } from './js/model.js';

// ============================================
// 애플리케이션 초기화
// ============================================

async function initialize() {
    try {
        updateLoadingProgress('오디오 컨텍스트 초기화 중...');
        await initializeAudioContext();

        updateLoadingProgress('레이블 데이터 로드 중...');
        await loadLabels();

        updateLoadingProgress('Perch v2 모델 로드 중...');
        await loadModel();

        updateLoadingProgress('UI 초기화 중...');
        initializeUI();
        initializeEventListeners();
        resizeCanvas();
        drawIdleWaveform();

        // Loading Complete
        elements.loadingOverlay.classList.add('hidden');
        state.isModelLoaded = true;

        console.log('Perch Web 초기화 완료');
    } catch (error) {
        console.error('초기화 실패:', error);
        updateLoadingProgress(`오류: ${error.message}`);
    }
}

// ============================================
// 오디오 분류 처리
// ============================================

async function classifyAudioBlob(blob) {
    try {
        showLoadingState('분류 분석 중...');

        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
        const audioData = await processAudioBuffer(audioBuffer);
        const results = await runInference(audioData);

        displayResults(results);

    } catch (error) {
        console.error('분류 실패:', error);
        showError('오디오 분류에 실패했습니다.');
    }
}

async function classifyAudioFile(file) {
    try {
        showLoadingState('파일 처리 중...');

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
        const audioData = await processAudioBuffer(audioBuffer);
        const results = await runInference(audioData);

        displayResults(results);

    } catch (error) {
        console.error('파일 처리 실패:', error);
        showError('파일 처리에 실패했습니다.');
    }
}

// ============================================
// 이벤트 리스너 등록
// ============================================

function initializeEventListeners() {
    elements.recordBtn.addEventListener('click', () => {
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording(classifyAudioBlob);
        }
    });

    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            classifyAudioFile(e.target.files[0]);
        }
    });

    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');

        if (e.dataTransfer.files.length > 0) {
            classifyAudioFile(e.dataTransfer.files[0]);
        }
    });

    elements.retryBtn.addEventListener('click', () => {
        elements.resultsSection.classList.add('hidden');
    });

    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.remove('hidden');
    });

    elements.modalClose.addEventListener('click', () => {
        elements.settingsModal.classList.add('hidden');
    });

    elements.settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => {
        elements.settingsModal.classList.add('hidden');
    });

    elements.topKSelect.addEventListener('change', (e) => {
        state.settings.topK = parseInt(e.target.value, 10);
    });

    elements.thresholdRange.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        state.settings.threshold = value / 100;
        elements.thresholdValue.textContent = `${value}%`;
    });

    elements.autoRecord.addEventListener('change', (e) => {
        state.settings.autoClassify = e.target.checked;
    });

    window.addEventListener('resize', () => {
        resizeCanvas();
        if (!state.isRecording) {
            drawIdleWaveform();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.target.matches('input, select, textarea')) {
            e.preventDefault();
            if (state.isRecording) {
                stopRecording();
            } else {
                startRecording(classifyAudioBlob);
            }
        }
    });
}

// ============================================
// 서비스 워커
// ============================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('Service Worker 등록:', registration.scope);
        } catch (error) {
            console.warn('Service Worker 실패:', error);
        }
    }
}

// ============================================
// 애플리케이션 시작
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

registerServiceWorker();

