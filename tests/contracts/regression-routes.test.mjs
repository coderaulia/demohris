import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(process.cwd());
const appSource = fs.readFileSync(path.join(projectRoot, 'server', 'app.js'), 'utf8');
const lmsSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'lms.js'), 'utf8');
const tnaSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'tna.js'), 'utf8');

test('LMS, TNA, KPI and Employees dispatch wiring remains intact', () => {
    assert.ok(appSource.includes("if (action.startsWith('lms/'))"), 'LMS dispatch missing from /api router');
    assert.ok(appSource.includes("if (action.startsWith('tna/'))"), 'TNA dispatch missing from /api router');
    assert.ok(appSource.includes("if (action.startsWith('kpi/'))"), 'KPI dispatch missing from /api router');
    assert.ok(appSource.includes("if (action.startsWith('employees/'))"), 'Employees dispatch missing from /api router');

    assert.ok(lmsSource.includes("case 'lms/enrollments/list'"), 'LMS enrollment list action missing');
    assert.ok(lmsSource.includes("case 'lms/progress/get'"), 'LMS progress get action missing');

    assert.ok(tnaSource.includes("if (action === 'tna/calculate-gaps')"), 'TNA calculate-gaps action missing');
    assert.ok(tnaSource.includes("if (action === 'tna/lms-report')"), 'TNA LMS report action missing');
});

