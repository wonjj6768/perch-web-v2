import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { wav } from './fixtures.js';

async function reportDownload(page, testInfo, filename) {
    const pending = page.waitForEvent('download');
    await page.locator('#export-json').click();
    const download = await pending;
    const report = JSON.parse(await readFile(await download.path(), 'utf8'));
    await writeFile(testInfo.outputPath(filename), JSON.stringify(report, null, 2));
    return report;
}

test('real Perch ONNX in Chromium: whole-file analysis, playback, exports and replacement', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.onnx')) requests.push(url.origin + url.pathname);
    });
    await page.goto('http://127.0.0.1:8765/web/');
    await expect(page.locator('#loading-overlay')).toBeHidden({ timeout: 8 * 60 * 1000 });
    console.info('Real Perch model initialized');
    // Count calls while delegating every invocation to the real service and ONNX session.
    // These wrappers do not replace inference outputs or intercept any network response.
    await page.evaluate(async () => {
        const { modelService, stateManager } = await import('./src/services/index.js');
        const classify = modelService.classify.bind(modelService);
        const session = stateManager.get('session');
        const run = session.run.bind(session);
        window.modelCalls = { classify: 0, inference: 0 };
        modelService.classify = (...args) => { window.modelCalls.classify++; return classify(...args); };
        session.run = (...args) => { window.modelCalls.inference++; return run(...args); };
    });
    await expect(page.locator('#record-btn')).toBeEnabled();
    await page.locator('#settings-btn').click();
    await page.locator('#threshold-range').focus();
    await page.locator('#threshold-range').press('Home');
    await expect(page.locator('#threshold-value')).toHaveText('0%');
    await page.locator('#modal-close').click();

    // Use the unchanged production model and runtime URLs. No routes or inference mocks.
    await page.locator('#file-input').setInputFiles({ name: 'synthetic-12.25s.wav', mimeType: 'audio/wav', buffer: wav(12.25) });
    await expect(page.locator('#analysis-status')).toContainText('분석 완료', { timeout: 5 * 60 * 1000 });
    await expect(page.locator('.timeline-segment')).toHaveCount(3);
    await expect(page.locator('#analysis-progress')).toHaveJSProperty('value', 1);
    expect(requests.length).toBe(1);
    await expect(page.locator('.timeline-segment').last()).toContainText('00:10.0–00:12.3');

    await page.locator('.segment-play').last().click();
    await expect.poll(() => page.locator('#audio-player').evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(10);

    const report = await reportDownload(page, testInfo, 'real-model-report.json');
    expect(report.status).toBe('completed'); expect(report.segments).toHaveLength(3);
    expect(report.duration).toBeCloseTo(12.25, 2);
    expect(report.segments.map(segment => segment.start)).toEqual([0, 5, 10]);
    expect(report.segments[2].end).toBeCloseTo(12.25, 2);
    expect(report.model).toContain('Perch v2');
    for (const segment of report.segments) expect(segment.detections).toHaveLength(5);
    for (const segment of report.segments) for (const detection of segment.detections) {
        expect(Number.isFinite(detection.confidence)).toBe(true);
        expect(detection.label).not.toMatch(/^Unknown_/);
    }
    const csvDownloadPromise = page.waitForEvent('download');
    await page.locator('#export-csv').click();
    const csvDownload = await csvDownloadPromise;
    const csv = await readFile(await csvDownload.path(), 'utf8');
    expect(csv).toContain('model_score'); expect(csv).toContain('synthetic-12.25s.wav');
    await writeFile(testInfo.outputPath('real-model-report.csv'), csv);
    await page.screenshot({ path: testInfo.outputPath('mobile-results.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Refinement must update screen and exports immediately without any classify/run calls.
    const beforeRefinement = await page.evaluate(() => ({ ...window.modelCalls }));
    await page.locator('#species-search').fill(report.segments[0].detections[0].label);
    await page.locator('#settings-btn').click();
    await page.locator('#top-k-select').selectOption('10');
    await page.locator('#modal-close').click();
    await expect(page.locator('#species-search')).toHaveValue(report.segments[0].detections[0].label);
    await expect(page.locator('#result-settings')).toContainText('최대 10개');
    await page.locator('#species-search').fill('');
    await expect(page.locator('.detection-row')).toHaveCount(30);
    const expanded = await reportDownload(page, testInfo, 'ten-candidates-report.json');
    expect(expanded.settings.topK).toBe(10);
    for (let i = 0; i < report.segments.length; i++) expect(expanded.segments[i].detections.slice(0, 5)).toEqual(report.segments[i].detections);

    await page.locator('#settings-btn').click();
    await page.locator('#top-k-select').selectOption('3');
    await page.locator('#threshold-range').focus();
    await page.locator('#threshold-range').press('End');
    await page.locator('#modal-close').click();
    const narrowed = await reportDownload(page, testInfo, 'filtered-report.json');
    expect(narrowed.settings.topK).toBe(3); expect(narrowed.settings.threshold).toBe(.5);
    for (let i = 0; i < narrowed.segments.length; i++) expect(narrowed.segments[i].detections).toEqual(expanded.segments[i].detections.filter(d => d.confidence >= .5).slice(0, 3));
    await expect(page.locator('.detection-row')).toHaveCount(narrowed.segments.reduce((sum, segment) => sum + segment.detections.length, 0));
    const filteredCSVPromise = page.waitForEvent('download');
    await page.locator('#export-csv').click();
    const filteredCSV = await readFile(await (await filteredCSVPromise).path(), 'utf8');
    expect(filteredCSV).toContain('"top_k","min_model_score"');
    expect(filteredCSV.split('\r\n').slice(1).every(row => row.endsWith(',"3","0.5"'))).toBe(true);
    expect(filteredCSV.split('\r\n')).toHaveLength(1 + narrowed.segments.reduce((sum, segment) => sum + Math.max(1, segment.detections.length), 0));
    await writeFile(testInfo.outputPath('filtered-report.csv'), filteredCSV);

    await page.locator('#settings-btn').click();
    await page.locator('#top-k-select').selectOption('5');
    await page.locator('#threshold-range').focus();
    await page.locator('#threshold-range').press('Home');
    await page.locator('#modal-close').click();
    const restored = await reportDownload(page, testInfo, 'restored-report.json');
    expect(restored.segments).toEqual(report.segments);
    const afterRefinement = await page.evaluate(() => ({ ...window.modelCalls }));
    expect(afterRefinement).toEqual(beforeRefinement);
    console.info('Refinement verified with unchanged model calls:', afterRefinement);
    await page.screenshot({ path: testInfo.outputPath('mobile-refined-results.png'), fullPage: true });

    // Keep real completed windows when cancelling, then resume only the remaining windows.
    // Click the real button after the first completed window inside the browser. A
    // fast CPU can finish all twelve windows before a protocol round trip to click.
    await page.evaluate(() => {
        const progress = document.getElementById('analysis-progress');
        const cancel = document.getElementById('cancel-analysis');
        const observer = new MutationObserver(() => {
            if (progress.value > 0 && progress.value < 1 && !cancel.hidden) {
                observer.disconnect(); cancel.click();
            }
        });
        observer.observe(progress, { attributes: true, attributeFilter: ['value'] });
    });
    console.info('Uploading 60-second synthetic resume fixture');
    await page.locator('#file-input').setInputFiles({ name: 'cancel-60s.wav', mimeType: 'audio/wav', buffer: wav(60) });
    await expect(page.locator('#source-name')).toHaveText('cancel-60s.wav');
    await expect(page.locator('#analysis-status')).toContainText('분석 중지');
    await expect(page.locator('#retry-btn')).toBeEnabled();
    await expect(page.locator('#record-btn')).toBeEnabled();
    await expect(page.locator('#resume-analysis')).toBeVisible();
    const cancelled = await reportDownload(page, testInfo, 'cancelled-report.json');
    console.info('Cancelled with completed prefix:', cancelled.segments.length);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.segments.length).toBeGreaterThan(0);
    expect(cancelled.segments.length).toBeLessThan(cancelled.totalSegments);
    await page.screenshot({ path: testInfo.outputPath('mobile-cancelled-results.png'), fullPage: true });
    const beforeResume = await page.evaluate(() => ({ ...window.modelCalls }));
    await page.locator('#resume-analysis').click();
    await expect(page.locator('#analysis-status')).toContainText('분석 완료', { timeout: 5 * 60 * 1000 });
    await expect(page.locator('#resume-analysis')).toBeHidden();
    const resumed = await reportDownload(page, testInfo, 'resumed-report.json');
    expect(resumed.status).toBe('completed'); expect(resumed.segments).toHaveLength(12);
    expect(resumed.createdAt).toBe(cancelled.createdAt);
    expect(resumed.segments.slice(0, cancelled.segments.length)).toEqual(cancelled.segments);
    const afterResume = await page.evaluate(() => ({ ...window.modelCalls }));
    expect(afterResume.classify - beforeResume.classify).toBe(cancelled.totalSegments - cancelled.segments.length);
    console.info('Resume verified:', { completedPrefix: cancelled.segments.length, total: cancelled.totalSegments, before: beforeResume, after: afterResume });

    // A second real file must replace all prior windows and source metadata.
    await page.locator('#file-input').setInputFiles({ name: 'replacement-1s.wav', mimeType: 'audio/wav', buffer: wav(1) });
    await expect(page.locator('#analysis-status')).toContainText('분석 완료', { timeout: 3 * 60 * 1000 });
    await expect(page.locator('#source-name')).toHaveText('replacement-1s.wav');
    await expect(page.locator('.timeline-segment')).toHaveCount(1);
    await expect(page.locator('#retry-btn')).toBeEnabled();
    await expect(page.locator('#record-btn')).toBeEnabled();
    expect(errors).toEqual([]);
    await writeFile(testInfo.outputPath('verification.json'), JSON.stringify({
        mocked: false, input: 'synthetic audio, no biological accuracy claim',
        modelRequests: requests, uncaughtErrors: errors, viewport: '390x844',
        refinement: { before: beforeRefinement, after: afterRefinement },
        resume: { cancellation: 'real button click after first completed window', completedPrefix: cancelled.segments.length, total: cancelled.totalSegments, before: beforeResume, after: afterResume },
        verified: ['real model initialization', 'real browser inference', '12.25-second full-file coverage', 'tail timestamp', 'playback seek', 'JSON/CSV exports', 'instant candidate/threshold refinement with zero additional model calls', 'unchanged scores after restoring settings', 'search retained after refinement', 'pipeline cancellation and control recovery', 'resume without reclassifying completed windows', 'replacement file', 'mobile overflow'],
    }, null, 2));
});
