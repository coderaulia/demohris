import crypto from 'node:crypto';

import { supabaseTableRequest } from '../compat/supabaseAdmin.js';

const ALLOWED_ROLES = new Set(['superadmin', 'hr']);

function requireSettingsUser(req) {
    const user = req.currentUser;
    if (!user) {
        const error = new Error('Authentication required.');
        error.status = 401;
        error.code = 'AUTH_REQUIRED';
        throw error;
    }

    const role = String(user.role || '').trim().toLowerCase();
    if (!ALLOWED_ROLES.has(role)) {
        const error = new Error('Access denied.');
        error.status = 403;
        error.code = 'FORBIDDEN';
        throw error;
    }

    return user;
}

function nowIso() {
    return new Date().toISOString();
}

function requireNonEmptyString(value, fieldName) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        const error = new Error(`${fieldName} is required.`);
        error.status = 400;
        error.code = 'INVALID_INPUT';
        throw error;
    }
    return normalized;
}

function normalizeCompetencyPayload(rows = []) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    return normalizedRows.map((row) => ({
        name: requireNonEmptyString(row?.name, 'competency name'),
        level: Math.max(1, Math.min(5, Number(row?.level || 1))),
    }));
}

function parseOrgSettingsSave(body = {}) {
    return {
        seniority_levels: Array.isArray(body.seniority_levels)
            ? body.seniority_levels.map((item) => String(item || '').trim()).filter(Boolean)
            : [],
        departments: Array.isArray(body.departments)
            ? body.departments.map((department) => ({
                id: department?.id ? String(department.id).trim() : undefined,
                name: requireNonEmptyString(department?.name, 'department name'),
                positions: Array.isArray(department?.positions)
                    ? department.positions.map((position) => ({
                        id: position?.id ? String(position.id).trim() : undefined,
                        name: requireNonEmptyString(position?.name, 'position name'),
                    }))
                    : [],
            }))
            : [],
    };
}

function parsePositionCreate(body = {}) {
    return {
        name: requireNonEmptyString(body.name, 'name'),
        department_id: body.department_id ? String(body.department_id).trim() : null,
    };
}

function parsePositionUpdate(body = {}) {
    return {
        position_id: requireNonEmptyString(body.position_id, 'position_id'),
        name: requireNonEmptyString(body.name, 'name'),
        department_id: body.department_id ? String(body.department_id).trim() : null,
    };
}

function parseCompetencyCreate(body = {}) {
    return {
        name: requireNonEmptyString(body.name, 'name'),
        department_id: body.department_id ? String(body.department_id).trim() : null,
        competencies: normalizeCompetencyPayload(body.competencies),
    };
}

function parseCompetencyUpdate(body = {}) {
    return {
        position_id: requireNonEmptyString(body.position_id, 'position_id'),
        name: requireNonEmptyString(body.name, 'name'),
        department_id: body.department_id ? String(body.department_id).trim() : null,
        competencies: normalizeCompetencyPayload(body.competencies),
    };
}

function normalizeCompetencies(rows = []) {
    return rows
        .map((row) => ({
            name: String(row?.name || '').trim(),
            level: Number(row?.level || 0),
        }))
        .filter((row) => row.name && Number.isFinite(row.level) && row.level >= 1 && row.level <= 5);
}

async function fetchDepartments() {
    return supabaseTableRequest({
        table: 'departments',
        method: 'GET',
        select: 'id,name',
        order: 'name.asc',
        limit: 500,
    });
}

async function fetchPositions() {
    return supabaseTableRequest({
        table: 'positions',
        method: 'GET',
        select: 'id,name,department_id,competencies',
        order: 'name.asc',
        limit: 1000,
    });
}

async function fetchOrgSettingsRow() {
    const rows = await supabaseTableRequest({
        table: 'org_settings',
        method: 'GET',
        select: 'id,seniority_levels',
        filters: {
            id: { type: 'eq', value: 'default' },
        },
        limit: 1,
    });
    return rows[0] || { id: 'default', seniority_levels: [] };
}

async function getOrgSettings(req, res) {
    requireSettingsUser(req);

    const [orgSettings, departments, positions] = await Promise.all([
        fetchOrgSettingsRow(),
        fetchDepartments(),
        fetchPositions(),
    ]);

    const departmentMap = new Map(
        departments.map((department) => [String(department.id), {
            id: String(department.id),
            name: String(department.name || ''),
            positions: [],
        }]),
    );

    for (const position of positions) {
        const departmentId = String(position.department_id || '').trim();
        if (!departmentId || !departmentMap.has(departmentId)) continue;
        departmentMap.get(departmentId).positions.push({
            id: String(position.id),
            name: String(position.name || ''),
            department_id: departmentId,
        });
    }

    return res.json({
        success: true,
        org_settings: {
            seniority_levels: Array.isArray(orgSettings.seniority_levels) ? orgSettings.seniority_levels : [],
        },
        departments: [...departmentMap.values()],
    });
}

