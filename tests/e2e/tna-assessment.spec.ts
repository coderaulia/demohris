import { expect, test } from '@playwright/test';

import { authStatePath } from './helpers/auth';
import { waitForDataToSettle } from './helpers/ui';

test.describe('TNA Assessment Workflow', () => {
    
    test.describe('Manager Functionality', () => {
        test.use({ storageState: authStatePath('manager') });

        test('Manager can select employee and submit evaluation', async ({ page }) => {
            // 1. Visit the assessment selection page.
            await page.goto('/assessment/start');
            await waitForDataToSettle(page);
            
            // 2. Select an employee (e.g., Farhan)
            // Farhan is a common test employee in this codebase (EMP002).
            const farhanCard = page.getByRole('button', { name: /farhan/i }).first();
            await expect(farhanCard).toBeVisible();
            await farhanCard.click();
            
            // 3. Verify landing on assessment setup for the employee.
            await expect(page.getByRole('heading', { name: /assess competencies/i })).toBeVisible();
            await expect(page.getByText(/farhan/i)).toBeVisible();

            // 4. Input scores and qualitative feedback.
            // We expect at least one competency card to be rendered.
            const cards = page.locator('.space-y-4 .border-amber-200, .space-y-4 .bg-card');
            await expect(cards.first()).toBeVisible();
            
            const firstCompetency = cards.first();
            // Score 2 (out of 5) should create a gap if the required level is at least 3.
            await firstCompetency.getByRole('button', { name: '2', exact: true }).click();
            await firstCompetency.locator('textarea').fill('E2E Evaluation: Needs more hands-on training for this competency.');

            // 5. Submit the evaluation.
            await page.getByRole('button', { name: /submit evaluation/i }).click();
            
            // 6. Confirm redirect to the TNA dashboard.
            await expect(page).toHaveURL(/kpi|dashboard/);
        });
    });

    test.describe('Employee Functionality', () => {
        test.use({ storageState: authStatePath('employee') });

        test('Employee can review manager scores and submit self-assessment', async ({ page }) => {
            // 1. Employee navigates directly to the assessment start page (auto-resolved to self).
            await page.goto('/assessment/start');
            await waitForDataToSettle(page);

            // 2. Verify heading reflects the self-assessment context.
            await expect(page.getByRole('heading', { name: /self-assessment/i })).toBeVisible();
            
            // 3. Perform self-assessment scoring.
            const selfScoreBtn = page.getByRole('button', { name: '4', exact: true }).first();
            if (await selfScoreBtn.count() > 0) {
                await selfScoreBtn.click();
                await page.locator('textarea[placeholder*="Reflect"]').first().fill('E2E Self-Reflection: I have improved since last quarter.');
            }

            // 4. Submit self-assessment (active if manager has already evaluated).
            const submitBtn = page.getByRole('button', { name: /submit self-assessment/i });
            if (await submitBtn.isEnabled()) {
                await submitBtn.click();
                await expect(page).toHaveURL(/dashboard/);
            } else {
                // If manager evaluation doesn't exist, we expect the warning banner.
                await expect(page.getByText(/manager has evaluated/i)).toBeVisible();
            }
        });

        test('Employee can see assessment summary on dashboard', async ({ page }) => {
            await page.goto('/dashboard');
            await waitForDataToSettle(page);
            
            // Should see a TNA or Assessment related card on the primary dashboard.
            await expect(page.getByText(/assessment/i)).toBeVisible();
        });
    });
});
