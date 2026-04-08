// server/modules/kpi.js — Full KPI Management Module
// Supabase-only: no mysql2/pool/db/query
import crypto from 'node:crypto';
import { supabaseTableRequest } from '../compat/supabaseAdmin.js';
import { fetchKpiReportingSummaryFromSupabase, resolveKpiReadSource } from '../compat/supabaseKpiRead.js';

// ==================================================
// HELPERS
// ==================================================

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

function uuid() {
    return crypto.randomUUID();
}

function parseTargetSnapshotValue(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw === 'string') {
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) return numeric;
        try {
            const parsed = JSON.parse(raw);
            return parseTargetSnapshotValue(parsed);
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') {
        const candidate = Number(raw.target_value ?? raw.target ?? raw.value ?? null);
        return Number.isFinite(candidate) ? candidate : null;
    }
    return null;
}

function isAdmin(user) {
    return ['superadmin', 'hr'].includes(String(user.role || '').toLowerCase());
}

function isManager(user) {
    return String(user.role || '').toLowerCase() === 'manager';
}

// ==================================================
// KPI DEFINITIONS
// ==================================================

async function kpiDefinitionsList(req, res) {
    requireAuth(req);

    const filters = { status: { type: 'eq', value: 'approved' } };
    const position = String(getInput(req, 'applies_to_position', '')).trim();
    if (position) {
        filters.applies_to_position = { type: 'eq', value: position };
    }

    const rows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: '*',
        filters,
        order: 'effective_date.desc,created_at.desc',
        limit: 200,
    });

    // Group by position category
    const grouped = {};
    for (const row of rows) {
        const category = String(row.applies_to_position || 'General').trim();
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(row);
    }

    return res.json({ success: true, definitions: grouped });
}

async function kpiDefinitionsGet(req, res) {
    requireAuth(req);

    const definitionId = String(getInput(req, 'definition_id', '')).trim();
    assert(definitionId, 'definition_id is required.');

    const rows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: '*',
        filters: { id: { type: 'eq', value: definitionId } },
        limit: 1,
    });

    assert(rows[0], 'KPI definition not found.', 404, 'NOT_FOUND');

    return res.json({ success: true, definition: rows[0] });
}

async function kpiDefinitionsCreate(req, res) {
    const user = requireRole(req, ['superadmin', 'hr', 'manager']);

    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim() || null;
    const formula = String(req.body?.formula || '').trim() || null;
    const unit = String(req.body?.unit || '%').trim();
    const kpiType = String(req.body?.kpi_type || 'direct').trim();
    const appliesToPosition = String(req.body?.applies_to_position || '').trim() || null;
    const targetValue = req.body?.target_value !== undefined ? Number(req.body.target_value) : null;
    const effectiveDate = String(req.body?.effective_date || '').trim();
    const changeNote = String(req.body?.change_note || '').trim() || null;

    assert(name, 'KPI name is required.');
    assert(effectiveDate, 'effective_date is required.');
    assert(['direct', 'ratio'].includes(kpiType), 'kpi_type must be direct or ratio.');

    // Check governance: if manager and governance is on, status=pending
    let status = 'approved';
    if (isManager(user)) {
        const govRows = await supabaseTableRequest({
            table: 'kpi_governance',
            method: 'GET',
            select: 'require_hr_approval',
            filters: {},
            limit: 1,
        });
        if (govRows[0]?.require_hr_approval) {
            status = 'pending';
        }
    }

    const definitionId = uuid();
    const rows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'POST',
        body: [{
            id: definitionId,
            name,
            description,
            formula,
            unit,
            kpi_type: kpiType,
            applies_to_position: appliesToPosition,
            target_value: targetValue,
            effective_date: effectiveDate,
            version: 1,
            status,
            created_by: user.employee_id,
            change_note: changeNote,
        }],
        prefer: 'return=representation',
    });

    return res.json({ success: true, definition: rows[0] || null });
}

