import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const script = readFileSync('web/service-worker.js', 'utf8');
function worker(addAll) {
    const handlers = new Map(); let skipped = false;
    const context = vm.createContext({
        console: { log() {}, error() {}, warn() {} },
        self: { addEventListener: (type, callback) => handlers.set(type, callback), skipWaiting() { skipped = true; } },
        caches: { open: async () => ({ addAll }) },
    });
    vm.runInContext(script, context);
    return { context, handlers, skipped: () => skipped };
}
test('every service worker precache asset exists, including whole-file analysis module', () => {
    const { context } = worker();
    const assets = vm.runInContext('STATIC_ASSETS', context);
    for (const asset of assets) assert.ok(existsSync(resolve('web', asset)), `Missing precache asset ${asset}`);
    assert.ok(assets.includes('./src/utils/analysis-utils.js'));
});
test('failed precache rejects installation instead of activating an incomplete app', async () => {
    const fixture = worker(async () => { throw new Error('precache unavailable'); }); let completion;
    fixture.handlers.get('install')({ waitUntil(promise) { completion = promise; } });
    await assert.rejects(completion, /precache unavailable/);
    assert.equal(fixture.skipped(), false);
});
test('successful precache allows activation', async () => {
    let count = 0; const fixture = worker(async assets => { count = assets.length; }); let completion;
    fixture.handlers.get('install')({ waitUntil(promise) { completion = promise; } });
    await completion; assert.ok(count > 20); assert.equal(fixture.skipped(), true);
});
