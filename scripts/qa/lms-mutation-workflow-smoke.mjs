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
    const configuredLessonId = env('SUPABASE_LMS_WORKFLOW_TEST_LESSON_ID');
    const quizAnswersJson = env('SUPABASE_LMS_WORKFLOW_TEST_QUIZ_ANSWERS_JSON');

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

    const unauthorizedEnroll = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/enroll',
        body: { course_id: courseId },
    });
    assert(unauthorizedEnroll.status === 401, `unauthorized enroll should return 401, got ${unauthorizedEnroll.status}`);

    const enrollResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/enrollments/enroll',
        jwt,
        body: { course_id: courseId },
    });

    let enrollmentId = '';
    if (enrollResp.status === 200) {
        assert(enrollResp.payload?.success === true, 'enroll should return success=true');
        enrollmentId = String(enrollResp.payload?.enrollment?.id || '').trim();
    } else if (enrollResp.status === 400) {
        const message = String(enrollResp.payload?.error || '').toLowerCase();
        assert(message.includes('already enrolled'), `enroll 400 must be already-enrolled, got: ${message || 'unknown'}`);
        enrollmentId = await findEnrollmentByCourse({ baseUrl: backendBaseUrl, jwt, courseId });
    } else {
        throw new Error(`enroll should return 200 or 400, got ${enrollResp.status}`);
    }
    assert(enrollmentId, 'Unable to resolve enrollment ID after enroll step');

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

    const progressBefore = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: { enrollment_id: enrollmentId },
    });
    assert(progressBefore.status === 200, `progress/get before complete should return 200, got ${progressBefore.status}`);
    assertProgressShape(progressBefore.payload);

    const lessonId = String(
        configuredLessonId
        || progressBefore.payload?.progress?.lessons?.[0]?.lesson_id
        || ''
    ).trim();
    assert(lessonId, 'No lesson ID available for complete-lesson step (set SUPABASE_LMS_WORKFLOW_TEST_LESSON_ID)');

    const completeLessonResp = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/complete-lesson',
        jwt,
        body: { enrollment_id: enrollmentId, lesson_id: lessonId },
    });
    assert(completeLessonResp.status === 200, `complete-lesson should return 200, got ${completeLessonResp.status}`);
    assert(completeLessonResp.payload?.success === true, 'complete-lesson missing success=true');

    const progressAfter = await callLmsEndpoint({
        baseUrl: backendBaseUrl,
        action: 'lms/progress/get',
        jwt,
        body: { enrollment_id: enrollmentId, lesson_id: lessonId },
    });
    assert(progressAfter.status === 200, `progress/get after complete should return 200, got ${progressAfter.status}`);
    assertProgressShape(progressAfter.payload);
    const progressLesson = progressAfter.payload?.progress?.lesson;
    if (progressLesson) {
        const status = String(progressLesson.status || '').toLowerCase();
        assert(
            status === 'completed' || Number(progressLesson.progress_percent || 0) >= 100,
            `completed lesson should be reflected in progress/get, got status=${status}`
        );
    }

    if (quizAnswersJson) {
        let answers;
        try {
            answers = JSON.parse(quizAnswersJson);
        } catch {
            throw new Error('SUPABASE_LMS_WORKFLOW_TEST_QUIZ_ANSWERS_JSON must be valid JSON');
        }

        const submitResp = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/quizzes/submit',
            jwt,
            body: {
                enrollment_id: enrollmentId,
                lesson_id: lessonId,
                answers,
            },
        });
        assert(submitResp.status === 200, `quizzes/submit should return 200, got ${submitResp.status}`);
        assert(submitResp.payload?.success === true, 'quizzes/submit missing success=true');
        const attemptId = String(submitResp.payload?.attempt?.id || '').trim();
        assert(attemptId, 'quizzes/submit missing attempt.id');

        const getAttemptResp = await callLmsEndpoint({
            baseUrl: backendBaseUrl,
            action: 'lms/quizzes/get-attempt',
            jwt,
            body: { attempt_id: attemptId },
        });
        assert(getAttemptResp.status === 200, `quizzes/get-attempt should return 200, got ${getAttemptResp.status}`);
        assert(getAttemptResp.payload?.success === true, 'quizzes/get-attempt missing success=true');
        assert(getAttemptResp.payload?.attempt, 'quizzes/get-attempt missing attempt payload');
    } else {
        console.log('Quiz submit/get-attempt step skipped (set SUPABASE_LMS_WORKFLOW_TEST_QUIZ_ANSWERS_JSON to enable).');
    }

    console.log('LMS mutation workflow smoke checks passed.');
}

main().catch(error => {
    console.error('\nLMS mutation workflow smoke failed:', error.message);
    process.exit(1);
});