async function kpiDefinitionsUpdate(req, res) {
    const user = requireRole(req, ['superadmin', 'hr', 'manager']);

    const definitionId = String(req.body?.definition_id || '').trim();
    assert(definitionId, 'definition_id is required.');

    // Get existing
    const existingRows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: '*',
        filters: { id: { type: 'eq', value: definitionId } },
        limit: 1,
    });
    const existing = existingRows[0];
    assert(existing, 'KPI definition not found.', 404, 'NOT_FOUND');

    // Governance check for managers
    if (isManager(user)) {
        const govRows = await supabaseTableRequest({
            table: 'kpi_governance',
            method: 'GET',
            select: 'require_hr_approval',
            filters: {},
            limit: 1,
        });
        if (govRows[0]?.require_hr_approval) {
            // Manager update becomes pending
            existing.status = 'pending';
        }
    }

    const patch = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) patch.description = String(req.body.description || '').trim() || null;
    if (req.body?.formula !== undefined) patch.formula = String(req.body.formula || '').trim() || null;
    if (req.body?.unit !== undefined) patch.unit = String(req.body.unit).trim();
    if (req.body?.kpi_type !== undefined) patch.kpi_type = String(req.body.kpi_type).trim();
    if (req.body?.applies_to_position !== undefined) patch.applies_to_position = String(req.body.applies_to_position || '').trim() || null;
    if (req.body?.target_value !== undefined) patch.target_value = Number(req.body.target_value);
    if (req.body?.effective_date !== undefined) patch.effective_date = String(req.body.effective_date).trim();
    if (req.body?.change_note !== undefined) patch.change_note = String(req.body.change_note || '').trim() || null;
    if (req.body?.status !== undefined && isAdmin(user)) patch.status = String(req.body.status).trim();

    // Bump version
    patch.version = (existing.version || 1) + 1;
    patch.updated_by = user.employee_id;

    const rows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: definitionId } },
        body: patch,
        prefer: 'return=representation',
    });

    return res.json({ success: true, definition: rows[0] || null });
}

async function kpiDefinitionsDelete(req, res) {
    requireRole(req, ['superadmin', 'hr']);

    const definitionId = String(req.body?.definition_id || '').trim();
    assert(definitionId, 'definition_id is required.');

    // Soft-delete: set status=archived
    await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: definitionId } },
        body: { status: 'archived' },
        prefer: 'return=minimal',
    });

    return res.json({ success: true });
}

// ==================================================
// KPI TARGETS
// ==================================================

async function kpiTargetsGet(req, res) {
    requireAuth(req);

    const employeeId = String(getInput(req, 'employee_id', '')).trim();
    const period = String(getInput(req, 'period', '')).trim();

    assert(employeeId, 'employee_id is required.');
    assert(period, 'period is required (YYYY-MM).');

    // Get personalized targets
    const personalRows = await supabaseTableRequest({
        table: 'kpi_targets',
        method: 'GET',
        select: 'kpi_definition_id,target_value',
        filters: {
            employee_id: { type: 'eq', value: employeeId },
            period: { type: 'eq', value: period },
        },
        limit: 100,
    });

    const personalMap = new Map();
    for (const row of personalRows) {
        personalMap.set(String(row.kpi_definition_id), Number(row.target_value));
    }

    // Get all active definitions for fallback
    const defRows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: 'id,name,unit,target_value,applies_to_position',
        filters: { status: { type: 'eq', value: 'approved' } },
        limit: 100,
    });

    // Get employee's position
    const empRows = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'position',
        filters: { employee_id: { type: 'eq', value: employeeId } },
        limit: 1,
    });
    const empPosition = String(empRows[0]?.position || '').trim();

    // Build targets with fallback
    const targets = [];
    for (const def of defRows) {
        const defId = String(def.id);
        const appliesTo = String(def.applies_to_position || '').trim();

        // Only include definitions that apply to this employee's position
        if (appliesTo && appliesTo !== empPosition) continue;

        const personalTarget = personalMap.get(defId);
        const source = personalTarget !== undefined ? 'personal' : 'default';
        const targetValue = personalTarget !== undefined ? personalTarget : Number(def.target_value || 0);

        targets.push({
            kpi_definition_id: defId,
            kpi_name: def.name,
            unit: def.unit,
            target_value: targetValue,
            source,
        });
    }

    return res.json({ success: true, targets });
}

