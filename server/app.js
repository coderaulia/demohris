import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import session from 'express-session';

import { pool } from './pool.js';
import { createDualAuthBridgeMiddleware } from './compat/authBridge.js';
import { resolveEffectiveModulesRole, validateModulesActionAccess } from './compat/modulesAccess.js';
import { verifySupabaseJwt, syncSupabaseProfileFromEmployee } from './compat/supabaseClient.js';
import { normalizeAuthSessionResponse, normalizeErrorResponse } from './compat/responseNormalizer.js';
import { getTableMeta, getRegisteredTables, isTableRegistered, isTableReadable, isTableWritable } from './modules/registry.js';
import { isFeatureEnabled } from './features.js';
import { isTnaEnabled, handleTnaAction } from './modules/tna.js';
import { handleLmsAction } from './modules/lms.js';
import { handleEmployeesAction } from './modules/employees.js';
import { handleKpiAction } from './modules/kpi.js';
import { handleDashboardAction } from './modules/dashboard.js';
import {
    getAllModules,
    getModule,
    updateModuleSettings,
    toggleModule,
    getModuleActivityLog,
    getModulesByCategory,
    getActiveModules
} from './modules/moduleManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = String(process.env.SESSION_SECRET || 'change-this-in-production');
const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
const SESSION_COOKIE_DOMAIN = String(process.env.SESSION_COOKIE_DOMAIN || '').trim();
const SESSION_COOKIE_SAME_SITE = String(
    process.env.SESSION_COOKIE_SAME_SITE
    || (CORS_ALLOWED_ORIGINS.length > 0 ? 'none' : 'lax')
).trim().toLowerCase();
const SESSION_COOKIE_SECURE = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.SESSION_COOKIE_SECURE || (SESSION_COOKIE_SAME_SITE === 'none' ? 'true' : process.env.NODE_ENV === 'production')).trim().toLowerCase()
);

