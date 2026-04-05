// server/modules/kpi.js
import crypto from 'node:crypto';

import { queryRows } from '../app.js';
import { fetchKpiReportingSummaryFromSupabase, resolveKpiReadSource } from '../compat/supabaseKpiRead.js';
import { supabaseTableRequest } from '../compat/supabaseAdmin.js';

function requireAuth(req) {
    if (!req.currentUser) {
        const err = new Error('Authentication required.');
        err.status = 401; err.code = 'AUTH_REQUIRED';
        throw err;
    }
    return req.currentUser;
}

function requireRole(req, roles = []) {
    const user = requireAuth(req);
    if (!roles.includes(String(user.role || '').toLowerCase())) {
        const err = new Error('Access denied.');
        err.status = 403; err.code = 'FORBIDDEN';
        throw err;
    }
    return user;
}

function getInput(req, key, defaultValue = '') {
    const bv = req.body?.[key];
    if (bv !== undefined && bv !== null && bv !== '') return bv;
    const qv = req.query?.[key];
    if (qv !== undefined && qv !== null && qv !== '') return qv;
    return defaultValue;
}

function assert(condition, message, status = 400, code = 'INVALID_INPUT') {
    if (condition) return;
    const err = new Error(message);
    err.status = status;
    err.code = code;
    throw err;
}

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
    if (typeof raw === 'object' && raw !== null) {
        const v = Number(raw.target_value ?? raw.target ?? raw.value ?? null);
        return Number.isFinite(v) ? v : null;
    }
    return null;
}

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

async function resolveEmployeeAndKpi(employeeId, requestedKpiId = '') {
    const [employeeRows, assignedTargets, activeDefinitions] = await Promise.all([
        supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'employee_id,department,position',
            filters: { employee_id: { type: 'eq', value: employeeId } },
            limit: 1,
        }),
        supabaseTableRequest({
            table: 'employee_kpi_targets',
            method: 'GET',
            select: 'kpi_id,target_value',
            filters: { employee_id: { type: 'eq', value: employeeId }, status: { type: 'eq', value: 'active' } },
            limit: 50,
        }).catch(() => []),
        supabaseTableRequest({
            table: 'kpi_definitions',
            method: 'GET',
            select: 'id,name,category,unit',
            filters: { status: { type: 'eq', value: 'active' } },
            order: 'created_at.asc',
            limit: 50,
        }),
    ]);

    const employee = employeeRows[0] || null;
    assert(Boolean(employee), 'Employee not found.', 404, 'NOT_FOUND');

    const assigned = Array.isArray(assignedTargets) ? assignedTargets : [];
    const definitions = Array.isArray(activeDefinitions) ? activeDefinitions : [];

    const assignedTarget = requestedKpiId
        ? assigned.find(row => String(row.kpi_id || '') === String(requestedKpiId)) || null
        : assigned[0] || null;

    const definition = requestedKpiId
        ? definitions.find(row => String(row.id || '') === String(requestedKpiId)) || null
        : (assignedTarget ? definitions.find(row => String(row.id || '') === String(assignedTarget.kpi_id || '')) || null : definitions[0] || null);

    assert(Boolean(definition), 'No active KPI definition is available for this employee.', 400, 'KPI_DEFINITION_MISSING');

    return {
        employee,
        definition,
        assignedTarget,
    };
}

