import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(process.cwd());
const fixturesDir = path.join(projectRoot, 'tests', 'contracts', 'fixtures');
const lmsSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'lms.js'), 'utf8');
const frontendLmsSource = fs.readFileSync(path.join(projectRoot, 'src', 'modules', 'lms.js'), 'utf8');

function readFixture(fileName) {
    const fullPath = path.join(fixturesDir, fileName);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

test('Sprint 4 admin fixture exists and declares required LMS admin actions', () => {
    const fileName = 'lms.sprint4-admin.group.json';
    const files = fs.readdirSync(fixturesDir);
    assert.ok(files.includes(fileName), `${fileName} fixture is required`);

    const fixture = readFixture(fileName);
    assert.ok(Array.isArray(fixture.actions), 'fixture.actions must be an array');
    assert.ok(fixture.actions.length >= 5, 'fixture should include Sprint 4 LMS admin actions');

    for (const actionEntry of fixture.actions) {
        assert.ok(actionEntry.action, 'action string is required');
        assert.ok(Array.isArray(actionEntry.responseRequiredKeys), 'responseRequiredKeys is required');
        assert.ok(actionEntry.responseRequiredKeys.length > 0, 'responseRequiredKeys cannot be empty');
    }
});

test('Sprint 4 LMS admin routes are wired in backend module', () => {
    const fixture = readFixture('lms.sprint4-admin.group.json');
    for (const actionEntry of fixture.actions) {
        assert.ok(
            lmsSource.includes(`case '${actionEntry.action}'`),
            `Missing LMS action dispatch for ${actionEntry.action}`
        );
    }
});

test('Legacy LMS frontend exposes Sprint 4 admin handlers', () => {
    const expectedSymbols = [
        'loadAdminReports',
        'showBulkAssignmentDialog',
        'downloadCertificatePdf',
        'window.__app.reissueCertificate',
        'window.__app.downloadCertificate',
    ];
    for (const symbol of expectedSymbols) {
        assert.ok(frontendLmsSource.includes(symbol), `Expected legacy LMS handler missing: ${symbol}`);
    }
});
