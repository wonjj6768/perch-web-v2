/**
 * Perch Web Service Worker
 * PWA 오프라인 지원 및 캐시 관리
 * @module service-worker
 */

// ============================================
// 설정
// ============================================

const CACHE_VERSION = 'v1';
const APP_CACHE_NAME = `Perch Web-app-${CACHE_VERSION}`;
const MODEL_CACHE_NAME = 'perch-v2-model-cache';

// 정적 자산 목록
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './css/variables.css',
    './css/base.css',
    './css/animations.css',
    './css/layout.css',
    './css/components.css',
    './src/app.js',
    './src/config/constants.js',
    './src/config/index.js',
    './src/services/StateManager.js',
    './src/services/AudioManager.js',
    './src/services/ModelService.js',
    './src/services/index.js',
    './src/components/DOMElements.js',
    './src/components/WaveformCanvas.js',
    './src/components/ResultRenderer.js',
    './src/components/LoadingUI.js',
    './src/components/SettingsModal.js',
    './src/components/RecordButton.js',
    './src/components/UploadArea.js',
    './src/components/index.js',
    './src/utils/audio-utils.js',
    './src/utils/errors.js',
    './src/utils/index.js',
    './manifest.json',
    './data/labels.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// 모델 자산 목록
const MODEL_ASSETS = [
    'https://huggingface.co/justinchuby/Perch-onnx/resolve/main/perch_v2.onnx',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort.min.js',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort-wasm.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort-wasm-simd.wasm',
];

// ============================================
// Install
// ============================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(APP_CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[SW] Install failed:', err))
    );
});

// ============================================
// Activate
// ============================================

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('Perch Web-app-') && name !== APP_CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// ============================================
// Fetch
// ============================================

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (url.origin !== location.origin &&
        !url.hostname.includes('huggingface.co') &&
        !url.hostname.includes('jsdelivr.net')) {
        return;
    }

    if (url.pathname.includes('/model/') || url.pathname.endsWith('.onnx')) {
        return;
    }

    event.respondWith(handleStaticRequest(event.request));
});

/**
 * 정적 자산 요청 처리 (Stale-While-Revalidate)
 */
async function handleStaticRequest(request) {
    const cache = await caches.open(APP_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok && networkResponse.type === 'basic') {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}

// ============================================
// Message
// ============================================

self.addEventListener('message', (event) => {
    const { type } = event.data || {};

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CACHE_MODEL':
            caches.open(MODEL_CACHE_NAME)
                .then((cache) => cache.addAll(MODEL_ASSETS))
                .then(() => event.source.postMessage({ type: 'MODEL_CACHED' }))
                .catch((err) => event.source.postMessage({ type: 'MODEL_CACHE_ERROR', error: err.message }));
            break;

        case 'CLEAR_CACHE':
            Promise.all([
                caches.delete(APP_CACHE_NAME),
                caches.delete(MODEL_CACHE_NAME),
            ]).then(() => event.source.postMessage({ type: 'CACHE_CLEARED' }));
            break;

        case 'GET_CACHE_SIZE':
            getCacheSize().then((size) => {
                event.source.postMessage({ type: 'CACHE_SIZE', size });
            });
            break;
    }
});

async function getCacheSize() {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
            const res = await cache.match(req);
            if (res) totalSize += (await res.blob()).size;
        }
    }
    return totalSize;
}

