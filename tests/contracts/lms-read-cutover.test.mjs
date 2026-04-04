import assert from 'node:assert/strict';
import test from 'node:test';

import {
    fetchLmsEnrollmentByIdFromSupabase,
    fetchLmsEnrollmentsFromSupabase,
    fetchLmsProgressFromSupabase,
    resolveLmsReadSource,
} from '../../server/compat/supabaseLmsRead.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

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
