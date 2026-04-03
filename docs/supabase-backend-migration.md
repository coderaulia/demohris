# Supabase Backend Migration

Purpose: stabilize Supabase-backed auth for `demo-kpi` using a dual-auth bridge and contract-first controls, without migrating LMS/TNA logic yet.

## Scope and Guardrails
- Keep legacy Express + MySQL runtime active.
- Keep current API contract stable.
- Introduce dual-auth acceptance:
  - legacy session cookie
  - Supabase JWT
- Do not migrate LMS/TNA business logic in this slice.
- Do not remove legacy auth fallback in this stage.

## Step 0 - Contract Freeze (Completed)

Golden fixtures created:
- `tests/contracts/fixtures/auth.login.json`
- `tests/contracts/fixtures/auth.session.json`
- `tests/contracts/fixtures/lms.enrollments.group.json`
- `tests/contracts/fixtures/lms.progress.group.json`
- `tests/contracts/fixtures/tna.calculate-gaps.json`
- `tests/contracts/fixtures/modules.group.json`

Golden contract tests:
- `tests/contracts/golden-fixtures.test.mjs`
- `tests/contracts/regression-routes.test.mjs`

Run:
```bash
npm run qa:contracts
```

## Step 1 - Current Auth Dependency Map (Code-Verified)

### Auth Source and Resolution
- Session storage: `express-session` in `server/app.js`.
- Session id key: `req.session.userId`.
- User resolver: `getCurrentUser(req)` in `server/app.js`.
- Role source: `currentUser.role` from employee row.

### Where Auth Is Read
- `server/app.js`
  - `requireAuth(req)` and `requireRole(req, roles)`
  - `handleAuthAction` (`auth/login`, `auth/logout`, `auth/session`, etc.)
  - `/api/modules` route role gate (`superadmin`, `hr`)
  - `db/query` path requires auth for non-public reads
- `server/modules/lms.js`
  - relies on `req.currentUser` and role checks via `isAdmin()`
- `server/modules/tna.js`
  - relies on `req.currentUser` via `requireAuth()` and `requireRole()`

### Endpoints Coupled To Auth Context
- `/api?action=auth/*`
- `/api?action=db/query`
- `/api?action=lms/*`
- `/api?action=tna/*`
- `/api/modules?action=*`

## Step 2 - Dual-Auth Bridge (Completed)

Implemented:
- `server/compat/authBridge.js`
- `server/compat/supabaseClient.js`
- Wired in `server/app.js` after session middleware.

Behavior:
1. If session exists and resolves -> `source=legacy-session`
2. Else if Bearer JWT verifies and maps to employee -> `source=supabase-jwt`
3. Else -> anonymous

Unified request shape:
- `req.user` and `req.currentUser` are always normalized to the same employee profile shape.
- `req.authContext` captures source metadata (`legacy-session`, `supabase-jwt`, `anonymous`).
- Invalid/missing JWTs fall back safely to anonymous auth context (no crash).

## Step 3 - Profile Sync Strategy (Implemented)

Deterministic mapping implementation:
1. Resolve JWT `sub` against `employees.auth_id`.
2. If not found, resolve JWT email against `employees.auth_email`.
3. If still not found and `employees.email` column exists, resolve against `employees.email`.
4. On first JWT login with email match:
   - bind `employees.auth_id = <jwt.sub>`
   - normalize `employees.auth_email = <jwt.email>`
5. If `sub` and email map to different employees -> reject identity binding (safe deny).

Compatibility/consistency:
- Profile sync to Supabase `public.profiles` is attempted via service-role key (best effort).
- Sync failures do not crash request path and do not remove legacy session fallback.

## Step 4 - Supabase Auth + Profile Model (Foundation Completed)

Added migration foundation:
- `supabase/migrations/0001_profiles_auth.sql`
  - `public.profiles` table
  - `public.app_role` enum (`employee`, `manager`, `hr`, `superadmin`)
  - trigger `auth.users -> public.profiles`

Role resolution direction:
- JWT claim role (from `raw_app_meta_data.role`) seeds profile role.
- Effective runtime role stays sourced from mapped legacy employee record until full domain migration.

## Step 5 - Database Foundation (Minimal Completed)

Added:
- `supabase/migrations/README.md`
- Versioned SQL migrations under `supabase/migrations/`

MySQL -> Postgres domain migration map (planned):
- Core/Auth: `employees` -> `profiles` + legacy employee mapping bridge
- LMS: migrate after auth stabilization
- TNA: migrate after LMS critical contract parity
- KPI/Probation/PIP: later slices

## Step 6 - RLS Foundation (Minimal Completed)

Added:
- `supabase/migrations/0002_profiles_rls.sql`

Policies included:
- user can read own profile
- admin roles (`manager`, `hr`, `superadmin`) can read broader profiles

## Step 7 - Compatibility Layer (Completed For Foundation)

Added:
- Supabase JWT verifier wrapper: `server/compat/supabaseClient.js`
- Backend dual-auth adapter: `server/compat/authBridge.js`
- API response normalizer: `server/compat/responseNormalizer.js`
- Provisioning helper: `scripts/qa/supabase-provision.mjs`
- Staging auth parity checker: `scripts/qa/supabase-auth-staging-check.mjs`

Contract stability:
- Existing response contracts remain unchanged for frozen endpoints.

## Step 8 - First Safe Cutover Domain

Chosen domain: **auth/session bootstrap**.

Why:
- low-risk compared to LMS/TNA logic
- validates dual-auth bridge path early
- keeps downstream domain handlers unchanged

## Step 9 - Test Plan and Current Results

### Contract tests
- Verify fixture freeze completeness and route coverage.
- Verify mandatory actions remain wired.

### Auth bridge tests
- Session-only auth works.
- JWT-only auth works.
- Session takes precedence when both exist.
- `req.user` shape is identical across auth sources.
- Invalid JWT fallback behaves safely.
- Missing role in resolved user context does not crash bridge.

### Regression smoke
- LMS and TNA routing remains wired after bridge insertion.

Current command result:
- `npm run qa:contracts` -> pass
- `npm run qa:supabase:provision` -> blocked (missing env variables)
- `npm run qa:auth:staging` -> blocked (missing `SUPABASE_URL` and related secrets)
- `npm run build` -> pass

## Step 10 - Staging Validation Status

Current status: **blocked by missing Supabase staging credentials in runtime environment**.

Required env to execute real staging validation:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF_DEV`
- `SUPABASE_PROJECT_REF_STAGING`
- `SUPABASE_DB_PASSWORD_DEV` / `SUPABASE_DB_PASSWORD_STAGING` (or shared `SUPABASE_DB_PASSWORD`)
- `SUPABASE_TEST_EMAIL`
- `SUPABASE_TEST_PASSWORD`

After env is supplied:
1. run `npm run qa:supabase:provision`
2. run backend in staging-like config
3. run `npm run qa:auth:staging`
4. confirm parity report and failure-case outcomes

## Step 11 - Status, Migrated Domain, Next Slice

- Dual-auth bridge status: **implemented**
- Migrated domain in this slice: **auth/session bootstrap**
- Next slice recommendation:
  1. execute real Supabase staging validation once env credentials are provided
  2. capture parity results (session vs JWT) for same user in staging report
  3. add alerting for identity-collision cases during first-JWT binding
  4. keep LMS/TNA on legacy backend until parity is confirmed

## Reversibility

This slice is reversible:
- Session auth remains primary fallback.
- JWT path can be disabled by removing `SUPABASE_URL`.
- No LMS/TNA logic has been migrated.
- No legacy endpoint has been removed.
