import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    fetchLmsEnrollmentByIdFromSupabase,
    fetchLmsEnrollmentsFromSupabase,
    fetchLmsProgressFromSupabase,
    resolveLmsReadSource,
    toEnrollmentGetParityRow,
    toEnrollmentListParityRow,
    toMyCoursesParityRow,
} from '../../server/compat/supabaseLmsRead.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const lmsSource = fs.readFileSync(path.join(process.cwd(), 'server', 'modules', 'lms.js'), 'utf8');

function restoreEnv() {
    process.env = { ...originalEnv };
}

function mockFetchSequence(handlers = []) {
    let index = 0;
    globalThis.fetch = async (url, options) => {
        const handler = handlers[index++];
        if (!handler) {
            throw new Error(`Unexpected fetch call: ${url}`);
        }
        return handler(url, options);
    };
}

function jsonResponse(payload, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return payload;
        },
        async text() {
            return JSON.stringify(payload);
        },
    };
}

test.afterEach(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
});

test('resolveLmsReadSource respects auto and legacy modes', () => {
    process.env.LMS_READ_SOURCE = 'legacy';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    assert.equal(resolveLmsReadSource().source, 'legacy');

    process.env.LMS_READ_SOURCE = 'auto';
    assert.equal(resolveLmsReadSource().source, 'supabase');
});

test('resolveLmsReadSource fails fast when forced supabase is misconfigured', () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.throws(
        () => resolveLmsReadSource(),
        /LMS_READ_SOURCE is set to supabase/
    );
});

test('fetchLmsEnrollmentsFromSupabase returns decorated enrollment rows', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            assert.match(String(url), /course_enrollments/);
            assert.match(String(url), /course_id=eq.course-1/);
            return jsonResponse([
                {
                    id: 'enr-1',
                    course_id: 'course-1',
                    employee_id: 'EMP001',
                    status: 'in_progress',
                    progress_percent: 50,
                    certificate_issued: false,
                },
            ]);
        },
        (url) => {
            assert.match(String(url), /employees/);
            return jsonResponse([
                {
                    employee_id: 'EMP001',
                    name: 'Farhan Akbar',
                    department: 'Sales',
                    position: 'Sales Executive',
                },
            ]);
        },
        (url) => {
            assert.match(String(url), /courses/);
            return jsonResponse([
                {
                    id: 'course-1',
                    title: 'Sales Fundamentals',
                    description: 'Sales baseline course',
                    category: 'Sales',
                    thumbnail_url: null,
                    estimated_duration_minutes: 90,
                    difficulty_level: 'beginner',
                },
            ]);
        },
    ]);

    const result = await fetchLmsEnrollmentsFromSupabase({
        courseId: 'course-1',
        page: 1,
        limit: 20,
    });

    assert.equal(result.page, 1);
    assert.equal(result.limit, 20);
    assert.equal(result.enrollments.length, 1);
    assert.equal(result.enrollments[0].employee_name, 'Farhan Akbar');
    assert.equal(result.enrollments[0].course_title, 'Sales Fundamentals');
});

test('enrollment parity mappers preserve legacy endpoint shapes', () => {
    const supabaseDecoratedRow = {
        id: 'enr-1',
        course_id: 'course-1',
        employee_id: 'EMP001',
        status: 'in_progress',
        progress_percent: 50,
        certificate_issued: true,
        employee_name: 'Farhan Akbar',
        department: 'Sales',
        position: 'Sales Executive',
        course_title: 'Sales Fundamentals',
        title: 'Sales Fundamentals',
        description: 'Sales baseline course',
        category: 'Sales',
        thumbnail_url: null,
        estimated_duration_minutes: 90,
        difficulty_level: 'beginner',
    };

    const listRow = toEnrollmentListParityRow(supabaseDecoratedRow);
    assert.equal(listRow.employee_name, 'Farhan Akbar');
    assert.equal(listRow.course_title, 'Sales Fundamentals');
    assert.equal(listRow.certificate_issued, 1);
    assert.equal('title' in listRow, false);
    assert.equal('description' in listRow, false);

    const getRow = toEnrollmentGetParityRow(supabaseDecoratedRow);
    assert.equal(getRow.course_title, 'Sales Fundamentals');
    assert.equal(getRow.certificate_issued, 1);
    assert.equal('employee_name' in getRow, false);
    assert.equal('title' in getRow, false);

    const myCoursesRow = toMyCoursesParityRow(supabaseDecoratedRow);
    assert.equal(myCoursesRow.title, 'Sales Fundamentals');
    assert.equal(myCoursesRow.description, 'Sales baseline course');
    assert.equal(myCoursesRow.certificate_issued, 1);
    assert.equal('employee_name' in myCoursesRow, false);
    assert.equal('course_title' in myCoursesRow, false);
});

