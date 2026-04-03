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

async function backendRequest({ baseUrl, action, method = 'POST', body = {}, jwt = '', cookie = '' }) {
    const headers = { 'Content-Type': 'application/json' };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(`${baseUrl}/api?action=${encodeURIComponent(action)}`, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    const payload = await parseJsonSafe(response);
    return { status: response.status, payload, setCookie: response.headers.get('set-cookie') || '' };
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function main() {
    const supabaseUrl = required('SUPABASE_URL');
    const supabaseAnonKey = required('SUPABASE_ANON_KEY');
    const backendBaseUrl = env('BACKEND_BASE_URL', 'http://127.0.0.1:3000');
    const testEmail = required('SUPABASE_TEST_EMAIL');
    const supabasePassword = required('SUPABASE_TEST_PASSWORD');
    const legacyPassword = env('LEGACY_TEST_PASSWORD', supabasePassword);
    const expiredJwt = env('SUPABASE_EXPIRED_JWT');
    const unmappedEmail = env('SUPABASE_UNMAPPED_TEST_EMAIL');
    const unmappedPassword = env('SUPABASE_UNMAPPED_TEST_PASSWORD');

    console.log('== Supabase auth staging validation ==');
    console.log(`Backend base URL: ${backendBaseUrl}`);
    console.log(`Supabase URL: ${supabaseUrl}`);

    const supabaseSession = await signInSupabase({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        email: testEmail,
        password: supabasePassword,
    });
    const jwt = String(supabaseSession.access_token || '').trim();
    assert(jwt, 'Supabase access_token is missing');

    const jwtSession = await backendRequest({
        baseUrl: backendBaseUrl,
        action: 'auth/session',
        method: 'GET',
        jwt,
    });
    assert(jwtSession.status === 200, `JWT auth/session failed with status ${jwtSession.status}`);
    assert(jwtSession.payload?.profile?.employee_id, 'JWT auth/session did not resolve employee profile');

    const legacyLogin = await backendRequest({
        baseUrl: backendBaseUrl,
        action: 'auth/login',
        body: { email: testEmail, password: legacyPassword },
    });
    assert(legacyLogin.status === 200, `Legacy auth/login failed with status ${legacyLogin.status}`);
    const cookie = legacyLogin.setCookie.split(';')[0];
    assert(cookie, 'Legacy login did not return session cookie');

    const legacySession = await backendRequest({
        baseUrl: backendBaseUrl,
        action: 'auth/session',
        method: 'GET',
        cookie,
    });
    assert(legacySession.status === 200, `Legacy auth/session failed with status ${legacySession.status}`);
    assert(legacySession.payload?.profile?.employee_id, 'Legacy auth/session did not resolve employee profile');

    const jwtProfile = jwtSession.payload.profile;
    const legacyProfile = legacySession.payload.profile;

    assert(jwtProfile.employee_id === legacyProfile.employee_id, 'Auth parity failed: employee_id differs');
    assert(String(jwtProfile.role || '') === String(legacyProfile.role || ''), 'Auth parity failed: role differs');

    const protectedActions = [
        { action: 'lms/dashboard/stats', body: {} },
        { action: 'tna/summary', body: {} },
    ];

    for (const entry of protectedActions) {
        const viaJwt = await backendRequest({
            baseUrl: backendBaseUrl,
            action: entry.action,
            body: entry.body,
            jwt,
        });
        const viaSession = await backendRequest({
            baseUrl: backendBaseUrl,
            action: entry.action,
            body: entry.body,
            cookie,
        });
        assert(
            viaJwt.status === viaSession.status,
            `Permission parity failed for ${entry.action}: jwt=${viaJwt.status}, session=${viaSession.status}`
        );
    }

    const invalidJwtResp = await backendRequest({
        baseUrl: backendBaseUrl,
        action: 'lms/dashboard/stats',
        body: {},
        jwt: 'invalid.jwt.token',
    });
    assert(
        invalidJwtResp.status === 401 || invalidJwtResp.status === 403,
        `Invalid JWT should be rejected, got ${invalidJwtResp.status}`
    );

    if (expiredJwt) {
        const expiredJwtResp = await backendRequest({
            baseUrl: backendBaseUrl,
            action: 'lms/dashboard/stats',
            body: {},
            jwt: expiredJwt,
        });
        assert(
            expiredJwtResp.status === 401 || expiredJwtResp.status === 403,
            `Expired JWT should be rejected, got ${expiredJwtResp.status}`
        );
    } else {
        console.log('Skipped expired JWT test (SUPABASE_EXPIRED_JWT not set).');
    }

    if (unmappedEmail && unmappedPassword) {
        const unmappedSession = await signInSupabase({
            supabaseUrl,
            anonKey: supabaseAnonKey,
            email: unmappedEmail,
            password: unmappedPassword,
        });
        const unmappedJwt = String(unmappedSession.access_token || '').trim();
        const unmappedResp = await backendRequest({
            baseUrl: backendBaseUrl,
            action: 'lms/dashboard/stats',
            body: {},
            jwt: unmappedJwt,
        });
        assert(
            unmappedResp.status === 401 || unmappedResp.status === 403,
            `Unmapped JWT user should not access protected domain, got ${unmappedResp.status}`
        );
    } else {
        console.log('Skipped unmapped-user test (SUPABASE_UNMAPPED_TEST_EMAIL/PASSWORD not set).');
    }

    console.log('\nAuth parity and JWT bridge checks passed.');
    console.log(`- employee_id: ${jwtProfile.employee_id}`);
    console.log(`- role: ${jwtProfile.role}`);
}

main().catch(error => {
    console.error('\nAuth staging validation failed:', error.message);
    process.exit(1);
});

