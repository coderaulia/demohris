import crypto from 'node:crypto';

function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function getSupabaseAdminConfig() {
    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceRoleKey) {
        const error = new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
        error.status = 500;
        error.code = 'SUPABASE_CONFIG_MISSING';
        throw error;
    }
    return { supabaseUrl, serviceRoleKey };
}

function buildFilterParams(filters = {}) {
    const params = new URLSearchParams();
    for (const [column, filter] of Object.entries(filters || {})) {
        if (!filter || filter.value === undefined || filter.value === null || filter.value === '') continue;
        if (filter.type === 'eq') {
            params.set(column, `eq.${filter.value}`);
            continue;
        }
        if (filter.type === 'in' && Array.isArray(filter.value) && filter.value.length > 0) {
            params.set(column, `in.(${filter.value.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')})`);
            continue;
        }
        if (filter.type === 'ilike') {
            params.set(column, `ilike.${filter.value}`);
        }
    }
    return params;
}

async function parseResponse(response) {
    const text = await response.text().catch(() => '');
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [{ raw: text }];
    }
}

function mapSupabaseError(message, status = 500) {
    const normalized = String(message || '').toLowerCase();
    if (status === 401 || status === 403) {
        return { status, code: 'FORBIDDEN', message: 'Supabase request was not authorized.' };
    }
    if (status === 404) {
        return { status, code: 'NOT_FOUND', message: 'Requested record was not found.' };
    }
    if (status === 409 || normalized.includes('duplicate key') || normalized.includes('already registered') || normalized.includes('already exists') || normalized.includes('23505')) {
        return { status: 409, code: 'DUPLICATE', message: 'A record with this value already exists.' };
    }
    return { status, code: 'SUPABASE_REQUEST_FAILED', message: String(message || 'Supabase request failed.') };
}

export async function supabaseTableRequest({
    table,
    method = 'GET',
    select = '',
    filters = {},
    order = '',
    limit = null,
    offset = null,
    body = null,
    prefer = '',
    extraParams = {},
}) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
    const params = buildFilterParams(filters);
    if (select) params.set('select', select);
    if (order) params.set('order', order);
    if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
        params.set('limit', String(Number(limit)));
    }
    if (Number.isFinite(Number(offset)) && Number(offset) >= 0) {
        params.set('offset', String(Number(offset)));
    }
    for (const [key, value] of Object.entries(extraParams || {})) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }

    const query = params.toString();
    const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
    };
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        const mapped = mapSupabaseError(details, response.status);
        const error = new Error(mapped.message);
        error.status = mapped.status;
        error.code = mapped.code;
        error.details = details;
        throw error;
    }

    if (method === 'DELETE') {
        return [];
    }

    if (method === 'POST' || method === 'PATCH') {
        return parseResponse(response);
    }

    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload : [];
}

function authHeaders(serviceRoleKey) {
    return {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
    };
}

export function generateTemporaryPassword() {
    return `Tmp-${crypto.randomUUID()}-Aa1!`;
}

export async function createSupabaseAuthUser({ email, password, role, employeeId, name }) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: authHeaders(serviceRoleKey),
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            app_metadata: { role },
            user_metadata: { employee_id: employeeId, name },
        }),
    });

    const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
    if (!response.ok) {
        const mapped = mapSupabaseError(JSON.stringify(payload), response.status);
        const error = new Error(mapped.message);
        error.status = mapped.status;
        error.code = mapped.code;
        error.details = payload;
        throw error;
    }

    return payload?.user || payload;
}

export async function updateSupabaseAuthUser(userId, { email, role, employeeId, name }) {
    if (!userId) return null;
    const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: authHeaders(serviceRoleKey),
        body: JSON.stringify({
            email,
            email_confirm: true,
            app_metadata: role ? { role } : undefined,
            user_metadata: {
                ...(employeeId ? { employee_id: employeeId } : {}),
                ...(name ? { name } : {}),
            },
        }),
    });

    const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
    if (!response.ok) {
        const mapped = mapSupabaseError(JSON.stringify(payload), response.status);
        const error = new Error(mapped.message);
        error.status = mapped.status;
        error.code = mapped.code;
        error.details = payload;
        throw error;
    }

    return payload?.user || payload;
}

export async function deleteSupabaseAuthUser(userId) {
    if (!userId) return;
    const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: authHeaders(serviceRoleKey),
    });
    if (!response.ok && response.status !== 404) {
        const details = await response.text().catch(() => '');
        const mapped = mapSupabaseError(details, response.status);
        const error = new Error(mapped.message);
        error.status = mapped.status;
        error.code = mapped.code;
        error.details = details;
        throw error;
    }
}

export async function upsertSupabaseProfile({ userId, email, role, employeeId, name, department, position }) {
    const rows = await supabaseTableRequest({
        table: 'profiles',
        method: 'POST',
        body: [{
            id: userId,
            email,
            role,
            metadata: {
                employee_id: employeeId,
                name,
                department: department || null,
                position: position || null,
                source: 'employees-module',
                synced_at: new Date().toISOString(),
            },
        }],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0] || null;
}
