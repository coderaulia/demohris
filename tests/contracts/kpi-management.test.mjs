import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(process.cwd());
const kpiSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'kpi.js'), 'utf8');

test('KPI Management actions are dispatched in handleKpiAction', () => {
    const actions = [
        'kpi/definitions/list',
        'kpi/definitions/get',
        'kpi/definitions/create',
        'kpi/definitions/update',
        'kpi/definitions/delete',
        'kpi/targets/get',
        'kpi/targets/set',
        'kpi/governance/get',
        'kpi/governance/set',
        'kpi/approvals/list',
        'kpi/approvals/approve',
        'kpi/approvals/reject',
        'kpi/records/list',
        'kpi/record/create',
        'kpi/record/update',
        'kpi/record/delete',
        'kpi/department-summary',
        'kpi/version-history'
    ];

    for (const action of actions) {
        assert.ok(
            kpiSource.includes(`if (action === '${action}')`),
            `Missing dispatch for KPI action: ${action}`
        );
    }
});

test('KPI Management functions exist in module', () => {
    const functions = [
        'kpiDefinitionsList',
        'kpiDefinitionsGet',
        'kpiDefinitionsCreate',
        'kpiDefinitionsUpdate',
        'kpiDefinitionsDelete',
        'kpiTargetsGet',
        'kpiTargetsSet',
        'kpiGovernanceGet',
        'kpiGovernanceSet',
        'kpiApprovalsList',
        'kpiApprovalsApprove',
        'kpiApprovalsReject',
        'kpiRecordsList',
        'kpiRecordCreate',
        'kpiRecordUpdate',
        'kpiRecordDelete',
        'kpiDepartmentSummary',
        'kpiVersionHistory'
    ];

    for (const fn of functions) {
        assert.ok(
            kpiSource.includes(`async function ${fn}`),
            `Missing function implementation: ${fn}`
        );
    }
});

test('KPI Management enforces role-based access', () => {
    // Check that sensitive actions have requireRole or isAdmin/isManager logic
    assert.ok(kpiSource.includes("requireRole(req, ['superadmin', 'hr', 'manager'])"), 'kpi/definitions/create missing role guard');
    assert.ok(kpiSource.includes("requireRole(req, ['superadmin', 'hr'])"), 'kpi/definitions/delete missing role guard');
    assert.ok(kpiSource.includes("requireRole(req, ['superadmin'])"), 'kpi/governance/set missing superadmin-only guard');
});
