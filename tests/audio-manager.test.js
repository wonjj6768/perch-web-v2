import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../web/src/services/AudioManager.js';
import stateManager from '../web/src/services/StateManager.js';

function mocks({ pending = false } = {}) {
    let stopped = 0, requests = 0, release, recorder;
    const stream = { getTracks: () => [{ stop() { stopped++; } }] };
    const microphone = pending ? new Promise(resolve => { release = () => resolve(stream); }) : Promise.resolve(stream);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia() { requests++; return microphone; } } } });
    globalThis.window = { AudioContext: class {
        createAnalyser() { return {}; }
        createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
        close() { return Promise.resolve(); }
    } };
    globalThis.MediaRecorder = class {
        static isTypeSupported(type) { return type === 'audio/mp4'; }
        constructor(stream, options) { recorder = this; this.mimeType = options.mimeType; this.state = 'inactive'; }
        start() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            this.ondataavailable({ data: new Blob(['recorded'], { type: this.mimeType }) });
            queueMicrotask(() => this.onstop());
        }
    };
    return { release: () => release(), stopped: () => stopped, requests: () => requests, recorder: () => recorder };
}

test('manual mode still returns recording with real MIME and releases microphone', async () => {
    const fixture = mocks(); const manager = new AudioManager(); let blob;
    stateManager.updateSettings({ autoClassify: false });
    await manager.initialize(); await manager.startRecording({ onStop: value => { blob = value; } });
    manager.stopRecording(); await Promise.resolve();
    assert.equal(blob.type, 'audio/mp4'); assert.equal(await blob.text(), 'recorded');
    assert.equal(fixture.stopped(), 1); assert.equal(manager.isRecording, false);
    manager.dispose(); stateManager.reset();
});
test('repeated starts during permission prompt do not request multiple streams', async () => {
    const fixture = mocks({ pending: true }); const manager = new AudioManager();
    await manager.initialize();
    const starting = manager.startRecording();
    await manager.startRecording();
    assert.equal(fixture.requests(), 1);
    fixture.release(); await starting;
    manager.dispose(); await Promise.resolve();
    assert.equal(fixture.stopped(), 1);
});
test('dispose during microphone permission releases late stream without starting recording', async () => {
    const fixture = mocks({ pending: true }); const manager = new AudioManager(); let callbacks = 0;
    await manager.initialize(); const starting = manager.startRecording({ onStop: () => callbacks++ });
    manager.dispose(); fixture.release(); await starting;
    assert.equal(fixture.stopped(), 1); assert.equal(manager.isRecording, false); assert.equal(callbacks, 0);
});
test('dispose suppresses late stop callback', async () => {
    mocks(); const manager = new AudioManager(); let callbacks = 0;
    await manager.initialize(); await manager.startRecording({ onStop: () => callbacks++ });
    manager.dispose(); await Promise.resolve(); assert.equal(callbacks, 0);
});

test('spontaneous recorder stop resets state and allows a new recording', async () => {
    const fixture = mocks(); const manager = new AudioManager();
    await manager.initialize(); await manager.startRecording();
    fixture.recorder().stop(); await Promise.resolve();
    assert.equal(manager.isRecording, false);
    assert.equal(stateManager.get('isRecording'), false);
    await manager.startRecording(); assert.equal(manager.isRecording, true);
    manager.dispose(); await Promise.resolve();
});
test('recorder error releases tracks and never sends partial audio for classification', async () => {
    const fixture = mocks(); const manager = new AudioManager(); let stops = 0, errors = 0;
    await manager.initialize();
    await manager.startRecording({ onStop: () => stops++, onError: () => errors++ });
    fixture.recorder().onerror({ error: new Error('device disconnected') });
    await Promise.resolve();
    assert.equal(stops, 0); assert.equal(errors, 1); assert.equal(fixture.stopped(), 1);
    assert.equal(manager.isRecording, false); manager.dispose();
});
test('late events from failed recorder cannot stop or modify a newer recording', async () => {
    const fixture = mocks(); const manager = new AudioManager(); let oldStops = 0, newStops = 0;
    await manager.initialize(); await manager.startRecording({ onStop: () => oldStops++ });
    const oldRecorder = fixture.recorder();
    oldRecorder.state = 'inactive';
    oldRecorder.onerror({ error: new Error('device disconnected') });
    await manager.startRecording({ onStop: () => newStops++ });
    oldRecorder.onstop();
    oldRecorder.ondataavailable({ data: new Blob(['stale']) });
    oldRecorder.onerror({ error: new Error('late error') });
    assert.equal(manager.isRecording, true); assert.equal(oldStops, 0); assert.equal(newStops, 0);
    manager.stopRecording(); await Promise.resolve();
    assert.equal(newStops, 1); manager.dispose();
});
