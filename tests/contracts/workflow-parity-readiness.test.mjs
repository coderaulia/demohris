import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const lmsSource = fs.readFileSync(path.join(root, 'server', 'modules', 'lms.js'), 'utf8');
const tnaSource = fs.readFileSync(path.join(root, 'server', 'modules', 'tna.js'), 'utf8');

function readFixture(name) {
    return JSON.parse(
        fs.readFileSync(path.join(root, 'tests', 'contracts', 'fixtures', name), 'utf8')
    );
}

test('mutation workflow fixtures are present and ordered for cutover planning', () => {
    const lmsWorkflow = readFixture('lms.workflow-core-mutation.json');
    const tnaWorkflow = readFixture('tna.workflow-basic-mutation.json');

    assert.equal(lmsWorkflow.id, 'workflow:lms-core-mutation');
    assert.equal(Array.isArray(lmsWorkflow.sequence), true);
    assert.equal(lmsWorkflow.sequence.length >= 4, true);
    assert.equal(lmsWorkflow.firstMutationSliceCandidate, 'lms/enrollments/start');

    assert.equal(tnaWorkflow.id, 'workflow:tna-basic-mutation');
    assert.equal(Array.isArray(tnaWorkflow.sequence), true);
    assert.equal(tnaWorkflow.sequence.length >= 2, true);
    assert.equal(tnaWorkflow.firstMutationSliceCandidate, 'tna/needs/update-status');
});

test('LMS mutation workflow parity intent exists in current implementation', () => {
    assert.match(lmsSource, /case 'lms\/enrollments\/enroll'/);
    assert.match(lmsSource, /case 'lms\/enrollments\/start'/);
    assert.match(lmsSource, /case 'lms\/progress\/complete-lesson'/);
    assert.match(lmsSource, /case 'lms\/quizzes\/submit'/);

    assert.match(
        lmsSource,
        /async function enrollInCourse[\s\S]*INSERT INTO course_enrollments[\s\S]*status\)\s*VALUES \(\?, \?, \?, \?, \?, 'enrolled'\)/
    );
    assert.match(
        lmsSource,
        /async function startCourse[\s\S]*UPDATE course_enrollments SET status = 'in_progress'[\s\S]*INSERT INTO lesson_progress/
    );
    assert.match(
        lmsSource,
        /async function updateLessonProgress[\s\S]*ON DUPLICATE KEY UPDATE[\s\S]*updateEnrollmentProgress\(enrollment_id\)/
    );
    assert.match(
        lmsSource,
        /async function completeLesson[\s\S]*status = 'completed'[\s\S]*updateEnrollmentProgress\(enrollment_id\)/
    );
    assert.match(
        lmsSource,
        /async function submitQuiz[\s\S]*INSERT INTO quiz_attempts[\s\S]*if \(passed\)[\s\S]*INSERT INTO lesson_progress[\s\S]*updateEnrollmentProgress\(enrollment_id\)/
    );
    assert.match(
        lmsSource,
        /async function startCourse[\s\S]*resolveLmsMutationSource\(\)[\s\S]*startCourseEnrollmentInSupabase\(/,
    );
});

test('TNA mutation workflow parity intent exists in current implementation', () => {
    assert.match(tnaSource, /if \(action === 'tna\/needs\/create'\)/);
    assert.match(tnaSource, /if \(action === 'tna\/needs\/update-status'\)/);
    assert.match(tnaSource, /if \(action === 'tna\/summary'\)/);

    assert.match(
        tnaSource,
        /if \(action === 'tna\/needs\/create'\)[\s\S]*requireRole\(req, \['superadmin', 'manager', 'hr'\]\)[\s\S]*INSERT INTO training_need_records[\s\S]*ON DUPLICATE KEY UPDATE/
    );
    assert.match(
        tnaSource,
        /if \(action === 'tna\/needs\/update-status'\)[\s\S]*UPDATE training_need_records SET status = \?, completed_at = \? WHERE id = \?/
    );
    assert.match(
        tnaSource,
        /if \(action === 'tna\/summary'\)[\s\S]*total_needs_identified[\s\S]*high_gaps/
    );
});

test('workflow parity sequence keeps follow-up read verification requirements explicit', () => {
    const lmsWorkflow = readFixture('lms.workflow-core-mutation.json');
    const tnaWorkflow = readFixture('tna.workflow-basic-mutation.json');

    for (const step of lmsWorkflow.sequence) {
        assert.ok(Array.isArray(step.response?.requiredTopLevelKeys), `${step.action} must define required response keys`);
        assert.ok(step.response.requiredTopLevelKeys.length > 0, `${step.action} required response keys cannot be empty`);
        assert.ok(Array.isArray(step.followUpReads), `${step.action} must define follow-up reads`);
        assert.ok(step.followUpReads.length > 0, `${step.action} follow-up reads cannot be empty`);
    }
    for (const step of tnaWorkflow.sequence) {
        assert.ok(Array.isArray(step.response?.requiredTopLevelKeys), `${step.action} must define required response keys`);
        assert.ok(step.response.requiredTopLevelKeys.length > 0, `${step.action} required response keys cannot be empty`);
        assert.ok(Array.isArray(step.followUpReads), `${step.action} must define follow-up reads`);
        assert.ok(step.followUpReads.length > 0, `${step.action} follow-up reads cannot be empty`);
    }
});
