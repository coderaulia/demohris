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

async function callTnaEndpoint({ baseUrl, action, jwt = '', body = {} }) {
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
    }
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');

    const adminEmail = required('SUPABASE_TNA_WORKFLOW_TEST_EMAIL');
    const adminPassword = required('SUPABASE_TNA_WORKFLOW_TEST_PASSWORD');
    const employeeId = required('SUPABASE_TNA_WORKFLOW_TEST_EMPLOYEE_ID');
    const trainingNeedId = required('SUPABASE_TNA_WORKFLOW_TEST_NEED_ID');

    console.log('== TNA mutation workflow smoke ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);

    const session = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: adminEmail,
        password: adminPassword,
    });
    const jwt = String(session.access_token || '').trim();
    assert(jwt, 'Supabase access_token is missing');

    const unauthorizedCreate = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/needs/create',
        body: {
            employee_id: employeeId,
            training_need_id: trainingNeedId,
            current_level: 2,
        },
    });
    assert(
        unauthorizedCreate.status === 401,
        `unauthorized tna/needs/create should return 401, got ${unauthorizedCreate.status}`
    );

    const createResp = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/needs/create',
        jwt,
        body: {
            employee_id: employeeId,
            training_need_id: trainingNeedId,
            current_level: 2,
            priority: 'high',
            notes: 'workflow parity smoke',
        },
    });
    assert(createResp.status === 200, `tna/needs/create should return 200, got ${createResp.status}`);
    assert(createResp.payload?.data, 'tna/needs/create missing data payload');
    const recordId = String(createResp.payload?.data?.id || '').trim();
    assert(recordId, 'tna/needs/create missing created record id');

    const updateResp = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/needs/update-status',
        jwt,
        body: {
            id: recordId,
            status: 'planned',
        },
    });
    assert(updateResp.status === 200, `tna/needs/update-status should return 200, got ${updateResp.status}`);
    assert(updateResp.payload?.data, 'tna/needs/update-status missing data payload');
    assert(
        String(updateResp.payload.data.status || '').toLowerCase() === 'planned',
        `updated TNA need status should be planned, got ${String(updateResp.payload.data.status || '')}`
    );

    const needsReadResp = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/needs',
        jwt,
        body: {
            employee_id: employeeId,
            status: 'planned',
        },
    });
    assert(needsReadResp.status === 200, `tna/needs should return 200, got ${needsReadResp.status}`);
    assert(Array.isArray(needsReadResp.payload?.data), 'tna/needs should return data[]');
    assert(
        needsReadResp.payload.data.some(item => String(item?.id || '') === recordId),
        'tna/needs follow-up read should include updated record'
    );

    const summaryResp = await callTnaEndpoint({
        baseUrl: backendBaseUrl,
        action: 'tna/summary',
        jwt,
        body: {},
    });
    assert(summaryResp.status === 200, `tna/summary should return 200, got ${summaryResp.status}`);
    assertSummaryShape(summaryResp.payload);

    console.log('TNA mutation workflow smoke checks passed.');
}

main().catch(error => {
    console.error('\nTNA mutation workflow smoke failed:', error.message);
    process.exit(1);
});
