import { test, expect, type Page } from '@playwright/test';

import { authStatePath } from './helpers/auth';
import { selectForLabel, waitForDataToSettle } from './helpers/ui';

function groupedRows(page: Page) {
    return page.locator('tbody tr');
}

async function groupedDepartmentTexts(page: Page): Promise<string[]> {
    return page.locator('tbody tr td:first-child').evaluateAll(cells =>
        cells.map(cell => String(cell.textContent || '').trim()).filter(Boolean),
    );
}

async function waitForKpiReportingReady(page: Page): Promise<void> {
    await waitForDataToSettle(page);
    await expect(page.getByText(/loading kpi\/assessment summaries/i)).toHaveCount(0);
    await expect(page.getByText(/^Source:loading$/i)).toHaveCount(0);
}

test.describe('KPI - HR', () => {
    test.use({ storageState: authStatePath('hr') });

    test('kpi route loads with KPI Summary tab', async ({ page }) => {
        await page.goto('/kpi');
        await waitForKpiReportingReady(page);

        await expect(page).toHaveURL(/\/kpi$/);
        await expect(page.getByRole('tab', { name: /kpi summary/i })).toHaveAttribute('data-state', 'active');
    });

    test('Assessment For TNA tab loads', async ({ page }) => {
        await page.goto('/kpi');
        await waitForKpiReportingReady(page);

        const tab = page.getByRole('tab', { name: /assessment for tna summary/i });
        await tab.click();

        await expect(tab).toHaveAttribute('data-state', 'active');
        await expect(page.getByRole('heading', { name: /assessment for tna summary/i })).toBeVisible();
    });

    test('department filter applies to grouped rows', async ({ page }) => {
        await page.goto('/kpi');
        await waitForKpiReportingReady(page);

        const departmentSelect = selectForLabel(page, 'Department');
        const options = await departmentSelect.evaluate(select =>
            Array.from((select as HTMLSelectElement).options).map(option => option.value).filter(Boolean),
        );
        expect(options.length).toBeGreaterThan(0);

        await departmentSelect.selectOption(options[0]);
        await page.getByRole('button', { name: /^apply$/i }).click();
        await waitForKpiReportingReady(page);

        const departments = await groupedDepartmentTexts(page);
        expect(departments.length).toBeGreaterThan(0);
        expect(new Set(departments)).toEqual(new Set([options[0]]));
    });

    test('no Deferred badges are visible', async ({ page }) => {
        await page.goto('/kpi');
        await waitForKpiReportingReady(page);

        await expect(page.getByText(/^Deferred$/)).toHaveCount(0);
    });
});

test.describe('KPI - Manager', () => {
    test.use({ storageState: authStatePath('manager') });

    test('manager sees only own department data', async ({ page }) => {
        await page.goto('/kpi');
        await waitForKpiReportingReady(page);

        const rows = groupedRows(page);
        expect(await rows.count()).toBeGreaterThan(0);

        const departments = await groupedDepartmentTexts(page);
        expect(new Set(departments).size).toBe(1);
    });
});

test.describe('KPI - Employee', () => {
    test.use({ storageState: authStatePath('employee') });

    test('employee /kpi redirects to /dashboard', async ({ page }) => {
        await page.goto('/kpi');

        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /management console/i })).toBeVisible();
    });
});
