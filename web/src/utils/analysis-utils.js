import { SAMPLE_RATE, AUDIO_SAMPLES } from '../config/constants.js';

export function formatTimestamp(seconds) {
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}

/** Non-overlapping windows cover every sample, including a zero-padded final window. */
export function* audioSegments(samples, sampleRate = SAMPLE_RATE, windowSize = AUDIO_SAMPLES) {
    if (!samples.length || sampleRate <= 0 || windowSize < 1) throw new Error('비어 있거나 잘못된 오디오입니다');
    for (let offset = 0; offset < samples.length; offset += windowSize) {
        const end = Math.min(offset + windowSize, samples.length);
        const audio = new Float32Array(windowSize);
        audio.set(samples.subarray(offset, end));
        yield { audio, start: offset / sampleRate, end: end / sampleRate };
    }
}

/** Abort stops between windows; an already-running ONNX invocation finishes safely. */
export async function analyzeSegments(samples, classify, { signal, onProgress = () => {} } = {}) {
    const segments = [];
    const total = Math.ceil(samples.length / AUDIO_SAMPLES);
    for (const { audio, start, end } of audioSegments(samples)) {
        signal?.throwIfAborted();
        const detections = await classify(audio);
        signal?.throwIfAborted();
        segments.push({ start, end, detections });
        onProgress({ completed: segments.length, total, segments });
        await new Promise(resolve => setTimeout(resolve, 0));
        signal?.throwIfAborted();
    }
    return segments;
}

export function summarizeDetections(segments) {
    const species = new Map();
    for (const segment of segments) for (const detection of segment.detections) {
        const previous = species.get(detection.label);
        if (!previous) species.set(detection.label, { ...detection, count: 1, firstSeen: segment.start });
        else { previous.count++; previous.confidence = Math.max(previous.confidence, detection.confidence); }
    }
    return [...species.values()].sort((a, b) => b.confidence - a.confidence);
}

// Quote every cell, and neutralize spreadsheet formulas in any user/model text.
export function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}

export function exportCSV(report) {
    const rows = [['file', 'model', 'status', 'start_seconds', 'end_seconds', 'scientific_name', 'korean_name', 'model_score']];
    for (const segment of report.segments) {
        // Preserve analyzed windows with no above-threshold detections as well.
        for (const detection of segment.detections.length ? segment.detections : [{}]) {
            rows.push([report.name, report.model, report.status, segment.start, segment.end,
                detection.label, detection.koreanName, detection.confidence]);
        }
    }
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
