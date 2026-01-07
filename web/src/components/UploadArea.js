/**
 * Perch Web - Upload Area
 * 파일 업로드 (드래그 앤 드롭)
 * @module UploadArea
 */

import domElements from './DOMElements.js';
import { validateAudioFile } from '../utils/audio-utils.js';

// ============================================
// Upload Area
// ============================================

class UploadArea {
    #onFileSelect = null;

    // ============================================
    // Init
    // ============================================

    /**
     * 초기화
     * @param {Function} onFileSelect
     */
    initialize(onFileSelect) {
        this.#onFileSelect = onFileSelect;
        this.#bindEvents();
        console.log('UploadArea 초기화 완료');
    }

    #bindEvents() {
        const uploadArea = domElements.uploadArea;
        const fileInput = domElements.fileInput;

        uploadArea?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', (e) => {
            const target = /** @type {HTMLInputElement} */(e.target);
            if (target.files?.length > 0) {
                this.#handleFileSelect(target.files[0]);
                target.value = '';
            }
        });

        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });

        uploadArea?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');

            if (e.dataTransfer?.files?.length > 0) {
                this.#handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    #handleFileSelect(file) {
        const validation = validateAudioFile(file);

        if (!validation.valid) {
            console.warn('파일 검증 실패:', validation.error);
            alert(validation.error);
            return;
        }

        console.log(`파일 선택됨: ${file.name} (${file.type})`);
        this.#onFileSelect?.(file);
    }

    // ============================================
    // Control
    // ============================================

    setDisabled(disabled) {
        const uploadArea = domElements.uploadArea;
        if (uploadArea) {
            uploadArea.style.opacity = disabled ? '0.5' : '1';
            uploadArea.style.pointerEvents = disabled ? 'none' : 'auto';
        }
    }

    setDragOver(isOver) {
        const uploadArea = domElements.uploadArea;
        if (uploadArea) {
            isOver ? uploadArea.classList.add('dragover') : uploadArea.classList.remove('dragover');
        }
    }
}

/** @type {UploadArea} */
const uploadArea = new UploadArea();

export { UploadArea, uploadArea };
export default uploadArea;

