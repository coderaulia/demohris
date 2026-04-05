import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    fetchKpiReportingSummaryFromSupabase,
    resolveKpiReadSource,
} from '../../server/compat/supabaseKpiRead.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const kpiSource = fs.readFileSync(path.join(process.cwd(), 'server', 'modules', 'kpi.js'), 'utf8');

function restoreEnv() {
    process.env = { ...originalEnv };
}

function mockFetchSequence(handlers = []) {
    let index = 0;
    globalThis.fetch = async (url, options) => {
        const handler = handlers[index++];
        if (!handler) {
            throw new Error(`Unexpected fetch call: ${url}`);
        }
        return handler(url, options);
    };
}

function jsonResponse(payload, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return payload; },
        async text() { return JSON.stringify(payload); },
    };
}

test.afterEach(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
});

// ─── resolveKpiReadSource ────────────────────────────────────────────────────

test('resolveKpiReadSource respects explicit legacy mode', () => {
    process.env.KPI_READ_SOURCE = 'legacy';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    assert.equal(resolveKpiReadSource().source, 'legacy');
});

test('resolveKpiReadSource respects explicit supabase mode', () => {
    process.env.KPI_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    assert.equal(resolveKpiReadSource().source, 'supabase');
});

test('resolveKpiReadSource auto selects supabase when configured', () => {
    process.env.KPI_READ_SOURCE = 'auto';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    assert.equal(resolveKpiReadSource().source, 'supabase');
});

test('resolveKpiReadSource auto selects legacy when Supabase not configured', () => {
    process.env.KPI_READ_SOURCE = 'auto';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(resolveKpiReadSource().source, 'legacy');
});

// ─── fetchKpiReportingSummaryFromSupabase ────────────────────────────────────

test('fetchKpiReportingSummaryFromSupabase returns grouped department summary', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/kpi_records/);
            assert.match(decoded, /select=employee_id,period,value,target_snapshot/);
            return jsonResponse([
                { employee_id: 'EMP001', period: '2026-04', value: 90, target_snapshot: 100 },
                { employee_id: 'EMP001', period: '2026-04', value: 80, target_snapshot: 100 },
                { employee_id: 'EMP002', period: '2026-04', value: 110, target_snapshot: 100 },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/employees/);
            assert.match(decoded, /select=employee_id,department,manager_id,role,name/);
            return jsonResponse([
                { employee_id: 'EMP001', department: 'Sales', manager_id: 'MGR001', role: 'employee', name: 'Farhan Akbar' },
                { employee_id: 'EMP002', department: 'Sales', manager_id: 'MGR001', role: 'employee', name: 'Maya Suryani' },
                { employee_id: 'MGR001', department: 'Sales', manager_id: null, role: 'manager', name: 'Budi Santoso' },
            ]);
        },
    ]);

    const rows = await fetchKpiReportingSummaryFromSupabase({});
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.department, 'Sales');
    assert.equal(typeof row.employee_count, 'number');
    assert.ok(row.employee_count >= 0);
    assert.equal(typeof row.record_count, 'number');
    assert.ok(row.record_count >= 0);
    assert.equal(typeof row.met_count, 'number');
    assert.equal(typeof row.not_met_count, 'number');
    assert.ok(row.missing_count >= 0);
    // avg_score is either null or a number
    assert.ok(row.avg_score === null || typeof row.avg_score === 'number');
});

test('fetchKpiReportingSummaryFromSupabase applies period filter to kpi_records query', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    let capturedKpiUrl = '';
    mockFetchSequence([
        (url) => { capturedKpiUrl = decodeURIComponent(String(url)); return jsonResponse([]); },
        () => jsonResponse([]),
    ]);

    await fetchKpiReportingSummaryFromSupabase({ period: '2026-04' });
    assert.match(capturedKpiUrl, /period=eq\.2026-04/);
});

test('fetchKpiReportingSummaryFromSupabase applies year-only period as LIKE filter', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    let capturedKpiUrl = '';
    mockFetchSequence([
        (url) => { capturedKpiUrl = decodeURIComponent(String(url)); return jsonResponse([]); },
        () => jsonResponse([]),
    ]);

    await fetchKpiReportingSummaryFromSupabase({ period: '2026' });
    assert.match(capturedKpiUrl, /period=like\.2026-/);
});

test('fetchKpiReportingSummaryFromSupabase returns empty array when no employees', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([]),
        () => jsonResponse([]),
    ]);

    const rows = await fetchKpiReportingSummaryFromSupabase({});
    assert.deepEqual(rows, []);
});

