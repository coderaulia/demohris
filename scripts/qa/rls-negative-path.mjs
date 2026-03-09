const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();

const roleCreds = {
    employee: {
        email: String(process.env.TEST_EMPLOYEE_EMAIL || '').trim(),
        password: String(process.env.TEST_EMPLOYEE_PASSWORD || '').trim(),
    },
    manager: {
        email: String(process.env.TEST_MANAGER_EMAIL || '').trim(),
        password: String(process.env.TEST_MANAGER_PASSWORD || '').trim(),
    },
    hr: {
        email: String(process.env.TEST_HR_EMAIL || '').trim(),
        password: String(process.env.TEST_HR_PASSWORD || '').trim(),
    },
    superadmin: {
        email: String(process.env.TEST_SUPERADMIN_EMAIL || '').trim(),
        password: String(process.env.TEST_SUPERADMIN_PASSWORD || '').trim(),
    },
};

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('SKIPPED: SUPABASE_URL / SUPABASE_ANON_KEY not provided.');
    process.exit(0);
}

async function signIn(email, password) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }

    if (!response.ok || !payload.access_token) {
        throw new Error(`Auth failed for ${email}: HTTP ${response.status} ${raw}`);
    }

    return payload.access_token;
}

async function restRequest(token, { method = 'GET', path, body = null, prefer = 'return=representation' }) {
    const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
    };

    if (body !== null) {
        headers['Content-Type'] = 'application/json';
    }
    if (prefer) {
        headers.Prefer = prefer;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    return {
        ok: response.ok,
        status: response.status,
        data,
        text,
    };
}

function assertDenied(result, label) {
    if (result.ok) {
        throw new Error(`${label}: expected denial but request succeeded (HTTP ${result.status})`);
    }
    const msg = String(result.text || '');
    const deniedPattern = /(row-level security|permission|denied|forbidden|not allowed|violates)/i;
    if (!deniedPattern.test(msg) && ![400, 401, 403, 404, 409].includes(result.status)) {
        throw new Error(`${label}: unexpected status/message for denial. HTTP ${result.status} body=${msg}`);
    }
}

function assertSuccess(result, label) {
    if (!result.ok) {
        throw new Error(`${label}: expected success but failed (HTTP ${result.status}) body=${result.text}`);
    }
}

async function maybeGetToken(role, tokens) {
    if (tokens[role]) return tokens[role];
    const creds = roleCreds[role];
    if (!creds?.email || !creds?.password) return null;
    tokens[role] = await signIn(creds.email, creds.password);
    return tokens[role];
}

async function run() {
    const tokens = {};
    const results = [];

    const execute = async (name, fn) => {
        try {
            await fn();
            results.push({ name, status: 'PASS' });
        } catch (error) {
            results.push({ name, status: 'FAIL', message: String(error?.message || error) });
        }
    };

    await execute('Employee denied app_settings update', async () => {
        const token = await maybeGetToken('employee', tokens);
        if (!token) throw new Error('SKIP: employee credentials missing');
        const result = await restRequest(token, {
            method: 'PATCH',
            path: "app_settings?key=eq.app_name",
            body: { value: `QA-${Date.now()}` },
            prefer: 'return=minimal',
        });
        assertDenied(result, 'employee app_settings patch');
    });

    await execute('Manager denied app_settings update', async () => {
        const token = await maybeGetToken('manager', tokens);
        if (!token) throw new Error('SKIP: manager credentials missing');
        const result = await restRequest(token, {
            method: 'PATCH',
            path: "app_settings?key=eq.app_name",
            body: { value: `QA-${Date.now()}` },
            prefer: 'return=minimal',
        });
        assertDenied(result, 'manager app_settings patch');
    });

    await execute('HR denied app_settings update', async () => {
        const token = await maybeGetToken('hr', tokens);
        if (!token) throw new Error('SKIP: hr credentials missing');
        const result = await restRequest(token, {
            method: 'PATCH',
            path: "app_settings?key=eq.app_name",
            body: { value: `QA-${Date.now()}` },
            prefer: 'return=minimal',
        });
        assertDenied(result, 'hr app_settings patch');
    });

    await execute('Manager denied KPI definition insert outside team scope', async () => {
        const managerToken = await maybeGetToken('manager', tokens);
        if (!managerToken) throw new Error('SKIP: manager credentials missing');

        const rowName = `QA-Forbidden-${Date.now()}`;
        const result = await restRequest(managerToken, {
            method: 'POST',
            path: 'kpi_definitions',
            body: {
                name: rowName,
                description: 'QA negative-path test',
                category: '__QA_UNAUTHORIZED_POSITION__',
                target: 1,
                unit: 'Count',
                effective_period: '2030-01',
                approval_status: 'approved',
            },
        });

        if (result.ok) {
            const superToken = await maybeGetToken('superadmin', tokens);
            if (superToken) {
                await restRequest(superToken, {
                    method: 'DELETE',
                    path: `kpi_definitions?name=eq.${encodeURIComponent(rowName)}`,
                    prefer: 'return=minimal',
                });
            }
            throw new Error('manager was able to insert forbidden KPI category');
        }

        assertDenied(result, 'manager forbidden kpi definition insert');
    });

    await execute('Superadmin can read app_settings', async () => {
        const token = await maybeGetToken('superadmin', tokens);
        if (!token) throw new Error('SKIP: superadmin credentials missing');
        const result = await restRequest(token, {
            method: 'GET',
            path: 'app_settings?select=key&limit=1',
            prefer: '',
        });
        assertSuccess(result, 'superadmin app_settings read');
    });

    await execute('Superadmin can read KPI definitions', async () => {
        const token = await maybeGetToken('superadmin', tokens);
        if (!token) throw new Error('SKIP: superadmin credentials missing');
        const result = await restRequest(token, {
            method: 'GET',
            path: 'kpi_definitions?select=id,name,category&limit=1',
            prefer: '',
        });
        assertSuccess(result, 'superadmin kpi_definitions read');
    });

    console.log('=== RLS Negative-Path Results ===');
    results.forEach(row => {
        const msg = row.message ? ` | ${row.message}` : '';
        console.log(`${row.status} - ${row.name}${msg}`);
    });

    const failed = results.filter(r => r.status === 'FAIL' && !String(r.message || '').startsWith('SKIP:'));
    const executed = results.filter(r => !String(r.message || '').startsWith('SKIP:'));

    console.log(`\nexecuted_checks: ${executed.length}`);
    console.log(`failed_checks: ${failed.length}`);

    if (failed.length > 0) {
        process.exit(1);
    }

    if (executed.length === 0) {
        console.log('No runtime checks executed (all skipped due to missing role credentials).');
    }
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
