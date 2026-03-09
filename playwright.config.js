import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 90000,
    retries: process.env.CI ? 1 : 0,
    expect: {
        timeout: 15000,
    },
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1440, height: 900 },
    },
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],
});
