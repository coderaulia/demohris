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

async function callTnaSummary({ baseUrl, jwt = '', payload = {}, periodQuery = '' }) {
    const query = periodQuery ? `&period=${encodeURIComponent(periodQuery)}` : '';
    const response = await fetch(`${baseUrl}/api?action=tna/summary${query}`, {
        method: 'POST',
        headers: {
            Authorization: jwt ? `Bearer ${jwt}` : '',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
    });
    const body = await parseJsonSafe(response);
    return { status: response.status, body };
}

async function callTnaEndpoint({ baseUrl, action, jwt = '', payload = {} }) {
    const response = await fetch(`${baseUrl}/api?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        headers: {
            Authorization: jwt ? `Bearer ${jwt}` : '',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
    });
    const body = await parseJsonSafe(response);
    return { status: response.status, body };
}

function assertSummaryShape(payload) {
    const data = payload?.data;
    assert(data && typeof data === 'object', 'summary response missing data object');
    const keys = [
        'total_needs_identified',
        'needs_completed',
        'active_plans',
        'total_enrollments',
        'enrollments_completed',
        'critical_gaps',
        'high_gaps',
    ];
    for (const key of keys) {
        assert(Object.prototype.hasOwnProperty.call(data, key), `summary missing key: ${key}`);
        assert(Number.isFinite(Number(data[key])), `summary key ${key} must be numeric`);
    }
}

function assertGapsReportShape(payload) {
    const data = payload?.data;
    assert(Array.isArray(data), 'gaps-report response missing data[]');
    if (data.length === 0) return;

    const row = data[0];
    const keys = [
        'employee_id',
        'employee_name',
        'position',
        'department',
        'competency_name',
        'required_level',
        'current_level',
        'gap_level',
        'priority',
        'status',
        'identified_at',
    ];
    for (const key of keys) {
        assert(Object.prototype.hasOwnProperty.call(row, key), `gaps-report row missing key: ${key}`);
    }
}

function assertLmsReportShape(payload) {
    const data = payload?.data;
    assert(data && typeof data === 'object', 'lms-report response missing data object');
    assert(data.summary && typeof data.summary === 'object', 'lms-report missing summary object');
    assert(Array.isArray(data.by_course), 'lms-report missing by_course[]');

    const summaryKeys = ['total_enrollments', 'completed', 'in_progress', 'enrolled', 'avg_score'];
    for (const key of summaryKeys) {
        assert(Object.prototype.hasOwnProperty.call(data.summary, key), `lms-report summary missing key: ${key}`);
    }

    if (data.by_course.length > 0) {
        const row = data.by_course[0];
        const rowKeys = ['department', 'course_name', 'provider', 'total_enrolled', 'completed', 'in_progress', 'avg_score'];
        for (const key of rowKeys) {
            assert(Object.prototype.hasOwnProperty.call(row, key), `lms-report row missing key: ${key}`);
        }
    }
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');

    const adminEmail = required('SUPABASE_TNA_ADMIN_TEST_EMAIL');
    const adminPassword = required('SUPABASE_TNA_ADMIN_TEST_PASSWORD');
    const employeeEmail = env('SUPABASE_TNA_EMPLOYEE_TEST_EMAIL');
    const employeePassword = env('SUPABASE_TNA_EMPLOYEE_TEST_PASSWORD');

    console.log('== TNA read cutover smoke ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);

    const adminSession = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: adminEmail,
        password: adminPassword,
    });
    const adminJwt = String(adminSession.access_token || '').trim();
    assert(adminJwt, 'Supabase admin access_token is missing');

    const bodyFilterResp = await callTnaSummary({
        baseUrl: backendBaseUrl,
        jwt: adminJwt,
        payload: { period: '2026-04' },
    });
    assert(bodyFilterResp.status === 200, `tna/summary with body filter should return 200, got ${bodyFilterResp.status}`);
    assertSummaryShape(bodyFilterResp.body);

    const queryFilterResp = await callTnaSummary({
        baseUrl: backendBaseUrl,
        jwt: adminJwt,
        payload: {},
        periodQuery: '2026-04',
    });
    assert(queryFilterResp.status === 200, `tna/summary with query filter should return 200, got ${queryFilterResp.status}`);
    assertSummaryShape(queryFilterResp.body);

    const gapsReportResp = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/gaps-report',
        jwt: adminJwt,
        payload: {},
    });
    assert(gapsReportResp.status === 200, `tna/gaps-report should return 200, got ${gapsReportResp.status}`);
    assertGapsReportShape(gapsReportResp.body);

    const derivedDepartment = String(gapsReportResp.body?.data?.[0]?.department || '').trim();
    if (derivedDepartment) {
        const filteredGapsResp = await callTnaEndpoint({
            baseUrl: backendBaseUrl,
            action: 'tna/gaps-report',
            jwt: adminJwt,
            payload: { department: derivedDepartment },
        });
        assert(
            filteredGapsResp.status === 200,
            `tna/gaps-report with department filter should return 200, got ${filteredGapsResp.status}`
        );
        assertGapsReportShape(filteredGapsResp.body);
        const mismatched = (filteredGapsResp.body?.data || []).find(row => String(row?.department || '') !== derivedDepartment);
        assert(!mismatched, 'tna/gaps-report department filter returned mismatched row');
    }

    const lmsReportResp = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/lms-report',
        jwt: adminJwt,
        payload: {},
    });
    assert(lmsReportResp.status === 200, `tna/lms-report should return 200, got ${lmsReportResp.status}`);
    assertLmsReportShape(lmsReportResp.body);

    if (derivedDepartment) {
        const filteredLmsReportResp = await callTnaEndpoint({
            baseUrl: backendBaseUrl,
            action: 'tna/lms-report',
            jwt: adminJwt,
            payload: { department: derivedDepartment },
        });
        assert(
            filteredLmsReportResp.status === 200,
            `tna/lms-report with department filter should return 200, got ${filteredLmsReportResp.status}`
        );
        assertLmsReportShape(filteredLmsReportResp.body);
        const mismatched = (filteredLmsReportResp.body?.data?.by_course || []).find(
            row => String(row?.department || '') !== derivedDepartment
        );
        assert(!mismatched, 'tna/lms-report department filter returned mismatched row');
    }

    const unauthorizedResp = await callTnaSummary({
        baseUrl: backendBaseUrl,
        jwt: '',
        payload: { period: '2026-04' },
    });
    assert(unauthorizedResp.status === 401, `unauthorized tna/summary should return 401, got ${unauthorizedResp.status}`);

    const employeeSession = await signInIfProvided({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: employeeEmail,
        password: employeePassword,
    });
    if (employeeSession?.access_token) {
        const forbiddenResp = await callTnaSummary({
            baseUrl: backendBaseUrl,
            jwt: String(employeeSession.access_token),
            payload: { period: '2026-04' },
        });
        assert(forbiddenResp.status === 403, `employee tna/summary should return 403, got ${forbiddenResp.status}`);

        const forbiddenGaps = await callTnaEndpoint({
            baseUrl: backendBaseUrl,
            action: 'tna/gaps-report',
            jwt: String(employeeSession.access_token),
            payload: {},
        });
        assert(forbiddenGaps.status === 403, `employee tna/gaps-report should return 403, got ${forbiddenGaps.status}`);

        const forbiddenLmsReport = await callTnaEndpoint({
            baseUrl: backendBaseUrl,
            action: 'tna/lms-report',
            jwt: String(employeeSession.access_token),
            payload: {},
        });
        assert(
            forbiddenLmsReport.status === 403,
            `employee tna/lms-report should return 403, got ${forbiddenLmsReport.status}`
        );
    }

    console.log('TNA read cutover smoke checks passed.');
}

main().catch(error => {
    console.error('\nTNA read cutover smoke failed:', error.message);
    process.exit(1);
});
