import assert from 'node:assert/strict';
import test from 'node:test';

import { createDualAuthBridgeMiddleware } from '../../server/compat/authBridge.js';

const baseUser = {
    employee_id: 'EMP-001',
    auth_email: 'employee@example.com',
    role: 'employee',
    name: 'Employee One',
};

async function runMiddleware(middleware, req) {
    await new Promise((resolve, reject) => {
        middleware(req, {}, error => {
            if (error) reject(error);
            else resolve();
        });
    });
}

test('dual-auth bridge prefers legacy session when session exists', async () => {
    const middleware = createDualAuthBridgeMiddleware({
        resolveSessionUser: async sessionUserId => ({ ...baseUser, employee_id: sessionUserId }),
        resolveJwtUser: async () => ({ ...baseUser, employee_id: 'EMP-JWT' }),
        verifyJwt: async () => ({ sub: 'jwt-sub', email: baseUser.auth_email }),
    });

    const req = {
        session: { userId: 'EMP-SESSION' },
        headers: { authorization: 'Bearer jwt-token' },
    };
    await runMiddleware(middleware, req);

    assert.equal(req.authContext.source, 'legacy-session');
    assert.equal(req.user.employee_id, 'EMP-SESSION');
    assert.equal(req.currentUser.employee_id, 'EMP-SESSION');
});

test('dual-auth bridge accepts Supabase JWT when no session exists', async () => {
    const middleware = createDualAuthBridgeMiddleware({
        resolveSessionUser: async () => null,
        resolveJwtUser: async claims => ({
            ...baseUser,
            employee_id: 'EMP-JWT',
            auth_email: claims.email,
        }),
        verifyJwt: async () => ({ sub: 'supabase-uid', email: 'employee@example.com' }),
    });

    const req = {
        session: {},
        headers: { authorization: 'Bearer jwt-token' },
    };
    await runMiddleware(middleware, req);

    assert.equal(req.authContext.source, 'supabase-jwt');
    assert.equal(req.user.employee_id, 'EMP-JWT');
    assert.equal(req.currentUser.employee_id, 'EMP-JWT');
    assert.equal(req.user.role, baseUser.role);
});

test('dual-auth bridge falls back to anonymous when no auth exists', async () => {
    const middleware = createDualAuthBridgeMiddleware({
        resolveSessionUser: async () => null,
        resolveJwtUser: async () => null,
        verifyJwt: async () => null,
    });

    const req = {
        session: {},
        headers: {},
    };
    await runMiddleware(middleware, req);

    assert.equal(req.authContext.source, 'anonymous');
    assert.equal(req.user, null);
    assert.equal(req.currentUser, null);
});

test('session and jwt sources produce compatible req.user shape', async () => {
    const sessionMiddleware = createDualAuthBridgeMiddleware({
        resolveSessionUser: async () => ({ ...baseUser }),
        resolveJwtUser: async () => null,
        verifyJwt: async () => null,
    });
    const jwtMiddleware = createDualAuthBridgeMiddleware({
        resolveSessionUser: async () => null,
        resolveJwtUser: async () => ({ ...baseUser }),
        verifyJwt: async () => ({ sub: 'x', email: baseUser.auth_email }),
    });

    const sessionReq = { session: { userId: baseUser.employee_id }, headers: {} };
    const jwtReq = { session: {}, headers: { authorization: 'Bearer token' } };

    await runMiddleware(sessionMiddleware, sessionReq);
    await runMiddleware(jwtMiddleware, jwtReq);

    assert.deepEqual(
        Object.keys(sessionReq.user).sort(),
        Object.keys(jwtReq.user).sort(),
        'req.user shape must match for both auth sources'
    );
});

