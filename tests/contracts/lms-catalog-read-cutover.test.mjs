import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    fetchLmsCourseByIdFromSupabase,
    fetchLmsCoursesFromSupabase,
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

test('fetchLmsCoursesFromSupabase returns course rows with legacy aggregate fields', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/courses/);
            assert.match(decoded, /status=eq.published/);
            return jsonResponse([
                {
                    id: 'course-1',
                    title: 'Sales Fundamentals',
                    description: 'Pipeline and negotiation basics',
                    category: 'Sales',
                    status: 'published',
                    tags: ['sales'],
                    prerequisites: [],
                    competencies_covered: [],
                },
                {
                    id: 'course-2',
                    title: 'Leadership Essentials',
                    description: 'Coaching and team management',
                    category: 'Leadership',
                    status: 'published',
                    tags: ['leadership'],
                    prerequisites: [],
                    competencies_covered: [],
                },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/course_enrollments/);
            return jsonResponse([
                { id: 'enr-1', course_id: 'course-1' },
                { id: 'enr-2', course_id: 'course-1' },
                { id: 'enr-3', course_id: 'course-2' },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/course_reviews/);
            return jsonResponse([
                { id: 'rev-1', course_id: 'course-1', rating: 4 },
                { id: 'rev-2', course_id: 'course-1', rating: 5 },
                { id: 'rev-3', course_id: 'course-2', rating: 3 },
            ]);
        },
    ]);

    const result = await fetchLmsCoursesFromSupabase({
        status: 'published',
        search: 'sales',
        page: 1,
        limit: 20,
    });

    assert.equal(result.total, 1);
    assert.equal(result.courses.length, 1);
    assert.equal(result.courses[0].id, 'course-1');
    assert.equal(result.courses[0].enrollment_count, 2);
    assert.equal(result.courses[0].review_count, 2);
    assert.equal(Number(result.courses[0].avg_rating), 4.5);
});

test('fetchLmsCourseByIdFromSupabase returns course detail with sections, lessons, and my enrollment', async () => {
    process.env.LMS_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/courses/);
            assert.match(decoded, /id=eq.course-1/);
            return jsonResponse([
                {
                    id: 'course-1',
                    title: 'Sales Fundamentals',
                    description: 'Pipeline and negotiation basics',
                    category: 'Sales',
                    status: 'published',
                },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/course_sections/);
            return jsonResponse([
                { id: 'sec-1', course_id: 'course-1', title: 'Intro', ordinal: 1 },
                { id: 'sec-2', course_id: 'course-1', title: 'Negotiation', ordinal: 2 },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/lessons/);
            return jsonResponse([
                {
                    id: 'lesson-1',
                    section_id: 'sec-1',
                    course_id: 'course-1',
                    title: 'What is Sales?',
                    description: 'Foundational concepts',
                    content_type: 'text',
                    estimated_duration_minutes: 15,
                    ordinal: 1,
                    is_preview: false,
                },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/course_enrollments/);
            assert.match(decoded, /employee_id=eq.EMP001/);
            return jsonResponse([
                { id: 'enr-1', course_id: 'course-1', employee_id: 'EMP001', status: 'in_progress' },
            ]);
        },
    ]);

    const course = await fetchLmsCourseByIdFromSupabase({
        courseId: 'course-1',
        employeeId: 'EMP001',
    });

    assert.equal(course?.id, 'course-1');
    assert.equal(Array.isArray(course?.sections), true);
    assert.equal(course.sections.length, 2);
    assert.equal(Array.isArray(course.sections[0].lessons), true);
    assert.equal(course.sections[0].lessons[0]?.id, 'lesson-1');
    assert.equal(course.my_enrollment?.id, 'enr-1');
});

test('LMS catalog routes are source-selectable on read path', () => {
    assert.match(
        lmsSource,
        /async function listCourses[\s\S]*resolveLmsReadSource\(\)[\s\S]*fetchLmsCoursesFromSupabase\(/,
    );
    assert.match(
        lmsSource,
        /async function getCourse[\s\S]*resolveLmsReadSource\(\)[\s\S]*fetchLmsCourseByIdFromSupabase\(/,
    );
});
