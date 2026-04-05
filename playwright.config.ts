import 'dotenv/config';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: ['**/*.spec.ts'],
    globalSetup: './tests/e2e/global.setup.ts',
    timeout: 90_000,
    retries: process.env.CI ? 1 : 0,
    expect: {
        timeout: 15_000,
    },
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1440, height: 900 },
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],
});
