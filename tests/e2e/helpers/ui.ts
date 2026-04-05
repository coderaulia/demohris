import { expect, type Locator, type Page } from '@playwright/test';

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function startConsoleCapture(page: Page): string[] {
    const issues: string[] = [];

    page.on('console', message => {
        if (message.type() === 'error') {
            issues.push(`console: ${message.text()}`);
        }
    });

    page.on('pageerror', error => {
        issues.push(`pageerror: ${String(error?.message || error)}`);
    });

    return issues;
}

export function expectNoConsoleErrors(issues: string[]): void {
    const ignored = [
        /ResizeObserver loop limit exceeded/i,
    ];

    const fatal = issues.filter(issue => !ignored.some(pattern => pattern.test(issue)));
    expect.soft(fatal, `Unexpected console or page errors:\n${fatal.join('\n')}`).toEqual([]);
}

export function fieldContainer(page: Page, label: string): Locator {
    return page.locator('label', {
        hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i'),
    }).locator('xpath=..');
}

export function selectForLabel(page: Page, label: string): Locator {
    return fieldContainer(page, label).locator('select');
}

export function inputForLabel(page: Page, label: string): Locator {
    return fieldContainer(page, label).locator('input');
}

export async function waitForDataToSettle(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(750);
}
