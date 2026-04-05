import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Browser, type Page } from '@playwright/test';

export type E2ERole = 'superadmin' | 'hr' | 'manager' | 'employee';

interface RoleCredentials {
    email: string;
    password: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authDir = path.resolve(__dirname, '../.auth');

const fallbackEmails: Record<E2ERole, string> = {
    superadmin: 'admin.demo@xenos.local',
    hr: 'hr.demo@xenos.local',
    manager: 'manager.demo@xenos.local',
    employee: 'farhan.demo@xenos.local',
};

const envKeyByRole: Record<E2ERole, { email: string; password: string }> = {
    superadmin: {
        email: 'E2E_SUPERADMIN_EMAIL',
        password: 'E2E_SUPERADMIN_PASSWORD',
    },
    hr: {
        email: 'E2E_HR_EMAIL',
        password: 'E2E_HR_PASSWORD',
    },
    manager: {
        email: 'E2E_MANAGER_EMAIL',
        password: 'E2E_MANAGER_PASSWORD',
    },
    employee: {
        email: 'E2E_EMPLOYEE_EMAIL',
        password: 'E2E_EMPLOYEE_PASSWORD',
    },
};

function envValue(key: string): string {
    return String(process.env[key] || '').trim();
}

export function authStatePath(role: E2ERole): string {
    return path.join(authDir, `${role}.json`);
}

export function getRoleCredentials(role: E2ERole): RoleCredentials {
    const keys = envKeyByRole[role];
    const email = envValue(keys.email) || fallbackEmails[role];
    const password = envValue(keys.password) || envValue('E2E_PASSWORD') || 'Demo123!';

    return { email, password };
}

export async function ensureAuthDir(): Promise<void> {
    await fs.mkdir(authDir, { recursive: true });
}

export async function resetAuthStates(): Promise<void> {
    await fs.rm(authDir, { recursive: true, force: true });
    await ensureAuthDir();
}

export async function loginAs(page: Page, role: E2ERole): Promise<void> {
    const credentials = getRoleCredentials(role);

    if (!credentials.email || !credentials.password) {
        throw new Error(`Missing Playwright credentials for role "${role}".`);
    }

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel(/email/i).fill(credentials.email);
    await page.getByLabel(/password/i).fill(credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /management console/i })).toBeVisible();

    await ensureAuthDir();
    await page.context().storageState({ path: authStatePath(role) });
}

export async function ensureRoleAuthState(browser: Browser, baseURL: string, role: E2ERole): Promise<void> {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
        await loginAs(page, role);
    } finally {
        await context.close();
    }
}
