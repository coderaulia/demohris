import 'dotenv/config';

import type { FullConfig } from '@playwright/test';
import { chromium } from '@playwright/test';

import { ensureRoleAuthState, resetAuthStates, type E2ERole } from './helpers/auth';

const roles: E2ERole[] = ['superadmin', 'hr', 'manager', 'employee'];

export default async function globalSetup(config: FullConfig): Promise<void> {
    const baseURL = String(config.projects[0]?.use?.baseURL || config.use?.baseURL || '').trim();
    if (!baseURL) {
        throw new Error('Playwright baseURL is required for E2E auth-state setup.');
    }

    await resetAuthStates();

    const browser = await chromium.launch();
    try {
        for (const role of roles) {
            await ensureRoleAuthState(browser, baseURL, role);
        }
    } finally {
        await browser.close();
    }
}
