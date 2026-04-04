import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    fetchTnaGapsReportFromSupabase,
    fetchTnaLmsReportFromSupabase,
    fetchTnaSummaryFromSupabase,
    resolveTnaReadSource,
} from '../../server/compat/supabaseTnaRead.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const tnaSource = fs.readFileSync(path.join(process.cwd(), 'server', 'modules', 'tna.js'), 'utf8');

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

function jsonResponse(payload, status = 200, headers = {}) {
    const headersMap = new Map(
        Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)])
    );
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get(name) {
                return headersMap.get(String(name || '').toLowerCase()) || null;
            },
        },
        async json() {
            return payload;
        },
        async text() {
            return JSON.stringify(payload);
        },
    };
}

test.afterEach(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
});

test('resolveTnaReadSource respects legacy and auto modes', () => {
    process.env.TNA_READ_SOURCE = 'legacy';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    assert.equal(resolveTnaReadSource().source, 'legacy');

    process.env.TNA_READ_SOURCE = 'auto';
    assert.equal(resolveTnaReadSource().source, 'supabase');
});

test('resolveTnaReadSource fails fast when forced supabase is misconfigured', () => {
    process.env.TNA_READ_SOURCE = 'supabase';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.throws(
        () => resolveTnaReadSource(),
        /TNA_READ_SOURCE is set to supabase/
    );
});

test('fetchTnaSummaryFromSupabase returns legacy-compatible summary shape', async () => {
    process.env.TNA_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([], 200, { 'content-range': '0-0/9' }),
        () => jsonResponse([], 200, { 'content-range': '0-0/4' }),
        () => jsonResponse([], 200, { 'content-range': '0-0/2' }),
        () => jsonResponse([], 200, { 'content-range': '0-0/7' }),
        () => jsonResponse([], 200, { 'content-range': '0-0/3' }),
        () => jsonResponse([], 200, { 'content-range': '0-0/1' }),
        () => jsonResponse([], 200, { 'content-range': '0-0/5' }),
    ]);

    const summary = await fetchTnaSummaryFromSupabase();
    assert.deepEqual(summary, {
        total_needs_identified: 9,
        needs_completed: 4,
        active_plans: 2,
        total_enrollments: 7,
        enrollments_completed: 3,
        critical_gaps: 1,
        high_gaps: 5,
    });
});

test('fetchTnaSummaryFromSupabase handles zero-count fallback without content-range', async () => {
    process.env.TNA_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse([]),
        () => jsonResponse([]),
        () => jsonResponse([]),
        () => jsonResponse([]),
        () => jsonResponse([]),
        () => jsonResponse([]),
        () => jsonResponse([]),
    ]);

    const summary = await fetchTnaSummaryFromSupabase();
    assert.deepEqual(summary, {
        total_needs_identified: 0,
        needs_completed: 0,
        active_plans: 0,
        total_enrollments: 0,
        enrollments_completed: 0,
        critical_gaps: 0,
        high_gaps: 0,
    });
});

test('fetchTnaSummaryFromSupabase surfaces upstream failures', async () => {
    process.env.TNA_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
        () => jsonResponse({ error: 'Unauthorized' }, 401),
    ]);

    await assert.rejects(
        () => fetchTnaSummaryFromSupabase(),
        /failed \(401\)/
    );
});

test('fetchTnaGapsReportFromSupabase preserves legacy report fields and department filter', async () => {
    process.env.TNA_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/training_need_records/);
            assert.match(decoded, /status=not\.in\.\("completed","cancelled"\)/);
            return jsonResponse([
                {
                    employee_id: 'EMP001',
                    training_need_id: 'need-1',
                    current_level: 2,
                    gap_level: 2,
                    priority: 'high',
                    status: 'identified',
                    identified_at: '2026-04-01T00:00:00Z',
                },
                {
                    employee_id: 'EMP002',
                    training_need_id: 'need-2',
                    current_level: 3,
                    gap_level: 1,
                    priority: 'high',
                    status: 'identified',
                    identified_at: '2026-04-01T00:00:00Z',
                },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/employees/);
            return jsonResponse([
                { employee_id: 'EMP001', name: 'Farhan Akbar', position: 'Sales Executive', department: 'Sales' },
                { employee_id: 'EMP002', name: 'Maya Suryani', position: 'HR Officer', department: 'HR' },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/training_needs/);
            return jsonResponse([
                { id: 'need-1', competency_name: 'Negotiation', required_level: 4 },
                { id: 'need-2', competency_name: 'Compliance', required_level: 4 },
            ]);
        },
    ]);

    const report = await fetchTnaGapsReportFromSupabase({ department: 'Sales' });
    assert.equal(Array.isArray(report), true);
    assert.equal(report.length, 1);
    assert.deepEqual(Object.keys(report[0]).sort(), [
        'competency_name',
        'current_level',
        'department',
        'employee_id',
        'employee_name',
        'gap_level',
        'identified_at',
        'position',
        'priority',
        'required_level',
        'status',
    ]);
    assert.equal(report[0].employee_id, 'EMP001');
    assert.equal(report[0].department, 'Sales');
});

