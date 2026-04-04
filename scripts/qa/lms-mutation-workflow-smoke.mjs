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

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
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

async function resolveWorkflowCourseId({ baseUrl, jwt, explicitCourseId = '' }) {
    if (explicitCourseId) return explicitCourseId;
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceRoleKey) {
        const qs = new URLSearchParams();
        qs.set('select', 'id');
        qs.set('status', 'eq.published');
        qs.set('limit', '1');
        const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/courses?${qs.toString()}`, {
            method: 'GET',
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
            },
        });
        if (response.ok) {
            const rows = await response.json().catch(() => []);
            if (Array.isArray(rows) && rows[0]?.id) {
                return String(rows[0].id);
            }
        }
    }

    const listResp = await callLmsEndpoint({
        baseUrl,
        action: 'lms/courses/list',
        jwt,
        body: { status: 'published', page: 1, limit: 25 },
    });
    if (listResp.status !== 200 || !Array.isArray(listResp.payload?.courses) || listResp.payload.courses.length === 0) {
        throw new Error('Unable to auto-resolve published LMS course for workflow smoke');
    }
    return String(listResp.payload.courses[0].id || '').trim();
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');

    const userEmail = firstNonEmpty(
        env('SUPABASE_LMS_TEST_EMAIL'),
        env('SUPABASE_LMS_WORKFLOW_TEST_EMAIL')
    );
    const userPassword = firstNonEmpty(
        env('SUPABASE_LMS_TEST_PASSWORD'),
        env('SUPABASE_LMS_WORKFLOW_TEST_PASSWORD')
    );
    assert(userEmail, 'Missing LMS workflow/test email env var');
    assert(userPassword, 'Missing LMS workflow/test password env var');
    const configuredCourseId = firstNonEmpty(
        env('SUPABASE_LMS_WORKFLOW_TEST_COURSE_ID'),
        env('SUPABASE_LMS_WORKFLOW_ENROLL_TEST_COURSE_ID')
    );
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

    const enrollCourseId = await resolveWorkflowCourseId({
        baseUrl: backendBaseUrl,
        jwt,
        explicitCourseId: configuredCourseId,
    });
    assert(enrollCourseId, 'Unable to resolve workflow course id');

    const baselineEnrollmentId = await findEnrollmentByCourse({
        baseUrl: backendBaseUrl,
        jwt,
        courseId: enrollCourseId,
    });

    if (baselineEnrollmentId) {
        const preUnenroll = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/enrollments/unenroll',
            jwt,
            body: { enrollment_id: baselineEnrollmentId },
        });
        assert(
            [200, 404].includes(preUnenroll.status),
            `pre-cleanup unenroll should return 200 or 404, got ${preUnenroll.status}`
        );
    }

    const enrollResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/enroll',
        jwt,
        body: { course_id: enrollCourseId },
    });
    assert(
        [200, 400, 409].includes(enrollResp.status),
        `enroll should return 200, 400 or 409, got ${enrollResp.status}`
    );
    if (enrollResp.status === 200) {
        assert(enrollResp.payload?.success === true, 'enroll should return success=true');
        assert(enrollResp.payload?.enrollment, 'enroll should return enrollment payload');
    }

    const enrollDuplicateResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/enroll',
        jwt,
        body: { course_id: enrollCourseId },
    });
    assert(
        [400, 409].includes(enrollDuplicateResp.status),
        `duplicate enroll should return 400 or 409, got ${enrollDuplicateResp.status}`
    );

    const unauthorizedEnroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/enroll',
        body: { course_id: enrollCourseId },
    });
    assert(unauthorizedEnroll.status === 401, `unauthorized enroll should return 401, got ${unauthorizedEnroll.status}`);

    const enrolledId = await findEnrollmentByCourse({
        baseUrl: backendBaseUrl,
        jwt,
        courseId: enrollCourseId,
    });
    assert(enrolledId, 'Unable to resolve enrollment after enroll mutation');

    const enrollmentAfterEnroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/get',
        jwt,
        body: { enrollment_id: enrolledId },
    });
    assert(
        enrollmentAfterEnroll.status === 200,
        `enrollments/get after enroll should return 200, got ${enrollmentAfterEnroll.status}`
    );
    assert(enrollmentAfterEnroll.payload?.success === true, 'enrollments/get after enroll missing success=true');
    assert(enrollmentAfterEnroll.payload?.enrollment, 'enrollments/get after enroll missing enrollment payload');

    const progressAfterEnroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: { enrollment_id: enrolledId },
    });
    assert(
        progressAfterEnroll.status === 200,
        `progress/get after enroll should return 200, got ${progressAfterEnroll.status}`
    );
    assertProgressShape(progressAfterEnroll.payload);

    const startResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/start',
        jwt,
        body: { course_id: enrollCourseId },
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
        body: { course_id: enrollCourseId },
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
        body: { enrollment_id: enrolledId },
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
        body: { enrollment_id: enrolledId },
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

    const unenrollResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/unenroll',
        jwt,
        body: { enrollment_id: enrolledId },
    });
    assert(unenrollResp.status === 200, `unenroll should return 200, got ${unenrollResp.status}`);
    assert(unenrollResp.payload?.success === true, 'unenroll should return success=true');

    const getAfterUnenroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/get',
        jwt,
        body: { enrollment_id: enrolledId },
    });
    assert(getAfterUnenroll.status === 404, `enrollments/get after unenroll should return 404, got ${getAfterUnenroll.status}`);

    const progressAfterUnenroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: { enrollment_id: enrolledId },
    });
    assert(progressAfterUnenroll.status === 404, `progress/get after unenroll should return 404, got ${progressAfterUnenroll.status}`);

    const unauthorizedUnenroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/unenroll',
        body: { enrollment_id: enrolledId },
    });
    assert(unauthorizedUnenroll.status === 401, `unauthorized unenroll should return 401, got ${unauthorizedUnenroll.status}`);

    console.log('LMS enroll/unenroll/start workflow smoke checks passed.');
}

main().catch(error => {
    console.error('\nLMS mutation workflow smoke failed:', error.message);
    process.exit(1);
});
