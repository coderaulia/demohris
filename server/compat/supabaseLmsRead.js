function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function parseJsonObject(value, fallback = null) {
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

function parseEnrollmentRow(row = {}) {
    return {
        ...row,
    };
}

function parseLessonProgressRow(row = {}) {
    return {
        ...row,
        options: parseJsonArray(row.options, []),
        correct_answer: parseJsonObject(row.correct_answer, {}),
        answers: parseJsonObject(row.answers, {}),
        attachment_urls: parseJsonArray(row.attachment_urls, []),
    };
}

function toInFilter(values = []) {
    return `in.(${values.map(value => `"${String(value).replaceAll('"', '\\"')}"`).join(',')})`;
}

export function resolveLmsReadSource() {
    const configured = String(process.env.LMS_READ_SOURCE || 'auto').trim().toLowerCase();
    const source = ['legacy', 'supabase', 'auto'].includes(configured) ? configured : 'auto';

    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const hasSupabaseConfig = Boolean(supabaseUrl && serviceRoleKey);

    if (source === 'supabase' && !hasSupabaseConfig) {
        throw new Error('LMS_READ_SOURCE is set to supabase but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is missing.');
    }

    if (source === 'legacy') return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
    if (source === 'supabase') return { source: 'supabase', supabaseUrl, serviceRoleKey };
    if (hasSupabaseConfig) return { source: 'supabase', supabaseUrl, serviceRoleKey };
    return { source: 'legacy', supabaseUrl: '', serviceRoleKey: '' };
}

async function fetchSupabaseRows({
    table,
    select = '*',
    filters = {},
    order = '',
    limit = null,
    offset = null,
}) {
    const { source, supabaseUrl, serviceRoleKey } = resolveLmsReadSource();
    if (source !== 'supabase') {
        return null;
    }

    const params = new URLSearchParams();
    params.set('select', select);
    if (order) {
        params.set('order', order);
    }
    if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
        params.set('limit', String(Number(limit)));
    }
    if (Number.isFinite(Number(offset)) && Number(offset) >= 0) {
        params.set('offset', String(Number(offset)));
    }

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
        },
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Supabase ${table} read failed (${response.status}): ${details}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
        throw new Error(`Supabase ${table} read returned non-array payload.`);
    }

    return payload;
}

async function fetchEmployeesByIds(employeeIds = []) {
    if (!employeeIds.length) return new Map();
    const rows = await fetchSupabaseRows({
        table: 'employees',
        select: 'employee_id,name,department,position',
        filters: {
            employee_id: { type: 'in', values: employeeIds },
        },
    });
    const map = new Map();
    for (const row of rows || []) {
        map.set(String(row.employee_id), row);
    }
    return map;
}

async function fetchCoursesByIds(courseIds = []) {
    if (!courseIds.length) return new Map();
    const rows = await fetchSupabaseRows({
        table: 'courses',
        select: 'id,title,description,category,thumbnail_url,estimated_duration_minutes,difficulty_level',
        filters: {
            id: { type: 'in', values: courseIds },
        },
    });
    const map = new Map();
    for (const row of rows || []) {
        map.set(String(row.id), row);
    }
    return map;
}

function decorateEnrollmentRows(rows = [], employeeMap = new Map(), courseMap = new Map()) {
    return rows.map(rawRow => {
        const row = parseEnrollmentRow(rawRow);
        const employee = employeeMap.get(String(row.employee_id)) || {};
        const course = courseMap.get(String(row.course_id)) || {};
        return {
            ...row,
            employee_name: employee.name || null,
            department: employee.department || null,
            position: employee.position || null,
            course_title: course.title || null,
            title: course.title || null,
            description: course.description || null,
            category: course.category || null,
            thumbnail_url: course.thumbnail_url || null,
            estimated_duration_minutes: course.estimated_duration_minutes ?? null,
            difficulty_level: course.difficulty_level || null,
        };
    });
}

