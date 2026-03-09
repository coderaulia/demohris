import { test, expect } from '@playwright/test';

const managerEmail = process.env.E2E_MANAGER_EMAIL || '';
const managerPassword = process.env.E2E_MANAGER_PASSWORD || '';

function currentPeriod() {
    const dt = new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function assertNoFatalPageErrors(errors) {
    const ignored = [/ResizeObserver loop limit exceeded/i];
    const fatal = errors.filter(message => !ignored.some(pattern => pattern.test(message)));
    expect.soft(fatal, `Unexpected page errors:\n${fatal.join('\n')}`).toEqual([]);
}

async function loginAsManager(page) {
    await page.goto('/');
    await page.fill('#login-user', managerEmail);
    await page.fill('#login-pass', managerPassword);
    await page.click('#login-btn');
    await expect(page.locator('#main-app')).toBeVisible({ timeout: 30000 });
}

async function clickAndExpectExportFeedback(page, buttonSelector) {
    const downloadPromise = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    await page.click(buttonSelector);

    const download = await downloadPromise;
    if (download) {
        return { type: 'download', suggestedFilename: download.suggestedFilename() };
    }

    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 10000 });
    const text = (await page.locator('.swal2-popup').innerText()).toLowerCase();
    return { type: 'dialog', text };
}

test.describe('Sprint 6 E2E Regression: KPI + Probation + Export', () => {
    test.skip(!managerEmail || !managerPassword, 'Requires E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD.');

    test('manager KPI settings flow uses dropdown unit and saves without schema/duplicate errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAsManager(page);

        await page.click('#nav-settings');
        await page.click('#settingsPills .nav-link[data-target="set-kpi"]');

        const unitSelect = page.locator('#kpi-def-unit');
        await expect(unitSelect).toBeVisible();
        const optionCount = await unitSelect.locator('option').count();
        expect(optionCount).toBeGreaterThan(3);

        const categoryOptions = page.locator('#kpi-def-category option');
        const categories = await categoryOptions.evaluateAll(options => options.map(opt => opt.value).filter(Boolean));

        const kpiName = `QA Sprint6 KPI ${Date.now()}`;
        await page.fill('#kpi-def-name', kpiName);
        await page.fill('#kpi-def-desc', 'Sprint 6 E2E regression KPI definition save');
        if (categories.length > 0) {
            await page.selectOption('#kpi-def-category', categories[0]);
        }
        await page.fill('#kpi-def-effective-period', currentPeriod());
        await page.selectOption('#kpi-def-unit', 'Count');
        await page.fill('#kpi-def-target', '1');
        await page.fill('#kpi-def-request-note', 'Sprint 6 automated save check');

        await page.click('[onclick="window.__app.saveKpiDef()"]');
        await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15000 });

        const popupText = ((await page.locator('.swal2-popup').innerText()) || '').toLowerCase();
        expect(popupText).not.toContain('duplicate key value');
        expect(popupText).not.toContain('schema');
        expect(popupText).not.toContain('error saving kpi');

        const confirmBtn = page.locator('.swal2-confirm');
        if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
        }

        assertNoFatalPageErrors(pageErrors);
    });

    test('kpi input + probation export flow regression', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

        await loginAsManager(page);

        await page.click('#nav-assessment');
        await expect(page.locator('#tab-assessment')).toBeVisible();

        const employeeSelect = page.locator('#inp-pending-select');
        await expect(employeeSelect).toBeVisible();
        const employeeOptionCount = await employeeSelect.locator('option').count();
        expect(employeeOptionCount).toBeGreaterThan(1);

        await employeeSelect.selectOption({ index: 1 });
        await page.click('[onclick="window.__app.startKpiInput()"]');
        await expect(page.locator('#step-kpi-input')).toBeVisible();

        const metricSelect = page.locator('#kpi-metric-select');
        const metricCount = await metricSelect.locator('option').count();
        expect(metricCount).toBeGreaterThan(1);
        if (metricCount > 1) {
            await metricSelect.selectOption({ index: 1 });
        }

        await page.fill('#kpi-period', currentPeriod());
        await page.fill('#kpi-value', '1');
        await page.fill('#kpi-notes', 'Sprint 6 E2E KPI record smoke');

        await page.click('[onclick="window.__app.submitKpiRecord()"]');
        await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15000 });

        const savePopupText = ((await page.locator('.swal2-popup').innerText()) || '').toLowerCase();
        expect(savePopupText).not.toContain('error saving kpi record');

        const confirmBtn = page.locator('.swal2-confirm');
        if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
        }

        await page.click('#nav-records');
        await page.click('#recordsPills .nav-link[data-target="records-kpi"]');
        await expect(page.locator('#kpi-history-body')).toBeVisible();

        await page.click('#recordsPills .nav-link[data-target="records-probation"]');
        await expect(page.locator('#records-probation')).toBeVisible();

        const pdfResult = await clickAndExpectExportFeedback(page, '[onclick="window.__app.exportProbationPdf()"]');
        if (pdfResult.type === 'dialog') {
            expect(pdfResult.text).not.toContain('uncaught');
        }

        if (page.locator('.swal2-confirm')) {
            const confirmAfterPdf = page.locator('.swal2-confirm');
            if (await confirmAfterPdf.isVisible()) {
                await confirmAfterPdf.click();
            }
        }

        const excelResult = await clickAndExpectExportFeedback(page, '[onclick="window.__app.exportProbationCsv()"]');
        if (excelResult.type === 'dialog') {
            expect(excelResult.text).not.toContain('uncaught');
        }

        if (page.locator('.swal2-confirm')) {
            const confirmAfterExcel = page.locator('.swal2-confirm');
            if (await confirmAfterExcel.isVisible()) {
                await confirmAfterExcel.click();
            }
        }

        await page.click('#nav-dashboard');
        await expect(page.locator('#d-kpi-records-sub')).toBeVisible();

        assertNoFatalPageErrors(pageErrors);
    });
});
