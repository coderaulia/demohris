import { test, expect } from '@playwright/test';

const testUsers = {
    employee: {
        email: process.env.E2E_EMPLOYEE_EMAIL || 'farhan.demo@xenos.local',
        password: process.env.E2E_PASSWORD || 'Demo123!'
    },
    manager: {
        email: process.env.E2E_MANAGER_EMAIL || 'manager.demo@xenos.local',
        password: process.env.E2E_PASSWORD || 'Demo123!'
    },
    hr: {
        email: process.env.E2E_HR_EMAIL || 'hr.demo@xenos.local',
        password: process.env.E2E_PASSWORD || 'Demo123!'
    },
    superadmin: {
        email: process.env.E2E_SUPERADMIN_EMAIL || 'admin.demo@xenos.local',
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

test.describe('LMS Course Management E2E Tests', () => {
    test.skip(!process.env.E2E_MANAGER_EMAIL, 'Requires E2E test credentials');

    test('employee can view My Learning dashboard', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        // Check if LMS is enabled
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            await expect(page.locator('#tab-lms')).toBeVisible();
            
            // Check My Learning view
            await expect(page.locator('#lms-view-my-learning')).toBeVisible();
            
            // Check summary cards
            await expect(page.locator('#lms-enrolled-count')).toBeVisible();
            await expect(page.locator('#lms-in-progress-count')).toBeVisible();
            await expect(page.locator('#lms-completed-count')).toBeVisible();
            await expect(page.locator('#lms-certificates-count')).toBeVisible();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('employee can browse course catalog', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Navigate to catalog
            await page.click('[data-lms-view="catalog"]');
            await expect(page.locator('#lms-view-catalog')).toBeVisible();
            
            // Check filter controls
            await expect(page.locator('#lms-catalog-category')).toBeVisible();
            await expect(page.locator('#lms-catalog-difficulty')).toBeVisible();
            await expect(page.locator('#lms-catalog-search')).toBeVisible();
            
            // Check catalog container
            await expect(page.locator('#lms-catalog-cards')).toBeVisible();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('admin can access course management', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'superadmin');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Navigate to admin courses
            await page.click('[data-lms-view="admin-courses"]');
            await expect(page.locator('#lms-view-admin-courses')).toBeVisible();
            
            // Check admin controls
            await expect(page.locator('#lms-btn-admin-new-course')).toBeVisible();
            
            // Check filter controls
            await expect(page.locator('#lms-admin-status')).toBeVisible();
            await expect(page.locator('#lms-admin-search')).toBeVisible();
            
            // Check table
            await expect(page.locator('#lms-admin-courses-body')).toBeVisible();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('admin can open create course modal', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'superadmin');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            await page.click('[data-lms-view="admin-courses"]');
            
            // Click create course button
            await page.click('#lms-btn-admin-new-course');
            
            // Check modal appears
            const modal = page.locator('#lms-course-form-modal');
            await expect(modal).toBeVisible();
            
            // Check form fields
            await expect(page.locator('#course-title')).toBeVisible();
            await expect(page.locator('#course-category')).toBeVisible();
            await expect(page.locator('#course-difficulty')).toBeVisible();
            await expect(page.locator('#course-duration')).toBeVisible();
            
            // Close modal
            await page.click('.btn-close');
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('employee cannot see admin-only elements', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Admin-only elements should not be visible
            const adminCoursesNav = page.locator('#nav-lms-admin-courses');
            await expect(adminCoursesNav).not.toBeVisible();
            
            const adminActions = page.locator('#lms-admin-actions');
            await expect(adminActions).not.toBeVisible();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('LMS navigation and view switching works correctly', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            
            // Test all view switches
            const views = ['my-learning', 'catalog', 'my-courses', 'certificates'];
            
            for (const view of views) {
                await page.click(`[data-lms-view="${view}"]`);
                await expect(page.locator(`#lms-view-${view}`)).toBeVisible();
                
                // Wait a moment for view to load
                await page.waitForTimeout(500);
            }
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('course catalog filters work', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAs(page, 'employee');
        
        const lmsNav = page.locator('#nav-lms');
        if (await lmsNav.isVisible()) {
            await lmsNav.click();
            await page.click('[data-lms-view="catalog"]');
            
            // Test search
            const searchInput = page.locator('#lms-catalog-search');
            await searchInput.fill('test');
            await page.waitForTimeout(500); // Wait for debounce
            
            // Test category filter
            const categorySelect = page.locator('#lms-catalog-category');
            await categorySelect.selectOption('General');
            
            // Test difficulty filter
            const difficultySelect = page.locator('#lms-catalog-difficulty');
            await difficultySelect.selectOption('beginner');
            
            // Clear filters
            await page.click('#lms-btn-clear-filters');
            await expect(searchInput).toHaveValue('');
        }

        assertNoFatalPageErrors(pageErrors);
    });
});