test('fetchLmsEnrollmentByIdFromSupabase returns null when enrollment is missing', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([]),
    ]);

    const enrollment = await fetchLmsEnrollmentByIdFromSupabase('missing-id');
    assert.equal(enrollment, null);
});

test('fetchLmsProgressFromSupabase returns lesson progress rows for enrollment', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            assert.match(String(url), /lesson_progress/);
            assert.match(String(url), /enrollment_id=eq.enr-1/);
            return jsonResponse([
                {
                    id: 'progress-1',
                    enrollment_id: 'enr-1',
                    lesson_id: 'lesson-1',
                    status: 'in_progress',
                    progress_percent: 60,
                },
            ]);
        },
    ]);

    const rows = await fetchLmsProgressFromSupabase({ enrollmentId: 'enr-1' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].enrollment_id, 'enr-1');
    assert.equal(rows[0].lesson_id, 'lesson-1');
});

test('fetchLmsEnrollmentsFromSupabase honors explicit orderBy for my-courses parity', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /order=last_accessed_at.desc.nullslast,created_at.desc/);
            return jsonResponse([]);
        },
    ]);

    const result = await fetchLmsEnrollmentsFromSupabase({
        employeeId: 'EMP001',
        page: 1,
        limit: 10,
        orderBy: 'last_accessed_at.desc.nullslast,created_at.desc',
    });
    assert.equal(result.enrollments.length, 0);
});

test('fetchLmsProgressFromSupabase returns empty rows safely for no-progress and invalid lesson filters', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([]),
        () => jsonResponse([]),
    ]);

    const noProgress = await fetchLmsProgressFromSupabase({ enrollmentId: 'enr-empty' });
    assert.deepEqual(noProgress, []);

    const invalidLesson = await fetchLmsProgressFromSupabase({ enrollmentId: 'enr-empty', lessonId: 'lesson-missing' });
    assert.deepEqual(invalidLesson, []);
});

test('fetchLmsEnrollmentsFromSupabase surfaces upstream auth and service failures', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse({ error: 'Unauthorized' }, 401),
    ]);

    await assert.rejects(
        () => fetchLmsEnrollmentsFromSupabase({ courseId: 'course-1' }),
        /failed \(401\)/
    );
});

test('LMS read handlers keep legacy role and access gates for employee vs admin', () => {
    assert.match(
        lmsSource,
        /if \(!isAdmin\(currentUser\) && !course_id\)[\s\S]*course_id is required for non-admin users/
    );
    assert.match(
        lmsSource,
        /if \(!isAdmin\(currentUser\) && enrollment\.employee_id !== currentUser\.employee_id\)[\s\S]*Not authorized/
    );
});

test('LMS read handlers preserve not-found before forbidden distinction for enrollment reads', () => {
    const getEnrollmentStart = lmsSource.indexOf('async function getEnrollment');
    const getEnrollmentBody = lmsSource.slice(getEnrollmentStart, lmsSource.indexOf('async function enrollInCourse', getEnrollmentStart));

    const notFoundIndex = getEnrollmentBody.indexOf("Enrollment not found");
    const forbiddenIndex = getEnrollmentBody.indexOf('Not authorized');
    assert.ok(notFoundIndex >= 0, 'getEnrollment missing not-found branch');
    assert.ok(forbiddenIndex >= 0, 'getEnrollment missing forbidden branch');
    assert.ok(notFoundIndex < forbiddenIndex, 'getEnrollment should evaluate not-found before forbidden');
});
