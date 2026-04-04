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
    }

    console.log('TNA read cutover smoke checks passed.');
}

main().catch(error => {
    console.error('\nTNA read cutover smoke failed:', error.message);
    process.exit(1);
});
