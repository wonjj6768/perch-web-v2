/** Safe, accessible full-recording results with timestamped playback and pagination. */
import domElements from './DOMElements.js';
import { formatTimestamp, summarizeDetections } from '../utils/analysis-utils.js';

function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

class ResultRenderer {
    #page = 0;
    #query = '';
    #report = null;
    #play = null;

    displayReport(report, onPlay) {
        this.#report = report;
        this.#play = onPlay;
        this.#page = 0;
        this.#query = '';
        this.#render();
    }

    #render() {
        const { resultsList, resultsSection } = domElements;
        if (!resultsList || !resultsSection || !this.#report) return;
        const report = this.#report;
        resultsList.replaceChildren();
        resultsSection.classList.remove('hidden');
        const summary = summarizeDetections(report.segments);
        const subtitle = node('p', `${summary.length}개 후보 · ${report.segments.length}/${report.totalSegments}개 구간 · ${formatTimestamp(report.duration)}`, 'analysis-meta');
        resultsList.append(subtitle);
        resultsList.append(node('p', '점수는 모델의 상대적 분류 점수이며, 실제 종이 맞을 확률을 보장하지 않습니다. 낮은 점수와 겹치는 울음은 직접 확인하세요.', 'score-note'));
        if (!summary.length) resultsList.append(node('p', '설정한 최소 점수를 넘는 후보가 없습니다. 설정을 낮추고 다시 분석해 보세요.'));
        const overview = node('div', undefined, 'species-summary');
        for (const species of summary.slice(0, 20)) {
            const button = node('button', `${species.koreanName || species.label} · ${(species.confidence * 100).toFixed(1)}% · ${species.count}구간`, 'species-chip');
            button.type = 'button';
            button.title = species.label;
            button.addEventListener('click', () => { this.#query = species.label; this.#page = 0; this.#render(); });
            overview.append(button);
        }
        resultsList.append(overview);
        const label = node('label', '종 이름으로 구간 찾기', 'filter-label');
        label.htmlFor = 'species-search';
        const search = node('input');
        search.id = 'species-search'; search.type = 'search'; search.value = this.#query;
        search.placeholder = '한국어 이름 또는 학명';
        search.addEventListener('input', () => {
            this.#query = search.value;
            this.#page = 0;
            renderTimeline();
        });
        resultsList.append(label, search);
        const timeline = node('div', undefined, 'timeline');
        const pagination = node('div', undefined, 'analysis-actions');
        resultsList.append(timeline, pagination);
        const renderTimeline = () => {
            timeline.replaceChildren(); pagination.replaceChildren();
            const query = this.#query.trim().toLocaleLowerCase();
            const matches = report.segments.filter(segment => !query || segment.detections.some(d => `${d.label} ${d.koreanName || ''}`.toLocaleLowerCase().includes(query)));
            const pages = Math.max(1, Math.ceil(matches.length / 20));
            this.#page = Math.min(this.#page, pages - 1);
            for (const segment of matches.slice(this.#page * 20, this.#page * 20 + 20)) {
                const section = node('section', undefined, 'timeline-segment');
                const play = node('button', `▶ ${formatTimestamp(segment.start)}–${formatTimestamp(segment.end)}`, 'segment-play');
                play.type = 'button';
                play.setAttribute('aria-label', `${formatTimestamp(segment.start)}부터 ${formatTimestamp(segment.end)}까지 듣기`);
                play.addEventListener('click', () => this.#play?.(segment));
                section.append(play);
                if (!segment.detections.length) section.append(node('p', '최소 점수 이상의 후보 없음', 'analysis-meta'));
                for (const detection of segment.detections) {
                    const row = node('div', undefined, 'detection-row');
                    const scientific = !detection.label.includes('_') && /^[A-Z][a-z]+ [a-z]/.test(detection.label);
                    const name = node(scientific ? 'a' : 'span', detection.koreanName || detection.label);
                    if (scientific) {
                        name.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(detection.label)}`;
                        name.target = '_blank'; name.rel = 'noopener noreferrer';
                        name.title = `${detection.label} · 위키백과 (새 탭)`;
                    }
                    const score = node('span', `${(detection.confidence * 100).toFixed(1)}%`, 'detection-score');
                    row.append(name, score); section.append(row);
                }
                timeline.append(section);
            }
            if (!matches.length) timeline.append(node('p', '이 이름과 일치하는 구간이 없습니다'));
            const prev = node('button', '이전', 'secondary-btn');
            const next = node('button', '다음', 'secondary-btn');
            prev.disabled = this.#page === 0; next.disabled = this.#page >= pages - 1;
            prev.addEventListener('click', () => { this.#page--; renderTimeline(); });
            next.addEventListener('click', () => { this.#page++; renderTimeline(); });
            pagination.append(prev, node('span', `${this.#page + 1} / ${pages}`), next);
        };
        renderTimeline();
    }

    showLoading(message) {
        this.#message(message, 'status');
    }
    showError(message) { this.#message(message, 'alert'); }
    #message(message, role) {
        domElements.resultsSection?.classList.remove('hidden');
        const text = node('p', message, 'analysis-meta'); text.setAttribute('role', role);
        domElements.resultsList?.replaceChildren(text);
    }
    hideResults() { domElements.resultsSection?.classList.add('hidden'); }
    clearResults() { domElements.resultsList?.replaceChildren(); this.#report = null; }
}
const resultRenderer = new ResultRenderer();
export { ResultRenderer, resultRenderer };
export default resultRenderer;
