function extractBearerToken(authHeader = '') {
    const raw = String(authHeader || '').trim();
    if (!raw) return '';
    const match = raw.match(/^Bearer\s+(.+)$/i);
    return match ? String(match[1] || '').trim() : '';
}

function applyAuthContext(req, {
    source = 'anonymous',
    user = null,
    claims = null,
    tokenPresent = false,
}) {
    req.authContext = {
        source,
        tokenPresent: Boolean(tokenPresent),
        claims: claims || null,
        userId: user?.employee_id || null,
    };
    req.user = user || null;
    req.currentUser = user || null;
    req.currentUserLoaded = true;
}

export function createDualAuthBridgeMiddleware({
    resolveSessionUser,
    resolveJwtUser,
    verifyJwt,
}) {
    if (typeof resolveSessionUser !== 'function') {
        throw new Error('resolveSessionUser must be a function');
    }
    if (typeof resolveJwtUser !== 'function') {
        throw new Error('resolveJwtUser must be a function');
    }
    if (typeof verifyJwt !== 'function') {
        throw new Error('verifyJwt must be a function');
    }

    return async function dualAuthBridge(req, _res, next) {
        try {
            const sessionUserId = req.session?.userId || null;
            if (sessionUserId) {
                const sessionUser = await resolveSessionUser(sessionUserId, req);
                if (sessionUser) {
                    applyAuthContext(req, { source: 'legacy-session', user: sessionUser });
                    return next();
                }

                if (req.session) {
                    req.session.userId = null;
                }
            }

            const bearerToken = extractBearerToken(req.headers?.authorization || '');
            if (bearerToken) {
                const claims = await verifyJwt(bearerToken, req);
                if (claims) {
                    const jwtUser = await resolveJwtUser(claims, req);
                    if (jwtUser) {
                        applyAuthContext(req, {
                            source: 'supabase-jwt',
                            user: jwtUser,
                            claims,
                            tokenPresent: true,
                        });
                        return next();
                    }
                }

                applyAuthContext(req, {
                    source: 'anonymous',
                    user: null,
                    claims: claims || null,
                    tokenPresent: true,
                });
                return next();
            }

            applyAuthContext(req, { source: 'anonymous', user: null, claims: null });
            return next();
        } catch (error) {
            return next(error);
        }
    };
}
