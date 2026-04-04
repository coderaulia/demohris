function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function parseJsonObject(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function parseJsonArray(value, fallback = []) {
    const parsed = parseJsonObject(value, fallback);
    return Array.isArray(parsed) ? parsed : fallback;
}

export function normalizeModuleSettingsRow(row = {}) {
    return {
        ...row,
        is_enabled: Boolean(row.is_enabled),
        settings: parseJsonObject(row.settings, {}),
        dependencies: parseJsonArray(row.dependencies, []),
    };
}

export function resolveModulesReadSource() {
    const configured = String(process.env.MODULES_READ_SOURCE || 'auto').trim().toLowerCase();
    const source = ['legacy', 'supabase', 'auto'].includes(configured) ? configured : 'auto';

    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const hasSupabaseConfig = Boolean(supabaseUrl && serviceRoleKey);

    if (source === 'supabase' && !hasSupabaseConfig) {
        throw new Error('MODULES_READ_SOURCE is set to supabase but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is missing.');
    }

    if (source === 'legacy') return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
    if (source === 'supabase') return { source: 'supabase', supabaseUrl, serviceRoleKey };
    if (hasSupabaseConfig) return { source: 'supabase', supabaseUrl, serviceRoleKey };
    return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
}

export async function fetchModuleSettingsFromSupabase({
    moduleId = '',
    category = '',
    onlyActive = false,
    orderBy = 'category.asc,module_name.asc',
} = {}) {
    const { source, supabaseUrl, serviceRoleKey } = resolveModulesReadSource();
    if (source !== 'supabase') {
        return null;
    }

    const params = new URLSearchParams();
    params.set('select', 'module_id,module_name,description,category,status,is_enabled,settings,version,dependencies,created_at,updated_at,created_by');
    params.set('order', orderBy);

    if (moduleId) {
        params.set('module_id', `eq.${moduleId}`);
    }
    if (category) {
        params.set('category', `eq.${category}`);
    }
    if (onlyActive) {
        params.set('is_enabled', 'eq.true');
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/module_settings?${params.toString()}`, {
        method: 'GET',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Supabase module_settings read failed (${response.status}): ${details}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
        throw new Error('Supabase module_settings read returned non-array payload.');
    }

    return rows.map(normalizeModuleSettingsRow);
}

