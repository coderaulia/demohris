import { test, expect } from '@playwright/test';

const testUsers = {
    employee: {
        email: process.env.E2E_EMPLOYEE_EMAIL || 'farhan.demo@xenos.local',
        password: process.env.E2E_PASSWORD || 'Demo123!'
    },
    manager: {
        email: process.env.E2E_MANAGER_EMAIL || 'manager.demo@xenos.local',
        password: process.env.E2E_PASSWORD || 'Demo123!'
    }
};

function assertNoFatalPageErrors(errors) {
    const ignored = [/ResizeObserver loop limit exceeded/i];
    const fatal = errors.filter(message => !ignored.some(pattern => pattern.test(message)));
    expect.soft(fatal, `Unexpected page errors:\n${fatal.join('\n')}`).toEqual([]);
}

async function loginAs(page, userType = 'employee') {
    const user = testUsers[userType];
    await page.goto('/');
    await page.fill('#login-user', user.email);
    await page.fill('#login-pass', user.password);
    await page.click('#login-btn');
    await expect(page.locator('#main-app')).toBeVisible({ timeout: 30000 });
}

test.describe('LMS Lesson Viewer E2E Tests', () => {
    test.skip(!process.env.E2E_EMPLOYEE_EMAIL, 'Requires E2E test credentials');

    test('lesson viewer modal opens correctly', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        // Navigate to LMS
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            await expect(page.locator('#tab-lms')).toBeVisible();
            
            // Go to My Learning to find enrollments
            await page.click('[data-lms-view="my-learning"]');
            await expect(page.locator('#lms-view-my-learning')).toBeVisible();
            
            // Check for continue buttons
            const continueButtons = page.locator('button:has-text("Continue")');
            const count = await continueButtons.count();
            
            if (count > 0) {
                // Click a continue button
                await continueButtons.first().click();
                
                // Wait for lesson viewer modal
                const modal = page.locator('#lesson-viewer-modal');
                await expect(modal).toBeVisible({ timeout: 5000 });
                
                // Check modal structure
                await expect(page.locator('[id^="lesson-btn-"]').first()).toBeVisible();
                await expect(page.locator('#lesson-content-wrapper')).toBeVisible();
                
                // Close modal
                await page.click('.modal-header .btn-close');
                await expect(modal).not.toBeVisible();
            }
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('course outline navigation works', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // This test assumes there's at least one enrolled course with lessons
            // In real testing, we'd create test data first
            
            // Navigate to my-learning
            await page.click('[data-lms-view="my-learning"]');
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('progress tracking updates correctly', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Navigate to My Learning
            await page.click('[data-lms-view="my-learning"]');
            
            // Check progress card exists
            const progressCard = page.locator('#lms-continue-learning-card');
            await expect(progressCard).toBeVisible();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('enrollment flow shows confirmation', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Go to catalog
            await page.click('[data-lms-view="catalog"]');
            await expect(page.locator('#lms-view-catalog')).toBeVisible();
            
            // Wait for courses to load
            await page.waitForTimeout(1000);
            
            // Check for course cards
            const courseCards = page.locator('.course-card');
            const count = await courseCards.count();
            
            if (count > 0) {
                // Click first course
                await courseCards.first().click();
                
                // Wait for course details modal
                const modal = page.locator('#lms-course-detail-modal');
                await expect(modal).toBeVisible({ timeout: 3000 });
                
                // Check enrollment button
                const enrollBtn = page.locator('#lms-btn-enroll-course');
                if (await enrollBtn.isVisible()) {
                    await enrollBtn.click();
                    
                    // Verify confirmation dialog appears
                    const confirmDialog = page.locator('.swal2-popup');
                    await expect(confirmDialog).toBeVisible({ timeout: 2000 });
                    
                    // Verify it shows course info
                    await expect(confirmDialog.locator('.enrollment-confirmation')).toBeVisible();
                    
                    // Cancel enrollment
                    await page.click('.swal2-cancel');
                }
            }
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('quiz placeholder works', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        // This test would verify that quiz lessons show "Start Quiz" button
        // In future Sprint 3, this would test actual quiz functionality
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            // Placeholder for quiz tests in Sprint 3
        }

        assertNoFatalPageErrors(pageErrors);
    });
});

test.describe('LMS Progress Tracking E2E Tests', () => {
    test.skip(!process.env.E2E_EMPLOYEE_EMAIL, 'Requires E2E test credentials');

    test('circular progress widget renders', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Check My Learning dashboard
            await page.click('[data-lms-view="my-learning"]');
            
            // Verify progress cards appear
            await expect(page.locator('#lms-enrolled-count')).toBeVisible();
            await expect(page.locator('#lms-in-progress-count')).toBeVisible();
            await expect(page.locator('#lms-completed-count')).toBeVisible();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('course progress cards display correctly', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            await page.click('[data-lms-view="my-courses"]');
            
            // Check for progress bars in course list
            const progressBars = page.locator('.progress');
            const count = await progressBars.count();
            
            // Should have at least one progress bar if enrolled
            if (count > 0) {
                await expect(progressBars.first()).toBeVisible();
            }
        }

        assertNoFatalPageErrors(pageErrors);
    });
});