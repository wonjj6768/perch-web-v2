import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/browser',
    timeout: 15 * 60 * 1000,
    expect: { timeout: 30000 },
    workers: 1,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        browserName: 'chromium',
        headless: true,
        viewport: { width: 390, height: 844 },
        trace: 'off',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'python3 -m http.server 8765 --bind 127.0.0.1',
        url: 'http://127.0.0.1:8765/web/',
        reuseExistingServer: !process.env.CI,
    },
});
