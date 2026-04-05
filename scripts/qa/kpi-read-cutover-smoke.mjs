// scripts/qa/kpi-read-cutover-smoke.mjs
// Live smoke test for kpi/reporting-summary Supabase read cutover.
// Usage: npm run qa:kpi:cutover
// Required env vars (in .env or environment):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_KPI_ADMIN_TEST_EMAIL   (superadmin or hr or manager)
//   SUPABASE_KPI_ADMIN_TEST_PASSWORD
// Optional:
//   SUPABASE_KPI_EMPLOYEE_TEST_EMAIL
//   SUPABASE_KPI_EMPLOYEE_TEST_PASSWORD
//   BACKEND_BASE_URL                (default: http://127.0.0.1:3000)

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
    if (!condition) throw new Error(`Assertion failed: ${message}`);
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

async function callKpiEndpoint({ baseUrl, action, jwt = '', payload = {} }) {
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

function assertReportingSummaryShape(payload) {
    assert(payload && typeof payload === 'object', 'response must be object');
    assert(payload.success === true, 'success must be true');
    assert(Array.isArray(payload.rows), 'response must have rows[]');

    if (payload.rows.length > 0) {
        const row = payload.rows[0];
        const requiredKeys = [
            'department',
            'employee_count',
            'record_count',
            'met_count',
            'not_met_count',
            'missing_count',
        ];
        for (const key of requiredKeys) {
            assert(Object.prototype.hasOwnProperty.call(row, key), `row missing key: ${key}`);
        }
        assert(typeof row.department === 'string', 'row.department must be string');
        assert(typeof row.employee_count === 'number', 'row.employee_count must be number');
        assert(row.employee_count >= 0, 'row.employee_count must be non-negative');
        assert(typeof row.record_count === 'number', 'row.record_count must be number');
        assert(typeof row.met_count === 'number', 'row.met_count must be number');
        assert(typeof row.not_met_count === 'number', 'row.not_met_count must be number');
        assert(typeof row.missing_count === 'number', 'row.missing_count must be non-negative');
        assert(row.avg_score === null || typeof row.avg_score === 'number', 'row.avg_score must be number or null');
    }
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');

    const adminEmail = required('SUPABASE_KPI_ADMIN_TEST_EMAIL');
    const adminPassword = required('SUPABASE_KPI_ADMIN_TEST_PASSWORD');
    const employeeEmail = env('SUPABASE_KPI_EMPLOYEE_TEST_EMAIL');
    const employeePassword = env('SUPABASE_KPI_EMPLOYEE_TEST_PASSWORD');

    console.log('== KPI read cutover smoke ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);

    // ─── Sign in admin ───────────────────────────────────────────────────────
    const adminSession = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: adminEmail,
        password: adminPassword,
    });
    const adminJwt = String(adminSession.access_token || '').trim();
    assert(adminJwt, 'Supabase admin access_token is missing');
    console.log('  [ok] admin sign-in');

    // ─── Basic summary (no filters) ─────────────────────────────────────────
    const baseResp = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        jwt: adminJwt,
        payload: {},
    });
    assert(baseResp.status === 200, `kpi/reporting-summary (no filter) should be 200, got ${baseResp.status}: ${JSON.stringify(baseResp.body)}`);
    assertReportingSummaryShape(baseResp.body);
    console.log(`  [ok] kpi/reporting-summary no filter → ${baseResp.body.rows?.length ?? 0} row(s), source=${baseResp.body.source}`);

    // ─── With period filter (body) ────────────────────────────────────────────
    const periodBodyResp = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        jwt: adminJwt,
        payload: { period: '2026-04' },
    });
    assert(periodBodyResp.status === 200, `kpi/reporting-summary with period should be 200, got ${periodBodyResp.status}`);
    assertReportingSummaryShape(periodBodyResp.body);
    console.log(`  [ok] kpi/reporting-summary period=2026-04 → ${periodBodyResp.body.rows?.length ?? 0} row(s)`);

    // ─── With department filter (if rows exist) ───────────────────────────────
    const derivedDepartment = String(baseResp.body?.rows?.[0]?.department || '').trim();
    if (derivedDepartment) {
        const deptResp = await callKpiEndpoint({
            baseUrl: backendBaseUrl,
            action: 'kpi/reporting-summary',
            jwt: adminJwt,
            payload: { department: derivedDepartment },
        });
        assert(deptResp.status === 200, `kpi/reporting-summary department filter should be 200, got ${deptResp.status}`);
        assertReportingSummaryShape(deptResp.body);
        const mismatched = (deptResp.body?.rows || []).find(r => String(r?.department || '') !== derivedDepartment);
        assert(!mismatched, `department filter returned mismatched row: ${mismatched?.department}`);
        console.log(`  [ok] kpi/reporting-summary department=${derivedDepartment} → ${deptResp.body.rows?.length ?? 0} row(s)`);
    } else {
        console.log('  [skip] department filter: no rows returned from base query to derive department from');
    }

    // ─── Unauthenticated → 401 ────────────────────────────────────────────────
    const unauthResp = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        jwt: '',
        payload: {},
    });
    assert(unauthResp.status === 401, `unauthenticated should return 401, got ${unauthResp.status}`);
    console.log('  [ok] unauthenticated → 401');

    // ─── Employee role → 403 ─────────────────────────────────────────────────
    const employeeSession = await signInIfProvided({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: employeeEmail,
        password: employeePassword,
    });
    if (employeeSession?.access_token) {
        const forbiddenResp = await callKpiEndpoint({
            baseUrl: backendBaseUrl,
            action: 'kpi/reporting-summary',
            jwt: String(employeeSession.access_token),
            payload: {},
        });
        assert(forbiddenResp.status === 403, `employee kpi/reporting-summary should return 403, got ${forbiddenResp.status}`);
        console.log('  [ok] employee role → 403');
    } else {
        console.log('  [skip] employee role check: SUPABASE_KPI_EMPLOYEE_TEST_EMAIL/PASSWORD not set');
    }

    console.log('\nKPI read cutover smoke checks passed. ✓');
}

main().catch(error => {
    console.error('\nKPI read cutover smoke failed:', error.message);
    process.exit(1);
});
