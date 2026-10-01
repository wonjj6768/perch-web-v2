import test from 'node:test';
import assert from 'node:assert/strict';
import { audioSegments, analyzeSegments, exportCSV, summarizeDetections, formatTimestamp } from '../web/src/utils/analysis-utils.js';
import { AUDIO_SAMPLES } from '../web/src/config/constants.js';
import { validateAudioFile, normalizeAudio } from '../web/src/utils/audio-utils.js';

test('windows cover entire file, retain final sample, and pad only the tail', () => {
    const data = new Float32Array(AUDIO_SAMPLES * 2 + 8);
    data[0] = 1; data[data.length - 1] = 2;
    const windows = [...audioSegments(data)];
    assert.equal(windows.length, 3);
    assert.equal(windows[0].audio[0], 1);
    assert.equal(windows[2].audio[7], 2);
    assert.equal(windows[2].audio[8], 0);
    assert.equal(windows[2].start, 10);
    assert.equal(windows[2].end, data.length / 32000);
});
test('short/exact/empty file boundaries', () => {
    assert.equal([...audioSegments(new Float32Array(AUDIO_SAMPLES))].length, 1);
    assert.equal([...audioSegments(new Float32Array(1))][0].end, 1 / 32000);
    assert.throws(() => [...audioSegments(new Float32Array(0))]);
});
test('analysis reports completed windows and stops before next inference', async () => {
    const controller = new AbortController(); let calls = 0; let progress;
    await assert.rejects(analyzeSegments(new Float32Array(AUDIO_SAMPLES * 3), async () => { calls++; return []; }, {
        signal: controller.signal,
        onProgress: value => { progress = value; controller.abort(); },
    }), { name: 'AbortError' });
    assert.equal(calls, 1); assert.equal(progress.completed, 1); assert.equal(progress.total, 3);
});
test('abort during inference never includes stale output', async () => {
    const controller = new AbortController(); let updates = 0;
    await assert.rejects(analyzeSegments(new Float32Array(1), async () => { controller.abort(); return []; }, {
        signal: controller.signal, onProgress: () => updates++,
    }), { name: 'AbortError' });
    assert.equal(updates, 0);
});
test('summary uses maximum score and window count', () => {
    const summary = summarizeDetections([
        { start: 0, detections: [{ label: 'A', confidence: .2 }] },
        { start: 5, detections: [{ label: 'A', confidence: .8 }, { label: 'B', confidence: .5 }] },
    ]);
    assert.deepEqual(summary[0], { label: 'A', confidence: .8, count: 2, firstSeen: 0 });
});
test('CSV preserves empty windows, quotes commas/newlines and neutralizes formulas', () => {
    const csv = exportCSV({ name: '=SUM(1,2)\n"file"', model: 'Perch', status: 'cancelled', segments: [
        { start: 0, end: 5, detections: [{ label: '+formula', confidence: .25 }] },
        { start: 5, end: 6, detections: [] },
    ] });
    assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes("'=SUM"));
    assert.ok(csv.includes('""file""')); assert.ok(csv.includes("'+formula"));
    assert.ok(csv.includes('"5","6","","",""'));
});
test('file validation supports MIME-less known audio extensions and rejects oversized files', () => {
    assert.equal(validateAudioFile({ name: 'song.FLAC', type: '', size: 100 }).valid, true);
    assert.equal(validateAudioFile({ name: 'bad.txt', type: '', size: 100 }).valid, false);
    assert.equal(validateAudioFile({ name: 'big.wav', type: 'audio/wav', size: 51 * 1024 * 1024 }).valid, false);
});
test('large audio normalization does not overflow argument stack', () => {
    const data = new Float32Array(200000).fill(.5); data[100] = 2;
    assert.equal(normalizeAudio(data)[0], .25);
    assert.equal(formatTimestamp(65.25), '01:05.3');
});
test('cancel during final UI yield cannot be marked complete', async () => {
    const controller = new AbortController();
    await assert.rejects(analyzeSegments(new Float32Array(1), async () => [], {
        signal: controller.signal,
        onProgress: () => setTimeout(() => controller.abort(), 0),
    }), { name: 'AbortError' });
});
test('full-audio preparation mixes both channels and keeps full duration', async () => {
    const { prepareFullAudio } = await import('../web/src/utils/audio-utils.js');
    let mono, requested;
    globalThis.OfflineAudioContext = class {
        constructor(channels, length, rate) { requested = { channels, length, rate }; }
        createBuffer(channels, length) { mono = new Float32Array(length); return { getChannelData: () => mono }; }
        createBufferSource() { return { connect() {}, start() {} }; }
        async startRendering() { return { getChannelData: () => mono }; }
    };
    const output = await prepareFullAudio({
        length: 4, duration: 4 / 32000, sampleRate: 32000, numberOfChannels: 2,
        getChannelData: channel => new Float32Array(channel ? [1, 2, 3, 4] : [3, 4, 5, 6]),
    });
    assert.deepEqual([...output], [2, 3, 4, 5]);
    assert.deepEqual(requested, { channels: 1, length: 4, rate: 32000 });
    delete globalThis.OfflineAudioContext;
});
test('duration limit rejects before allocating resampler', async () => {
    const { prepareFullAudio } = await import('../web/src/utils/audio-utils.js');
    await assert.rejects(prepareFullAudio({ length: 1, duration: 1201 }), /20분/);
});
