// server/compat/supabaseKpiRead.js
// Supabase-backed KPI reporting summary — grouped by department.

function getSupabaseConfig() {
    const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) return null;
    return { url, key };
}

async function supabaseGet(path, config) {
    const resp = await fetch(`${config.url}/rest/v1/${path}`, {
        headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
        },
    });
    if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(`Supabase KPI read failed (${resp.status}): ${msg}`);
    }
    return resp.json();
}

/**
 * Parse `target_snapshot` — the column stores either:
 *   - a raw number (e.g. 120)
 *   - a JSON object (e.g. {"target_value": 120})
 *   - null
 * Returns a number or null.
 */
function parseTargetSnapshot(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'number') return parsed;
            if (parsed && typeof parsed === 'object') {
                const v = Number(parsed.target_value ?? parsed.target ?? parsed.value ?? null);
                return Number.isFinite(v) ? v : null;
            }
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') {
        const v = Number(raw.target_value ?? raw.target ?? raw.value ?? null);
        return Number.isFinite(v) ? v : null;
    }
    return null;
}

/**
 * Build department-grouped KPI reporting summary from raw kpi_records and employees.
 *
 * @param {Array} kpiRows   - rows from kpi_records
 * @param {Array} empRows   - rows from employees (employee_id, department, manager_id, role)
 * @param {Object} opts
 * @param {string} [opts.department]  - filter to single department
 * @param {string} [opts.managerId]   - scope to manager's department
 * @returns {Array} grouped summary rows
 */
function buildGroupedSummary(kpiRows, empRows, { department, managerId } = {}) {
    // Index employees — only 'employee' roles unless overridden
    const empById = new Map();
    for (const e of empRows) {
        empById.set(String(e.employee_id), e);
    }

    // Group employees by department (apply scope filters)
    const deptEmployees = new Map(); // department -> Set<employee_id>
    const deptManager = new Map();   // department -> manager display name

    for (const e of empRows) {
        const role = String(e.role || 'employee').toLowerCase();
        if (role !== 'employee') continue;

        const dept = String(e.department || 'Unassigned').trim();

        // Scope by department filter
        if (department && dept !== department) continue;

        // Scope by manager
        if (managerId) {
            const empDept = empRows.find(x => String(x.employee_id) === managerId)?.department;
            if (empDept && dept !== String(empDept)) continue;
        }

        if (!deptEmployees.has(dept)) deptEmployees.set(dept, new Set());
        deptEmployees.get(dept).add(String(e.employee_id));

        if (!deptManager.has(dept) && e.manager_id) {
            const mgr = empById.get(String(e.manager_id));
            if (mgr?.name) deptManager.set(dept, String(mgr.name));
        }
    }

    // Aggregate KPI records per department
    const deptStats = new Map();
    // pre-populate so departments with 0 records appear
    for (const [dept] of deptEmployees) {
        deptStats.set(dept, {
            recordCount: 0,
            empWithRecords: new Set(),
            metCount: 0,
            notMetCount: 0,
            scoreSum: 0,
            scoredCount: 0,
        });
    }

    for (const row of kpiRows) {
        const empId = String(row.employee_id || '');
        const emp = empById.get(empId);
        if (!emp) continue;
        const dept = String(emp.department || 'Unassigned').trim();

        if (!deptStats.has(dept)) continue; // outside filtered scope

        const stats = deptStats.get(dept);
        stats.recordCount += 1;
        stats.empWithRecords.add(empId);

        const actual = Number(row.value);
        const target = parseTargetSnapshot(row.target_snapshot);

        if (Number.isFinite(actual) && Number.isFinite(target) && target > 0) {
            const pct = (actual / target) * 100;
            stats.scoreSum += pct;
            stats.scoredCount += 1;
            if (actual >= target) {
                stats.metCount += 1;
            } else {
                stats.notMetCount += 1;
            }
        }
    }

    const results = [];
    for (const [dept, empSet] of deptEmployees) {
        const stats = deptStats.get(dept) || {
            recordCount: 0, empWithRecords: new Set(), metCount: 0, notMetCount: 0, scoreSum: 0, scoredCount: 0,
        };
        const avgScore = stats.scoredCount > 0
            ? Math.round((stats.scoreSum / stats.scoredCount) * 10) / 10
            : null;

        results.push({
            department: dept,
            manager: deptManager.get(dept) || null,
            employee_count: empSet.size,
            record_count: stats.recordCount,
            met_count: stats.metCount,
            not_met_count: stats.notMetCount,
            avg_score: avgScore,
            missing_count: Math.max(0, empSet.size - stats.empWithRecords.size),
        });
    }

    results.sort((a, b) => a.department.localeCompare(b.department));
    return results;
}

/**
 * Fetch KPI reporting summary from Supabase.
 *
 * @param {Object} opts
 * @param {string} [opts.department]
 * @param {string} [opts.period]    - YYYY-MM or YYYY
 * @param {string} [opts.managerId]
 * @returns {Promise<Array>}
 */
export async function fetchKpiReportingSummaryFromSupabase({ department, period, managerId } = {}) {
    const config = getSupabaseConfig();
    if (!config) throw new Error('Supabase not configured for KPI read.');

    // Build kpi_records query
    let kpiPath = 'kpi_records?select=employee_id,period,value,target_snapshot';
    if (period) {
        if (/^\d{4}-\d{2}$/.test(period)) {
            kpiPath += `&period=eq.${encodeURIComponent(period)}`;
        } else if (/^\d{4}$/.test(period)) {
            kpiPath += `&period=like.${encodeURIComponent(period + '-%')}`;
        }
    }

    const [kpiRows, empRows] = await Promise.all([
        supabaseGet(kpiPath, config),
        supabaseGet('employees?select=employee_id,department,manager_id,role,name', config),
    ]);

    return buildGroupedSummary(
        Array.isArray(kpiRows) ? kpiRows : [],
        Array.isArray(empRows) ? empRows : [],
        { department, managerId }
    );
}

export function resolveKpiReadSource() {
    const env = String(process.env.KPI_READ_SOURCE || 'auto').toLowerCase().trim();
    if (env === 'supabase') return { source: 'supabase' };
    if (env === 'legacy') return { source: 'legacy' };
    const configured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    return { source: configured ? 'supabase' : 'legacy' };
}
