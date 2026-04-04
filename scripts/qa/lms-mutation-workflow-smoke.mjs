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

async function callLmsEndpoint({ baseUrl, action, jwt = '', body = {} }) {
    const response = await fetch(`${baseUrl}/api?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        headers: {
            Authorization: jwt ? `Bearer ${jwt}` : '',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const payload = await parseJsonSafe(response);
    return { status: response.status, payload };
}

function assertProgressShape(progressPayload) {
    assert(progressPayload?.success === true, 'progress/get must return success=true');
    assert(progressPayload?.progress && typeof progressPayload.progress === 'object', 'progress/get missing progress object');
    assert(Array.isArray(progressPayload.progress.lessons), 'progress/get missing progress.lessons[]');
}

async function findEnrollmentByCourse({ baseUrl, jwt, courseId }) {
    const myCoursesResp = await callLmsEndpoint({
        baseUrl,
        action: 'lms/enrollments/my-courses',
        jwt,
        body: { page: 1, limit: 100 },
    });
    if (myCoursesResp.status !== 200 || !Array.isArray(myCoursesResp.payload?.enrollments)) {
        return '';
    }
    const row = myCoursesResp.payload.enrollments.find(item => String(item?.course_id || '') === String(courseId));
    return String(row?.id || '').trim();
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');

    const userEmail = required('SUPABASE_LMS_WORKFLOW_TEST_EMAIL');
    const userPassword = required('SUPABASE_LMS_WORKFLOW_TEST_PASSWORD');
    const courseId = required('SUPABASE_LMS_WORKFLOW_TEST_COURSE_ID');
    const expectsFirstLessonInit = env('SUPABASE_LMS_WORKFLOW_EXPECTS_FIRST_LESSON_INIT', 'true') !== 'false';

    console.log('== LMS mutation workflow smoke ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);

    const session = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: userEmail,
        password: userPassword,
    });
    const jwt = String(session.access_token || '').trim();
    assert(jwt, 'Supabase access_token is missing');

    const enrollmentId = await findEnrollmentByCourse({
        baseUrl: backendBaseUrl,
        jwt,
        courseId,
    });
    assert(enrollmentId, 'Unable to resolve seeded enrollment for workflow user/course');

    const startResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/start',
        jwt,
        body: { course_id: courseId },
    });
    assert([200, 400].includes(startResp.status), `start should return 200 or 400, got ${startResp.status}`);
    if (startResp.status === 200) {
        assert(startResp.payload?.success === true, 'start should return success=true');
    } else {
        const message = String(startResp.payload?.error || '').toLowerCase();
        assert(
            message.includes('already completed'),
            `start 400 should be already-completed guard, got: ${message || 'unknown'}`
        );
    }

    const unauthorizedStart = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/start',
        body: { course_id: courseId },
    });
    assert(unauthorizedStart.status === 401, `unauthorized start should return 401, got ${unauthorizedStart.status}`);

    const notEnrolledStart = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/start',
        jwt,
        body: { course_id: '00000000-0000-4000-8000-000000000000' },
    });
    assert(
        notEnrolledStart.status === 404,
        `start with unknown/non-enrolled course should return 404, got ${notEnrolledStart.status}`
    );

    const enrollmentAfterStart = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/get',
        jwt,
        body: { enrollment_id: enrollmentId },
    });
    assert(
        enrollmentAfterStart.status === 200,
        `enrollments/get after start should return 200, got ${enrollmentAfterStart.status}`
    );
    assert(enrollmentAfterStart.payload?.success === true, 'enrollments/get after start missing success=true');
    assert(enrollmentAfterStart.payload?.enrollment, 'enrollments/get after start missing enrollment payload');

    const progressAfterStart = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: { enrollment_id: enrollmentId },
    });
    assert(
        progressAfterStart.status === 200,
        `progress/get after start should return 200, got ${progressAfterStart.status}`
    );
    assertProgressShape(progressAfterStart.payload);
    const statusAfterStart = String(enrollmentAfterStart.payload?.enrollment?.status || '').toLowerCase();
    assert(
        ['in_progress', 'completed'].includes(statusAfterStart),
        `enrollment status after start should be in_progress|completed, got ${statusAfterStart || 'empty'}`
    );
    if (expectsFirstLessonInit && statusAfterStart === 'in_progress') {
        assert(
            progressAfterStart.payload?.progress?.lessons?.length > 0,
            'start should initialize first lesson progress row when course has lessons'
        );
    }

    console.log('LMS start-mutation workflow smoke checks passed.');
}

main().catch(error => {
    console.error('\nLMS mutation workflow smoke failed:', error.message);
    process.exit(1);
});
