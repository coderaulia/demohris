import { test, expect } from '@playwright/test';

import { authStatePath } from './helpers/auth';
import { expectNoConsoleErrors, inputForLabel, selectForLabel, startConsoleCapture, waitForDataToSettle } from './helpers/ui';

function departmentLinks(pageUrlHrefs: string[]): string[] {
    return pageUrlHrefs.map(href => decodeURIComponent(String(href).split('/').pop() || ''));
}

test.describe('Dashboard - HR', () => {
    test.use({ storageState: authStatePath('hr') });

    test('filter bar is visible with department, manager, and period', async ({ page }) => {
        await page.goto('/dashboard');
        await waitForDataToSettle(page);

        await expect(selectForLabel(page, 'Department')).toBeVisible();
        await expect(selectForLabel(page, 'Manager')).toBeVisible();
        await expect(inputForLabel(page, 'Period')).toBeVisible();
        await expect(page.getByRole('button', { name: /apply filters/i })).toBeVisible();
    });

    test('KPI Summary tab is clickable', async ({ page }) => {
        await page.goto('/dashboard');
        await waitForDataToSettle(page);

        const kpiTab = page.getByRole('tab', { name: /kpi summary/i });
        await kpiTab.click();

        await expect(kpiTab).toHaveAttribute('data-state', 'active');
        await expect(page.getByText(/enrollment records/i)).toBeVisible();
    });

    test('Assessment Summary tab is clickable', async ({ page }) => {
        await page.goto('/dashboard');
        await waitForDataToSettle(page);

        const assessmentTab = page.getByRole('tab', { name: /assessment summary/i });
        await assessmentTab.click();

        await expect(assessmentTab).toHaveAttribute('data-state', 'active');
        await expect(page.getByText(/needs identified/i)).toBeVisible();
    });

    test('department filter changes the department card list', async ({ page }) => {
        await page.goto('/dashboard');
        await waitForDataToSettle(page);

        const departmentSelect = selectForLabel(page, 'Department');
        const links = page.locator('a[href^="/dashboard/drilldown/"]');
        const initialCount = await links.count();
        expect(initialCount).toBeGreaterThan(0);

        const options = await departmentSelect.evaluate(select =>
            Array.from((select as HTMLSelectElement).options).map(option => ({
                value: option.value,
                label: option.label,
            })),
        );

        const chosen = options.find(option => option.value);
        expect(chosen?.value).toBeTruthy();

        await departmentSelect.selectOption(chosen!.value);
        await page.getByRole('button', { name: /apply filters/i }).click();
        await waitForDataToSettle(page);

        const filteredLinks = await links.evaluateAll(elements =>
            elements.map(element => (element as HTMLAnchorElement).getAttribute('href') || ''),
        );

        expect(filteredLinks.length).toBeGreaterThan(0);
        expect(filteredLinks.length).toBeLessThanOrEqual(initialCount);
        expect(new Set(departmentLinks(filteredLinks))).toEqual(new Set([chosen!.value]));
    });

    test('no console errors on load', async ({ page }) => {
        const issues = startConsoleCapture(page);

        await page.goto('/dashboard');
        await waitForDataToSettle(page);
        await expect(page.getByRole('heading', { name: /hr management dashboard/i })).toBeVisible();

        expectNoConsoleErrors(issues);
    });
});

test.describe('Dashboard - Manager', () => {
    test.use({ storageState: authStatePath('manager') });

    test('dashboard loads with department-scoped data', async ({ page }) => {
        await page.goto('/dashboard');
        await waitForDataToSettle(page);

        const links = page.locator('a[href^="/dashboard/drilldown/"]');
        await expect(links.first()).toBeVisible();

        const hrefs = await links.evaluateAll(elements =>
            elements.map(element => (element as HTMLAnchorElement).getAttribute('href') || ''),
        );
        const departments = [...new Set(departmentLinks(hrefs))];

        expect(departments.length).toBe(1);
    });
});
