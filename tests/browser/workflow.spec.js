import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { wav } from './fixtures.js';

// Deterministic failure/race coverage complements real-model.spec.js. These tests
// deliberately mock ONNX; they do not provide evidence of model or species accuracy.
test.use({ serviceWorkers: 'block' });

const runtime = `
window.qa = { hold: true, pending: [], calls: 0, classifyCalls: 0, failDecode: false, holdDecode: false, pendingDecode: [] };
window.ort = {
    env: { wasm: {} },
    Tensor: class { constructor(type, data) { this.data = data; } dispose() {} },
    InferenceSession: { create: async () => ({
        inputNames: ['audio'], outputNames: ['logits'],
        async run() {
            qa.calls++;
            if (qa.hold) await new Promise(resolve => qa.pending.push(resolve));
            return { logits: { data: new Float32Array([3, 2.5, 2, 1.5, 1, .5, 0, -.5, -1, -1.5]), dispose() {} } };
        },
    }) },
};`;

async function setup(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/ort.min.js', route => route.fulfill({ contentType: 'application/javascript', body: runtime }));
    await page.route('**/perch_v2.onnx', route => route.fulfill({ body: Buffer.from([1, 2, 3]) }));
    await page.route('**/data/labels.json', route => route.fulfill({ json: {
        labels: ['Parus major', 'Pica pica', 'Species c', 'Species d', 'Species e', 'Species f', 'Species g', 'Species h', 'Species i', 'Species j'],
        koreanNames: { 'Parus major': '박새', 'Pica pica': '까치' },
    } }));
    await page.goto('http://127.0.0.1:8765/web/');
    await expect(page.locator('#loading-overlay')).toBeHidden();
    await page.evaluate(async () => {
        const { modelService, audioManager } = await import('./src/services/index.js');
        const classify = modelService.classify.bind(modelService);
        modelService.classify = (...args) => { qa.classifyCalls++; return classify(...args); };
        const processFile = audioManager.processFile.bind(audioManager);
        audioManager.processFile = async (...args) => {
            if (qa.failDecode) { qa.failDecode = false; throw new Error('test decode failure'); }
            if (qa.holdDecode) await new Promise(resolve => qa.pendingDecode.push(resolve));
            return processFile(...args);
        };
    });
    await settings(page, 5, 'Home');
    return errors;
}

async function settings(page, topK, thresholdKey) {
    await page.locator('#settings-btn').click();
    await page.locator('#top-k-select').selectOption(String(topK));
    await page.locator('#threshold-range').focus();
    await page.locator('#threshold-range').press(thresholdKey);
    await page.locator('#modal-close').click();
}

async function downloadReport(page) {
    const pending = page.waitForEvent('download');
    await page.locator('#export-json').click();
    const download = await pending;
    return JSON.parse(await readFile(await download.path(), 'utf8'));
}

async function cancelledPrefix(page) {
    await page.locator('#file-input').setInputFiles({ name: 'partial-12.25s.wav', mimeType: 'audio/wav', buffer: wav(12.25) });
    await expect.poll(() => page.evaluate(() => qa.pending.length)).toBe(1);
    await page.evaluate(() => qa.pending.shift()());
    await expect(page.locator('#analysis-progress')).toHaveJSProperty('value', 1 / 3);
    await expect.poll(() => page.evaluate(() => qa.pending.length)).toBe(1);
    await page.locator('#cancel-analysis').click();
    await page.evaluate(() => qa.pending.shift()());
    await expect(page.locator('#analysis-status')).toContainText('분석 중지');
    await expect(page.locator('#resume-analysis')).toBeVisible();
    const report = await downloadReport(page);
    expect(report.status).toBe('cancelled'); expect(report.segments).toHaveLength(1);
    return report;
}

