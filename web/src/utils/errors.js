/**
 * Perch Web - Errors
 * 커스텀 에러 정의
 * @module errors
 */

/**
 * 기본 앱 에러
 */
export class AppError extends Error {
    constructor(message, code = 'APP_ERROR') {
        super(message);
        this.name = 'AppError';
        this.code = code;
        Error.captureStackTrace?.(this, this.constructor);
    }
}

/**
 * 오디오 에러
 */
export class AudioError extends AppError {
    constructor(message, code = 'AUDIO_ERROR') {
        super(message, code);
        this.name = 'AudioError';
    }

    static contextInitFailed(cause) {
        const err = new AudioError('오디오 초기화 실패', 'CONTEXT_INIT');
        err.cause = cause;
        return err;
    }

    static recordingStartFailed(cause) {
        const err = new AudioError('녹음 시작 실패', 'RECORDING_START');
        err.cause = cause;
        return err;
    }

    static permissionDenied() {
        return new AudioError('마이크 권한 거부됨', 'PERMISSION_DENIED');
    }

    static processingFailed(cause) {
        const err = new AudioError('오디오 처리 실패', 'PROCESSING');
        err.cause = cause;
        return err;
    }
}

/**
 * 모델 에러
 */
export class ModelError extends AppError {
    constructor(message, code = 'MODEL_ERROR') {
        super(message, code);
        this.name = 'ModelError';
    }

    static loadFailed(cause) {
        const err = new ModelError('모델 로딩 실패', 'LOAD_FAILED');
        err.cause = cause;
        return err;
    }

    static notLoaded() {
        return new ModelError('모델 로드되지 않음', 'NOT_LOADED');
    }

    static inferenceFailed(cause) {
        const err = new ModelError('추론 실패', 'INFERENCE_FAILED');
        err.cause = cause;
        return err;
    }

    static labelsFailed(cause) {
        const err = new ModelError('레이블 로딩 실패', 'LABELS_FAILED');
        err.cause = cause;
        return err;
    }
}

/**
 * 네트워크 에러
 */
export class NetworkError extends AppError {
    constructor(message, code = 'NETWORK_ERROR') {
        super(message, code);
        this.name = 'NetworkError';
    }

    static fetchFailed(url, cause) {
        const err = new NetworkError(`리소스 로딩 실패: ${url}`, 'FETCH_FAILED');
        err.cause = cause;
        return err;
    }

    static offline() {
        return new NetworkError('오프라인 상태', 'OFFLINE');
    }
}

