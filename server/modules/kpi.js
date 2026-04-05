// server/modules/kpi.js
import { queryRows } from '../app.js';
import { pool } from '../pool.js';
import { fetchKpiReportingSummaryFromSupabase, resolveKpiReadSource } from '../compat/supabaseKpiRead.js';

function requireAuth(req) {
    if (!req.currentUser) {
        const err = new Error('Authentication required.');
        err.status = 401; err.code = 'AUTH_REQUIRED';
        throw err;
    }
    return req.currentUser;
}

function getInput(req, key, defaultValue = '') {
    const bv = req.body?.[key];
    if (bv !== undefined && bv !== null && bv !== '') return bv;
    const qv = req.query?.[key];
    if (qv !== undefined && qv !== null && qv !== '') return qv;
    return defaultValue;
}

/**
 * Parse target_snapshot — may be number, JSON string, or plain number string.
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
        } catch { return null; }
    }
    if (typeof raw === 'object' && raw !== null) {
        const v = Number(raw.target_value ?? raw.target ?? raw.value ?? null);
        return Number.isFinite(v) ? v : null;
    }
    return null;
}

/**
 * Build grouped summary from raw legacy MySQL KPI and employee rows.
 */
function buildGroupedSummaryFromLegacy(kpiRows, empRows, { department, managerId } = {}) {
    const empById = new Map();
    for (const e of empRows) empById.set(String(e.employee_id), e);

    const deptEmployees = new Map();
    const deptManager = new Map();

    for (const e of empRows) {
        const role = String(e.role || 'employee').toLowerCase();
        if (role !== 'employee') continue;
        const dept = String(e.department || 'Unassigned').trim();
        if (department && dept !== department) continue;
        if (managerId) {
            const mgr = empById.get(String(managerId));
            if (mgr?.department && dept !== String(mgr.department)) continue;
        }
        if (!deptEmployees.has(dept)) deptEmployees.set(dept, new Set());
        deptEmployees.get(dept).add(String(e.employee_id));
        if (!deptManager.has(dept) && e.manager_id) {
            const mgr = empById.get(String(e.manager_id));
            if (mgr?.name) deptManager.set(dept, String(mgr.name));
        }
    }

    const deptStats = new Map();
    for (const [dept] of deptEmployees) {
        deptStats.set(dept, { recordCount: 0, empWithRecords: new Set(), metCount: 0, notMetCount: 0, scoreSum: 0, scoredCount: 0 });
    }

    for (const row of kpiRows) {
        const empId = String(row.employee_id || '');
        const emp = empById.get(empId);
        if (!emp) continue;
        const dept = String(emp.department || 'Unassigned').trim();
        if (!deptStats.has(dept)) continue;
        const stats = deptStats.get(dept);
        stats.recordCount += 1;
        stats.empWithRecords.add(empId);
        const actual = Number(row.value);
        const target = parseTargetSnapshot(row.target_snapshot ?? row.target_value ?? null);
        if (Number.isFinite(actual) && Number.isFinite(target) && target > 0) {
            const pct = (actual / target) * 100;
            stats.scoreSum += pct;
            stats.scoredCount += 1;
            if (actual >= target) stats.metCount += 1;
            else stats.notMetCount += 1;
        }
    }

    const results = [];
    for (const [dept, empSet] of deptEmployees) {
        const stats = deptStats.get(dept) || { recordCount: 0, empWithRecords: new Set(), metCount: 0, notMetCount: 0, scoreSum: 0, scoredCount: 0 };
        results.push({
            department: dept,
            manager: deptManager.get(dept) || null,
            employee_count: empSet.size,
            record_count: stats.recordCount,
            met_count: stats.metCount,
            not_met_count: stats.notMetCount,
            avg_score: stats.scoredCount > 0 ? Math.round((stats.scoreSum / stats.scoredCount) * 10) / 10 : null,
            missing_count: Math.max(0, empSet.size - stats.empWithRecords.size),
        });
    }
    results.sort((a, b) => a.department.localeCompare(b.department));
    return results;
}

async function fetchKpiReportingSummaryFromLegacy({ department, period, managerId } = {}) {
    const kpiFilters = [];
    if (period) kpiFilters.push({ op: 'eq', column: 'period', value: period });

    const [kpiRows, empRows] = await Promise.all([
        queryRows('kpi_records', {
            filters: kpiFilters,
            columns: ['employee_id', 'period', 'value', 'target_snapshot'],
        }),
        queryRows('employees', { columns: ['employee_id', 'department', 'manager_id', 'role', 'name'] }),
    ]);

    return buildGroupedSummaryFromLegacy(kpiRows || [], empRows || [], { department, managerId });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handleKpiAction(req, res, action) {
    const user = requireAuth(req);

    if (action === 'kpi/reporting-summary') {
        const role = String(user.role || '').toLowerCase();

        // access guard: employee → 403
        if (role === 'employee') {
            const err = new Error('KPI reporting summary is not available for the employee role.');
            err.status = 403; err.code = 'FORBIDDEN';
            throw err;
        }

        const department = String(getInput(req, 'department', '')).trim();
        const period = String(getInput(req, 'period', '')).trim();

        // Manager scope: force to own department only
        const effectiveDepartment = role === 'manager'
            ? String(user.department || department || '').trim()
            : department;

        const managerId = role === 'manager' ? String(user.employee_id || '').trim() : '';

        const { source } = resolveKpiReadSource();

        let rows;
        if (source === 'supabase') {
            try {
                rows = await fetchKpiReportingSummaryFromSupabase({
                    department: effectiveDepartment || undefined,
                    period: period || undefined,
                    managerId: managerId || undefined,
                });
            } catch (err) {
                console.warn('[kpi/reporting-summary] Supabase read failed, falling back to legacy:', err.message);
                rows = await fetchKpiReportingSummaryFromLegacy({
                    department: effectiveDepartment || undefined,
                    period: period || undefined,
                    managerId: managerId || undefined,
                });
            }
        } else {
            rows = await fetchKpiReportingSummaryFromLegacy({
                department: effectiveDepartment || undefined,
                period: period || undefined,
                managerId: managerId || undefined,
            });
        }

        return res.json({
            success: true,
            source,
            period: period || null,
            department: effectiveDepartment || null,
            rows,
        });
    }

    const err = new Error(`Unknown KPI action: ${action}`);
    err.status = 404; err.code = 'NOT_FOUND';
    throw err;
}
