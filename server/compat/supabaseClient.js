import { createRemoteJWKSet, jwtVerify } from 'jose';

let cachedJwksUrl = '';
let cachedJwks = null;

function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function getSupabaseConfig() {
    const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const issuer = url ? `${url}/auth/v1` : '';
    const jwksUrl = url ? `${issuer}/.well-known/jwks.json` : '';
    const audienceRaw = String(process.env.SUPABASE_JWT_AUDIENCE || '').trim();
    const audiences = audienceRaw
        ? audienceRaw.split(',').map(item => item.trim()).filter(Boolean)
        : [];

    return {
        url,
        issuer,
        jwksUrl,
        audiences,
    };
}

function getJwks(jwksUrl) {
    if (!jwksUrl) return null;
    if (cachedJwks && cachedJwksUrl === jwksUrl) return cachedJwks;
    cachedJwksUrl = jwksUrl;
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    return cachedJwks;
}

export function isSupabaseJwtEnabled() {
    return Boolean(getSupabaseConfig().url);
}

export async function verifySupabaseJwt(token) {
    const rawToken = String(token || '').trim();
    if (!rawToken) return null;

    const { issuer, jwksUrl, audiences } = getSupabaseConfig();
    const jwks = getJwks(jwksUrl);
    if (!issuer || !jwks) return null;

    const verifyOptions = { issuer };
    if (audiences.length === 1) {
        verifyOptions.audience = audiences[0];
    } else if (audiences.length > 1) {
        verifyOptions.audience = audiences;
    }

    try {
        const { payload } = await jwtVerify(rawToken, jwks, verifyOptions);
        return payload;
    } catch {
        return null;
    }
}

function mapRole(rawRole) {
    const normalized = String(rawRole || '').trim().toLowerCase();
    if (['employee', 'manager', 'director', 'hr', 'superadmin'].includes(normalized)) {
        return normalized;
    }
    return 'employee';
}

export async function syncSupabaseProfileFromEmployee({
    claims = {},
    employee = {},
}) {
    const { url } = getSupabaseConfig();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !serviceRoleKey) {
        return { status: 'skipped', reason: 'missing_supabase_service_role' };
    }

    const id = String(claims?.sub || '').trim();
    if (!id) {
        return { status: 'skipped', reason: 'missing_sub_claim' };
    }

    const email = String(claims?.email || employee?.auth_email || '').trim().toLowerCase();
    const role = mapRole(employee?.role || claims?.role);
    const metadata = {
        employee_id: employee?.employee_id || '',
        source: 'dual-auth-bridge',
        synced_at: new Date().toISOString(),
    };

    const payload = [{ id, email, role, metadata }];
    const response = await fetch(`${url}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const message = await response.text().catch(() => '');
        return {
            status: 'error',
            reason: 'upsert_failed',
            details: message,
        };
    }

    return { status: 'ok' };
}
