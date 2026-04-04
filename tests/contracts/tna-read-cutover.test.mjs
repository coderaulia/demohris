import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
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
