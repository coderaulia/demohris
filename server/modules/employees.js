import crypto from 'node:crypto';

import {
    createSupabaseAuthUser,
    deleteSupabaseAuthUser,
    generateTemporaryPassword,
    supabaseTableRequest,
    updateSupabaseAuthUser,
    upsertSupabaseProfile,
} from '../compat/supabaseAdmin.js';

const LEADERSHIP_ROLES = new Set(['superadmin', 'hr', 'director']);
const EDITABLE_MANAGER_FIELDS = new Set(['department', 'position']);
const EDITABLE_ADMIN_FIELDS = new Set(['name', 'email', 'department', 'position', 'role', 'manager_id', 'join_date']);
const VALID_EMPLOYEE_ROLES = new Set(['employee', 'manager', 'hr', 'superadmin', 'director']);
const VALID_STATUS = new Set(['active', 'inactive']);

function requireAuth(req) {
    if (!req.currentUser) {
        const error = new Error('Authentication required.');
        error.status = 401;
        error.code = 'AUTH_REQUIRED';
        throw error;
    }
    return req.currentUser;
}

function getInput(req, key, fallback = '') {
    const bodyValue = req.body?.[key];
    if (bodyValue !== undefined && bodyValue !== null && bodyValue !== '') return bodyValue;
    const queryValue = req.query?.[key];
    if (queryValue !== undefined && queryValue !== null && queryValue !== '') return queryValue;
    return fallback;
}

function toRole(value) {
    return String(value || '').trim().toLowerCase();
}

function assert(condition, message, status = 400, code = 'INVALID_INPUT') {
    if (condition) return;
    const error = new Error(message);
    error.status = status;
    error.code = code;
    throw error;
}

function normalizeString(value) {
    const raw = String(value ?? '').trim();
    return raw || null;
}

function normalizeStatus(value, fallback = 'active') {
    const status = String(value || fallback).trim().toLowerCase();
    assert(VALID_STATUS.has(status), 'Status must be active or inactive.');
    return status;
}

function normalizeEmployeeRole(value) {
    const role = toRole(value || 'employee');
    assert(VALID_EMPLOYEE_ROLES.has(role), 'Role must be one of employee, manager, hr, director, or superadmin.');
    return role;
}

function isLeadershipRole(role) {
    return LEADERSHIP_ROLES.has(toRole(role));
}

function isManagerScope(user) {
    return toRole(user?.role) === 'manager';
}

function canReadEmployee(user, employee) {
    const role = toRole(user?.role);
    const currentId = String(user?.employee_id || '');
    const employeeId = String(employee?.employee_id || '');
    if (isLeadershipRole(role)) return true;
    if (role === 'manager') {
        return String(employee?.manager_id || '') === currentId;
    }
    if (role === 'employee') {
        return employeeId === currentId;
    }
    return false;
}

function canManageEmployee(user, employee) {
    const role = toRole(user?.role);
    if (role === 'superadmin' || role === 'hr') return true;
    if (role === 'manager') {
        return String(employee?.manager_id || '') === String(user?.employee_id || '');
    }
    return false;
}

function buildEmployeeSearchIndex(row) {
    return [row.employee_id, row.name, row.email, row.auth_email, row.department, row.position]
        .map(value => String(value || '').toLowerCase())
        .join(' ');
}

async function fetchEmployeesRows() {
    return supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: '*',
        order: 'name.asc',
        limit: 1000,
    });
}

async function fetchEmployeeById(employeeId) {
    const rows = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: '*',
        filters: {
            employee_id: { type: 'eq', value: employeeId },
        },
        limit: 1,
    });
    return rows[0] || null;
}

async function assertManagerExists(managerId) {
    if (!managerId) return null;
    const manager = await fetchEmployeeById(managerId);
    assert(Boolean(manager), 'Manager not found.', 404, 'NOT_FOUND');
    return manager;
}

async function assertUniqueEmail(email, excludeEmployeeId = '') {
    const rows = await fetchEmployeesRows();
    const normalized = String(email || '').trim().toLowerCase();
    const duplicate = rows.find(row => {
        const employeeId = String(row.employee_id || '');
        if (excludeEmployeeId && employeeId === excludeEmployeeId) return false;
        return [row.email, row.auth_email].some(value => String(value || '').trim().toLowerCase() === normalized);
    });
    assert(!duplicate, 'Email is already assigned to another employee.', 409, 'DUPLICATE');
}