export async function fetchLmsEnrollmentsFromSupabase({
    courseId = '',
    status = '',
    employeeId = '',
    page = 1,
    limit = 20,
    orderBy = '',
}) {
    const pageSafe = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitSafe = Math.max(1, Number.parseInt(limit, 10) || 20);
    const offset = (pageSafe - 1) * limitSafe;

    const rows = await fetchSupabaseRows({
        table: 'course_enrollments',
        select: '*',
        filters: {
            course_id: courseId ? { type: 'eq', value: courseId } : null,
            status: status ? { type: 'eq', value: status } : null,
            employee_id: employeeId ? { type: 'eq', value: employeeId } : null,
        },
        order: String(orderBy || '').trim() || (employeeId ? 'last_accessed_at.desc.nullslast,created_at.desc' : 'created_at.desc'),
        limit: limitSafe,
        offset,
    });

    const employeeIds = [...new Set((rows || []).map(row => String(row.employee_id || '')).filter(Boolean))];
    const courseIds = [...new Set((rows || []).map(row => String(row.course_id || '')).filter(Boolean))];
    const [employeeMap, courseMap] = await Promise.all([
        fetchEmployeesByIds(employeeIds),
        fetchCoursesByIds(courseIds),
    ]);

    return {
        page: pageSafe,
        limit: limitSafe,
        enrollments: decorateEnrollmentRows(rows || [], employeeMap, courseMap),
    };
}

export async function fetchLmsEnrollmentByIdFromSupabase(enrollmentId) {
    const id = String(enrollmentId || '').trim();
    if (!id) return null;
    const rows = await fetchSupabaseRows({
        table: 'course_enrollments',
        select: '*',
        filters: {
            id: { type: 'eq', value: id },
        },
        limit: 1,
    });
    const enrollment = rows?.[0] ? parseEnrollmentRow(rows[0]) : null;
    if (!enrollment) return null;

    const [employeeMap, courseMap] = await Promise.all([
        fetchEmployeesByIds([enrollment.employee_id]),
        fetchCoursesByIds([enrollment.course_id]),
    ]);
    const decorated = decorateEnrollmentRows([enrollment], employeeMap, courseMap);
    return decorated[0] || null;
}

export async function fetchLmsProgressFromSupabase({
    enrollmentId,
    lessonId = '',
}) {
    const id = String(enrollmentId || '').trim();
    if (!id) return [];

    const rows = await fetchSupabaseRows({
        table: 'lesson_progress',
        select: '*',
        filters: {
            enrollment_id: { type: 'eq', value: id },
            lesson_id: lessonId ? { type: 'eq', value: lessonId } : null,
        },
        order: 'last_accessed_at.desc.nullslast',
    });

    return (rows || []).map(parseLessonProgressRow);
}

function normalizeEnrollmentParity(row = {}) {
    const next = { ...row };
    if (typeof next.certificate_issued === 'boolean') {
        next.certificate_issued = next.certificate_issued ? 1 : 0;
    }
    return next;
}

export function toEnrollmentListParityRow(row = {}) {
    const next = normalizeEnrollmentParity(row);
    const employee_name = row.employee_name ?? null;
    const department = row.department ?? null;
    const position = row.position ?? null;
    const course_title = row.course_title ?? null;

    delete next.title;
    delete next.description;
    delete next.category;
    delete next.thumbnail_url;
    delete next.estimated_duration_minutes;
    delete next.difficulty_level;

    return {
        ...next,
        employee_name,
        department,
        position,
        course_title,
    };
}

export function toEnrollmentGetParityRow(row = {}) {
    const next = normalizeEnrollmentParity(row);
    const course_title = row.course_title ?? null;

    delete next.title;
    delete next.description;
    delete next.category;
    delete next.thumbnail_url;
    delete next.estimated_duration_minutes;
    delete next.difficulty_level;
    delete next.employee_name;
    delete next.department;
    delete next.position;

    return {
        ...next,
        course_title,
    };
}

export function toMyCoursesParityRow(row = {}) {
    const next = normalizeEnrollmentParity(row);
    const title = row.title ?? null;
    const description = row.description ?? null;
    const category = row.category ?? null;
    const thumbnail_url = row.thumbnail_url ?? null;
    const estimated_duration_minutes = row.estimated_duration_minutes ?? null;
    const difficulty_level = row.difficulty_level ?? null;

    delete next.employee_name;
    delete next.department;
    delete next.position;
    delete next.course_title;

    return {
        ...next,
        title,
        description,
        category,
        thumbnail_url,
        estimated_duration_minutes,
        difficulty_level,
    };
}
