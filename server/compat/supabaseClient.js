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

