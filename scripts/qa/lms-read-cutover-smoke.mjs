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

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');
    const testEmail = required('SUPABASE_LMS_TEST_EMAIL');
    const testPassword = required('SUPABASE_LMS_TEST_PASSWORD');
    const defaultEnrollmentId = env('SUPABASE_LMS_TEST_ENROLLMENT_ID', 'a5000000-0000-4000-8000-000000000001');

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

    console.log('LMS read cutover smoke checks passed.');
}

main().catch(error => {
    console.error('\nLMS read cutover smoke failed:', error.message);
    process.exit(1);
});
