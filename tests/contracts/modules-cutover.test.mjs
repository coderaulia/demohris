import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    fetchModuleSettingsFromSupabase,
    resolveModulesReadSource,
} from '../../server/compat/supabaseModulesRead.js';
import {
    resolveEffectiveModulesRole,
    validateModulesActionAccess,
} from '../../server/compat/modulesAccess.js';

const projectRoot = path.resolve(process.cwd());
const appSource = fs.readFileSync(path.join(projectRoot, 'server', 'app.js'), 'utf8');
const moduleManagerSource = fs.readFileSync(path.join(projectRoot, 'server', 'modules', 'moduleManager.js'), 'utf8');

const ENV_KEYS = ['MODULES_READ_SOURCE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function withEnv(patch, fn) {
    const before = {};
    for (const key of ENV_KEYS) before[key] = process.env[key];

    for (const [key, value] of Object.entries(patch || {})) {
        if (value === null || value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = String(value);
        }
    }

    return Promise.resolve()
        .then(fn)
        .finally(() => {
            for (const key of ENV_KEYS) {
                if (before[key] === undefined) delete process.env[key];
                else process.env[key] = before[key];
            }
        });
}

test('modules cutover wiring is present in backend sources', () => {
    assert.ok(
        moduleManagerSource.includes("fetchModuleSettingsFromSupabase"),
        'moduleManager should import Supabase module read helper'
    );
    assert.ok(
        moduleManagerSource.includes('readModulesRows'),
        'moduleManager should route read endpoints through readModulesRows helper'
    );
    assert.ok(appSource.includes('resolveEffectiveModulesRole'), 'app route should use shared modules access helper');
});

test('modules access helper enforces auth and role restrictions', () => {
    const unauthenticated = validateModulesActionAccess({
        action: 'list',
        effectiveRole: '',
        currentUser: null,
    });
    assert.equal(unauthenticated.ok, false);
    assert.equal(unauthenticated.status, 401);

    const forbiddenRole = validateModulesActionAccess({
        action: 'list',
        effectiveRole: 'employee',
        currentUser: { employee_id: 'EMP001', role: 'employee' },
    });
    assert.equal(forbiddenRole.ok, false);
    assert.equal(forbiddenRole.status, 403);

    const readAllowedByClaims = validateModulesActionAccess({
        action: 'list',
        effectiveRole: resolveEffectiveModulesRole({
            currentUser: null,
            claims: { app_metadata: { role: 'hr' } },
        }),
        currentUser: null,
    });
    assert.equal(readAllowedByClaims.ok, true);

    const writeBlockedWithoutEmployeeContext = validateModulesActionAccess({
        action: 'toggle',
        effectiveRole: 'hr',
        currentUser: null,
    });
    assert.equal(writeBlockedWithoutEmployeeContext.ok, false);
    assert.equal(writeBlockedWithoutEmployeeContext.code, 'AUTH_CONTEXT_INCOMPLETE');
});

test('resolveModulesReadSource returns legacy when no Supabase config', async () => {
    await withEnv(
        {
            MODULES_READ_SOURCE: 'auto',
            SUPABASE_URL: null,
            SUPABASE_SERVICE_ROLE_KEY: null,
        },
        async () => {
            const resolved = resolveModulesReadSource();
            assert.equal(resolved.source, 'legacy');
        }
    );
});

test('resolveModulesReadSource returns supabase when configured', async () => {
    await withEnv(
        {
            MODULES_READ_SOURCE: 'auto',
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        },
        async () => {
            const resolved = resolveModulesReadSource();
            assert.equal(resolved.source, 'supabase');
            assert.equal(resolved.supabaseUrl, 'https://example.supabase.co');
        }
    );
});

test('fetchModuleSettingsFromSupabase normalizes payload and filters', async () => {
    const originalFetch = global.fetch;
    const calls = [];

    global.fetch = async (url, init) => {
        calls.push({ url: String(url), init });
        return {
            ok: true,
            async json() {
                return [
                    {
                        module_id: 'LMS',
                        module_name: 'Learning Management',
                        is_enabled: true,
                        settings: '{"flag":true}',
                        dependencies: '["CORE"]',
                    },
                ];
            },
        };
    };

    try {
        await withEnv(
            {
                MODULES_READ_SOURCE: 'supabase',
                SUPABASE_URL: 'https://example.supabase.co',
                SUPABASE_SERVICE_ROLE_KEY: 'service-role',
            },
            async () => {
                const rows = await fetchModuleSettingsFromSupabase({
                    category: 'talent',
                    onlyActive: true,
                });

                assert.equal(rows.length, 1);
                assert.equal(rows[0].module_id, 'LMS');
                assert.equal(rows[0].is_enabled, true);
                assert.deepEqual(rows[0].settings, { flag: true });
                assert.deepEqual(rows[0].dependencies, ['CORE']);

                assert.equal(calls.length, 1);
                assert.ok(calls[0].url.includes('/rest/v1/module_settings?'));
                assert.ok(calls[0].url.includes('category=eq.talent'));
                assert.ok(calls[0].url.includes('is_enabled=eq.true'));
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('fetchModuleSettingsFromSupabase handles empty state and unauthorized responses safely', async () => {
    const originalFetch = global.fetch;
    let callCount = 0;

    global.fetch = async () => {
        callCount += 1;
        if (callCount === 1) {
            return {
                ok: true,
                async json() {
                    return [];
                },
            };
        }

        return {
            ok: false,
            status: 401,
            async text() {
                return '{"message":"unauthorized"}';
            },
        };
    };

    try {
        await withEnv(
            {
                MODULES_READ_SOURCE: 'supabase',
                SUPABASE_URL: 'https://example.supabase.co',
                SUPABASE_SERVICE_ROLE_KEY: 'service-role',
            },
            async () => {
                const emptyRows = await fetchModuleSettingsFromSupabase({ moduleId: 'MISSING' });
                assert.deepEqual(emptyRows, [], 'not-found module read should return empty array');

                await assert.rejects(
                    () => fetchModuleSettingsFromSupabase({ onlyActive: true }),
                    /Supabase module_settings read failed/
                );
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});
