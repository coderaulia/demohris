import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv(filePath = path.join(process.cwd(), '.env')) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = String(rawLine || '').trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!key) continue;
        if (!process.env[key]) process.env[key] = value;
    }
}

loadDotEnv();

function env(name, fallback = '') {
    const value = process.env[name];
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    return String(value).trim();
}

function required(name) {
    const value = env(name);
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function parseJsonSafe(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

async function signInSupabase({ supabaseUrl, anonKey, email, password }) {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        throw new Error(`Supabase sign-in failed (${response.status}): ${JSON.stringify(payload)}`);
    }
    return payload;
}

async function signInIfProvided({ supabaseUrl, anonKey, email, password }) {
    if (!email || !password) return null;
    return signInSupabase({ supabaseUrl, anonKey, email, password });
}

async function callLmsEndpoint({ baseUrl, action, jwt, body = {} }) {
    const response = await fetch(`${baseUrl}/api?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const payload = await parseJsonSafe(response);
    return { status: response.status, payload };
}

function assertCourseListShape(payload) {
    assert(payload?.success === true, 'courses/list missing success=true');
    assert(Array.isArray(payload?.courses), 'courses/list missing courses[]');
    assert(Number.isFinite(Number(payload?.total)), 'courses/list missing numeric total');
    assert(Number.isFinite(Number(payload?.page)), 'courses/list missing numeric page');
    assert(Number.isFinite(Number(payload?.limit)), 'courses/list missing numeric limit');
}

function assertCourseDetailShape(payload) {
    assert(payload?.success === true, 'courses/get missing success=true');
    assert(payload?.course && typeof payload.course === 'object', 'courses/get missing course object');
    assert(Array.isArray(payload.course.sections), 'courses/get missing course.sections[]');
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');
    const testEmail = required('SUPABASE_LMS_TEST_EMAIL');
    const testPassword = required('SUPABASE_LMS_TEST_PASSWORD');
    const defaultEnrollmentId = env('SUPABASE_LMS_TEST_ENROLLMENT_ID', 'a5000000-0000-4000-8000-000000000001');
    const adminEmail = env('SUPABASE_LMS_ADMIN_TEST_EMAIL');
    const adminPassword = env('SUPABASE_LMS_ADMIN_TEST_PASSWORD');
    const otherEmail = env('SUPABASE_LMS_OTHER_TEST_EMAIL');
    const otherPassword = env('SUPABASE_LMS_OTHER_TEST_PASSWORD');
    const emptyEmail = env('SUPABASE_LMS_EMPTY_TEST_EMAIL');
    const emptyPassword = env('SUPABASE_LMS_EMPTY_TEST_PASSWORD');

    console.log('== LMS read cutover smoke ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);

    const session = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: testEmail,
        password: testPassword,
    });
    const jwt = String(session.access_token || '').trim();
    assert(jwt, 'Supabase access_token is missing');

    const myCoursesResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/my-courses',
        jwt,
        body: { page: 1, limit: 10 },
    });
    assert(myCoursesResp.status === 200, `my-courses should return 200, got ${myCoursesResp.status}`);
    assert(myCoursesResp.payload?.success === true, 'my-courses missing success=true');
    assert(Array.isArray(myCoursesResp.payload?.enrollments), 'my-courses missing enrollments[]');

    const employeeListWithoutCourseResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/list',
        jwt,
        body: { page: 1, limit: 10 },
    });
    assert(
        employeeListWithoutCourseResp.status === 400,
        `employee enrollments/list without course_id should return 400, got ${employeeListWithoutCourseResp.status}`
    );

    const enrollmentId = myCoursesResp.payload?.enrollments?.[0]?.id || defaultEnrollmentId;
    assert(enrollmentId, 'No enrollment ID available for downstream checks');

    const getResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/get',
        jwt,
        body: { enrollment_id: enrollmentId },
    });
    assert(getResp.status === 200, `enrollments/get should return 200, got ${getResp.status}`);
    assert(getResp.payload?.success === true, 'enrollments/get missing success=true');
    assert(getResp.payload?.enrollment, 'enrollments/get missing enrollment payload');

    const notFoundEnrollmentResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/get',
        jwt,
        body: { enrollment_id: '00000000-0000-4000-8000-000000000000' },
    });
    assert(
        notFoundEnrollmentResp.status === 404,
        `enrollments/get missing id should return 404, got ${notFoundEnrollmentResp.status}`
    );

    const courseId = String(getResp.payload?.enrollment?.course_id || '').trim();
    if (courseId) {
        const listResp = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/enrollments/list',
            jwt,
            body: { course_id: courseId, page: 1, limit: 10 },
        });
        assert(listResp.status === 200, `enrollments/list should return 200, got ${listResp.status}`);
        assert(listResp.payload?.success === true, 'enrollments/list missing success=true');
        assert(Array.isArray(listResp.payload?.enrollments), 'enrollments/list missing enrollments[]');
    }

    const progressResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: { enrollment_id: enrollmentId },
    });
    assert(progressResp.status === 200, `progress/get should return 200, got ${progressResp.status}`);
    assert(progressResp.payload?.success === true, 'progress/get missing success=true');
    assert(progressResp.payload?.progress, 'progress/get missing progress payload');

    const coursesListResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/courses/list',
        jwt,
        body: { status: 'published', page: 1, limit: 10 },
    });
    assert(coursesListResp.status === 200, `courses/list should return 200, got ${coursesListResp.status}`);
    assertCourseListShape(coursesListResp.payload);

    const courseIdFromEnrollment = String(getResp.payload?.enrollment?.course_id || '').trim();
    const fallbackCourseId = String(coursesListResp.payload?.courses?.[0]?.id || '').trim();
    const courseIdForDetail = courseIdFromEnrollment || fallbackCourseId;
    assert(courseIdForDetail, 'No course ID available for courses/get parity check');

    const courseGetResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/courses/get',
        jwt,
        body: { course_id: courseIdForDetail },
    });
    assert(courseGetResp.status === 200, `courses/get should return 200, got ${courseGetResp.status}`);
    assertCourseDetailShape(courseGetResp.payload);

    const missingCourseResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/courses/get',
        jwt,
        body: { course_id: '00000000-0000-4000-8000-000000000000' },
    });
    assert(
        missingCourseResp.status === 404,
        `courses/get missing id should return 404, got ${missingCourseResp.status}`
    );

    const invalidLessonProgressResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: {
            enrollment_id: enrollmentId,
            lesson_id: '00000000-0000-4000-8000-000000000000',
        },
    });
    assert(
        invalidLessonProgressResp.status === 200,
        `progress/get invalid lesson should return 200 with empty lesson payload, got ${invalidLessonProgressResp.status}`
    );
    assert(
        Array.isArray(invalidLessonProgressResp.payload?.progress?.lessons),
        'progress/get invalid lesson should still return progress.lessons[]'
    );

    const noAuthResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/my-courses',
        jwt: '',
        body: { page: 1, limit: 10 },
    });
    assert(noAuthResp.status === 401, `unauthorized LMS read should return 401, got ${noAuthResp.status}`);

    const otherSession = await signInIfProvided({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: otherEmail,
        password: otherPassword,
    });
    if (otherSession?.access_token && enrollmentId) {
        const forbiddenResp = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/enrollments/get',
            jwt: String(otherSession.access_token),
            body: { enrollment_id: enrollmentId },
        });
        assert(
            forbiddenResp.status === 403,
            `other employee should receive 403 for foreign enrollment, got ${forbiddenResp.status}`
        );
    }

    const adminSession = await signInIfProvided({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: adminEmail,
        password: adminPassword,
    });
    if (adminSession?.access_token && courseId) {
        const adminListResp = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/enrollments/list',
            jwt: String(adminSession.access_token),
            body: { course_id: courseId, page: 1, limit: 10 },
        });
        assert(
            adminListResp.status === 200,
            `admin enrollments/list should return 200, got ${adminListResp.status}`
        );
        assert(Array.isArray(adminListResp.payload?.enrollments), 'admin enrollments/list missing enrollments[]');
    }

    const emptySession = await signInIfProvided({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: emptyEmail,
        password: emptyPassword,
    });
    if (emptySession?.access_token) {
        const emptyResp = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/enrollments/my-courses',
            jwt: String(emptySession.access_token),
            body: { page: 1, limit: 10 },
        });
        assert(emptyResp.status === 200, `empty-user my-courses should return 200, got ${emptyResp.status}`);
        assert(Array.isArray(emptyResp.payload?.enrollments), 'empty-user my-courses missing enrollments[]');
    }

    console.log('LMS read cutover smoke checks passed.');
}

main().catch(error => {
    console.error('\nLMS read cutover smoke failed:', error.message);
    process.exit(1);
});