async function createKpiRecord(req, res) {
    const user = requireRole(req, ['superadmin', 'hr']);
    const employeeId = String(req.body?.employee_id || '').trim();
    const period = String(req.body?.period || '').trim();
    const notes = String(req.body?.notes || '').trim() || null;
    const requestedKpiId = String(req.body?.kpi_id || '').trim();
    const actualValue = Number(req.body?.actual_value ?? req.body?.score ?? null);
    const targetValue = Number(req.body?.target_value ?? null);

    assert(employeeId, 'employee_id is required.');
    assert(/^\d{4}-\d{2}$/.test(period), 'period must use YYYY-MM format.');
    assert(Number.isFinite(actualValue), 'score or actual_value is required.');

    const { definition, assignedTarget } = await resolveEmployeeAndKpi(employeeId, requestedKpiId);
    const recordId = crypto.randomUUID();
    const effectiveTarget = Number.isFinite(targetValue)
        ? targetValue
        : Number(assignedTarget?.target_value ?? null);

    const rows = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'POST',
        body: [{
            id: recordId,
            employee_id: employeeId,
            kpi_id: definition.id,
            period,
            value: actualValue,
            notes,
            submitted_by: user.employee_id,
            submitted_at: new Date().toISOString(),
            target_snapshot: Number.isFinite(effectiveTarget) ? { target_value: effectiveTarget } : null,
            kpi_name_snapshot: definition.name || null,
            kpi_unit_snapshot: definition.unit || null,
            kpi_category_snapshot: definition.category || null,
        }],
        prefer: 'return=representation',
    });

    return res.json({ success: true, record: rows[0] || null });
}

async function updateKpiRecord(req, res) {
    const user = requireRole(req, ['superadmin', 'hr']);
    const recordId = String(req.body?.record_id || '').trim();
    assert(recordId, 'record_id is required.');

    const existingRows = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: '*',
        filters: { id: { type: 'eq', value: recordId } },
        limit: 1,
    });
    const existing = existingRows[0] || null;
    assert(Boolean(existing), 'KPI record not found.', 404, 'NOT_FOUND');

    const patch = {};
    if (req.body?.period !== undefined) {
        const period = String(req.body.period || '').trim();
        assert(/^\d{4}-\d{2}$/.test(period), 'period must use YYYY-MM format.');
        patch.period = period;
    }
    if (req.body?.notes !== undefined) patch.notes = String(req.body.notes || '').trim() || null;
    if (req.body?.score !== undefined || req.body?.actual_value !== undefined) {
        const actualValue = Number(req.body?.actual_value ?? req.body?.score ?? null);
        assert(Number.isFinite(actualValue), 'score or actual_value must be numeric.');
        patch.value = actualValue;
    }
    if (req.body?.target_value !== undefined) {
        const targetValue = Number(req.body.target_value);
        assert(Number.isFinite(targetValue), 'target_value must be numeric.');
        patch.target_snapshot = { target_value: targetValue };
    }
    if (req.body?.kpi_id !== undefined) {
        const requestedKpiId = String(req.body.kpi_id || '').trim();
        const { definition } = await resolveEmployeeAndKpi(String(existing.employee_id || ''), requestedKpiId);
        patch.kpi_id = definition.id;
        patch.kpi_name_snapshot = definition.name || null;
        patch.kpi_unit_snapshot = definition.unit || null;
        patch.kpi_category_snapshot = definition.category || null;
    }

    patch.updated_by = user.employee_id;

    const rows = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: recordId } },
        body: patch,
        prefer: 'return=representation',
    });

    return res.json({ success: true, record: rows[0] || null });
}

export async function handleKpiAction(req, res, action) {
    const user = requireAuth(req);

    if (action === 'kpi/reporting-summary') {
        const role = String(user.role || '').toLowerCase();

        if (role === 'employee') {
            const err = new Error('KPI reporting summary is not available for the employee role.');
            err.status = 403; err.code = 'FORBIDDEN';
            throw err;
        }

        const department = String(getInput(req, 'department', '')).trim();
        const period = String(getInput(req, 'period', '')).trim();

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

    if (action === 'kpi/record/create') {
        return createKpiRecord(req, res);
    }

    if (action === 'kpi/record/update') {
        return updateKpiRecord(req, res);
    }

    const err = new Error(`Unknown KPI action: ${action}`);
    err.status = 404; err.code = 'NOT_FOUND';
    throw err;
}