test('fetchTnaLmsReportFromSupabase preserves summary and by_course shape', async () => {
    process.env.TNA_READ_SOURCE = 'supabase';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    mockFetchSequence([
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/training_enrollments/);
            return jsonResponse([
                { id: 'enr-1', employee_id: 'EMP001', course_id: 'course-1', status: 'completed', score: 90, enrollment_date: '2026-04-01' },
                { id: 'enr-2', employee_id: 'EMP001', course_id: 'course-1', status: 'in_progress', score: null, enrollment_date: '2026-04-02' },
                { id: 'enr-3', employee_id: 'EMP002', course_id: 'course-2', status: 'enrolled', score: 70, enrollment_date: '2026-04-03' },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/employees/);
            return jsonResponse([
                { employee_id: 'EMP001', department: 'Sales' },
                { employee_id: 'EMP002', department: 'HR' },
            ]);
        },
        (url) => {
            const decoded = decodeURIComponent(String(url));
            assert.match(decoded, /rest\/v1\/training_courses/);
            return jsonResponse([
                { id: 'course-1', course_name: 'Sales Fundamentals', provider: 'Internal' },
                { id: 'course-2', course_name: 'HR Compliance', provider: 'External' },
            ]);
        },
    ]);

    const report = await fetchTnaLmsReportFromSupabase({ department: 'Sales' });
    assert.equal(typeof report, 'object');
    assert.deepEqual(Object.keys(report).sort(), ['by_course', 'summary']);
    assert.deepEqual(Object.keys(report.summary).sort(), ['avg_score', 'completed', 'enrolled', 'in_progress', 'total_enrollments']);
    assert.equal(report.summary.total_enrollments, 3);
    assert.equal(report.summary.completed, 1);
    assert.equal(report.summary.in_progress, 1);
    assert.equal(report.summary.enrolled, 1);
    assert.equal(report.summary.avg_score, 80);
    assert.equal(Array.isArray(report.by_course), true);
    assert.equal(report.by_course.length, 1);
    assert.deepEqual(Object.keys(report.by_course[0]).sort(), [
        'avg_score',
        'completed',
        'course_name',
        'department',
        'in_progress',
        'provider',
        'total_enrolled',
    ]);
    assert.equal(report.by_course[0].department, 'Sales');
});

test('tna/summary keeps role guard and supports body-query input compatibility', () => {
    assert.match(
        tnaSource,
        /if \(action === 'tna\/summary'\)[\s\S]*requireRole\(req, \['superadmin', 'manager', 'director', 'hr'\]\)/
    );
    assert.match(
        tnaSource,
        /const period = String\(getInput\(req, 'period', ''\)\)\.trim\(\)/
    );
    assert.match(
        tnaSource,
        /const sourceState = resolveTnaReadSource\(\)/
    );
});

test('tna report endpoints are source-selectable on read path', () => {
    assert.match(
        tnaSource,
        /if \(action === 'tna\/gaps-report'\)[\s\S]*resolveTnaReadSource\(\)[\s\S]*fetchTnaGapsReportFromSupabase\(/,
    );
    assert.match(
        tnaSource,
        /if \(action === 'tna\/lms-report'\)[\s\S]*resolveTnaReadSource\(\)[\s\S]*fetchTnaLmsReportFromSupabase\(/,
    );
});