async function generateNextEmployeeId() {
    const rows = await supabaseTableRequest({
        table: 'employees',
        method: 'GET',
        select: 'employee_id',
        limit: 1000,
    });

    let maxNumber = 0;
    for (const row of rows) {
        const match = /([A-Za-z]+)?(\d+)$/.exec(String(row.employee_id || ''));
        if (!match) continue;
        const value = Number(match[2]);
        if (Number.isFinite(value) && value > maxNumber) {
            maxNumber = value;
        }
    }

    return `EMP${String(maxNumber + 1).padStart(3, '0')}`;
}

function deriveKpiInsights(rows) {
    if (!rows || rows.length === 0) {
        return { latest_score: null, trend: null, record_count: 0 };
    }

    const sorted = [...rows].sort((left, right) => {
        const leftPeriod = Number(String(left.period || '').replace('-', ''));
        const rightPeriod = Number(String(right.period || '').replace('-', ''));
        if (rightPeriod !== leftPeriod) return rightPeriod - leftPeriod;
        return String(right.submitted_at || right.created_at || '').localeCompare(String(left.submitted_at || left.created_at || ''));
    });

    const latest = sorted[0];
    const latestValue = Number(latest.value);
    const latestTarget = Number(latest?.target_snapshot?.target_value ?? latest?.target_snapshot?.value ?? latest.target_value ?? null);
    const latestScore = Number.isFinite(latestValue)
        ? (Number.isFinite(latestTarget) && latestTarget > 0 ? Math.round((latestValue / latestTarget) * 1000) / 10 : Math.round(latestValue * 10) / 10)
        : null;

    const scored = sorted
        .map(row => {
            const value = Number(row.value);
            const target = Number(row?.target_snapshot?.target_value ?? row?.target_snapshot?.value ?? row.target_value ?? null);
            if (!Number.isFinite(value)) return null;
            if (Number.isFinite(target) && target > 0) return (value / target) * 100;
            return value;
        })
        .filter(value => value !== null);

    let trend = null;
    if (scored.length >= 2) {
        const recent = scored.slice(0, Math.min(3, scored.length));
        const prior = scored.slice(Math.min(3, scored.length), Math.min(6, scored.length));
        if (prior.length > 0) {
            const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
            const priorAvg = prior.reduce((sum, value) => sum + value, 0) / prior.length;
            const delta = recentAvg - priorAvg;
            trend = Math.abs(delta) < 0.5 ? 'flat' : delta > 0 ? 'up' : 'down';
        }
    }

    return { latest_score: latestScore, trend, record_count: rows.length };
}

function deriveTnaInsights(rows) {
    if (!rows || rows.length === 0) {
        return { gap_level: null, last_assessed_at: null, history_count: 0 };
    }
    const gaps = rows.map(row => Number(row.gap_level ?? row.gap_score)).filter(value => Number.isFinite(value) && value >= 0);
    const average = gaps.length > 0 ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : null;
    const gapLevel = average === null ? null : average >= 2.5 ? 'high' : average >= 1 ? 'medium' : 'low';
    const dates = rows.map(row => String(row.identified_at || row.created_at || '')).filter(Boolean).sort((left, right) => right.localeCompare(left));
    return { gap_level: gapLevel, last_assessed_at: dates[0] || null, history_count: rows.length };
}

function deriveLmsInsights(rows) {
    const total = rows.length;
    const completed = rows.filter(row => String(row.status || '').toLowerCase() === 'completed').length;
    return {
        enrolled_count: total,
        completed_count: completed,
        completion_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
}

async function resolveInsightAccessEmployee(user, employeeId) {
    const employee = await fetchEmployeeById(employeeId);
    assert(Boolean(employee), 'Employee not found.', 404, 'NOT_FOUND');
    assert(canReadEmployee(user, employee), 'Access denied.', 403, 'FORBIDDEN');
    return employee;
}

async function listEmployees(req, res) {
    const user = requireAuth(req);
    const role = toRole(user.role);
    assert(role !== 'employee', 'Employee directory list is not available for the employee role.', 403, 'FORBIDDEN');

    const search = String(getInput(req, 'search', '')).trim().toLowerCase();
    const department = String(getInput(req, 'department', '')).trim().toLowerCase();
    const employeeRole = String(getInput(req, 'role', '')).trim().toLowerCase();
    const managerId = String(getInput(req, 'manager_id', '')).trim();
    const status = String(getInput(req, 'status', '')).trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(String(getInput(req, 'page', '1')), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(getInput(req, 'limit', '100')), 10) || 100));

    const rows = await fetchEmployeesRows();
    let scoped = rows.filter(row => canReadEmployee(user, row));
    if (role === 'manager') {
        scoped = scoped.filter(row => String(row.manager_id || '') === String(user.employee_id || ''));
    }

    const filtered = scoped.filter(row => {
        if (department && String(row.department || '').trim().toLowerCase() !== department) return false;
        if (employeeRole && String(row.role || '').trim().toLowerCase() !== employeeRole) return false;
        if (managerId && String(row.manager_id || '').trim() !== managerId) return false;
        if (status && String(row.status || 'active').trim().toLowerCase() !== status) return false;
        if (search && !buildEmployeeSearchIndex(row).includes(search)) return false;
        return true;
    });

    const start = (page - 1) * limit;
    const employees = filtered.slice(start, start + limit);

    return res.json({
        success: true,
        source: 'supabase',
        employees,
        total: filtered.length,
        page,
    });
}