async function saveOrgSettings(req, res) {
    requireSettingsUser(req);
    const parsed = parseOrgSettingsSave(req.body || {});

    const [existingDepartments, existingPositions] = await Promise.all([
        fetchDepartments(),
        fetchPositions(),
    ]);

    const incomingDepartmentIds = new Set();
    const incomingPositionIds = new Set();
    const usedDepartmentNames = new Set();
    const usedPositionNames = new Set();

    for (const department of parsed.departments) {
        const departmentName = String(department.name || '').trim();
        if (usedDepartmentNames.has(departmentName.toLowerCase())) {
            const error = new Error(`Duplicate department name: ${departmentName}`);
            error.status = 409;
            error.code = 'DUPLICATE';
            throw error;
        }
        usedDepartmentNames.add(departmentName.toLowerCase());

        const departmentId = String(department.id || '').trim() || crypto.randomUUID();
        incomingDepartmentIds.add(departmentId);

        const departmentExists = existingDepartments.find((row) => String(row.id) === departmentId);
        const departmentPayload = {
            name: departmentName,
            updated_at: nowIso(),
        };

        if (departmentExists) {
            await supabaseTableRequest({
                table: 'departments',
                method: 'PATCH',
                filters: { id: { type: 'eq', value: departmentId } },
                body: departmentPayload,
                prefer: 'return=minimal',
            });
        } else {
            await supabaseTableRequest({
                table: 'departments',
                method: 'POST',
                body: [{
                    id: departmentId,
                    ...departmentPayload,
                }],
                prefer: 'return=minimal',
            });
        }

        for (const position of department.positions) {
            const positionName = String(position.name || '').trim();
            if (usedPositionNames.has(positionName.toLowerCase())) {
                const error = new Error(`Duplicate position name: ${positionName}`);
                error.status = 409;
                error.code = 'DUPLICATE';
                throw error;
            }
            usedPositionNames.add(positionName.toLowerCase());

            const positionId = String(position.id || '').trim() || crypto.randomUUID();
            incomingPositionIds.add(positionId);
            const positionExists = existingPositions.find((row) => String(row.id) === positionId);
            const currentCompetencies = positionExists?.competencies ?? [];
            const positionPayload = {
                name: positionName,
                department_id: departmentId,
                competencies: Array.isArray(currentCompetencies) ? currentCompetencies : [],
                updated_at: nowIso(),
            };

            if (positionExists) {
                await supabaseTableRequest({
                    table: 'positions',
                    method: 'PATCH',
                    filters: { id: { type: 'eq', value: positionId } },
                    body: positionPayload,
                    prefer: 'return=minimal',
                });
            } else {
                await supabaseTableRequest({
                    table: 'positions',
                    method: 'POST',
                    body: [{
                        id: positionId,
                        ...positionPayload,
                    }],
                    prefer: 'return=minimal',
                });
            }
        }
    }

    for (const existingPosition of existingPositions) {
        const id = String(existingPosition.id);
        if (incomingPositionIds.has(id)) continue;
        await supabaseTableRequest({
            table: 'positions',
            method: 'DELETE',
            filters: { id: { type: 'eq', value: id } },
            prefer: 'return=minimal',
        });
    }

    for (const existingDepartment of existingDepartments) {
        const id = String(existingDepartment.id);
        if (incomingDepartmentIds.has(id)) continue;
        await supabaseTableRequest({
            table: 'departments',
            method: 'DELETE',
            filters: { id: { type: 'eq', value: id } },
            prefer: 'return=minimal',
        });
    }

    await supabaseTableRequest({
        table: 'org_settings',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: 'default' } },
        body: {
            seniority_levels: parsed.seniority_levels,
            updated_at: nowIso(),
        },
        prefer: 'return=minimal',
    }).catch(async () => {
        await supabaseTableRequest({
            table: 'org_settings',
            method: 'POST',
            body: [{
                id: 'default',
                seniority_levels: parsed.seniority_levels,
                updated_at: nowIso(),
            }],
            prefer: 'return=minimal',
        });
    });

    return getOrgSettings(req, res);
}

async function listPositions(req, res) {
    requireSettingsUser(req);
    const positions = await fetchPositions();
    return res.json({
        success: true,
        positions: positions.map((position) => ({
            id: String(position.id),
            name: String(position.name || ''),
            department_id: position.department_id ? String(position.department_id) : null,
        })),
    });
}

async function createPosition(req, res) {
    requireSettingsUser(req);
    const parsed = parsePositionCreate(req.body || {});
    const rows = await supabaseTableRequest({
        table: 'positions',
        method: 'POST',
        body: [{
            id: crypto.randomUUID(),
            name: parsed.name,
            department_id: parsed.department_id || null,
            competencies: [],
            updated_at: nowIso(),
        }],
        prefer: 'return=representation',
    });

    return res.json({
        success: true,
        position: {
            id: String(rows[0].id),
            name: String(rows[0].name || ''),
            department_id: rows[0].department_id ? String(rows[0].department_id) : null,
        },
    });
}

