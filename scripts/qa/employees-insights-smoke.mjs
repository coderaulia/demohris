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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

loadDotEnv();

function env(name, fallback = '') {
    return String(process.env[name] || fallback).trim();
}

function required(name) {
    const v = env(name);
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

async function signIn({ supabaseUrl, anonKey, email, password }) {
    const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Supabase login failed (${resp.status}): ${JSON.stringify(data)}`);
    return String(data.access_token || '');
}

async function callInsights({ baseUrl, jwt, employeeId }) {
    const resp = await fetch(`${baseUrl}/api?action=employees%2Finsights`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ employee_id: employeeId }),
    });
    return { status: resp.status, body: await resp.json() };
}

function assert(cond, msg) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const anonKey = required('SUPABASE_ANON_KEY');
    const baseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');
    const testEmail = required('SUPABASE_TEST_EMAIL');
    const testPass = required('SUPABASE_TEST_PASSWORD');

    console.log('== employees/insights smoke test ==');
    console.log(`Backend: ${baseUrl}`);
    console.log(`User: ${testEmail}`);

    // Health check
    const healthResp = await fetch(`${baseUrl}/api/health`);
    const health = await healthResp.json();
    assert(health.ok === true, `/api/health must return ok:true, got: ${JSON.stringify(health)}`);
    console.log('✓ Health check passed:', JSON.stringify(health));

    // Get JWT
    const jwt = await signIn({ supabaseUrl, anonKey, email: testEmail, password: testPass });
    assert(jwt, 'JWT must be non-empty');
    console.log('✓ JWT obtained');

    // Decode employee_id from JWT claims
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    console.log('  JWT sub:', claims.sub, '  email:', claims.email);

    // Query the insights endpoint for a known employee (ADM001 from auth parity)
    const testEmployeeId = env('SUPABASE_INSIGHTS_TEST_EMPLOYEE_ID', 'ADM001');
    const { status, body } = await callInsights({ baseUrl, jwt, employeeId: testEmployeeId });

    console.log(`\nemployees/insights for ${testEmployeeId}:`);
    console.log('  status:', status);
    console.log('  body:', JSON.stringify(body, null, 2));

    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.success === true, 'body.success must be true');

    const { kpi, assessment, lms } = body.insights;

    assert(typeof kpi === 'object', 'insights.kpi must be object');
    assert(typeof kpi.record_count === 'number', 'kpi.record_count must be number');
    assert(kpi.trend === null || ['up', 'down', 'flat'].includes(kpi.trend), `kpi.trend invalid: ${kpi.trend}`);
    console.log('  ✓ KPI insights valid');

    assert(typeof assessment === 'object', 'insights.assessment must be object');
    assert(assessment.gap_level === null || ['low', 'medium', 'high'].includes(assessment.gap_level), `assessment.gap_level invalid: ${assessment.gap_level}`);
    assert(typeof assessment.history_count === 'number', 'assessment.history_count must be number');
    console.log('  ✓ Assessment insights valid');

    assert(typeof lms === 'object', 'insights.lms must be object');
    assert(typeof lms.enrolled_count === 'number', 'lms.enrolled_count must be number');
    assert(typeof lms.completion_pct === 'number' && lms.completion_pct >= 0 && lms.completion_pct <= 100, 'lms.completion_pct must be 0-100');
    console.log('  ✓ LMS insights valid');

    // Access control: missing employee_id should return 400
    const { status: noEmpStatus } = await callInsights({ baseUrl, jwt, employeeId: '' });
    assert(noEmpStatus === 400, `Expected 400 for missing employee_id, got ${noEmpStatus}`);
    console.log('  ✓ Missing employee_id rejected (400)');

    // Unauthenticated request
    const { status: unauthStatus } = await callInsights({ baseUrl, jwt: '', employeeId: testEmployeeId });
    assert(unauthStatus === 401, `Expected 401 for unauthenticated request, got ${unauthStatus}`);
    console.log('  ✓ Unauthenticated request rejected (401)');

    console.log('\nemployees/insights smoke test PASSED ✓');
}

main().catch(err => {
    console.error('\nSmoke test FAILED:', err.message);
    process.exit(1);
});