async function getEmployee(req, res) {
    const user = requireAuth(req);
    const employeeId = String(getInput(req, 'employee_id', '')).trim();
    assert(employeeId, 'employee_id is required.');

    const employee = await fetchEmployeeById(employeeId);
    assert(Boolean(employee), 'Employee not found.', 404, 'NOT_FOUND');
    assert(canReadEmployee(user, employee), 'Access denied.', 403, 'FORBIDDEN');

    return res.json({ success: true, employee });
}

async function createEmployee(req, res) {
    const user = requireAuth(req);
    const role = toRole(user.role);
    assert(role === 'superadmin' || role === 'hr', 'Only superadmin or HR can create employees.', 403, 'FORBIDDEN');

    const name = normalizeString(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const department = normalizeString(req.body?.department);
    const position = normalizeString(req.body?.position);
    const employeeRole = normalizeEmployeeRole(req.body?.role || 'employee');
    const managerId = normalizeString(req.body?.manager_id);
    const joinDate = normalizeString(req.body?.join_date);

    assert(name, 'Name is required.');
    assert(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'A valid email is required.');
    assert(department, 'Department is required.');
    assert(position, 'Position is required.');

    await assertUniqueEmail(email);
    await assertManagerExists(managerId);

    const employeeId = await generateNextEmployeeId();
    const temporaryPassword = generateTemporaryPassword();

    let authUser = null;
    let employee = null;
    try {
        authUser = await createSupabaseAuthUser({
            email,
            password: temporaryPassword,
            role: employeeRole,
            employeeId,
            name,
        });

        const inserted = await supabaseTableRequest({
            table: 'employees',
            method: 'POST',
            body: [{
                employee_id: employeeId,
                name,
                email,
                auth_email: email,
                auth_id: authUser.id,
                department,
                position,
                role: employeeRole,
                manager_id: managerId,
                join_date: joinDate,
                status: 'active',
                must_change_password: true,
            }],
            prefer: 'return=representation',
        });
        employee = inserted[0] || null;

        await upsertSupabaseProfile({
            userId: authUser.id,
            email,
            role: employeeRole,
            employeeId,
            name,
            department,
            position,
        });

        return res.json({ success: true, employee });
    } catch (error) {
        if (employee?.employee_id) {
            await supabaseTableRequest({
                table: 'employees',
                method: 'DELETE',
                filters: { employee_id: { type: 'eq', value: employee.employee_id } },
                prefer: 'return=minimal',
            }).catch(() => {});
        }
        if (authUser?.id) {
            await deleteSupabaseAuthUser(authUser.id).catch(() => {});
        }
        throw error;
    }
}

async function updateEmployee(req, res) {
    const user = requireAuth(req);
    const employeeId = String(req.body?.employee_id || '').trim();
    assert(employeeId, 'employee_id is required.');

    const existing = await fetchEmployeeById(employeeId);
    assert(Boolean(existing), 'Employee not found.', 404, 'NOT_FOUND');
    assert(canManageEmployee(user, existing), 'Access denied.', 403, 'FORBIDDEN');

    const actorRole = toRole(user.role);
    const allowedFields = actorRole === 'manager' ? EDITABLE_MANAGER_FIELDS : EDITABLE_ADMIN_FIELDS;
    const patch = {};

    for (const [key, value] of Object.entries(req.body || {})) {
        if (key === 'employee_id' || value === undefined) continue;
        if (!allowedFields.has(key)) continue;
        patch[key] = key === 'email'
            ? String(value || '').trim().toLowerCase()
            : normalizeString(value);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'email')) {
        assert(patch.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email), 'A valid email is required.');
        await assertUniqueEmail(patch.email, employeeId);
        patch.auth_email = patch.email;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'role')) {
        patch.role = normalizeEmployeeRole(patch.role);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'manager_id')) {
        await assertManagerExists(patch.manager_id);
    }

    assert(Object.keys(patch).length > 0, 'No editable fields were provided.');

    const updatedRows = await supabaseTableRequest({
        table: 'employees',
        method: 'PATCH',
        filters: { employee_id: { type: 'eq', value: employeeId } },
        body: patch,
        prefer: 'return=representation',
    });
    const employee = updatedRows[0] || await fetchEmployeeById(employeeId);

    if ((patch.email || patch.role || patch.name) && employee?.auth_id) {
        await updateSupabaseAuthUser(employee.auth_id, {
            email: String(employee.auth_email || employee.email || '').trim().toLowerCase(),
            role: String(employee.role || '').trim().toLowerCase(),
            employeeId: employee.employee_id,
            name: employee.name,
        });
    }
    if (employee?.auth_id) {
        await upsertSupabaseProfile({
            userId: employee.auth_id,
            email: String(employee.auth_email || employee.email || '').trim().toLowerCase(),
            role: String(employee.role || '').trim().toLowerCase(),
            employeeId: employee.employee_id,
            name: employee.name,
            department: employee.department,
            position: employee.position,
        });
    }

    return res.json({ success: true, employee });
}