async function kpiTargetsSet(req, res) {
    requireRole(req, ['superadmin', 'hr']);

    const employeeId = String(req.body?.employee_id || '').trim();
    const period = String(req.body?.period || '').trim();
    const targets = req.body?.targets;

    assert(employeeId, 'employee_id is required.');
    assert(period, 'period is required (YYYY-MM).');
    assert(Array.isArray(targets) && targets.length > 0, 'targets array is required.');

    const results = [];
    for (const t of targets) {
        const kpiDefinitionId = String(t.kpi_definition_id || '').trim();
        const targetValue = Number(t.target_value);

        if (!kpiDefinitionId || !Number.isFinite(targetValue)) continue;

        const rows = await supabaseTableRequest({
            table: 'kpi_targets',
            method: 'POST',
            body: [{
                id: uuid(),
                employee_id: employeeId,
                kpi_definition_id: kpiDefinitionId,
                period,
                target_value: targetValue,
                created_by: req.currentUser.employee_id,
            }],
            prefer: 'return=representation',
        });

        if (rows[0]) {
            results.push(rows[0]);
        }
    }

    return res.json({ success: true, targets: results });
}

// ==================================================
// KPI GOVERNANCE
// ==================================================

async function kpiGovernanceGet(req, res) {
    requireAuth(req);

    const rows = await supabaseTableRequest({
        table: 'kpi_governance',
        method: 'GET',
        select: 'require_hr_approval',
        filters: {},
        limit: 1,
    });

    return res.json({ success: true, require_hr_approval: Boolean(rows[0]?.require_hr_approval) });
}

async function kpiGovernanceSet(req, res) {
    requireRole(req, ['superadmin']);

    const requireHrApproval = Boolean(req.body?.require_hr_approval);

    const rows = await supabaseTableRequest({
        table: 'kpi_governance',
        method: 'GET',
        select: 'id',
        filters: {},
        limit: 1,
    });

    if (rows[0]) {
        await supabaseTableRequest({
            table: 'kpi_governance',
            method: 'PATCH',
            filters: { id: { type: 'eq', value: rows[0].id } },
            body: {
                require_hr_approval: requireHrApproval,
                updated_by: req.currentUser.employee_id,
            },
            prefer: 'return=minimal',
        });
    } else {
        await supabaseTableRequest({
            table: 'kpi_governance',
            method: 'POST',
            body: [{
                id: uuid(),
                require_hr_approval: requireHrApproval,
                updated_by: req.currentUser.employee_id,
            }],
            prefer: 'return=minimal',
        });
    }

    return res.json({ success: true, require_hr_approval: requireHrApproval });
}

// ==================================================
// KPI APPROVALS
// ==================================================

async function kpiApprovalsList(req, res) {
    requireRole(req, ['superadmin', 'hr']);

    const rows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: '*',
        filters: { status: { type: 'eq', value: 'pending' } },
        order: 'created_at.desc',
        limit: 100,
    });

    return res.json({ success: true, pending: rows });
}

async function kpiApprovalsApprove(req, res) {
    requireRole(req, ['superadmin', 'hr']);

    const definitionId = String(req.body?.definition_id || '').trim();
    assert(definitionId, 'definition_id is required.');

    await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: definitionId } },
        body: { status: 'approved' },
        prefer: 'return=minimal',
    });

    return res.json({ success: true });
}

async function kpiApprovalsReject(req, res) {
    requireRole(req, ['superadmin', 'hr']);

    const definitionId = String(req.body?.definition_id || '').trim();
    assert(definitionId, 'definition_id is required.');

    await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: definitionId } },
        body: { status: 'rejected' },
        prefer: 'return=minimal',
    });

    return res.json({ success: true });
}

// ==================================================
// KPI RECORDS
// ==================================================

