function normalizeSupabaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function toInFilter(values = []) {
    return `in.(${values.map(value => `"${String(value).replaceAll('"', '\\"')}"`).join(',')})`;
}

function escapeFilterValue(value) {
    return `"${String(value).replaceAll('"', '\\"')}"`;
}

function toFiniteNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
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
            continue;
        }
        if (filter.type === 'not_in') {
            if (!Array.isArray(filter.values) || filter.values.length === 0) continue;
            params.set(column, `not.in.(${filter.values.map(escapeFilterValue).join(',')})`);
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

async function fetchSupabaseRows({
    table,
    select = '*',
    filters = {},
    order = '',
    limit = null,
}) {
    const { source, supabaseUrl, serviceRoleKey } = resolveTnaReadSource();
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

    for (const [column, filter] of Object.entries(filters || {})) {
        if (!filter) continue;
        if (filter.type === 'eq') {
            params.set(column, `eq.${filter.value}`);
            continue;
        }
        if (filter.type === 'in') {
            if (!Array.isArray(filter.values) || filter.values.length === 0) continue;
            params.set(column, toInFilter(filter.values));
            continue;
        }
        if (filter.type === 'not_in') {
            if (!Array.isArray(filter.values) || filter.values.length === 0) continue;
            params.set(column, `not.in.(${filter.values.map(escapeFilterValue).join(',')})`);
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

export async function fetchTnaGapsReportFromSupabase({
    department = '',
}) {
    const needRows = await fetchSupabaseRows({
        table: 'training_need_records',
        select: 'employee_id,training_need_id,current_level,gap_level,priority,status,identified_at',
        filters: {
            status: { type: 'not_in', values: ['completed', 'cancelled'] },
        },
    });

    const employeeIds = [...new Set((needRows || []).map(row => String(row.employee_id || '')).filter(Boolean))];
    const needIds = [...new Set((needRows || []).map(row => String(row.training_need_id || '')).filter(Boolean))];

    const [employees, trainingNeeds] = await Promise.all([
        employeeIds.length > 0
            ? fetchSupabaseRows({
                table: 'employees',
                select: 'employee_id,name,position,department',
                filters: {
                    employee_id: { type: 'in', values: employeeIds },
                },
            })
            : [],
        needIds.length > 0
            ? fetchSupabaseRows({
                table: 'training_needs',
                select: 'id,competency_name,required_level',
                filters: {
                    id: { type: 'in', values: needIds },
                },
            })
            : [],
    ]);

    const employeeMap = new Map((employees || []).map(row => [String(row.employee_id), row]));
    const needMap = new Map((trainingNeeds || []).map(row => [String(row.id), row]));
    const departmentValue = String(department || '').trim();

    const rows = (needRows || [])
        .map(row => {
            const employee = employeeMap.get(String(row.employee_id || '')) || {};
            const need = needMap.get(String(row.training_need_id || '')) || {};
            return {
                employee_id: row.employee_id,
                employee_name: employee.name || null,
                position: employee.position || null,
                department: employee.department || null,
                competency_name: need.competency_name || null,
                required_level: need.required_level ?? null,
                current_level: row.current_level ?? null,
                gap_level: row.gap_level ?? null,
                priority: row.priority || null,
                status: row.status || null,
                identified_at: row.identified_at || null,
            };
        })
        .filter(row => !departmentValue || String(row.department || '') === departmentValue);

    rows.sort((a, b) => {
        const priorityOrder = String(b.priority || '').localeCompare(String(a.priority || ''));
        if (priorityOrder !== 0) return priorityOrder;
        const gapA = Number(a.gap_level || 0);
        const gapB = Number(b.gap_level || 0);
        if (gapB !== gapA) return gapB - gapA;
        return String(a.employee_name || '').localeCompare(String(b.employee_name || ''));
    });

    return rows;
}

export async function fetchTnaLmsReportFromSupabase({
    department = '',
}) {
    const enrollments = await fetchSupabaseRows({
        table: 'training_enrollments',
        select: 'id,employee_id,course_id,status,score,enrollment_date',
    });

    const employeeIds = [...new Set((enrollments || []).map(row => String(row.employee_id || '')).filter(Boolean))];
    const courseIds = [...new Set((enrollments || []).map(row => String(row.course_id || '')).filter(Boolean))];

    const [employees, courses] = await Promise.all([
        employeeIds.length > 0
            ? fetchSupabaseRows({
                table: 'employees',
                select: 'employee_id,department',
                filters: {
                    employee_id: { type: 'in', values: employeeIds },
                },
            })
            : [],
        courseIds.length > 0
            ? fetchSupabaseRows({
                table: 'training_courses',
                select: 'id,course_name,provider',
                filters: {
                    id: { type: 'in', values: courseIds },
                },
            })
            : [],
    ]);

    const employeeMap = new Map((employees || []).map(row => [String(row.employee_id), row]));
    const courseMap = new Map((courses || []).map(row => [String(row.id), row]));
    const departmentValue = String(department || '').trim();

    const summary = {
        total_enrollments: Number((enrollments || []).length),
        completed: Number((enrollments || []).filter(row => String(row.status || '') === 'completed').length),
        in_progress: Number((enrollments || []).filter(row => String(row.status || '') === 'in_progress').length),
        enrolled: Number((enrollments || []).filter(row => String(row.status || '') === 'enrolled').length),
        avg_score: null,
    };
    const summaryScores = (enrollments || [])
        .map(row => toFiniteNumberOrNull(row.score))
        .filter(score => Number.isFinite(score));
    if (summaryScores.length > 0) {
        summary.avg_score = summaryScores.reduce((sum, value) => sum + value, 0) / summaryScores.length;
    }

    const byCourseMap = new Map();
    for (const row of enrollments || []) {
        const employee = employeeMap.get(String(row.employee_id || '')) || {};
        const course = courseMap.get(String(row.course_id || '')) || {};
        const departmentName = String(employee.department || '');
        if (departmentValue && departmentName !== departmentValue) {
            continue;
        }
        const courseName = String(course.course_name || '');
        const provider = String(course.provider || '');
        const groupKey = `${departmentName}::${courseName}::${provider}`;
        const current = byCourseMap.get(groupKey) || {
            department: departmentName,
            course_name: courseName,
            provider: provider || null,
            total_enrolled: 0,
            completed: 0,
            in_progress: 0,
            avg_score: null,
            _scoreCount: 0,
            _scoreSum: 0,
        };

        current.total_enrolled += 1;
        if (String(row.status || '') === 'completed') current.completed += 1;
        if (String(row.status || '') === 'in_progress') current.in_progress += 1;
        const score = toFiniteNumberOrNull(row.score);
        if (score !== null) {
            current._scoreCount += 1;
            current._scoreSum += score;
        }
        byCourseMap.set(groupKey, current);
    }

    const byCourse = [...byCourseMap.values()]
        .map(row => ({
            department: row.department || null,
            course_name: row.course_name || null,
            provider: row.provider || null,
            total_enrolled: Number(row.total_enrolled || 0),
            completed: Number(row.completed || 0),
            in_progress: Number(row.in_progress || 0),
            avg_score: row._scoreCount > 0 ? (row._scoreSum / row._scoreCount) : null,
        }))
        .sort((a, b) => {
            const dep = String(a.department || '').localeCompare(String(b.department || ''));
            if (dep !== 0) return dep;
            return String(a.course_name || '').localeCompare(String(b.course_name || ''));
        });

    return {
        summary,
        by_course: byCourse,
    };
}
