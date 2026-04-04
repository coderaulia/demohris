import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(process.cwd());

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function readFile(relPath) {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
}

function main() {
    const fixtureRaw = readFile('tests/contracts/fixtures/lms.sprint4-admin.group.json');
    const fixture = JSON.parse(fixtureRaw);
    const backend = readFile('server/modules/lms.js');
    const frontend = readFile('src/modules/lms.js');
    const html = readFile('src/components/tab-lms.html');

    assert(Array.isArray(fixture.actions) && fixture.actions.length > 0, 'Fixture must include actions');
    for (const actionEntry of fixture.actions) {
        assert(
            backend.includes(`case '${actionEntry.action}'`),
            `Missing backend action dispatch: ${actionEntry.action}`
        );
    }

    const expectedFrontendMarkers = [
        'showBulkAssignmentDialog',
        'generateCertificateForEnrollment',
        'downloadCertificatePdf',
        'exportAdminReportCsv',
    ];
    for (const marker of expectedFrontendMarkers) {
        assert(frontend.includes(marker), `Missing frontend marker: ${marker}`);
    }

    const expectedHtmlIds = [
        'lms-report-filter-department',
        'lms-report-filter-period',
        'lms-report-course-performance-body',
        'lms-report-dept-completion-body',
        'lms-report-score-distribution-body',
        'lms-report-time-course-body',
    ];
    for (const id of expectedHtmlIds) {
        assert(html.includes(`id="${id}"`), `Missing LMS admin report element: ${id}`);
    }

    console.log('LMS Sprint 4 admin smoke: PASS');
}

main();
