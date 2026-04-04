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

async function callModulesEndpoint({ baseUrl, action, jwt, body = {} }) {
    const response = await fetch(`${baseUrl}/api/modules?action=${encodeURIComponent(action)}`, {
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
    const modulesTestEmail = required('SUPABASE_MODULES_TEST_EMAIL');
    const modulesTestPassword = required('SUPABASE_MODULES_TEST_PASSWORD');

    console.log('== Modules cutover smoke ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);

    const session = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: modulesTestEmail,
        password: modulesTestPassword,
    });
    const jwt = String(session.access_token || '').trim();
    assert(jwt, 'Supabase access_token is missing');

    const listResp = await callModulesEndpoint({
        baseUrl: backendBaseUrl,
        action: 'list',
        jwt,
    });
    assert(listResp.status === 200, `modules list should return 200, got ${listResp.status}`);
    assert(listResp.payload?.success === true, 'modules list response missing success=true');
    assert(Array.isArray(listResp.payload?.modules), 'modules list response missing modules[]');

    const activeResp = await callModulesEndpoint({
        baseUrl: backendBaseUrl,
        action: 'active',
        jwt,
    });
    assert(activeResp.status === 200, `modules active should return 200, got ${activeResp.status}`);
    assert(activeResp.payload?.success === true, 'modules active response missing success=true');
    assert(Array.isArray(activeResp.payload?.modules), 'modules active response missing modules[]');

    const byCategoryResp = await callModulesEndpoint({
        baseUrl: backendBaseUrl,
        action: 'by-category',
        jwt,
        body: { category: 'talent' },
    });
    assert(byCategoryResp.status === 200, `modules by-category should return 200, got ${byCategoryResp.status}`);
    assert(byCategoryResp.payload?.success === true, 'modules by-category response missing success=true');
    assert(Array.isArray(byCategoryResp.payload?.modules), 'modules by-category response missing modules[]');

    const badCategoryResp = await callModulesEndpoint({
        baseUrl: backendBaseUrl,
        action: 'by-category',
        jwt,
        body: { category: 'unknown' },
    });
    assert(
        badCategoryResp.status === 400,
        `modules by-category invalid input should return 400, got ${badCategoryResp.status}`
    );

    console.log('Modules cutover smoke checks passed.');
}

main().catch(error => {
    console.error('\nModules cutover smoke failed:', error.message);
    process.exit(1);
});