async function toggleEmployeeStatus(req, res) {
    const user = requireAuth(req);
    const role = toRole(user.role);
    assert(role === 'superadmin' || role === 'hr', 'Only superadmin or HR can change employee status.', 403, 'FORBIDDEN');

    const employeeId = String(req.body?.employee_id || '').trim();
    const status = normalizeStatus(req.body?.status);
    assert(employeeId, 'employee_id is required.');

    const existing = await fetchEmployeeById(employeeId);
    assert(Boolean(existing), 'Employee not found.', 404, 'NOT_FOUND');

    const updatedRows = await supabaseTableRequest({
        table: 'employees',
        method: 'PATCH',
        filters: { employee_id: { type: 'eq', value: employeeId } },
        body: { status },
        prefer: 'return=representation',
    });

    return res.json({ success: true, employee: updatedRows[0] || await fetchEmployeeById(employeeId) });
}

async function employeeInsights(req, res) {
    const user = requireAuth(req);
    const employeeId = String(getInput(req, 'employee_id', '')).trim();
    assert(employeeId, 'employee_id is required.');

    await resolveInsightAccessEmployee(user, employeeId);

    const [kpiRows, assessmentRows, lmsRows] = await Promise.all([
        supabaseTableRequest({
            table: 'kpi_records',
            method: 'GET',
            select: 'period,value,target_snapshot,submitted_at,created_at',
            filters: { employee_id: { type: 'eq', value: employeeId } },
            limit: 200,
        }),
        supabaseTableRequest({
            table: 'training_need_records',
            method: 'GET',
            select: 'gap_level,gap_score,priority,status,identified_at,created_at',
            filters: { employee_id: { type: 'eq', value: employeeId } },
            limit: 200,
        }),
        supabaseTableRequest({
            table: 'course_enrollments',
            method: 'GET',
            select: 'status',
            filters: { employee_id: { type: 'eq', value: employeeId } },
            limit: 200,
        }),
    ]);

    return res.json({
        success: true,
        source: 'supabase',
        insights: {
            kpi: deriveKpiInsights(kpiRows),
            assessment: deriveTnaInsights(assessmentRows),
            lms: deriveLmsInsights(lmsRows),
        },
    });
}

export async function handleEmployeesAction(req, res, action) {
    if (action === 'employees/list') return listEmployees(req, res);
    if (action === 'employees/get') return getEmployee(req, res);
    if (action === 'employees/create') return createEmployee(req, res);
    if (action === 'employees/update') return updateEmployee(req, res);
    if (action === 'employees/toggle-status') return toggleEmployeeStatus(req, res);
    if (action === 'employees/insights') return employeeInsights(req, res);

    const error = new Error(`Unknown employees action: ${action}`);
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
}