async function updatePosition(req, res) {
    requireSettingsUser(req);
    const parsed = parsePositionUpdate(req.body || {});
    const rows = await supabaseTableRequest({
        table: 'positions',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: parsed.position_id } },
        body: {
            name: parsed.name,
            department_id: parsed.department_id || null,
            updated_at: nowIso(),
        },
        prefer: 'return=representation',
    });

    if (!rows[0]) {
        const error = new Error('Position not found.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        throw error;
    }

    return res.json({
        success: true,
        position: {
            id: String(rows[0].id),
            name: String(rows[0].name || ''),
            department_id: rows[0].department_id ? String(rows[0].department_id) : null,
        },
    });
}

async function deletePosition(req, res) {
    requireSettingsUser(req);
    const positionId = String(req.body?.position_id || '').trim();
    if (!positionId) {
        const error = new Error('position_id is required.');
        error.status = 400;
        error.code = 'INVALID_INPUT';
        throw error;
    }

    await supabaseTableRequest({
        table: 'positions',
        method: 'DELETE',
        filters: { id: { type: 'eq', value: positionId } },
        prefer: 'return=minimal',
    });

    return res.json({ success: true });
}

async function listCompetencyMatrices(req, res) {
    requireSettingsUser(req);

    const [positions, departments] = await Promise.all([fetchPositions(), fetchDepartments()]);
    const departmentNameById = new Map(departments.map((department) => [String(department.id), String(department.name || '')]));

    return res.json({
        success: true,
        positions: positions.map((position) => ({
            id: String(position.id),
            name: String(position.name || ''),
            department_id: position.department_id ? String(position.department_id) : null,
            department_name: position.department_id ? (departmentNameById.get(String(position.department_id)) || null) : null,
            competencies: normalizeCompetencies(Array.isArray(position.competencies) ? position.competencies : []),
        })),
    });
}

async function createCompetencyMatrix(req, res) {
    requireSettingsUser(req);
    const parsed = parseCompetencyCreate(req.body || {});
    const rows = await supabaseTableRequest({
        table: 'positions',
        method: 'POST',
        body: [{
            id: crypto.randomUUID(),
            name: parsed.name,
            department_id: parsed.department_id || null,
            competencies: normalizeCompetencies(parsed.competencies),
            updated_at: nowIso(),
        }],
        prefer: 'return=representation',
    });

    return res.json({
        success: true,
        position: {
            id: String(rows[0].id),
            name: String(rows[0].name || ''),
            department_id: rows[0].department_id ? String(rows[0].department_id) : null,
            department_name: null,
            competencies: normalizeCompetencies(Array.isArray(rows[0].competencies) ? rows[0].competencies : []),
        },
    });
}

async function updateCompetencyMatrix(req, res) {
    requireSettingsUser(req);
    const parsed = parseCompetencyUpdate(req.body || {});
    const rows = await supabaseTableRequest({
        table: 'positions',
        method: 'PATCH',
        filters: { id: { type: 'eq', value: parsed.position_id } },
        body: {
            name: parsed.name,
            department_id: parsed.department_id || null,
            competencies: normalizeCompetencies(parsed.competencies),
            updated_at: nowIso(),
        },
        prefer: 'return=representation',
    });

    if (!rows[0]) {
        const error = new Error('Position not found.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        throw error;
    }

    return res.json({
        success: true,
        position: {
            id: String(rows[0].id),
            name: String(rows[0].name || ''),
            department_id: rows[0].department_id ? String(rows[0].department_id) : null,
            department_name: null,
            competencies: normalizeCompetencies(Array.isArray(rows[0].competencies) ? rows[0].competencies : []),
        },
    });
}

async function deleteCompetencyMatrix(req, res) {
    return deletePosition(req, res);
}

export async function handleSettingsAction(req, res, action) {
    if (action === 'settings/org/get') return getOrgSettings(req, res);
    if (action === 'settings/org/save') return saveOrgSettings(req, res);
    if (action === 'settings/positions/list') return listPositions(req, res);
    if (action === 'settings/positions/create') return createPosition(req, res);
    if (action === 'settings/positions/update') return updatePosition(req, res);
    if (action === 'settings/positions/delete') return deletePosition(req, res);
    if (action === 'settings/competencies/list') return listCompetencyMatrices(req, res);
    if (action === 'settings/competencies/create') return createCompetencyMatrix(req, res);
    if (action === 'settings/competencies/update') return updateCompetencyMatrix(req, res);
    if (action === 'settings/competencies/delete') return deleteCompetencyMatrix(req, res);

    const error = new Error(`Unknown settings action: ${action}`);
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
}
