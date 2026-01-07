/**
 * Perch Web - Constants
 * 전역 상수 및 설정 정의
 * @module constants
 */

// ============================================
// Audio
// ============================================

/** 샘플 레이트 (Hz) */
export const SAMPLE_RATE = 32000;

/** 녹음 길이 (초) */
export const AUDIO_DURATION_SECONDS = 5;

/** 총 샘플 수 */
export const AUDIO_SAMPLES = SAMPLE_RATE * AUDIO_DURATION_SECONDS;

/** 녹음 시간 (ms) */
export const RECORDING_DURATION_MS = 5000;

// ============================================
// Model
// ============================================

/** 모델 URL 목록 */
export const MODEL_URLS = Object.freeze([
    'https://huggingface.co/justinchuby/Perch-onnx/resolve/main/perch_v2.onnx',
    './model/perch_v2.onnx'
]);

/** ONNX Runtime WASM 경로 */
export const ONNX_WASM_PATH = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

/** 레이블 경로 */
export const LABELS_PATH = './data/labels.json';

/** 모델 예상 크기 (bytes) - 프로그레스 표시용 */
export const MODEL_SIZE_BYTES = 390 * 1024 * 1024;

// ============================================
// Classification
// ============================================

/** 기본 상위 결과 수 */
export const DEFAULT_TOP_K = 5;

/** 기본 임계값 */
export const DEFAULT_THRESHOLD = 0.01;

/** 결과 수 옵션 */
export const TOP_K_OPTIONS = Object.freeze([3, 5, 10]);

/** 최대 임계값 (%) */
export const MAX_THRESHOLD_PERCENT = 50;

// ============================================
// Visualization
// ============================================

/** 파형 바 개수 */
export const WAVEFORM_BARS = 64;

/** FFT 크기 */
export const FFT_SIZE = 256;

/** 스무딩 상수 */
export const SMOOTHING_TIME_CONSTANT = 0.8;

// ============================================
// UI Text
// ============================================

export const UI_TEXT = Object.freeze({
    LOADING_AUDIO_CONTEXT: '오디오 컨텍스트 초기화 중...',
    LOADING_LABELS: '레이블 데이터 로딩 중...',
    LOADING_MODEL: 'Perch v2 모델 로딩 중...',
    LOADING_UI: 'UI 초기화 중...',
    LOADING_DOWNLOAD: '모델 다운로드 중...',
    LOADING_SESSION: '세션 초기화 중... (10초 이상 소요 가능)',

    RECORD_HINT_IDLE: '탭하여 녹음 시작 (5초)',
    RECORD_HINT_RECORDING: '녹음 중... 탭하여 중지',

    CLASSIFYING: '분류 중...',
    PROCESSING_FILE: '파일 처리 중...',

    NO_RESULTS: '새 소리 감지 실패',
    TRY_AGAIN: '다시 시도해 주세요.',
    WIKI_HINT: '위키피디아 정보',
    RETRY_BUTTON: '재시도',

    ERROR_MIC_PERMISSION: '마이크 권한 필요',
    ERROR_CLASSIFICATION: '분류 실패',
    ERROR_FILE_PROCESSING: '파일 처리 실패',
    ERROR_MODEL_NOT_LOADED: '모델 로드 안됨',
    ERROR_LABELS_NOT_FOUND: '레이블 없음',
    ERROR_ALL_SOURCES_FAILED: '모델 로딩 실패',

    SETTINGS_TITLE: '설정',
    SETTINGS_TOP_K: '상위 결과 수',
    SETTINGS_THRESHOLD: '최소 확률',
    SETTINGS_AUTO_CLASSIFY: '자동 분류',
});

// ============================================
// Tips
// ============================================

export const LOADING_TIPS = Object.freeze([
    '💡 팁: 조용한 곳에서 녹음하세요.',
    '💡 팁: 마이크를 소리 방향으로 향하세요.',
    '💡 팁: 5초간 분석합니다.',
    '💡 팁: 새 이름을 누르면 상세 정보가 나옵니다.',
    '💡 팁: 모델은 최초 1회만 다운로드합니다.',
]);

/** 팁 롤링 간격 (ms) */
export const TIP_ROTATION_INTERVAL = 3000;

// ============================================
// Colors
// ============================================

export const COLORS = Object.freeze({
    WAVEFORM_IDLE: {
        START: 'rgba(99, 102, 241, 0.3)',
        MID: 'rgba(99, 102, 241, 0.5)',
        END: 'rgba(99, 102, 241, 0.3)',
    },
    WAVEFORM_RECORDING: {
        START: 'rgba(239, 68, 68, 0.4)',
        MID: 'rgba(239, 68, 68, 0.9)',
        END: 'rgba(239, 68, 68, 0.4)',
    },
});

// ============================================
// Cache
// ============================================

export const CACHE = Object.freeze({
    APP_CACHE_NAME: 'Perch Web-app-v6',
    MODEL_CACHE_NAME: 'perch-v2-model-cache',
});

// ============================================
// MIME Types
// ============================================

export const SUPPORTED_MIME_TYPES = Object.freeze([
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
]);

