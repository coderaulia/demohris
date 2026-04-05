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

async function callEndpoint({ baseUrl, action, jwt = '', body = {} }) {
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

    const superadminEmail = env('SUPABASE_ADMIN_TEST_EMAIL', 'admin.demo@xenos.local');
    const superadminPassword = env('SUPABASE_ADMIN_TEST_PASSWORD', 'Demo123!');
    const hrEmail = env('SUPABASE_HR_TEST_EMAIL', 'hr.demo@xenos.local');
    const hrPassword = env('SUPABASE_HR_TEST_PASSWORD', 'Demo123!');
    const managerEmail = env('SUPABASE_MANAGER_TEST_EMAIL', 'manager.demo@xenos.local');
    const managerPassword = env('SUPABASE_MANAGER_TEST_PASSWORD', 'Demo123!');
    const employeeEmail = env('SUPABASE_EMPLOYEE_TEST_EMAIL', 'farhan.demo@xenos.local');
    const employeePassword = env('SUPABASE_EMPLOYEE_TEST_PASSWORD', 'Demo123!');

    console.log('== Employees role-scope smoke tests ==');
    console.log(`Backend: ${backendBaseUrl}`);

    // Sign in all roles
    const superadminSession = await signInSupabase({
        supabaseUrl, anonKey: supabaseAnonKey,
        email: superadminEmail, password: superadminPassword,
    });
    const superadminJwt = String(superadminSession.access_token || '').trim();
    assert(superadminJwt, 'superadmin JWT missing');

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

    // ─── employees/insights: superadmin → any employee → 200 ───
    const superadminInsights = await callEndpoint({
        baseUrl: backendBaseUrl,
        action: 'employees/insights',
        jwt: superadminJwt,
        body: { employee_id: 'ADM001' },
    });
    assert(
        superadminInsights.status === 200,
        `superadmin employees/insights should return 200, got ${superadminInsights.status}`
    );
    assert(superadminInsights.payload?.success === true, 'superadmin insights missing success=true');
    console.log('  [ok] superadmin → employees/insights(any) → 200');

    // ─── employees/insights: hr → any employee → 200 ───
    const hrInsights = await callEndpoint({
        baseUrl: backendBaseUrl,
        action: 'employees/insights',
        jwt: hrJwt,
        body: { employee_id: 'ADM001' },
    });
    assert(
        hrInsights.status === 200,
        `hr employees/insights should return 200, got ${hrInsights.status}`
    );
    assert(hrInsights.payload?.success === true, 'hr insights missing success=true');
    console.log('  [ok] hr → employees/insights(any) → 200');

    // ─── employees/insights: employee → own id → 200 ───
    const employeeInsights = await callEndpoint({
        baseUrl: backendBaseUrl,
        action: 'employees/insights',
        jwt: employeeJwt,
        body: { employee_id: 'EMP001' },
    });
    assert(
        employeeInsights.status === 200,
        `employee employees/insights(self) should return 200, got ${employeeInsights.status}`
    );
    assert(employeeInsights.payload?.success === true, 'employee insights missing success=true');
    console.log('  [ok] employee → employees/insights(self) → 200');

    // ─── employees/insights: manager → non-report → 403 ───
    const managerNonReport = await callEndpoint({
        baseUrl: backendBaseUrl,
        action: 'employees/insights',
        jwt: managerJwt,
        body: { employee_id: 'ADM001' },
    });
    assert(
        managerNonReport.status === 403,
        `manager employees/insights(non-report) should return 403, got ${managerNonReport.status}`
    );
    console.log('  [ok] manager → employees/insights(non-report) → 403');

    // ─── employees/insights: employee → other id → 403 ───
    const employeeOther = await callEndpoint({
        baseUrl: backendBaseUrl,
        action: 'employees/insights',
        jwt: employeeJwt,
        body: { employee_id: 'ADM001' },
    });
    assert(
        employeeOther.status === 403,
        `employee employees/insights(other) should return 403, got ${employeeOther.status}`
    );
    console.log('  [ok] employee → employees/insights(other) → 403');

    // ─── employees/insights: unauthorized → 401 ───
    const unauthorizedInsights = await callEndpoint({
        baseUrl: backendBaseUrl,
        action: 'employees/insights',
        body: { employee_id: 'ADM001' },
    });
    assert(
        unauthorizedInsights.status === 401,
        `unauthorized employees/insights should return 401, got ${unauthorizedInsights.status}`
    );
    console.log('  [ok] unauthorized → employees/insights → 401');

    console.log('\nEmployees role-scope smoke checks passed ✓');
}

main().catch(error => {
    console.error('\nEmployees role-scope smoke failed:', error.message);
    process.exit(1);
});
