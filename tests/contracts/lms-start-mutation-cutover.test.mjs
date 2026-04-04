import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    resolveLmsMutationSource,
    startCourseEnrollmentInSupabase,
} from '../../server/compat/supabaseLmsMutation.js';

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

test('resolveLmsMutationSource respects configured mode and auto detection', () => {
    process.env.LMS_MUTATION_SOURCE = 'legacy';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    assert.equal(resolveLmsMutationSource().source, 'legacy');

    process.env.LMS_MUTATION_SOURCE = 'auto';
    assert.equal(resolveLmsMutationSource().source, 'supabase');
});

test('resolveLmsMutationSource fails fast when forced supabase is not configured', () => {
    process.env.LMS_MUTATION_SOURCE = 'supabase';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    assert.throws(
        () => resolveLmsMutationSource(),
        /LMS_MUTATION_SOURCE is set to supabase/
    );
});

test('startCourseEnrollmentInSupabase preserves legacy not-enrolled and completed guards', async () => {
    process.env.LMS_MUTATION_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([]),
    ]);
    const notEnrolled = await startCourseEnrollmentInSupabase({
        courseId: 'course-1',
        employeeId: 'EMP001',
        idFactory: () => 'progress-1',
    });
    assert.equal(notEnrolled.error?.status, 404);
    assert.equal(notEnrolled.error?.message, 'Not enrolled in this course');

    mockFetchSequence([
        () => jsonResponse([{ id: 'enr-1', status: 'completed', started_at: null }]),
    ]);
    const completed = await startCourseEnrollmentInSupabase({
        courseId: 'course-1',
        employeeId: 'EMP001',
        idFactory: () => 'progress-1',
    });
    assert.equal(completed.error?.status, 400);
    assert.equal(completed.error?.message, 'Course already completed');
});

test('startCourseEnrollmentInSupabase updates status and initializes first lesson progress when missing', async () => {
    process.env.LMS_MUTATION_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /course_enrollments/);
            assert.match(decoded, /course_id=eq.course-1/);
            assert.match(decoded, /employee_id=eq.EMP001/);
            return jsonResponse([{ id: 'enr-1', status: 'enrolled', started_at: null }]);
        },
        (url, options) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /course_enrollments\?id=eq.enr-1/);
            assert.equal(options?.method, 'PATCH');
            const body = JSON.parse(String(options?.body || '{}'));
            assert.equal(body.status, 'in_progress');
            assert.ok(body.started_at, 'started_at should be set on first start');
            assert.ok(body.last_accessed_at, 'last_accessed_at should be updated');
            return jsonResponse([]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /course_sections/);
            assert.match(decoded, /course_id=eq.course-1/);
            return jsonResponse([{ id: 'sec-1', ordinal: 1 }]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /lessons/);
            assert.match(decoded, /section_id=eq.sec-1/);
            return jsonResponse([{ id: 'lesson-1', ordinal: 1 }]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /lesson_progress/);
            assert.match(decoded, /enrollment_id=eq.enr-1/);
            assert.match(decoded, /lesson_id=eq.lesson-1/);
            return jsonResponse([]);
        },
        (_url, options) => {
            assert.equal(options?.method, 'POST');
            const body = JSON.parse(String(options?.body || '{}'));
            assert.equal(body.id, 'progress-seeded-id');
            assert.equal(body.enrollment_id, 'enr-1');
            assert.equal(body.lesson_id, 'lesson-1');
            assert.equal(body.status, 'not_started');
            return jsonResponse([]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /course_enrollments/);
            assert.match(decoded, /id=eq.enr-1/);
            return jsonResponse([{ id: 'enr-1', status: 'in_progress' }]);
        },
    ]);

    const result = await startCourseEnrollmentInSupabase({
        courseId: 'course-1',
        employeeId: 'EMP001',
        idFactory: () => 'progress-seeded-id',
    });

    assert.equal(result.error, undefined);
    assert.equal(result.enrollment?.id, 'enr-1');
    assert.equal(result.enrollment?.status, 'in_progress');
});

test('startCourse mutation route is source-selectable and keeps legacy fallback', () => {
    assert.match(lmsSource, /const mutationSource = resolveLmsMutationSource\(\)/);
    assert.match(lmsSource, /startCourseEnrollmentInSupabase\(/);
    assert.match(
        lmsSource,
        /async function startCourse[\s\S]*UPDATE course_enrollments SET status = 'in_progress'[\s\S]*INSERT INTO lesson_progress/
    );
});
