import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(process.cwd());
const fixturesDir = path.join(projectRoot, 'tests', 'contracts', 'fixtures');
const appSource = fs.readFileSync(path.join(projectRoot, 'server', 'app.js'), 'utf8');
const lmsSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'lms.js'), 'utf8');
const tnaSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'tna.js'), 'utf8');

function readFixture(fileName) {
    const fullPath = path.join(fixturesDir, fileName);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

test('contract freeze fixtures exist for mandatory endpoints', () => {
    const expected = [
        'auth.login.json',
        'auth.session.json',
        'lms.enrollments.group.json',
        'lms.progress.group.json',
        'tna.calculate-gaps.json',
        'modules.group.json',
    ];

    const files = fs.readdirSync(fixturesDir);
    for (const file of expected) {
        assert.ok(files.includes(file), `Missing fixture: ${file}`);
    }
});

test('fixture files are valid and contain request + response contracts', () => {
    const files = fs.readdirSync(fixturesDir).filter(name => name.endsWith('.json'));
    for (const fileName of files) {
        const fixture = readFixture(fileName);
        assert.ok(fixture.id, `${fileName}: id is required`);
        assert.ok(fixture.route, `${fileName}: route is required`);
        assert.ok(fixture.method, `${fileName}: method is required`);

        if (fixture.actions) {
            assert.ok(Array.isArray(fixture.actions), `${fileName}: actions must be an array`);
            assert.ok(fixture.actions.length > 0, `${fileName}: actions cannot be empty`);
            for (const actionEntry of fixture.actions) {
                assert.ok(actionEntry.action, `${fileName}: action string is required`);
                assert.ok(Array.isArray(actionEntry.responseRequiredKeys), `${fileName}: responseRequiredKeys array required`);
                assert.ok(actionEntry.responseRequiredKeys.length > 0, `${fileName}: responseRequiredKeys cannot be empty`);
            }
        } else {
            assert.ok(fixture.request, `${fileName}: request contract is required`);
            assert.ok(fixture.response, `${fileName}: response contract is required`);
        }
    }
});

test('golden contract actions are still routed in backend sources', () => {
    const authLogin = readFixture('auth.login.json');
    const authSession = readFixture('auth.session.json');
    const lmsEnrollments = readFixture('lms.enrollments.group.json');
    const lmsProgress = readFixture('lms.progress.group.json');
    const tnaCalcGaps = readFixture('tna.calculate-gaps.json');
    const modulesGroup = readFixture('modules.group.json');

    assert.ok(appSource.includes(`'${authLogin.id}'`), 'auth/login route is missing in server/app.js');
    assert.ok(appSource.includes(`'${authSession.id}'`), 'auth/session route is missing in server/app.js');

    for (const actionEntry of lmsEnrollments.actions) {
        assert.ok(lmsSource.includes(`'${actionEntry.action}'`), `Missing LMS enrollment action: ${actionEntry.action}`);
    }

    for (const actionEntry of lmsProgress.actions) {
        assert.ok(lmsSource.includes(`'${actionEntry.action}'`), `Missing LMS progress action: ${actionEntry.action}`);
    }

    assert.ok(tnaSource.includes(`'${tnaCalcGaps.id}'`), 'Missing TNA action tna/calculate-gaps');

    for (const actionEntry of modulesGroup.actions) {
        assert.ok(
            appSource.includes(`case '${actionEntry.action}'`),
            `Missing modules action: ${actionEntry.action}`
        );
    }
});

