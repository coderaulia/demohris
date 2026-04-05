import { test, expect, type Page } from '@playwright/test';
import { authStatePath } from './helpers/auth';
import { selectForLabel, waitForDataToSettle } from './helpers/ui';

test.describe('Management Workflows - HR/Admin', () => {
    test.use({ storageState: authStatePath('hr') });

    test('can create a new employee', async ({ page }) => {
        await page.goto('/employees');
        await waitForDataToSettle(page);

        // Open Modal
        await page.getByRole('button', { name: /add employee/i }).click();
        await expect(page.getByText(/add employee/i)).toBeVisible();

        // Fill form
        const uniqueEmail = `test.emp.${Date.now()}@example.com`;
        await page.getByLabel('Name').fill('Test Playwright Employee');
        await page.getByLabel('Email').fill(uniqueEmail);
        await page.getByLabel('Department').fill('QA-Test');
        await page.getByLabel('Position').fill('Automation Engineer');
        
        // Select Manager (optional but let's try if options exist)
        const managerSelect = page.getByLabel('Manager');
        const managerOptions = await managerSelect.evaluate(s => (s as HTMLSelectElement).options.length);
        if (managerOptions > 1) {
            await managerSelect.selectOption({ index: 1 });
        }

        await page.getByLabel('Join Date').fill('2026-04-01');

        // Submit
        await page.getByRole('button', { name: /create employee/i }).click();
        
        // Success check (Modal closes and list updates)
        await expect(page.getByText(/add employee/i)).toHaveCount(0);
        await waitForDataToSettle(page);

        // Verify in list
        await page.getByPlaceholder(/name, employee id, email/i).fill('Test Playwright Employee');
        await page.getByRole('button', { name: /apply filters/i }).click();
        await waitForDataToSettle(page);
        await expect(page.getByText('Test Playwright Employee')).toBeVisible();
    });

    test('can create a new KPI definition', async ({ page }) => {
        await page.goto('/system/kpi-settings');
        await waitForDataToSettle(page);

        const uniqueKpiName = `Auto KPI ${Date.now()}`;
        await page.getByPlaceholder(/kpi name/i).fill(uniqueKpiName);
        await page.getByPlaceholder(/description/i).fill('Created via Playwright E2E');
        await page.getByPlaceholder(/apply to position/i).fill('Automation Engineer');
        await page.getByPlaceholder(/target value/i).fill('95');
        
        // Submit
        await page.getByRole('button', { name: /^save$/i }).click();
        
        // Wait for list update
        await waitForDataToSettle(page);
        await expect(page.getByText(uniqueKpiName)).toBeVisible();
    });

    test('can input KPI achievement for an employee', async ({ page }) => {
        await page.goto('/performance/kpi-input');
        await waitForDataToSettle(page);

        // Select first available employee
        const empSelect = page.getByLabel('Select Employee');
        const options = await empSelect.evaluate(s => 
            Array.from((s as HTMLSelectElement).options).map(o => o.value).filter(Boolean)
        );
        expect(options.length).toBeGreaterThan(0);
        await empSelect.selectOption(options[0]);
        
        // Click Input Achievement
        await page.getByRole('button', { name: /input kpi achievement/i }).click();
        await expect(page.getByText(/input kpi achievement/i)).toBeVisible();

        // Select KPI (wait for definitions to load for that position)
        const kpiSelect = page.getByLabel('KPI Metric');
        await expect(async () => {
            const kpiOptions = await kpiSelect.evaluate(s => (s as HTMLSelectElement).options.length);
            expect(kpiOptions).toBeGreaterThan(1);
        }).toPass({ timeout: 10000 });
        
        await kpiSelect.selectOption({ index: 1 });

        // Input Value
        const actualInput = page.getByPlaceholder(/enter value in/i);
        if (await actualInput.isVisible()) {
            await actualInput.fill('88.5');
        } else {
            // Might be ratio
            await page.getByPlaceholder(/attained/i).fill('88.5');
            await page.getByPlaceholder(/total/i).fill('100');
        }

        // Submit
        await page.getByRole('button', { name: /submit achievement/i }).click();
        
        // Wait for panel to close
        await expect(page.getByText(/submit achievement/i)).toHaveCount(0);
        await expect(page.getByText(/assessment setup/i)).toBeVisible();
    });
});
