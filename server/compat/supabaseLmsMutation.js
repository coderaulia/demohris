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

export function resolveLmsMutationSource() {
    const configured = String(process.env.LMS_MUTATION_SOURCE || 'auto').trim().toLowerCase();
    const source = ['legacy', 'supabase', 'auto'].includes(configured) ? configured : 'auto';
    const config = getMutationConfig();

    if (source === 'supabase' && !config.hasConfig) {
        throw new Error('LMS_MUTATION_SOURCE is set to supabase but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is missing.');
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

    if (method === 'PATCH' || method === 'POST') {
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

async function findFirstLessonIdForCourse({ supabaseUrl, serviceRoleKey, courseId }) {
    const sections = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'course_sections',
        method: 'GET',
        select: 'id,ordinal',
        filters: {
            course_id: { type: 'eq', value: courseId },
        },
        order: 'ordinal.asc',
        limit: 200,
    });

    for (const section of sections || []) {
        const sectionId = String(section?.id || '').trim();
        if (!sectionId) continue;
        const lessons = await callSupabase({
            supabaseUrl,
            serviceRoleKey,
            table: 'lessons',
            method: 'GET',
            select: 'id,ordinal',
            filters: {
                section_id: { type: 'eq', value: sectionId },
            },
            order: 'ordinal.asc',
            limit: 1,
        });
        if (lessons[0]?.id) {
            return String(lessons[0].id);
        }
    }

    return '';
}

export async function startCourseEnrollmentInSupabase({
    courseId,
    employeeId,
    idFactory,
}) {
    const { source, supabaseUrl, serviceRoleKey } = resolveLmsMutationSource();
    if (source !== 'supabase') {
        throw new Error('startCourseEnrollmentInSupabase called when LMS mutation source is not supabase.');
    }

    const enrollments = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'course_enrollments',
        method: 'GET',
        select: '*',
        filters: {
            course_id: { type: 'eq', value: courseId },
            employee_id: { type: 'eq', value: employeeId },
        },
        limit: 1,
    });

    const enrollment = enrollments[0] || null;
    if (!enrollment) {
        return { error: { status: 404, message: 'Not enrolled in this course' } };
    }
    if (String(enrollment.status || '').toLowerCase() === 'completed') {
        return { error: { status: 400, message: 'Course already completed' } };
    }

    const nowIso = new Date().toISOString();
    const startedAt = enrollment.started_at || nowIso;

    await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'course_enrollments',
        method: 'PATCH',
        filters: {
            id: { type: 'eq', value: enrollment.id },
        },
        body: {
            status: 'in_progress',
            started_at: startedAt,
            last_accessed_at: nowIso,
        },
        prefer: 'return=representation',
    });

    const firstLessonId = await findFirstLessonIdForCourse({ supabaseUrl, serviceRoleKey, courseId });
    if (firstLessonId) {
        const existingProgress = await callSupabase({
            supabaseUrl,
            serviceRoleKey,
            table: 'lesson_progress',
            method: 'GET',
            select: 'id',
            filters: {
                enrollment_id: { type: 'eq', value: enrollment.id },
                lesson_id: { type: 'eq', value: firstLessonId },
            },
            limit: 1,
        });

        if (!existingProgress[0]) {
            const progressId = typeof idFactory === 'function' ? idFactory() : crypto.randomUUID();
            await callSupabase({
                supabaseUrl,
                serviceRoleKey,
                table: 'lesson_progress',
                method: 'POST',
                body: {
                    id: progressId,
                    enrollment_id: enrollment.id,
                    lesson_id: firstLessonId,
                    status: 'not_started',
                    first_accessed_at: nowIso,
                    last_accessed_at: nowIso,
                },
                prefer: 'return=minimal',
            });
        }
    }

    const updatedRows = await callSupabase({
        supabaseUrl,
        serviceRoleKey,
        table: 'course_enrollments',
        method: 'GET',
        select: '*',
        filters: {
            id: { type: 'eq', value: enrollment.id },
        },
        limit: 1,
    });

    return { enrollment: updatedRows[0] || enrollment };
}
