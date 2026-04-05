import { test, expect } from '@playwright/test';

import { getRoleCredentials, loginAs } from './helpers/auth';

test.describe('Auth', () => {
    test('valid login redirects to /dashboard', async ({ page }) => {
        const hr = getRoleCredentials('hr');

        await page.goto('/login');
        await page.getByLabel(/email/i).fill(hr.email);
        await page.getByLabel(/password/i).fill(hr.password);
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /management console/i })).toBeVisible();
    });

    test('wrong password shows error without redirect', async ({ page }) => {
        const hr = getRoleCredentials('hr');

        await page.goto('/login');
        await page.getByLabel(/email/i).fill(hr.email);
        await page.getByLabel(/password/i).fill(`${hr.password}-wrong`);
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page.getByText(/invalid|failed|credentials/i)).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });

    test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
        await page.goto('/dashboard');

        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('unauthenticated /employees redirects to /login', async ({ page }) => {
        await page.goto('/employees');

        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('logout clears session and /dashboard redirects back to /login', async ({ page }) => {
        await loginAs(page, 'hr');

        await page.getByRole('button', { name: /sign out/i }).click();
        await expect(page).toHaveURL(/\/login$/);

        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login$/);
    });
});