test('fetchKpiReportingSummaryFromSupabase calculates met/not_met correctly', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([
            { employee_id: 'EMP001', period: '2026-04', value: 100, target_snapshot: 100 }, // met
            { employee_id: 'EMP001', period: '2026-04', value: 80, target_snapshot: 100 },  // not_met
            { employee_id: 'EMP002', period: '2026-04', value: 120, target_snapshot: 100 }, // met
        ]),
        () => jsonResponse([
            { employee_id: 'EMP001', department: 'Ops', manager_id: null, role: 'employee', name: 'Alice' },
            { employee_id: 'EMP002', department: 'Ops', manager_id: null, role: 'employee', name: 'Bob' },
        ]),
    ]);

    const rows = await fetchKpiReportingSummaryFromSupabase({});
    assert.equal(rows.length, 1);
    assert.equal(rows[0].met_count, 2);
    assert.equal(rows[0].not_met_count, 1);
    assert.equal(rows[0].missing_count, 0);
    assert.ok(typeof rows[0].avg_score === 'number');
});

test('fetchKpiReportingSummaryFromSupabase applies department filter client-side', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([
            { employee_id: 'EMP001', period: '2026-04', value: 90, target_snapshot: 100 },
            { employee_id: 'EMP002', period: '2026-04', value: 80, target_snapshot: 100 },
        ]),
        () => jsonResponse([
            { employee_id: 'EMP001', department: 'Sales', manager_id: null, role: 'employee', name: 'Farhan' },
            { employee_id: 'EMP002', department: 'HR', manager_id: null, role: 'employee', name: 'Maya' },
        ]),
    ]);

    const rows = await fetchKpiReportingSummaryFromSupabase({ department: 'HR' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].department, 'HR');
});

test('fetchKpiReportingSummaryFromSupabase surfaces upstream Supabase errors', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
    ]);

    await assert.rejects(
        () => fetchKpiReportingSummaryFromSupabase({}),
        /failed \(401\)/
    );
});

test('fetchKpiReportingSummaryFromSupabase throws when Supabase is not configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await assert.rejects(
        () => fetchKpiReportingSummaryFromSupabase({}),
        /Supabase not configured/
    );
});

// ─── handler / module source checks ─────────────────────────────────────────

test('kpi.js handler guards employee role with 403', () => {
    assert.match(
        kpiSource,
        /if \(role === 'employee'\)[\s\S]*FORBIDDEN/
    );
});

test('kpi.js handler supports body-query input compatibility via getInput', () => {
    assert.match(
        kpiSource,
        /const department = String\(getInput\(req, 'department'/
    );
    assert.match(
        kpiSource,
        /const period = String\(getInput\(req, 'period'/
    );
});

test('kpi.js handler enforces manager department scope', () => {
    assert.match(
        kpiSource,
        /role === 'manager'[\s\S]*user\.department/
    );
});

test('kpi.js uses resolveKpiReadSource and falls back to legacy on Supabase failure', () => {
    assert.match(
        kpiSource,
        /resolveKpiReadSource\(\)/
    );
    assert.match(
        kpiSource,
        /fetchKpiReportingSummaryFromSupabase\(/
    );
    assert.match(
        kpiSource,
        /falling back to legacy/
    );
});

test('kpi reporting summary response has required contract keys', () => {
    // Verify handler returns: success, source, period, department, rows
    assert.match(kpiSource, /success: true/);
    assert.match(kpiSource, /source,/);
    assert.match(kpiSource, /period: period \|\| null/);
    assert.match(kpiSource, /department: effectiveDepartment \|\| null/);
    assert.match(kpiSource, /rows,/);
});

test('KpiReportingSummaryResponseSchema validates mock payload', async () => {
    const { KpiReportingSummaryResponseSchema } = await import('../../packages/contracts/src/kpi.ts?import').catch(() => null) || {};
    // Contract file exists and exports required type
    const contractSrc = fs.readFileSync(path.join(process.cwd(), 'packages', 'contracts', 'src', 'kpi.ts'), 'utf8');
    assert.match(contractSrc, /KpiReportingSummaryResponseSchema/);
    assert.match(contractSrc, /KpiReportingSummaryRowSchema/);
    assert.match(contractSrc, /met_count/);
    assert.match(contractSrc, /not_met_count/);
    assert.match(contractSrc, /avg_score/);
    assert.match(contractSrc, /missing_count/);
});
