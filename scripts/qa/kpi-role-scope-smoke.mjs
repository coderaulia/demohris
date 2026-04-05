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

async function callKpiEndpoint({ baseUrl, action, jwt = '', body = {} }) {
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

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');

    const hrEmail = env('SUPABASE_HR_TEST_EMAIL', 'hr.demo@xenos.local');
    const hrPassword = env('SUPABASE_HR_TEST_PASSWORD', 'Demo123!');
    const managerEmail = env('SUPABASE_MANAGER_TEST_EMAIL', 'manager.demo@xenos.local');
    const managerPassword = env('SUPABASE_MANAGER_TEST_PASSWORD', 'Demo123!');
    const employeeEmail = env('SUPABASE_EMPLOYEE_TEST_EMAIL', 'farhan.demo@xenos.local');
    const employeePassword = env('SUPABASE_EMPLOYEE_TEST_PASSWORD', 'Demo123!');

    console.log('== KPI role-scope smoke tests ==');
    console.log(`Backend: ${backendBaseUrl}`);

    // Sign in all roles
    const hrSession = await signInSupabase({
        supabaseUrl, anonKey: supabaseAnonKey,
        email: hrEmail, password: hrPassword,
    });
    const hrJwt = String(hrSession.access_token || '').trim();
    assert(hrJwt, 'hr JWT missing');

    const managerSession = await signInSupabase({
        supabaseUrl, anonKey: supabaseAnonKey,
        email: managerEmail, password: managerPassword,
    });
    const managerJwt = String(managerSession.access_token || '').trim();
    assert(managerJwt, 'manager JWT missing');

    const employeeSession = await signInSupabase({
        supabaseUrl, anonKey: supabaseAnonKey,
        email: employeeEmail, password: employeePassword,
    });
    const employeeJwt = String(employeeSession.access_token || '').trim();
    assert(employeeJwt, 'employee JWT missing');

    // ─── kpi/reporting-summary: hr → all departments → 200 ───
    const hrSummary = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        jwt: hrJwt,
        body: {},
    });
    assert(
        hrSummary.status === 200,
        `hr kpi/reporting-summary should return 200, got ${hrSummary.status}`
    );
    assert(hrSummary.payload?.success === true, 'hr kpi/reporting-summary missing success=true');
    assert(Array.isArray(hrSummary.payload?.data), 'hr kpi/reporting-summary missing data array');
    console.log('  [ok] hr → kpi/reporting-summary → 200 (all departments)');

    // ─── kpi/reporting-summary: manager → own dept only → 200 ───
    const managerSummary = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        jwt: managerJwt,
        body: {},
    });
    assert(
        managerSummary.status === 200,
        `manager kpi/reporting-summary should return 200, got ${managerSummary.status}`
    );
    assert(managerSummary.payload?.success === true, 'manager kpi/reporting-summary missing success=true');
    assert(Array.isArray(managerSummary.payload?.data), 'manager kpi/reporting-summary missing data array');
    console.log('  [ok] manager → kpi/reporting-summary → 200 (own dept only)');

    // ─── kpi/reporting-summary: employee → 403 ───
    const employeeSummary = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        jwt: employeeJwt,
        body: {},
    });
    assert(
        employeeSummary.status === 403,
        `employee kpi/reporting-summary should return 403, got ${employeeSummary.status}`
    );
    console.log('  [ok] employee → kpi/reporting-summary → 403');

    // ─── kpi/reporting-summary: unauthorized → 401 ───
    const unauthorizedSummary = await callKpiEndpoint({
        baseUrl: backendBaseUrl,
        action: 'kpi/reporting-summary',
        body: {},
    });
    assert(
        unauthorizedSummary.status === 401,
        `unauthorized kpi/reporting-summary should return 401, got ${unauthorizedSummary.status}`
    );
    console.log('  [ok] unauthorized → kpi/reporting-summary → 401');

    console.log('\nKPI role-scope smoke checks passed ✓');
}

main().catch(error => {
    console.error('\nKPI role-scope smoke failed:', error.message);
    process.exit(1);
});
