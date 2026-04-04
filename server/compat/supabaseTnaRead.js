function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function toInFilter(values = []) {
    return `in.(${values.map(value => `"${String(value).replaceAll('"', '\\"')}"`).join(',')})`;
}

export function resolveTnaReadSource() {
    const configured = String(process.env.TNA_READ_SOURCE || 'auto').trim().toLowerCase();
    const source = ['legacy', 'supabase', 'auto'].includes(configured) ? configured : 'auto';

    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const hasSupabaseConfig = Boolean(supabaseUrl && serviceRoleKey);

    if (source === 'supabase' && !hasSupabaseConfig) {
        throw new Error('TNA_READ_SOURCE is set to supabase but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is missing.');
    }

    if (source === 'legacy') return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
    if (source === 'supabase') return { source: 'supabase', supabaseUrl, serviceRoleKey };
    if (hasSupabaseConfig) return { source: 'supabase', supabaseUrl, serviceRoleKey };
    return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
}

async function fetchSupabaseCount({ table, filters = {} }) {
    const { source, supabaseUrl, serviceRoleKey } = resolveTnaReadSource();
    if (source !== 'supabase') {
        return null;
    }

    const params = new URLSearchParams();
    params.set('select', 'id');
    params.set('limit', '1');

    for (const [column, filter] of Object.entries(filters || {})) {
        if (!filter) continue;
        if (filter.type === 'eq') {
            params.set(column, `eq.${filter.value}`);
            continue;
        }
        if (filter.type === 'in') {
            if (!Array.isArray(filter.values) || filter.values.length === 0) continue;
            params.set(column, toInFilter(filter.values));
        }
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
        method: 'GET',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
        },
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Supabase ${table} count failed (${response.status}): ${details}`);
    }

    const contentRange = String(response.headers.get('content-range') || '').trim();
    const match = contentRange.match(/\/(\d+)$/);
    if (match) {
        return Number.parseInt(match[1], 10) || 0;
    }

    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload.length : 0;
}

export async function fetchTnaSummaryFromSupabase() {
    const [
        totalNeeds,
        completedNeeds,
        activePlans,
        totalEnrollments,
        completedEnrollments,
        criticalGaps,
        highGaps,
    ] = await Promise.all([
        fetchSupabaseCount({ table: 'training_need_records' }),
        fetchSupabaseCount({
            table: 'training_need_records',
            filters: {
                status: { type: 'eq', value: 'completed' },
            },
        }),
        fetchSupabaseCount({
            table: 'training_plans',
            filters: {
                status: { type: 'in', values: ['approved', 'in_progress'] },
            },
        }),
        fetchSupabaseCount({ table: 'training_enrollments' }),
        fetchSupabaseCount({
            table: 'training_enrollments',
            filters: {
                status: { type: 'eq', value: 'completed' },
            },
        }),
        fetchSupabaseCount({
            table: 'training_need_records',
            filters: {
                priority: { type: 'eq', value: 'critical' },
            },
        }),
        fetchSupabaseCount({
            table: 'training_need_records',
            filters: {
                priority: { type: 'eq', value: 'high' },
            },
        }),
    ]);

    return {
        total_needs_identified: Number(totalNeeds || 0),
        needs_completed: Number(completedNeeds || 0),
        active_plans: Number(activePlans || 0),
        total_enrollments: Number(totalEnrollments || 0),
        enrollments_completed: Number(completedEnrollments || 0),
        critical_gaps: Number(criticalGaps || 0),
        high_gaps: Number(highGaps || 0),
    };
}