test('partial work survives refinement, a decode failure, a cancelled resume and a fresh restart', async ({ page }) => {
    const errors = await setup(page);
    const partial = await cancelledPrefix(page);
    const calls = await page.evaluate(() => qa.classifyCalls);
    await settings(page, 3, 'End');
    const hidden = await downloadReport(page);
    expect(hidden.status).toBe('cancelled'); expect(hidden.segments).toHaveLength(1);
    expect(hidden.segments[0].detections).toEqual([]);
    await settings(page, 10, 'Home');
    const expanded = await downloadReport(page);
    expect(expanded.segments[0].detections).toHaveLength(10);
    expect(expanded.segments[0].detections.slice(0, 5)).toEqual(partial.segments[0].detections);
    expect(await page.evaluate(() => qa.classifyCalls)).toBe(calls);

    await page.evaluate(() => { qa.failDecode = true; });
    await page.locator('#resume-analysis').click();
    await expect(page.locator('#analysis-status')).toContainText('test decode failure');
    const failed = await downloadReport(page);
    expect(failed.status).toBe('failed'); expect(failed.segments).toEqual(expanded.segments);
    await expect(page.locator('#resume-analysis')).toBeVisible();

    await page.evaluate(() => { qa.holdDecode = true; });
    await page.locator('#resume-analysis').click();
    await expect.poll(() => page.evaluate(() => qa.pendingDecode.length)).toBe(1);
    await page.locator('#cancel-analysis').click();
    await page.evaluate(() => { qa.holdDecode = false; qa.pendingDecode.shift()(); });
    await expect(page.locator('#analysis-status')).toContainText('분석 중지');
    expect((await downloadReport(page)).segments).toEqual(expanded.segments);
    await expect(page.locator('#record-btn')).toBeEnabled();

    const beforeResume = await page.evaluate(() => qa.classifyCalls);
    await page.locator('#resume-analysis').click();
    await expect.poll(() => page.evaluate(() => qa.pending.length)).toBe(1);
    await page.evaluate(() => { qa.hold = false; qa.pending.shift()(); });
    await expect(page.locator('#analysis-status')).toContainText('분석 완료');
    const complete = await downloadReport(page);
    expect(complete.segments).toHaveLength(3); expect(complete.createdAt).toBe(partial.createdAt);
    expect(complete.segments[0]).toEqual(expanded.segments[0]);
    expect(await page.evaluate(() => qa.classifyCalls) - beforeResume).toBe(2);
    await expect(page.locator('#resume-analysis')).toBeHidden();

    const beforeRestart = await page.evaluate(() => qa.classifyCalls);
    await page.locator('#retry-btn').click();
    await expect(page.locator('#analysis-status')).toContainText('분석 완료');
    expect((await downloadReport(page)).segments).toHaveLength(3);
    expect(await page.evaluate(() => qa.classifyCalls) - beforeRestart).toBe(3);
    expect(errors).toEqual([]);
});

test('a replacement file during resumed inference receives only its own results', async ({ page }) => {
    const errors = await setup(page);
    await cancelledPrefix(page);
    await page.locator('#resume-analysis').click();
    await expect.poll(() => page.evaluate(() => qa.pending.length)).toBe(1);
    await page.locator('#file-input').setInputFiles({ name: 'replacement-1s.wav', mimeType: 'audio/wav', buffer: wav(1) });
    await expect(page.locator('#source-name')).toHaveText('replacement-1s.wav');
    await page.evaluate(() => qa.pending.shift()());
    await expect.poll(() => page.evaluate(() => qa.pending.length)).toBe(1);
    await page.evaluate(() => qa.pending.shift()());
    await expect(page.locator('#analysis-status')).toContainText('분석 완료');
    const report = await downloadReport(page);
    expect(report.name).toBe('replacement-1s.wav'); expect(report.totalSegments).toBe(1);
    expect(report.segments).toHaveLength(1); expect(report.segments[0].start).toBe(0); expect(report.segments[0].end).toBe(1);
    await expect(page.locator('.timeline-segment')).toHaveCount(1);
    await expect(page.locator('#resume-analysis')).toBeHidden();
    await expect(page.locator('#record-btn')).toBeEnabled();
    expect(errors).toEqual([]);
});

test('settings during analysis apply on completion and later refinement retains search and pagination', async ({ page }) => {
    const errors = await setup(page);
    await page.locator('#file-input').setInputFiles({ name: 'pages-105s.wav', mimeType: 'audio/wav', buffer: wav(105) });
    await expect.poll(() => page.evaluate(() => qa.pending.length)).toBe(1);
    await settings(page, 3, 'Home');
    await page.evaluate(() => { qa.hold = false; qa.pending.shift()(); });
    await expect(page.locator('#analysis-status')).toContainText('분석 완료');
    const report = await downloadReport(page);
    expect(report.settings.topK).toBe(3);
    expect(report.segments.every(segment => segment.detections.length === 3)).toBe(true);
    await expect(page.locator('.timeline-segment')).toHaveCount(20);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.locator('.timeline-segment')).toHaveCount(1);
    const calls = await page.evaluate(() => qa.classifyCalls);
    await settings(page, 10, 'Home');
    await expect(page.locator('.timeline-segment')).toHaveCount(1);
    await expect(page.locator('.detection-row')).toHaveCount(10);
    await expect(page.locator('.timeline-segment')).toContainText('01:40.0–01:45.0');
    await page.locator('#species-search').fill('박새');
    await settings(page, 5, 'End');
    await expect(page.locator('#species-search')).toHaveValue('박새');
    await expect(page.locator('.timeline-segment')).toHaveCount(0);
    await settings(page, 5, 'Home');
    await expect(page.locator('#species-search')).toHaveValue('박새');
    await expect(page.locator('.timeline-segment')).toHaveCount(20);
    expect(await page.evaluate(() => qa.classifyCalls)).toBe(calls);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
});
