import crypto from 'node:crypto';

function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildFilterParams(filters = {}) {
    const params = new URLSearchParams();
    for (const [column, filter] of Object.entries(filters || {})) {
        if (!filter) continue;
        if (filter.type === 'eq') {
            params.set(column, `eq.${filter.value}`);
        }
    }
    return params;
}

function getMutationConfig() {
    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    return {
        supabaseUrl,
        serviceRoleKey,
        hasConfig: Boolean(supabaseUrl && serviceRoleKey),
    };
}

export function resolveTnaMutationSource() {
    const configured = String(process.env.TNA_MUTATION_SOURCE || 'auto').trim().toLowerCase();
    const source = ['legacy', 'supabase', 'auto'].includes(configured) ? configured : 'auto';
    const config = getMutationConfig();

    if (source === 'supabase' && !config.hasConfig) {
        throw new Error('TNA_MUTATION_SOURCE is set to supabase but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is missing.');
    }
    if (source === 'legacy') {
        return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
    }
    if (source === 'supabase') {
        return { source: 'supabase', supabaseUrl: config.supabaseUrl, serviceRoleKey: config.serviceRoleKey };
    }
    if (config.hasConfig) {
        return { source: 'supabase', supabaseUrl: config.supabaseUrl, serviceRoleKey: config.serviceRoleKey };
    }
    return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
}

async function callSupabase({
    supabaseUrl,
    serviceRoleKey,
    table,
    method = 'GET',
    select = '',
    filters = {},
    order = '',
    limit = null,
    body = null,
    prefer = '',
}) {
    const params = buildFilterParams(filters);
    if (select) {
        params.set('select', select);
    }
    if (order) {
        params.set('order', order);
    }
    if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
        params.set('limit', String(Number(limit)));
    }

    const query = params.toString();
    const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
    };
    if (prefer) {
        headers.Prefer = prefer;
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Supabase ${table} ${method} failed (${response.status}): ${details}`);
    }

    if (method === 'PATCH' || method === 'POST' || method === 'DELETE') {
        const text = await response.text().catch(() => '');
        if (!text) return [];
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [];
        }
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
        throw new Error(`Supabase ${table} ${method} returned non-array payload.`);
    }
    return payload;
}

function mapSupabaseError(error) {
    const message = String(error?.message || error || '');
    if (message.includes('23505') || message.toLowerCase().includes('duplicate key')) {
        return { status: 409, message: 'Duplicate entry' };
    }
    return { status: 500, message };
}

// ==================================================
// TNA PLAN CREATE
// ==================================================

export async function createTrainingPlanInSupabase({
    employeeId,
    planName,
    period,
    items = [],
    actorUser,
    idFactory,
}) {
    const { source, supabaseUrl, serviceRoleKey } = resolveTnaMutationSource();
    if (source !== 'supabase') {
        throw new Error('createTrainingPlanInSupabase called when TNA mutation source is not supabase.');
    }

    const actorRole = String(actorUser?.role || '').toLowerCase();
    if (!['superadmin', 'hr', 'manager'].includes(actorRole)) {
        return { error: { status: 403, message: 'Access denied. HR or superadmin role required.' } };
    }

    if (!employeeId || !planName || !period) {
        return { error: { status: 400, message: 'Employee ID, plan name, and period are required' } };
    }

    const planId = typeof idFactory === 'function' ? idFactory() : crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Insert plan
    await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'training_plans',
        method: 'POST',
        body: {
            id: planId,
            employee_id: employeeId,
            plan_name: planName,
            period,
            status: 'draft',
            created_by: actorUser.employee_id,
        },
        prefer: 'return=minimal',
    });

    // Insert items if provided
    const savedItems = [];
    for (const item of items || []) {
        const trainingCourse = String(item.training_course || item.course_name || '').trim();
        if (!trainingCourse) continue;

        const itemId = typeof idFactory === 'function' ? idFactory() : crypto.randomUUID();
        await callSupabase({
            supabaseUrl,
            serviceRoleKey,
            table: 'training_plan_items',
            method: 'POST',
            body: {
                id: itemId,
                plan_id: planId,
                training_need_record_id: item.training_need_record_id || null,
                course_id: item.course_id || null,
                training_course: trainingCourse,
                training_provider: item.training_provider || null,
                start_date: item.start_date || null,
                end_date: item.end_date || null,
                cost: Number(item.cost || 0),
                status: 'planned',
            },
            prefer: 'return=minimal',
        });
        savedItems.push({ id: itemId, training_course: trainingCourse });
    }

    // Fetch created plan
    const plans = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'training_plans',
        method: 'GET',
        select: '*',
        filters: { id: { type: 'eq', value: planId } },
        limit: 1,
    });

    // Fetch items
    const itemsRows = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'training_plan_items',
        method: 'GET',
        select: '*',
        filters: { plan_id: { type: 'eq', value: planId } },
        order: 'created_at.asc',
        limit: 200,
    });

    return {
        success: true,
        plan: {
            ...plans[0],
            items: itemsRows || [],
        },
    };
}

// ==================================================
// TNA ENROLLMENT ENROLL
// ==================================================

export async function enrollInTrainingInSupabase({
    employeeId,
    courseId,
    actorUser,
    idFactory,
}) {
    const { source, supabaseUrl, serviceRoleKey } = resolveTnaMutationSource();
    if (source !== 'supabase') {
        throw new Error('enrollInTrainingInSupabase called when TNA mutation source is not supabase.');
    }

    const actorRole = String(actorUser?.role || '').toLowerCase();
    if (!['superadmin', 'hr', 'manager'].includes(actorRole)) {
        return { error: { status: 403, message: 'Access denied. HR or superadmin role required.' } };
    }

    if (!employeeId || !courseId) {
        return { error: { status: 400, message: 'Employee ID and Course ID are required' } };
    }

    // Check for existing enrollment
    const existing = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'training_enrollments',
        method: 'GET',
        select: '*',
        filters: {
            employee_id: { type: 'eq', value: employeeId },
            course_id: { type: 'eq', value: courseId },
        },
        limit: 1,
    });

    if (existing[0]) {
        return {
            success: true,
            enrollment: existing[0],
        };
    }

    const id = typeof idFactory === 'function' ? idFactory() : crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    try {
        await callSupabase({
            supabaseUrl,
            serviceRoleKey,
            table: 'training_enrollments',
            method: 'POST',
            body: {
                id,
                employee_id: employeeId,
                course_id: courseId,
                enrollment_date: today,
                status: 'enrolled',
            },
            prefer: 'return=minimal',
        });
    } catch (error) {
        const mapped = mapSupabaseError(error);
        return { error: { status: mapped.status, message: mapped.message } };
    }

    // Fetch created enrollment
    const enrollments = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'training_enrollments',
        method: 'GET',
        select: '*',
        filters: { id: { type: 'eq', value: id } },
        limit: 1,
    });

    return {
        success: true,
        enrollment: enrollments[0] || {
            id,
            employee_id: employeeId,
            course_id: courseId,
            enrollment_date: today,
            status: 'enrolled',
        },
    };
}