async function kpiRecordsList(req, res) {
    const user = requireAuth(req);
    const role = String(user.role || '').toLowerCase();

    const filters = {};
    const employeeId = String(getInput(req, 'employee_id', '')).trim();
    const period = String(getInput(req, 'period', '')).trim();
    const kpiDefinitionId = String(getInput(req, 'kpi_definition_id', '')).trim();

    if (employeeId) filters.employee_id = { type: 'eq', value: employeeId };
    if (period) filters.period = { type: 'eq', value: period };
    if (kpiDefinitionId) filters.kpi_id = { type: 'eq', value: kpiDefinitionId };

    // Role scoping
    if (role === 'employee') {
        filters.employee_id = { type: 'eq', value: user.employee_id };
    } else if (role === 'manager') {
        // Get direct reports
        const empRows = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'employee_id',
            filters: { manager_id: { type: 'eq', value: user.employee_id } },
            limit: 200,
        });
        const reportIds = empRows.map(e => e.employee_id);
        reportIds.push(user.employee_id); // manager can see own records too

        if (reportIds.length > 0) {
            filters.employee_id = { type: 'in', value: reportIds };
        } else {
            return res.json({ success: true, records: [] });
        }
    }

    const rows = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: '*',
        filters,
        order: 'period.desc,created_at.desc',
        limit: 500,
    });

    // Enrich with employee names and KPI names
    const enriched = [];
    for (const row of rows) {
        const empRows = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'name,department,position',
            filters: { employee_id: { type: 'eq', value: row.employee_id } },
            limit: 1,
        });
        const emp = empRows[0] || {};

        const defRows = await supabaseTableRequest({
            table: 'kpi_definitions',
            method: 'GET',
            select: 'name,unit',
            filters: { id: { type: 'eq', value: row.kpi_id } },
            limit: 1,
        });
        const def = defRows[0] || {};

        const targetValue = parseTargetSnapshotValue(row.target_snapshot);
        const actualValue = Number(row.value || 0);
        const existingAchievement = Number(row.achievement_pct);
        const achievementPct = Number.isFinite(existingAchievement)
            ? existingAchievement
            : targetValue && targetValue > 0
            ? Math.round((actualValue / targetValue) * 1000) / 10
            : null;

        const updaterRows = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'name',
            filters: { employee_id: { type: 'eq', value: row.updated_by || row.submitted_by || '' } },
            limit: 1,
        });

        enriched.push({
            ...row,
            employee_name: emp.name || row.employee_id,
            department: emp.department || '',
            position: emp.position || '',
            kpi_name: def.name || row.kpi_id,
            unit: def.unit || '%',
            target_value: targetValue,
            actual_value: actualValue,
            achievement_pct: achievementPct,
            updated_by_name: updaterRows[0]?.name || null,
        });
    }

    return res.json({ success: true, records: enriched });
}

async function kpiRecordCreate(req, res) {
    const user = requireAuth(req);
    const role = String(user.role || '').toLowerCase();

    const employeeId = String(req.body?.employee_id || '').trim();
    const kpiDefinitionId = String(req.body?.kpi_definition_id || '').trim();
    const period = String(req.body?.period || '').trim();
    const notes = String(req.body?.notes || '').trim() || null;

    assert(employeeId, 'employee_id is required.');
    assert(kpiDefinitionId, 'kpi_definition_id is required.');
    assert(/^\d{4}-\d{2}$/.test(period), 'period must use YYYY-MM format.');

    // Role scope: manager can only input for own team
    if (role === 'manager') {
        const empRows = await supabaseTableRequest({
            table: 'employees',
            method: 'GET',
            select: 'manager_id',
            filters: { employee_id: { type: 'eq', value: employeeId } },
            limit: 1,
        });
        const emp = empRows[0];
        assert(
            emp && (String(emp.manager_id) === String(user.employee_id) || String(employeeId) === String(user.employee_id)),
            'You can only input KPI for your team or yourself.',
            403,
            'FORBIDDEN'
        );
    }

    // Resolve target
    const targetRows = await supabaseTableRequest({
        table: 'kpi_targets',
        method: 'GET',
        select: 'target_value',
        filters: {
            employee_id: { type: 'eq', value: employeeId },
            kpi_definition_id: { type: 'eq', value: kpiDefinitionId },
            period: { type: 'eq', value: period },
        },
        limit: 1,
    });

    const defRows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: 'target_value,unit,kpi_type,name',
        filters: { id: { type: 'eq', value: kpiDefinitionId } },
        limit: 1,
    });
    const def = defRows[0] || {};

    let actualValue;
    const kpiType = String(def.kpi_type || 'direct').trim();

    if (kpiType === 'ratio') {
        const numerator = Number(req.body?.numerator ?? null);
        const denominator = Number(req.body?.denominator ?? null);
        assert(Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0, 'numerator and denominator are required for ratio KPIs.');
        actualValue = Math.round((numerator / denominator) * 10000) / 100;
    } else {
        actualValue = Number(req.body?.actual_value ?? req.body?.score ?? null);
        assert(Number.isFinite(actualValue), 'actual_value or score is required.');
    }

    const targetValue = targetRows[0]?.target_value ?? def.target_value ?? null;
    const achievementPct = targetValue && targetValue > 0
        ? Math.round((actualValue / targetValue) * 1000) / 10
        : null;

    const recordId = uuid();
    const rows = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'POST',
        body: [{
            id: recordId,
            employee_id: employeeId,
            kpi_id: kpiDefinitionId,
            period,
            value: actualValue,
            notes,
            target_snapshot: targetValue !== null ? { target_value: targetValue } : null,
            achievement_pct: achievementPct,
            kpi_name_snapshot: def.name || null,
            kpi_unit_snapshot: def.unit || null,
            submitted_by: user.employee_id,
            submitted_at: new Date().toISOString(),
            updated_by: user.employee_id,
        }],
        prefer: 'return=representation',
    });

    return res.json({ success: true, record: rows[0] || null });
}