class ApiError extends Error {
    constructor(status, message, code = 'APP_ERROR', details = '') {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeId(value) {
    const raw = String(value || '').trim();
    if (!/^[A-Za-z0-9_]+$/.test(raw)) {
        throw new ApiError(400, `Invalid identifier: ${value}`, 'INVALID_IDENTIFIER');
    }
    return `\`${raw}\``;
}

function parseMaybeJson(value) {
    if (value === null || value === undefined || value === '') return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
        return value;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

function normalizeRow(table, row) {
    if (!row) return null;
    const meta = getTableMeta(table) || {};
    const next = { ...row };

    for (const key of meta.jsonColumns || []) {
        next[key] = parseMaybeJson(next[key]);
        if (next[key] === null || next[key] === undefined || next[key] === '') {
            next[key] = key === 'kpi_targets' || key === 'detail' ? {} : [];
        }
    }

    for (const key of meta.booleanColumns || []) {
        next[key] = Boolean(Number(next[key]));
    }

    for (const key of meta.hiddenColumns || []) {
        delete next[key];
    }

    return next;
}

function prepareWritePayload(table, row = {}) {
    const meta = getTableMeta(table) || {};
    const next = {};

    for (const [key, value] of Object.entries(row || {})) {
        if (value === undefined) continue;
        if ((meta.jsonColumns || []).includes(key)) {
            next[key] = JSON.stringify(value ?? ((key === 'kpi_targets' || key === 'detail') ? {} : []));
            continue;
        }
        if ((meta.booleanColumns || []).includes(key)) {
            next[key] = value ? 1 : 0;
            continue;
        }
        next[key] = value;
    }

    return next;
}

function getPrimaryKey(table) {
    const meta = getTableMeta(table);
    if (!meta?.primaryKey) {
        throw new ApiError(400, `Unknown table: ${table}`, 'TABLE_NOT_FOUND');
    }
    return meta.primaryKey;
}

function buildWhere(filters = [], values = []) {
    const clauses = [];
    for (const filter of filters || []) {
        const column = escapeId(filter?.column);
        const op = String(filter?.op || 'eq');
        if (op === 'eq') {
            if (filter?.value === null) {
                clauses.push(`${column} IS NULL`);
            } else {
                clauses.push(`${column} = ?`);
                values.push(filter?.value ?? null);
            }
            continue;
        }
        if (op === 'in') {
            const items = Array.isArray(filter?.values) ? filter.values : [];
            if (items.length === 0) {
                clauses.push('1 = 0');
            } else {
                clauses.push(`${column} IN (${items.map(() => '?').join(', ')})`);
                values.push(...items);
            }
            continue;
        }
        throw new ApiError(400, `Unsupported filter operator: ${op}`, 'INVALID_FILTER');
    }

    return clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
}

function buildOrder(orders = []) {
    if (!Array.isArray(orders) || orders.length === 0) return '';
    return ` ORDER BY ${orders.map(order => `${escapeId(order?.column)} ${order?.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
}

export async function queryRows(table, { filters = [], orders = [], limit = null } = {}) {
    const values = [];
    let sql = `SELECT * FROM ${escapeId(table)}`;
    sql += buildWhere(filters, values);
    sql += buildOrder(orders);
    if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
        sql += ` LIMIT ${Number(limit)}`;
    }

    const [rows] = await pool.query(sql, values);
    return rows.map(row => normalizeRow(table, row));
}

export async function getRowByPrimaryKey(table, id) {
    const primaryKey = getPrimaryKey(table);
    const rows = await queryRows(table, {
        filters: [{ op: 'eq', column: primaryKey, value: id }],
        limit: 1,
    });
    return rows[0] || null;
}

async function findSingleRow(table, columns, sourceRow = {}) {
    const filters = columns.map(column => ({
        op: 'eq',
        column,
        value: sourceRow[column] ?? null,
    }));
    const rows = await queryRows(table, { filters, limit: 1 });
    return rows[0] || null;
}

function currentUserRole(user) {
    return String(user?.role || '').toLowerCase();
}

function isLeadershipRole(role) {
    return ['superadmin', 'manager', 'director', 'hr'].includes(String(role || '').toLowerCase());
}

async function getCurrentUser(req) {
    if (req.currentUserLoaded) return req.currentUser;
    req.currentUserLoaded = true;
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
        req.currentUser = null;
        return null;
    }

    let profile = null;
    try {
        profile = await getRowByPrimaryKey('employees', sessionUserId);
    } catch (err) {
        console.warn('MySQL employee profile lookup failed, using Supabase fallback:', err.message);
    }

    if (!profile) {
        const rows = await fetchSupabaseEmployeeRows({
            filters: { employee_id: sessionUserId },
            limit: 1,
        });
        profile = rows[0] || null;
    }

    if (!profile) {
        req.session.userId = null;
        req.currentUser = null;
        return null;
    }

    req.currentUser = profile;
    return profile;
}

async function resolveSessionBridgeUser(sessionUserId) {
    if (!sessionUserId) return null;
    try {
        const row = await getRowByPrimaryKey('employees', sessionUserId);
        if (row) return row;
    } catch (err) {
        console.warn('resolveSessionBridgeUser MySQL failed, using Supabase fallback:', err.message);
    }
    const rows = await fetchSupabaseEmployeeRows({ filters: { employee_id: sessionUserId }, limit: 1 });
    return rows[0] || null;
}

let employeesEmailColumnKnown = null;

async function hasEmployeesEmailColumn() {
    if (employeesEmailColumnKnown !== null) return employeesEmailColumnKnown;
    try {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS cnt
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'employees'
               AND COLUMN_NAME = 'email'`
        );
        employeesEmailColumnKnown = Number(rows?.[0]?.cnt || 0) > 0;
    } catch {
        employeesEmailColumnKnown = false;
    }
    return employeesEmailColumnKnown;
}

function getSupabaseServiceConfig() {
    const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceRoleKey) {
        return null;
    }
    return { supabaseUrl, serviceRoleKey };
}

async function fetchSupabaseEmployeeRows({ filters = {}, limit = 1 } = {}) {
    const config = getSupabaseServiceConfig();
    if (!config) return [];

    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('limit', String(Math.max(1, Number.parseInt(limit, 10) || 1)));

    for (const [column, value] of Object.entries(filters || {})) {
        if (value === null || value === undefined || value === '') continue;
        params.set(column, `eq.${value}`);
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/employees?${params.toString()}`, {
        method: 'GET',
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        console.warn('Supabase employee read fallback failed:', response.status, details);
        return [];
    }

    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
}

async function findEmployeeByAuthIdSupabase(sub) {
    if (!sub) return null;
    const rows = await fetchSupabaseEmployeeRows({
        filters: { auth_id: sub },
        limit: 1,
    });
    return rows[0] || null;
}

async function findEmployeeByMappedEmailSupabase(email) {
    if (!email) return null;

    const byAuthEmail = await fetchSupabaseEmployeeRows({
        filters: { auth_email: email },
        limit: 1,
    });
    if (byAuthEmail[0]) return byAuthEmail[0];

    const byEmail = await fetchSupabaseEmployeeRows({
        filters: { email },
        limit: 1,
    });
    return byEmail[0] || null;
}

async function assignJwtIdentityToEmployeeSupabase(employeeId, { sub, email }) {
    const config = getSupabaseServiceConfig();
    if (!config || !employeeId || !sub) return false;

    const targetEmail = String(email || '').trim().toLowerCase();
    const response = await fetch(
        `${config.supabaseUrl}/rest/v1/employees?employee_id=eq.${encodeURIComponent(employeeId)}`,
        {
            method: 'PATCH',
            headers: {
                apikey: config.serviceRoleKey,
                Authorization: `Bearer ${config.serviceRoleKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                auth_id: sub,
                auth_email: targetEmail || null,
            }),
        }
    );

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        console.warn('Supabase employee auth binding fallback failed:', response.status, details);
        return false;
    }
    return true;
}

async function findEmployeeByAuthId(sub) {
    if (!sub) return null;
    const rows = await queryRows('employees', {
        filters: [{ op: 'eq', column: 'auth_id', value: sub }],
        limit: 1,
    });
    return rows[0] || null;
}

async function findEmployeeByMappedEmail(email) {
    if (!email) return null;

    const byAuthEmail = await queryRows('employees', {
        filters: [{ op: 'eq', column: 'auth_email', value: email }],
        limit: 1,
    });
    if (byAuthEmail[0]) return byAuthEmail[0];

    if (await hasEmployeesEmailColumn()) {
        try {
            const byEmail = await queryRows('employees', {
                filters: [{ op: 'eq', column: 'email', value: email }],
                limit: 1,
            });
            if (byEmail[0]) return byEmail[0];
        } catch {
            // Keep bridge resilient if email column exists in some envs only.
        }
    }

    return null;
}

async function assignJwtIdentityToEmployee(employeeId, { sub, email }) {
    if (!employeeId || !sub) return;
    await pool.query(
        `UPDATE employees
         SET auth_id = ?,
             auth_email = COALESCE(NULLIF(?, ''), auth_email)
         WHERE employee_id = ?`,
        [sub, String(email || '').trim().toLowerCase(), employeeId]
    );
}

async function syncSupabaseProfileSafe({ claims, employee }) {
    try {
        await syncSupabaseProfileFromEmployee({ claims, employee });
    } catch (error) {
        console.warn('Supabase profile sync failed:', error?.message || error);
    }
}

async function resolveJwtBridgeUser(claims = {}) {
    const sub = String(claims?.sub || '').trim();
    const email = String(claims?.email || '').trim().toLowerCase();

    let byAuthId = null;
    let byEmail = null;
    let mysqlLookupFailed = false;
    try {
        byAuthId = await findEmployeeByAuthId(sub);
        byEmail = await findEmployeeByMappedEmail(email);
    } catch (error) {
        mysqlLookupFailed = true;
        console.warn('MySQL JWT bridge lookup failed, using Supabase employee fallback:', error?.message || error);
    }

    if (!byAuthId) {
        byAuthId = await findEmployeeByAuthIdSupabase(sub);
    }
    if (!byEmail) {
        byEmail = await findEmployeeByMappedEmailSupabase(email);
    }

    // Safety: prevent ambiguous identity binding.
    if (byAuthId && byEmail && String(byAuthId.employee_id) !== String(byEmail.employee_id)) {
        console.warn('JWT identity collision detected for sub/email mapping', {
            sub,
            email,
            authEmployeeId: byAuthId.employee_id,
            emailEmployeeId: byEmail.employee_id,
        });
        return null;
    }

    if (byAuthId) {
        await syncSupabaseProfileSafe({ claims, employee: byAuthId });
        return byAuthId;
    }

    if (byEmail) {
        // First JWT login path for legacy users: bind auth_id deterministically.
        if (!mysqlLookupFailed) {
            try {
                await assignJwtIdentityToEmployee(byEmail.employee_id, { sub, email });
            } catch (error) {
                console.warn('MySQL auth_id binding failed, falling back to Supabase patch:', error?.message || error);
                await assignJwtIdentityToEmployeeSupabase(byEmail.employee_id, { sub, email });
            }
        } else {
            await assignJwtIdentityToEmployeeSupabase(byEmail.employee_id, { sub, email });
        }

        let refreshed = null;
        if (!mysqlLookupFailed) {
            try {
                refreshed = await getRowByPrimaryKey('employees', byEmail.employee_id);
            } catch (error) {
                console.warn('MySQL employee refresh failed, using Supabase employee fallback:', error?.message || error);
            }
        }
        if (!refreshed) {
            refreshed = await fetchSupabaseEmployeeRows({
                filters: { employee_id: byEmail.employee_id },
                limit: 1,
            }).then(rows => rows[0] || null);
        }
        if (refreshed) {
            await syncSupabaseProfileSafe({ claims, employee: refreshed });
            return refreshed;
        }
    }

    return null;
}

const dualAuthBridgeMiddleware = createDualAuthBridgeMiddleware({
    resolveSessionUser: resolveSessionBridgeUser,
    resolveJwtUser: resolveJwtBridgeUser,
    verifyJwt: verifySupabaseJwt,
});

async function getAccessibleEmployeeIds(req) {
    const user = await getCurrentUser(req);
    if (!user) return new Set();
    if (req.accessibleEmployeeIds) return req.accessibleEmployeeIds;

    const role = currentUserRole(user);
    let rows = [];

    if (['superadmin', 'director', 'hr'].includes(role)) {
        rows = await queryRows('employees', { orders: [{ column: 'employee_id', ascending: true }] });
    } else if (role === 'manager') {
        const dept = String(user.department || '').trim();
        const filters = [];
        if (dept) {
            filters.push({ op: 'eq', column: 'department', value: dept });
        }
        rows = dept
            ? await queryRows('employees', { filters, orders: [{ column: 'employee_id', ascending: true }] })
            : await queryRows('employees', { orders: [{ column: 'employee_id', ascending: true }] });
        rows = rows.filter(row => row.employee_id === user.employee_id || row.manager_id === user.employee_id || (!dept || row.department === dept));
    } else {
        rows = [user];
    }

    req.accessibleEmployeeIds = new Set(rows.map(row => String(row.employee_id || '')));
    return req.accessibleEmployeeIds;
}

async function canAccessEmployee(req, employeeId) {
    const ids = await getAccessibleEmployeeIds(req);
    return ids.has(String(employeeId || ''));
}

async function getRelatedEmployeeId(req, table, row) {
    req.relationCache ||= new Map();

    const cacheLookup = async (cacheKey, resolver) => {
        if (req.relationCache.has(cacheKey)) return req.relationCache.get(cacheKey);
        const value = await resolver();
        req.relationCache.set(cacheKey, value);
        return value;
    };

    if (!row) return '';

    switch (table) {
        case 'employee_assessment_scores':
            return cacheLookup(`assessment:${row.assessment_id}`, async () => {
                const assessment = await getRowByPrimaryKey('employee_assessments', row.assessment_id);
                return assessment?.employee_id || '';
            });
        case 'probation_qualitative_items':
        case 'probation_monthly_scores':
        case 'probation_attendance_records':
            return cacheLookup(`probation:${row.probation_review_id}`, async () => {
                const review = await getRowByPrimaryKey('probation_reviews', row.probation_review_id);
                return review?.employee_id || '';
            });
        case 'pip_actions':
            return cacheLookup(`pip:${row.pip_plan_id}`, async () => {
                const plan = await getRowByPrimaryKey('pip_plans', row.pip_plan_id);
                return plan?.employee_id || '';
            });
        default:
            return row.employee_id || row.actor_employee_id || '';
    }
}

async function canReadRow(req, table, row) {
    if (isTableRegistered(table)) {
        return isTableReadable(req, table, row);
    }

    const user = await getCurrentUser(req);
    if (table === 'app_settings') return true;
    if (!user) return false;

    switch (table) {
        case 'competency_config':
        case 'kpi_definitions':
        case 'kpi_definition_versions':
        case 'kpi_weight_profiles':
        case 'kpi_weight_items':
            return true;
        case 'admin_activity_log':
            return isLeadershipRole(user.role) || String(row.actor_employee_id || '') === String(user.employee_id || '');
        default: {
            const employeeId = await getRelatedEmployeeId(req, table, row);
            if (!employeeId) return false;
            return canAccessEmployee(req, employeeId);
        }
    }
}

async function canWriteRow(req, table, row, action = 'update') {
    if (isTableRegistered(table)) {
        return isTableWritable(req, table, row, action);
    }

    const user = await getCurrentUser(req);
    if (!user) return false;
    const role = currentUserRole(user);

    switch (table) {
        case 'app_settings':
            return role === 'superadmin' || role === 'hr';
        case 'competency_config':
            return role === 'superadmin' || role === 'manager';
        case 'employees':
            if (action === 'insert' || action === 'delete') return role === 'superadmin';
            if (role === 'superadmin') return true;
            return canAccessEmployee(req, row.employee_id);
        case 'admin_activity_log':
            return String(row.actor_employee_id || '') === String(user.employee_id || '');
        case 'kpi_definitions':
        case 'kpi_definition_versions':
            return ['superadmin', 'manager', 'hr'].includes(role);
        case 'kpi_weight_profiles':
        case 'kpi_weight_items':
            return ['superadmin', 'hr'].includes(role);
        default: {
            const employeeId = await getRelatedEmployeeId(req, table, row);
            if (!employeeId) return false;
            if (role === 'employee') return String(employeeId) === String(user.employee_id);
            return canAccessEmployee(req, employeeId);
        }
    }
}

function sameValue(a, b) {
    if (typeof a === 'object' || typeof b === 'object') {
        return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    }
    return String(a ?? '') === String(b ?? '');
}

function enforceEmployeeMutationPolicy(user, existingRow, nextRow) {
    if (!existingRow) return;
    if (currentUserRole(user) === 'superadmin') return;

    const protectedFields = ['role', 'department', 'manager_id', 'auth_email', 'auth_id', 'password_hash'];
    for (const key of protectedFields) {
        if (Object.prototype.hasOwnProperty.call(nextRow, key) && !sameValue(existingRow[key], nextRow[key])) {
            throw new ApiError(403, `Access denied: ${key} is restricted to superadmin.`, 'FORBIDDEN_FIELD');
        }
    }
}

async function insertRow(table, row) {
    const meta = getTableMeta(table);
    const primaryKey = getPrimaryKey(table);
    const prepared = prepareWritePayload(table, row);

    if (meta.autoUuid && !prepared[primaryKey]) {
        prepared[primaryKey] = crypto.randomUUID();
    }

    const columns = Object.keys(prepared);
    if (columns.length === 0) {
        throw new ApiError(400, `No payload supplied for ${table}.`, 'EMPTY_PAYLOAD');
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${escapeId(table)} (${columns.map(escapeId).join(', ')}) VALUES (${placeholders})`;
    const values = columns.map(column => prepared[column]);
    const [result] = await pool.query(sql, values);

    if (meta.autoIncrement) {
        return getRowByPrimaryKey(table, result.insertId);
    }

    return getRowByPrimaryKey(table, prepared[primaryKey]);
}

async function upsertRow(table, row, onConflict = '') {
    const meta = getTableMeta(table);
    const primaryKey = getPrimaryKey(table);
    const conflictColumns = String(onConflict || primaryKey).split(',').map(item => item.trim()).filter(Boolean);
    const prepared = prepareWritePayload(table, row);

    if (meta.autoUuid && !prepared[primaryKey]) {
        prepared[primaryKey] = crypto.randomUUID();
    }

    const columns = Object.keys(prepared);
    if (columns.length === 0) {
        throw new ApiError(400, `No payload supplied for ${table}.`, 'EMPTY_PAYLOAD');
    }

    const placeholders = columns.map(() => '?').join(', ');
    const updateColumns = columns.filter(column => !conflictColumns.includes(column));
    const updateSql = updateColumns.length > 0
        ? updateColumns.map(column => `${escapeId(column)} = VALUES(${escapeId(column)})`).join(', ')
        : `${escapeId(primaryKey)} = VALUES(${escapeId(primaryKey)})`;

    const sql = `INSERT INTO ${escapeId(table)} (${columns.map(escapeId).join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateSql}`;
    const values = columns.map(column => prepared[column]);
    await pool.query(sql, values);

    return findSingleRow(table, conflictColumns, prepared);
}

async function updateRows(req, table, existingRows, patch = {}) {
    const primaryKey = getPrimaryKey(table);
    const updated = [];

    for (const existingRow of existingRows) {
        const candidate = { ...patch };
        if (table === 'employees') {
            enforceEmployeeMutationPolicy(req.currentUser, existingRow, candidate);
        }

        const prepared = prepareWritePayload(table, candidate);
        const columns = Object.keys(prepared);
        if (columns.length === 0) {
            updated.push(existingRow);
            continue;
        }

        const sql = `UPDATE ${escapeId(table)} SET ${columns.map(column => `${escapeId(column)} = ?`).join(', ')} WHERE ${escapeId(primaryKey)} = ?`;
        const values = [...columns.map(column => prepared[column]), existingRow[primaryKey]];
        await pool.query(sql, values);
        updated.push(await getRowByPrimaryKey(table, existingRow[primaryKey]));
    }

    return updated;
}

async function deleteRows(table, existingRows) {
    const primaryKey = getPrimaryKey(table);
    for (const row of existingRows) {
        await pool.query(`DELETE FROM ${escapeId(table)} WHERE ${escapeId(primaryKey)} = ?`, [row[primaryKey]]);
    }
}

async function requireAuth(req) {
    const user = await getCurrentUser(req);
    if (!user) {
        throw new ApiError(401, 'Authentication required.', 'AUTH_REQUIRED');
    }
    return user;
}

async function requireRole(req, roles = []) {
    const user = await requireAuth(req);
    if (!roles.includes(currentUserRole(user))) {
        throw new ApiError(403, 'Access denied.', 'FORBIDDEN');
    }
    return user;
}

async function handleAuthAction(req, res, action) {
    if (action === 'auth/login') {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required.', 'AUTH_INVALID');
        }

        let employee = null;
        let passwordHash = '';

        try {
            const rows = await queryRows('employees', {
                filters: [{ op: 'eq', column: 'auth_email', value: email }],
                limit: 1,
            });
            employee = rows[0] || null;
            const [rawRows] = await pool.query('SELECT password_hash FROM employees WHERE auth_email = ? LIMIT 1', [email]);
            passwordHash = rawRows?.[0]?.password_hash || '';
        } catch (err) {
            console.warn('MySQL auth lookup failed, using Supabase fallback:', err.message);
        }

        if (!employee || !passwordHash) {
            const supabaseRows = await fetchSupabaseEmployeeRows({
                filters: { auth_email: email },
                limit: 1,
            });
            employee = supabaseRows[0] || null;
            passwordHash = employee?.password_hash || '';
        }

        if (!employee || !passwordHash || !(await bcrypt.compare(password, passwordHash))) {
            throw new ApiError(401, 'Invalid credentials.', 'AUTH_INVALID');
        }

        req.session.userId = employee.employee_id;
        res.json({ profile: employee });
        return;
    }

    if (action === 'auth/logout') {
        req.session.destroy(() => {
            res.json({ ok: true });
        });
        return;
    }

    if (action === 'auth/session') {
        const user = await getCurrentUser(req);
        res.json(normalizeAuthSessionResponse(user || null));
        return;
    }

    if (action === 'auth/create-user') {
        await requireRole(req, ['superadmin']);
        const employeeId = String(req.body?.employee_id || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');

        if (!employeeId || !email || password.length < 6) {
            throw new ApiError(400, 'Employee, email, and password are required.', 'AUTH_INVALID');
        }

        const employee = await getRowByPrimaryKey('employees', employeeId);
        if (!employee) {
            throw new ApiError(404, 'Employee not found.', 'EMPLOYEE_NOT_FOUND');
        }

        const [existingRows] = await pool.query('SELECT employee_id FROM employees WHERE auth_email = ? AND employee_id <> ? LIMIT 1', [email, employeeId]);
        if (existingRows.length > 0) {
            throw new ApiError(409, 'This email is already registered to another employee.', 'EMAIL_EXISTS');
        }

        const authId = employee.auth_id || crypto.randomUUID();
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE employees SET auth_email = ?, auth_id = ?, password_hash = ?, must_change_password = 1, password_reset_requested_at = NULL WHERE employee_id = ?',
            [email, authId, hash, employeeId]
        );

        const updated = await getRowByPrimaryKey('employees', employeeId);
        res.json({ user: { id: authId }, profile: updated });
        return;
    }

    if (action === 'auth/password-reset-request') {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (email) {
            await pool.query('UPDATE employees SET password_reset_requested_at = CURRENT_TIMESTAMP WHERE auth_email = ?', [email]);
        }
        res.json({
            message: 'If that account exists, a reset request has been recorded. If your Hostinger app is not wired to outbound mail yet, ask an admin to issue a temporary password.',
        });
        return;
    }

    if (action === 'auth/update-password') {
        const user = await requireAuth(req);
        const password = String(req.body?.password || '');
        if (password.length < 8) {
            throw new ApiError(400, 'Password must be at least 8 characters.', 'AUTH_INVALID');
        }

        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE employees SET password_hash = ?, password_reset_requested_at = NULL WHERE employee_id = ?',
            [hash, user.employee_id]
        );
        res.json({ ok: true });
        return;
    }

    if (action === 'auth/verify-password') {
        const user = await requireAuth(req);
        const password = String(req.body?.password || '');
        const [rows] = await pool.query('SELECT password_hash FROM employees WHERE employee_id = ? LIMIT 1', [user.employee_id]);
        const passwordHash = rows?.[0]?.password_hash || '';
        if (!passwordHash || !(await bcrypt.compare(password, passwordHash))) {
            throw new ApiError(401, 'Invalid password.', 'AUTH_INVALID');
        }
        res.json({ ok: true });
        return;
    }

    throw new ApiError(404, 'Unknown auth action.', 'NOT_FOUND');
}

async function handleDbQuery(req, res) {
    const action = String(req.body?.action || 'select');
    const table = String(req.body?.table || '').trim();

    const meta = getTableMeta(table);
    const isRegistered = isTableRegistered(table);

    if (!meta && !isRegistered) {
        throw new ApiError(404, `Unknown table: ${table}`, 'TABLE_NOT_FOUND');
    }

    if (isRegistered && !isTableReadable(req, table, null)) {
        throw new ApiError(403, 'Access denied to table: ' + table, 'FORBIDDEN');
    }

    if (!(action === 'select' && table === 'app_settings')) {
        await requireAuth(req);
    }

    if (action === 'select') {
        let rows = await queryRows(table, {
            filters: req.body?.filters || [],
            orders: req.body?.orders || [],
        });
        const filtered = [];
        for (const row of rows) {
            if (await canReadRow(req, table, row)) {
                filtered.push(row);
            }
        }
        if (Number.isFinite(Number(req.body?.limit)) && Number(req.body.limit) > 0) {
            rows = filtered.slice(0, Number(req.body.limit));
        } else {
            rows = filtered;
        }
        res.json({ data: rows });
        return;
    }

    if (!['insert', 'upsert', 'update', 'delete'].includes(action)) {
        throw new ApiError(400, `Unsupported action: ${action}`, 'INVALID_ACTION');
    }

    const user = await getCurrentUser(req);
    const returning = Boolean(req.body?.returning);
    const payloadRows = Array.isArray(req.body?.data) ? req.body.data : (req.body?.data ? [req.body.data] : []);

    if (action === 'insert') {
        const saved = [];
        for (const row of payloadRows) {
            if (!(await canWriteRow(req, table, row, 'insert'))) {
                throw new ApiError(403, 'Access denied.', 'FORBIDDEN');
            }
            saved.push(await insertRow(table, row));
        }
        res.json({ data: returning ? saved : null });
        return;
    }

    if (action === 'upsert') {
        const saved = [];
        for (const row of payloadRows) {
            const existing = row?.[meta.primaryKey] ? await getRowByPrimaryKey(table, row[meta.primaryKey]) : null;
            const referenceRow = existing || row;
            if (!(await canWriteRow(req, table, referenceRow, existing ? 'update' : 'insert'))) {
                throw new ApiError(403, 'Access denied.', 'FORBIDDEN');
            }
            if (table === 'employees') {
                enforceEmployeeMutationPolicy(user, existing, row);
            }
            saved.push(await upsertRow(table, row, req.body?.onConflict || meta.primaryKey));
        }
        res.json({ data: returning ? saved : null });
        return;
    }

    const matchedRows = await queryRows(table, {
        filters: req.body?.filters || [],
        orders: req.body?.orders || [],
    });
    const allowedRows = [];
    for (const row of matchedRows) {
        if (await canWriteRow(req, table, row, action)) {
            allowedRows.push(row);
        }
    }

    if (action === 'update') {
        const updated = await updateRows(req, table, allowedRows, isPlainObject(req.body?.data) ? req.body.data : {});
        res.json({ data: returning ? updated : null });
        return;
    }

    if (action === 'delete') {
        await deleteRows(table, allowedRows);
        res.json({ data: returning ? allowedRows : null });
        return;
    }
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(session({
    name: 'demo_kpi_session',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8,
    },
}));
app.use(dualAuthBridgeMiddleware);

app.get('/api/health', async (_req, res, next) => {
    try {
        const mysqlStatus = await pool.query('SELECT 1').then(() => true).catch(() => false);
        const supabaseStatus = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
        if (mysqlStatus || supabaseStatus) {
            res.json({ ok: true, mysql: mysqlStatus, supabase: supabaseStatus });
        } else {
            res.status(503).json({ ok: false, message: 'Offline' });
        }
    } catch (error) {
        next(error);
    }
});


app.all('/api/modules', async (req, res, next) => {
    try {
        const action = String(req.query?.action || '').trim();

        await getCurrentUser(req);
        const effectiveRole = resolveEffectiveModulesRole({
            currentUser: req.currentUser,
            claims: req.authContext?.claims,
        });
        const access = validateModulesActionAccess({
            action,
            effectiveRole,
            currentUser: req.currentUser,
        });
        if (!access.ok) {
            throw new ApiError(access.status, access.message, access.code);
        }
        
        switch (action) {
            case 'list':
                await getAllModules(req, res, next);
                break;
            case 'get':
                await getModule(req, res, next);
                break;
            case 'update':
                await updateModuleSettings(req, res, next);
                break;
            case 'toggle':
                await toggleModule(req, res, next);
                break;
            case 'activity':
                await getModuleActivityLog(req, res, next);
                break;
            case 'by-category':
                await getModulesByCategory(req, res, next);
                break;
            case 'active':
                await getActiveModules(req, res, next);
                break;
            default:
                throw new ApiError(400, 'Invalid module action.', 'INVALID_ACTION');
        }
    } catch (error) {
        next(error);
    }
});

app.all('/api', async (req, res, next) => {
    try {
        const action = String(req.query?.action || '').trim();
        if (!action) {
            throw new ApiError(400, 'Missing action query parameter.', 'MISSING_ACTION');
        }

        if (action.startsWith('auth/')) {
            await handleAuthAction(req, res, action);
            return;
        }

        if (action === 'db/query') {
            await handleDbQuery(req, res);
            return;
        }

        if (action.startsWith('employees/')) {
            await handleEmployeesAction(req, res, action);
            return;
        }

        if (action.startsWith('tna/')) {
            if (!isTnaEnabled()) {
                throw new ApiError(404, 'TNA module is not enabled.', 'MODULE_DISABLED');
            }
            await handleTnaAction(req, res, action);
            return;
        }

        if (action.startsWith('lms/')) {
            if (!isFeatureEnabled('LMS')) {
                throw new ApiError(404, 'LMS module is not enabled.', 'MODULE_DISABLED');
            }
            await handleLmsAction(req, res, action);
            return;
        }

        if (action.startsWith('kpi/')) {
            if (!isFeatureEnabled('KPI')) {
                throw new ApiError(404, 'KPI module is not enabled.', 'MODULE_DISABLED');
            }
            await handleKpiAction(req, res, action);
            return;
        }

        if (action.startsWith('dashboard/')) {
            await handleDashboardAction(req, res, action);
            return;
        }

        if (action.startsWith('probation/') || action.startsWith('pip/')) {
            const feature = action.split('/')[0].toUpperCase();
            if (!isFeatureEnabled(feature)) {
                throw new ApiError(404, `${feature} module is not enabled.`, 'MODULE_DISABLED');
            }
        }

        throw new ApiError(404, 'Unknown action.', 'NOT_FOUND');
    } catch (error) {
        next(error);
    }
});

if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

app.use((error, _req, res, _next) => {
    const status = Number(error?.status || 500);

    if (status >= 500) {
        console.error(error);
    }

    res.status(status).json(normalizeErrorResponse(error));
});

app.listen(PORT, () => {
    console.log(`demo-kpi server listening on http://127.0.0.1:${PORT}`);
});
