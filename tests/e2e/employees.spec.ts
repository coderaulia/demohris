import { test, expect, type Page } from '@playwright/test';

import { authStatePath } from './helpers/auth';
import { selectForLabel, waitForDataToSettle } from './helpers/ui';

function directoryRows(page: Page) {
    return page.locator('tbody tr');
}

async function tableCellTexts(page: Page, columnIndex: number): Promise<string[]> {
    return page.locator(`tbody tr td:nth-child(${columnIndex})`).evaluateAll(cells =>
        cells.map(cell => String(cell.textContent || '').trim()).filter(Boolean),
    );
}

test.describe('Employees - HR', () => {
    test.use({ storageState: authStatePath('hr') });

    test('employees page loads the list', async ({ page }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        await expect(page).toHaveURL(/\/employees$/);
        await expect(page.getByRole('heading', { name: /employee directory/i })).toBeVisible();
        await expect(directoryRows(page).first()).toBeVisible();
    });

    test('name search filters the employee list', async ({ page }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        const rows = directoryRows(page);
        const initialCount = await rows.count();
        expect(initialCount).toBeGreaterThan(0);

        const firstName = await rows.first().locator('td').first().locator('p').first().innerText();
        await page.getByPlaceholder(/name, employee id, email/i).fill(firstName);
        await page.getByRole('button', { name: /apply filters/i }).click();
        await waitForDataToSettle(page);

        const filteredRows = directoryRows(page);
        const filteredCount = await filteredRows.count();
        expect(filteredCount).toBeGreaterThan(0);
        expect(filteredCount).toBeLessThanOrEqual(initialCount);

        const rowTexts = await filteredRows.evaluateAll(elements =>
            elements.map(element => String(element.textContent || '')),
        );
        expect(rowTexts.every(text => text.includes(firstName))).toBeTruthy();
    });

    test('department filter narrows the list', async ({ page }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        const departmentSelect = selectForLabel(page, 'Department');
        const options = await departmentSelect.evaluate(select =>
            Array.from((select as HTMLSelectElement).options).map(option => option.value).filter(Boolean),
        );
        expect(options.length).toBeGreaterThan(0);

        await departmentSelect.selectOption(options[0]);
        await page.getByRole('button', { name: /apply filters/i }).click();
        await waitForDataToSettle(page);

        const departments = await tableCellTexts(page, 2);
        expect(departments.length).toBeGreaterThan(0);
        expect(new Set(departments)).toEqual(new Set([options[0]]));
    });

    test('clicking a row opens /employees/:id', async ({ page }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        await page.getByRole('button', { name: /view detail/i }).first().click();

        await expect(page).toHaveURL(/\/employees\/[^/]+$/);
        await expect(page.getByRole('button', { name: /back to employees/i })).toBeVisible();
    });

    test('detail page shows KPI, Assessment, and LMS sections without Deferred badges', async ({ page }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        await page.getByRole('button', { name: /view detail/i }).first().click();
        await waitForDataToSettle(page);

        await expect(page.getByRole('heading', { name: /assessment summary/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /kpi summary/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /lms summary/i })).toBeVisible();
        await expect(page.getByText(/^Deferred$/)).toHaveCount(0);
    });
});

test.describe('Employees - Manager', () => {
    test.use({ storageState: authStatePath('manager') });

    test('manager sees only own team', async ({ page, browser }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        const rows = directoryRows(page);
        const managerCount = await rows.count();
        expect(managerCount).toBeGreaterThan(0);
        await expect(page.getByText(/scope:\s*my team/i)).toBeVisible();

        const hrContext = await browser.newContext({ storageState: authStatePath('hr') });
        const hrPage = await hrContext.newPage();
        try {
            await hrPage.goto('/employees');
            await waitForDataToSettle(hrPage);

            const hrCount = await directoryRows(hrPage).count();
            expect(managerCount).toBeLessThan(hrCount);
        } finally {
            await hrContext.close();
        }
    });
});

test.describe('Employees - Employee', () => {
    test.use({ storageState: authStatePath('employee') });

    test('employee /employees redirects to /dashboard', async ({ page }) => {
        await page.goto('/employees');

        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /management console/i })).toBeVisible();
    });
});