async function kpiRecordUpdate(req, res) {
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
    const existing = existingRows[0];
    assert(existing, 'KPI record not found.', 404, 'NOT_FOUND');

    const patch = {};
    if (req.body?.period !== undefined) {
        const period = String(req.body.period || '').trim();
        assert(/^\d{4}-\d{2}$/.test(period), 'period must use YYYY-MM format.');
        patch.period = period;
    }
    if (req.body?.notes !== undefined) patch.notes = String(req.body.notes || '').trim() || null;

    if (req.body?.actual_value !== undefined || req.body?.score !== undefined || req.body?.numerator !== undefined) {
        const defRows = await supabaseTableRequest({
            table: 'kpi_definitions',
            method: 'GET',
            select: 'kpi_type',
            filters: { id: { type: 'eq', value: existing.kpi_id } },
            limit: 1,
        });
        const kpiType = String(defRows[0]?.kpi_type || 'direct').trim();

        if (kpiType === 'ratio') {
            const numerator = Number(req.body?.numerator ?? existing.numerator ?? null);
            const denominator = Number(req.body?.denominator ?? existing.denominator ?? null);
            if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
                patch.value = Math.round((numerator / denominator) * 10000) / 100;
            }
        } else {
            const actualValue = Number(req.body?.actual_value ?? req.body?.score ?? null);
            if (Number.isFinite(actualValue)) patch.value = actualValue;
        }
    }

    if (req.body?.target_value !== undefined) {
        const targetValue = Number(req.body.target_value);
        if (Number.isFinite(targetValue)) {
            patch.target_snapshot = { target_value: targetValue };
        }
    }

    // Re-calculate achievement_pct
    const newActual = patch.value !== undefined ? patch.value : Number(existing.value || 0);
    const newTarget = patch.target_snapshot?.target_value ?? existing.target_snapshot?.target_value ?? null;
    if (Number.isFinite(newActual) && newTarget && newTarget > 0) {
        patch.achievement_pct = Math.round((newActual / newTarget) * 1000) / 10;
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

async function kpiRecordDelete(req, res) {
    requireRole(req, ['superadmin', 'hr']);

    const recordId = String(req.body?.record_id || '').trim();
    assert(recordId, 'record_id is required.');

    // Soft-delete
    await supabaseTableRequest({
        table: 'kpi_records',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: recordId } },
        body: { deleted_at: new Date().toISOString() },
        prefer: 'return=minimal',
    });

    return res.json({ success: true });
}

// ==================================================
// KPI DEPARTMENT SUMMARY (for dashboard drill-down)
// ==================================================

