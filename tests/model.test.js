import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ModelService } from '../web/src/services/ModelService.js';

// Avoid a Node 24 isolated-runner serialization failure when forwarding model logs.
// Only application console output is muted; assertions and test diagnostics stay active.
before(() => {
    for (const method of ['log', 'warn', 'error']) mock.method(console, method, () => {});
});
after(() => mock.restoreAll());

async function setup(run) {
    const requests = []; const created = []; let disposed = 0;
    globalThis.fetch = async url => {
        requests.push(url);
        return url.includes('labels') ? new Response(JSON.stringify({ labels: ['Species a', 'Species b', 'Species c'] })) : new Response(new Uint8Array([1, 2, 3]));
    };
    globalThis.ort = {
        env: { wasm: {} },
        Tensor: class { constructor(type, data, shape) { this.data = data; this.shape = shape; } dispose() { disposed++; } },
        InferenceSession: { create: async bytes => {
            created.push(bytes);
            return { inputNames: ['audio'], outputNames: ['logits'], run: run || (async () => ({ logits: { data: new Float32Array([2, 1, 0]), dispose() { disposed++; } } })) };
        } },
    };
    const service = new ModelService();
    await service.initialize();
    return { service, requests, created, disposed: () => disposed };
}

test('downloaded model bytes are passed to ONNX without a second URL fetch', async () => {
    const { created, requests } = await setup();
    assert.equal(requests.length, 2); // labels + one model download
    assert.ok(created[0] instanceof Uint8Array);
    assert.deepEqual([...created[0]], [1, 2, 3]);
});
test('cache preserves logits; threshold/topK changes and threshold zero apply immediately', async () => {
    let runs = 0;
    const { service } = await setup(async () => { runs++; return { logits: { data: new Float32Array([2, 1, 0]) } }; });
    const audio = new Float32Array([.1, .2, .3]);
    assert.equal((await service.classify(audio, { topK: 1, threshold: .5 })).length, 1);
    assert.equal((await service.classify(audio, { topK: 3, threshold: 0 })).length, 3);
    assert.equal(runs, 1);
});
test('same-sum audio and typed-array subviews do not collide', async () => {
    let runs = 0;
    const { service } = await setup(async () => { runs++; return { logits: { data: new Float32Array([2, 1, 0]) } }; });
    await service.classify(new Float32Array([1, 2]));
    await service.classify(new Float32Array([2, 1]));
    await service.classify(new Float32Array([9, 1, 2, 9]).subarray(1, 3));
    assert.equal(runs, 2);
});
test('tensors are disposed after success and failure; failed jobs do not block the queue', async () => {
    let runs = 0;
    const fixture = await setup(async () => {
        if (++runs === 1) throw new Error('test inference failure');
        return { logits: { data: new Float32Array([2, 1, 0]), dispose() {} } };
    });
    await assert.rejects(fixture.service.classify(new Float32Array([1])));
    await fixture.service.classify(new Float32Array([2]));
    assert.equal(fixture.disposed(), 2);
});
test('concurrent requests serialize ONNX execution', async () => {
    let running = 0; let maximum = 0;
    const { service } = await setup(async () => {
        running++; maximum = Math.max(maximum, running);
        await new Promise(resolve => setTimeout(resolve, 5)); running--;
        return { logits: { data: new Float32Array([2, 1, 0]) } };
    });
    await Promise.all([service.classify(new Float32Array([1])), service.classify(new Float32Array([2]))]);
    assert.equal(maximum, 1);
});
