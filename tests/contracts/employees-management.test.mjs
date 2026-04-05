import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(process.cwd());
const empSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'employees.js'), 'utf8');

test('Employees Management actions are dispatched in handleEmployeesAction', () => {
    const actions = [
        'employees/list',
        'employees/get',
        'employees/create',
        'employees/update',
        'employees/toggle-status',
        'employees/insights',
    ];

    for (const action of actions) {
        assert.ok(
            empSource.includes(`if (action === '${action}')`),
            `Missing dispatch for Employee action: ${action}`
        );
    }
});

test('Employees Management functions exist in module', () => {
    const functions = [
        'listEmployees',
        'getEmployee',
        'createEmployee',
        'updateEmployee',
        'toggleEmployeeStatus',
        'employeeInsights',
    ];

    for (const fn of functions) {
        assert.ok(
            empSource.includes(`async function ${fn}`),
            `Missing function implementation: ${fn}`
        );
    }
});

test('Employees Management enforces role-based access', () => {
    assert.ok(empSource.includes("assert(role === 'superadmin' || role === 'hr', 'Only superadmin or HR can create employees.', 403, 'FORBIDDEN')"), 'employees/create missing role guard');
    assert.ok(empSource.includes("assert(canManageEmployee(user, existing), 'Access denied.', 403, 'FORBIDDEN')"), 'employees/update missing manage guard');
    assert.ok(empSource.includes("assert(role === 'superadmin' || role === 'hr', 'Only superadmin or HR can change employee status.', 403, 'FORBIDDEN')"), 'employees/toggle-status missing role guard');
});

test('Employee ID generation preserves specific prefix/pad logic', () => {
    assert.ok(empSource.includes('generateNextEmployeeId'), 'Missing ID generation helper');
    assert.ok(empSource.includes("return `EMP${String(maxNumber + 1).padStart(3, '0')}`"), 'Incorrect ID prefix/pad format');
});

test('Employee creation flow handles auth and profile rollback safely', () => {
    assert.ok(empSource.includes('createSupabaseAuthUser'), 'Employee creation must create auth user');
    assert.ok(empSource.includes('upsertSupabaseProfile'), 'Employee creation must upsert profile');
    assert.ok(empSource.includes('deleteSupabaseAuthUser(authUser.id).catch(() => {})'), 'Employee creation must have auth rollback on error');
});