async function kpiDepartmentSummary(req, res) {
    const user = requireAuth(req);
    const role = String(user.role || '').toLowerCase();

    const department = String(getInput(req, 'department', '')).trim();
    const period = String(getInput(req, 'period', '')).trim();

    assert(department, 'department is required.');

    // Role scope
    if (role === 'manager') {
        assert(
            String(user.department || '').trim() === department,
            'You can only view your own department.',
            403,
            'FORBIDDEN'
        );
    }

    // Get all employees in department
    const empFilters = { department: { type: 'eq', value: department } };
    const empRows = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id,name,position,department,manager_id',
        filters: empFilters,
        limit: 500,
    });

    // Get KPI records for this department+period
    const empIds = empRows.map(e => e.employee_id);
    const kpiFilters = { period: { type: 'eq', value: period || '' } };
    if (empIds.length > 0) {
        kpiFilters.employee_id = { type: 'in', value: empIds };
    }

    const kpiRows = await supabaseTableRequest({
        table: 'kpi_records',
        method: 'GET',
        select: '*',
        filters: kpiFilters,
        limit: 1000,
    });

    // Get KPI definitions for active KPIs
    const defRows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: 'id,name,applies_to_position',
        filters: { status: { type: 'eq', value: 'approved' } },
        limit: 100,
    });

    // Build summary
    const empById = new Map();
    for (const e of empRows) empById.set(String(e.employee_id), e);

    const empWithRecords = new Set();
    const empKpis = new Map();

    for (const row of kpiRows) {
        const eid = String(row.employee_id);
        empWithRecords.add(eid);

        if (!empKpis.has(eid)) empKpis.set(eid, []);

        const def = defRows.find(d => String(d.id) === String(row.kpi_id));
        const target = parseTargetSnapshotValue(row.target_snapshot);
        const actual = Number(row.value || 0);
        const existingAchievement = Number(row.achievement_pct);
        const achievementPct = Number.isFinite(existingAchievement)
            ? existingAchievement
            : (target && target > 0 ? Math.round((actual / target) * 1000) / 10 : null);

        let status = 'below_target';
        if (achievementPct !== null) {
            if (achievementPct >= 100) status = 'on_track';
            else if (achievementPct >= 80) status = 'at_risk';
        }

        empKpis.get(eid).push({
            kpi_name: def?.name || row.kpi_name_snapshot || row.kpi_id,
            target,
            actual,
            achievement_pct: achievementPct,
            status,
            unit: row.kpi_unit_snapshot || '%',
        });
    }

    // Build employee list
    const employees = empRows.map(emp => {
        const eid = String(emp.employee_id);
        const kpis = empKpis.get(eid) || [];
        const hasRecord = empWithRecords.has(eid);
        const avgAchievement = kpis.length > 0 && kpis.some(k => k.achievement_pct !== null)
            ? Math.round(kpis.filter(k => k.achievement_pct !== null).reduce((sum, k) => sum + k.achievement_pct, 0) / kpis.filter(k => k.achievement_pct !== null).length * 10) / 10
            : null;

        return {
            employee_id: emp.employee_id,
            name: emp.name,
            position: emp.position,
            kpi_group: kpis[0]?.kpi_name?.split(' ').slice(0, 2).join(' ') || '',
            has_record: hasRecord,
            avg_achievement: avgAchievement,
            kpis,
        };
    });

    // Overall stats
    const totalEmployees = empRows.length;
    const employeesWithRecords = empWithRecords.size;
    const employeesWithoutRecords = totalEmployees - employeesWithRecords;
    const activeKpis = defRows.length;

    const allAchievements = [];
    for (const kpis of empKpis.values()) {
        for (const k of kpis) {
            if (k.achievement_pct !== null) allAchievements.push(k.achievement_pct);
        }
    }
    const overallAchievementPct = allAchievements.length > 0
        ? Math.round(allAchievements.reduce((a, b) => a + b, 0) / allAchievements.length * 10) / 10
        : 0;

    // 6-month trend
    const sixMonthTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        const monthAchievements = [];
        for (const row of kpiRows) {
            if (row.period === monthStr && row.achievement_pct !== null) {
                monthAchievements.push(Number(row.achievement_pct));
            }
        }
        const avg = monthAchievements.length > 0
            ? Math.round(monthAchievements.reduce((a, b) => a + b, 0) / monthAchievements.length * 10) / 10
            : 0;

        sixMonthTrend.push({ month: monthStr, avg_achievement: avg });
    }

    return res.json({
        success: true,
        department,
        period: period || null,
        total_employees: totalEmployees,
        employees_with_records: employeesWithRecords,
        employees_without_records: employeesWithoutRecords,
        active_kpis: activeKpis,
        overall_achievement_pct: overallAchievementPct,
        six_month_trend: sixMonthTrend,
        employees,
    });
}

