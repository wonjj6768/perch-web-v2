import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

/** Synthetic signal tests execution and window coverage, NOT species-identification accuracy. */
function wav(seconds, sampleRate = 16000) {
    const count = Math.round(seconds * sampleRate);
    const bytes = Buffer.alloc(44 + count * 2);
    bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
    bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
    bytes.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * (600 * t + 80 * t * t)) * Math.sin(Math.PI * (t % 1)) * .08;
        bytes.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
    }
    return bytes;
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

    const jsonDownloadPromise = page.waitForEvent('download');
    await page.locator('#export-json').click();
    const jsonDownload = await jsonDownloadPromise;
    const report = JSON.parse(await readFile(await jsonDownload.path(), 'utf8'));
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
    await writeFile(testInfo.outputPath('real-model-report.json'), JSON.stringify(report, null, 2));
    const csvDownloadPromise = page.waitForEvent('download');
    await page.locator('#export-csv').click();
    const csvDownload = await csvDownloadPromise;
    const csv = await readFile(await csvDownload.path(), 'utf8');
    expect(csv).toContain('model_score'); expect(csv).toContain('synthetic-12.25s.wav');
    await writeFile(testInfo.outputPath('real-model-report.csv'), csv);
    await page.screenshot({ path: testInfo.outputPath('mobile-results.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

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
        verified: ['real model initialization', 'real browser inference', '12.25-second full-file coverage', 'tail timestamp', 'playback seek', 'JSON/CSV exports', 'replacement file', 'mobile overflow'],
    }, null, 2));
});
