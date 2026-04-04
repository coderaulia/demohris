function normalizeRole(rawRole) {
    return String(rawRole || '').trim().toLowerCase();
}

export function roleFromJwtClaims(claims = {}) {
    const direct = normalizeRole(claims?.role);
    if (direct) return direct;

    const appMetaRole = normalizeRole(claims?.app_metadata?.role || claims?.raw_app_meta_data?.role);
    if (appMetaRole) return appMetaRole;

    const userMetaRole = normalizeRole(claims?.user_metadata?.role || claims?.raw_user_meta_data?.role);
    if (userMetaRole) return userMetaRole;

    return '';
}

export function resolveEffectiveModulesRole({ currentUser = null, claims = null } = {}) {
    const fromUser = normalizeRole(currentUser?.role);
    if (fromUser) return fromUser;
    return roleFromJwtClaims(claims || {});
}

export function validateModulesActionAccess({
    action = '',
    effectiveRole = '',
    currentUser = null,
} = {}) {
    const writeActions = new Set(['update', 'toggle', 'activity']);

    if (!effectiveRole) {
        return {
            ok: false,
            status: 401,
            code: 'AUTH_REQUIRED',
            message: 'Authentication required.',
        };
    }

    if (!['superadmin', 'hr'].includes(effectiveRole)) {
        return {
            ok: false,
            status: 403,
            code: 'ACCESS_DENIED',
            message: 'Access denied. Superadmin or HR role required.',
        };
    }

    if (writeActions.has(action) && !currentUser?.employee_id) {
        return {
            ok: false,
            status: 403,
            code: 'AUTH_CONTEXT_INCOMPLETE',
            message: 'Write action requires employee-mapped auth context.',
        };
    }

    return { ok: true };
}