// ==================================================
// KPI VERSION HISTORY
// ==================================================

async function kpiVersionHistory(req, res) {
    requireAuth(req);

    const kpiDefinitionId = String(getInput(req, 'kpi_definition_id', '')).trim();
    const limit = Math.min(Number(getInput(req, 'limit', '50')) || 50, 200);

    const filters = {};
    if (kpiDefinitionId) {
        filters.id = { type: 'eq', value: kpiDefinitionId };
    } else {
        filters.status = { type: 'in', value: ['approved', 'pending', 'rejected', 'archived'] };
    }

    const rows = await supabaseTableRequest({
        table: 'kpi_definitions',
        method: 'GET',
        select: 'id,name,applies_to_position,effective_date,version,status,target_value,change_note,created_by,created_at',
        filters,
        order: 'created_at.desc',
        limit,
    });

    const history = rows.map(row => ({
        type: row.status === 'archived' ? 'deleted' : row.version === 1 ? 'created' : 'updated',
        scope: row.applies_to_position || 'All Positions',
        effective: row.effective_date,
        version: row.version,
        status: row.status,
        value: row.target_value,
        change_note: row.change_note,
        created_by: row.created_by,
        created_at: row.created_at,
    }));

    return res.json({ success: true, history });
}

// ==================================================
// ROUTER
// ==================================================

export async function handleKpiAction(req, res, action) {
    const user = requireAuth(req);

    // Reporting summary (existing)
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
                rows = [];
            }
        } else {
            rows = [];
        }

        return res.json({
            success: true,
            source,
            period: period || null,
            department: effectiveDepartment || null,
            rows,
        });
    }

    // Definitions
    if (action === 'kpi/definitions/list') return kpiDefinitionsList(req, res);
    if (action === 'kpi/definitions/get') return kpiDefinitionsGet(req, res);
    if (action === 'kpi/definitions/create') return kpiDefinitionsCreate(req, res);
    if (action === 'kpi/definitions/update') return kpiDefinitionsUpdate(req, res);
    if (action === 'kpi/definitions/delete') return kpiDefinitionsDelete(req, res);

    // Targets
    if (action === 'kpi/targets/get') return kpiTargetsGet(req, res);
    if (action === 'kpi/targets/set') return kpiTargetsSet(req, res);

    // Governance
    if (action === 'kpi/governance/get') return kpiGovernanceGet(req, res);
    if (action === 'kpi/governance/set') return kpiGovernanceSet(req, res);

    // Approvals
    if (action === 'kpi/approvals/list') return kpiApprovalsList(req, res);
    if (action === 'kpi/approvals/approve') return kpiApprovalsApprove(req, res);
    if (action === 'kpi/approvals/reject') return kpiApprovalsReject(req, res);

    // Records
    if (action === 'kpi/records/list') return kpiRecordsList(req, res);
    if (action === 'kpi/record/create') return kpiRecordCreate(req, res);
    if (action === 'kpi/record/update') return kpiRecordUpdate(req, res);
    if (action === 'kpi/record/delete') return kpiRecordDelete(req, res);

    // Department summary
    if (action === 'kpi/department-summary') return kpiDepartmentSummary(req, res);

    // Version history
    if (action === 'kpi/version-history') return kpiVersionHistory(req, res);

    const err = new Error(`Unknown KPI action: ${action}`);
    err.status = 404; err.code = 'NOT_FOUND';
    throw err;
}
