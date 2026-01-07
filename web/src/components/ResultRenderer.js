/**
 * Perch Web - Result Renderer
 * 분류 결과 시각화 및 UI 업데이트
 * @module ResultRenderer
 */

import { UI_TEXT } from '../config/constants.js';
import domElements from './DOMElements.js';

// ============================================
// Result Renderer
// ============================================

class ResultRenderer {

    /**
     * 결과 목록 렌더링
     * @param {Array} results
     */
    displayResults(results) {
        const { resultsList, resultsSection } = domElements;

        if (!resultsList || !resultsSection) {
            console.warn('[ResultRenderer] DOM not found');
            return;
        }

        resultsList.innerHTML = '';

        if (results.length === 0) {
            this.#showNoResults();
            return;
        }

        const fragment = document.createDocumentFragment();
        results.forEach((result, index) => {
            const item = this.#createResultItem(result, index);
            fragment.appendChild(item);
        });
        resultsList.appendChild(fragment);

        resultsSection.classList.remove('hidden');
    }

    #showNoResults() {
        const { resultsList, resultsSection } = domElements;
        if (!resultsList || !resultsSection) return;

        resultsList.innerHTML = `
            <div class="no-results" style="text-align: center; padding: 20px; color: var(--color-text-muted);">
                <p>${UI_TEXT.NO_RESULTS}</p>
                <p>${UI_TEXT.TRY_AGAIN}</p>
            </div>
        `;

        resultsSection.classList.remove('hidden');
    }

    /**
     * 결과 아이템 요소 생성
     */
    #createResultItem(result, index) {
        const item = document.createElement('div');
        item.className = 'result-item';

        const confidencePercent = (result.confidence * 100).toFixed(1);
        const displayName = result.koreanName || this.#formatScientificName(result.label);
        const scientificName = result.koreanName ? result.label : '';
        const isScientificName = this.#isScientificName(result.label);

        const wikiHint = isScientificName ? `
                <div class="result-link-hint" aria-label="${UI_TEXT.WIKI_HINT}">
                    <span>${UI_TEXT.WIKI_HINT}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </div>
        ` : '';

        item.innerHTML = `
            <div class="result-rank ${index === 0 ? 'top-1' : ''}">${index + 1}</div>
            <div class="result-info">
                <div class="result-name">${displayName}</div>
                ${scientificName ? `<div class="result-scientific">${scientificName}</div>` : ''}
                ${wikiHint}
            </div>
            <div class="result-confidence">
                <span class="confidence-value">${confidencePercent}%</span>
                <div class="confidence-bar" role="progressbar" aria-valuenow="${confidencePercent}" aria-valuemin="0" aria-valuemax="100">
                    <div class="confidence-bar-fill" style="width: ${confidencePercent}%"></div>
                </div>
            </div>
        `;

        if (isScientificName) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => this.#openWikipedia(result.label));
        }

        return item;
    }

    /**
     * 학명 형식 확인 (Genus species)
     */
    #isScientificName(label) {
        if (label.includes('_')) return false;

        const words = label.trim().split(/\s+/);
        if (words.length < 2) return false;

        const [genus, species] = words;
        return /^[A-Z]/.test(genus) && /^[a-z]/.test(species);
    }

    #formatScientificName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    #openWikipedia(label) {
        const query = encodeURIComponent(label.replace(/_/g, ' '));
        window.open(`https://en.wikipedia.org/wiki/${query}`, '_blank', 'noopener,noreferrer');
    }

    // ============================================
    // Loading & Error UI
    // ============================================

    showLoading(message = UI_TEXT.CLASSIFYING) {
        const { resultsList, resultsSection } = domElements;

        if (!resultsList || !resultsSection) return;

        resultsList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner" style="width: 32px; height: 32px; margin: 20px auto;"></div>
                <p style="color: var(--color-text-secondary); text-align: center;">${message}</p>
            </div>
        `;

        resultsSection.classList.remove('hidden');
    }

    showError(message = UI_TEXT.ERROR_CLASSIFICATION) {
        const { resultsList } = domElements;
        if (!resultsList) return;

        resultsList.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 20px; color: var(--color-error);">
                <p>❌ ${message}</p>
            </div>
        `;
    }

    hideResults() {
        const { resultsSection } = domElements;
        if (resultsSection) {
            resultsSection.classList.add('hidden');
        }
    }

    clearResults() {
        const { resultsList } = domElements;
        if (resultsList) {
            resultsList.innerHTML = '';
        }
    }
}

/** @type {ResultRenderer} */
const resultRenderer = new ResultRenderer();

export { ResultRenderer, resultRenderer };
export default resultRenderer;


