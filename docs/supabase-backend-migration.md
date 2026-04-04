# Supabase Backend Migration

Purpose: stabilize Supabase-backed auth for `demo-kpi` using a dual-auth bridge and contract-first controls, without migrating LMS/TNA logic yet.

## Execution Update (2026-04-03, DB Baseline Slice)
- Added full Supabase baseline migrations through:
  - `0003_core_auth_and_modules.sql`
  - `0004_lms_core_tables.sql`
  - `0005_lms_progress_quiz_tables.sql`
  - `0006_tna_baseline_tables.sql`
  - `0007_rls_baseline.sql`
  - `0008_seed_helpers_and_triggers.sql`
  - `0009_kpi_baseline_tables.sql`
- Added deterministic seed data:
  - `supabase/seeds/seed_dev_staging.sql`
- Added auth user provisioning script:
  - `scripts/qa/supabase-provision-auth-users.mjs`
- Added provisioning command:
  - `npm run qa:supabase:auth-users`
- Provisioning status:
  - `npm run qa:supabase:provision` -> pass
  - `npm run qa:supabase:auth-users` -> pass

## Production Rollout Note (2026-04-03)
- Public deployment scope is restricted to React shell + Supabase-backed auth/session context.
- LMS/TNA routes in the React shell are feature-flagged and remain off until their backend paths are migrated.
- Legacy backend dual-auth bridge remains available for migration compatibility, but production-safe shell routes do not require MySQL-backed API calls.

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
- `npm run qa:supabase:provision` -> pass (dev + staging migrations up to date)
- `npm run qa:auth:staging` -> blocked by backend health check (`/api/health` -> MySQL `ECONNREFUSED 127.0.0.1:3306`)
- `npm run build` -> pass

## Step 10 - Staging Validation Status

Current status: **partially validated, parity blocked by backend DB connectivity on configured target**.

Required env to execute real staging validation:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF_DEV`
- `SUPABASE_PROJECT_REF_STAGING`
- `SUPABASE_DB_PASSWORD_DEV` / `SUPABASE_DB_PASSWORD_STAGING` (or shared `SUPABASE_DB_PASSWORD`)
- `SUPABASE_TEST_EMAIL`
- `SUPABASE_TEST_PASSWORD`

Execution status:
1. `npm run qa:supabase:provision` completed successfully.
2. `npm run qa:auth:staging` now performs a strict backend health preflight and fails early when DB is unavailable.

To finish staging parity validation:
1. Run backend against reachable MySQL (or point `BACKEND_BASE_URL` to staging backend with DB access).
2. Re-run `npm run qa:auth:staging`.
3. Confirm parity report and failure-case outcomes.

## Step 12 - Supabase Schema/Seed Baseline Outcome

What is now true:
- Supabase dev/staging has a complete runnable schema baseline for:
  - core/auth/module tables
  - LMS baseline tables
  - TNA baseline tables
  - KPI/probation/PIP baseline tables
- Seeded deterministic non-production baseline data is available for contract-safe development.
- Test auth users can be provisioned and mapped to seeded employees/profiles.

What is still legacy:
- Express runtime query engine is still MySQL-based for most domain handlers.
- `/api/health` still fails if MySQL is unavailable (`ECONNREFUSED 127.0.0.1:3306`).
- Full backend domain cutover to Supabase query path is deferred to next migration slices.

Related docs:
- `docs/supabase-schema-baseline.md`
- `docs/supabase-seed-plan.md`

## Step 11 - Status, Migrated Domain, Next Slice

- Dual-auth bridge status: **implemented**
- Migrated domain in this slice: **auth/session bootstrap**
- Next slice recommendation:
  1. execute real Supabase staging validation once backend DB connectivity is healthy for `BACKEND_BASE_URL`
  2. capture parity results (session vs JWT) for same user in staging report
  3. add alerting for identity-collision cases during first-JWT binding
  4. keep LMS/TNA on legacy backend until parity is confirmed

## Step 13 - First Backend Domain Cutover After Shell Launch (2026-04-04)

Cutover slice completed:
- `modules/*` read actions:
  - `list`
  - `get`
  - `by-category`
  - `active`

Implementation:
- Added `server/compat/supabaseModulesRead.js` for Supabase REST reads and row normalization.
- Updated `server/modules/moduleManager.js` read handlers to use source-selectable read path.
- Added source switch:
  - `MODULES_READ_SOURCE=legacy|supabase|auto`
  - `auto` => Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are present, else legacy.

Auth/role compatibility for this slice:
- `/api/modules` now accepts effective role from `req.currentUser` or verified JWT claims.
- Write actions still require employee-mapped auth context and remain legacy-backed.

Test coverage added:
- `tests/contracts/modules-cutover.test.mjs` (contract + adapter integration checks)
- `scripts/qa/modules-cutover-smoke.mjs` (authenticated endpoint smoke harness)

Route exposure decision:
- No frontend route exposure change in this slice.
- LMS/TNA routes remain feature-flagged off.

## Step 14 - Second Backend Cutover Slice: LMS Read Endpoints (2026-04-04)

Cutover slice completed:
- `lms/enrollments/list`
- `lms/enrollments/get`
- `lms/enrollments/my-courses`
- `lms/progress/get`

Implementation:
- Added `server/compat/supabaseLmsRead.js` for Supabase REST reads and enrollment/progress response decoration.
- Added source switch:
  - `LMS_READ_SOURCE=legacy|supabase|auto`
  - `auto` => Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are present, else legacy.
- Updated `server/modules/lms.js` to route only these read actions through the source-selectable path.
- Kept LMS mutation-heavy actions on legacy path by design.

Test coverage added:
- `tests/contracts/lms-read-cutover.test.mjs`
- `scripts/qa/lms-read-cutover-smoke.mjs` (`npm run qa:lms:cutover`)

Route exposure decision:
- No immediate frontend route enablement change.
- LMS React route remains feature-flagged until end-to-end parity is validated in staging/live smoke.

## Step 15 - LMS Read Parity Hardening (2026-04-04)

Scope:
- Harden parity for:
  - `lms/enrollments/list`
  - `lms/enrollments/get`
  - `lms/enrollments/my-courses`
  - `lms/progress/get`

Hardening updates:
- Added compatibility mappers in `server/compat/supabaseLmsRead.js`:
  - `toEnrollmentListParityRow`
  - `toEnrollmentGetParityRow`
  - `toMyCoursesParityRow`
- Aligned `certificate_issued` to legacy-compatible numeric shape (`0|1`) for read responses.
- Aligned null ordering semantics with legacy behavior:
  - my-courses: `last_accessed_at.desc.nullslast,created_at.desc`
  - progress: `last_accessed_at.desc.nullslast`
- Preserved role and not-found/forbidden sequencing in `server/modules/lms.js` read handlers.

Test coverage additions:
- Extended `tests/contracts/lms-read-cutover.test.mjs` with:
  - response-shape parity checks
  - ordering behavior checks
  - upstream failure safety checks
  - role/access and not-found-before-forbidden source checks
- Extended smoke script `scripts/qa/lms-read-cutover-smoke.mjs` with:
  - unauthorized checks
  - invalid enrollment and lesson edge checks
  - optional admin/other-user/empty-user parity scenarios

Current validation state:
- `npm run qa:contracts` -> pass
- `npm run qa:lms:cutover` -> blocked in this environment (missing `SUPABASE_LMS_TEST_EMAIL`)

Route enablement decision:
- Keep LMS React route feature-flagged off.
- Do not enable full LMS route until:
  1. staging smoke parity runs with real LMS credentials,
  2. required visible LMS flows no longer depend on legacy mutation/quiz/certificate endpoints.

## Step 16 - First TNA Read-Only Cutover (2026-04-04)

Cutover slice completed:
- `tna/summary`

Selected first TNA read-only slice and rationale:
- selected: `tna/summary`
- reason:
  - lowest-risk aggregate read endpoint
  - no mutation behavior coupling
  - stable contract shape already consumed by reporting dashboards

Implementation:
- Added `server/compat/supabaseTnaRead.js`:
  - `resolveTnaReadSource()` with `TNA_READ_SOURCE=legacy|supabase|auto`
  - `fetchTnaSummaryFromSupabase()` returning legacy-compatible keys
- Updated `server/modules/tna.js`:
  - only `tna/summary` is source-selectable in this slice
  - legacy MySQL summary path retained for fallback and rollback
- Added contract + fixture coverage:
  - `tests/contracts/tna-read-cutover.test.mjs`
  - `tests/contracts/fixtures/tna.summary.json`
  - `tests/contracts/golden-fixtures.test.mjs` action/fixture wiring update
- Added smoke harness:
  - `scripts/qa/tna-read-cutover-smoke.mjs`
  - `npm run qa:tna:cutover`

Contract parity status:
- preserved required response keys:
  - `total_needs_identified`
  - `needs_completed`
  - `active_plans`
  - `total_enrollments`
  - `enrollments_completed`
  - `critical_gaps`
  - `high_gaps`
- preserved body/query period filter compatibility for `period` input through existing `getInput(...)` behavior.

Validation status:
- `node --test tests/contracts/tna-read-cutover.test.mjs` -> pass
- `npm run qa:contracts` -> pass
- `npm run qa:tna:cutover` -> blocked in current environment (missing `SUPABASE_TNA_ADMIN_TEST_EMAIL`)

Route enablement decision:
- Keep TNA route feature-flagged off.
- Do not expose TNA route until visible screens are fully backed by migrated + smoke-verified read endpoints.

Remaining TNA blockers:
- read reporting endpoints `tna/gaps-report` and `tna/lms-report` still legacy-backed
- mutation flows (`plan/*`, `needs/*`, `enroll*`, import/migration actions) still legacy-backed

## Step 17 - Mutation Workflow Parity Baseline (2026-04-04)

Scope:
- define and test workflow parity expectations for mutation-heavy LMS/TNA paths before mutation cutover.

Added artifacts:
- parity matrix/spec:
  - `docs/workflow-mutation-parity.md`
- workflow fixtures:
  - `tests/contracts/fixtures/lms.workflow-core-mutation.json`
  - `tests/contracts/fixtures/tna.workflow-basic-mutation.json`
- contract/readiness tests:
  - `tests/contracts/workflow-parity-readiness.test.mjs`
- workflow smoke scripts:
  - `scripts/qa/lms-mutation-workflow-smoke.mjs`
  - `scripts/qa/tna-mutation-workflow-smoke.mjs`
- commands:
  - `npm run qa:lms:workflow`
  - `npm run qa:tna:workflow`

First mutation cutover candidate:
- `lms/enrollments/start`

Why this first:
- bounded status transition
- deterministic side effects
- clear follow-up read verification path
- lower migration risk than quizzes/certificates/bulk flows

Current status:
- mutation cutover not started in this step
- mutation endpoints remain legacy-backed
- route flags remain unchanged (LMS/TNA off)
- workflow smoke execution blocked in current environment:
  - `qa:lms:workflow` missing `SUPABASE_LMS_WORKFLOW_TEST_EMAIL`
  - `qa:tna:workflow` missing `SUPABASE_TNA_WORKFLOW_TEST_EMAIL`

Enablement rule:
- do not expose LMS/TNA frontend routes until both read parity and relevant mutation workflow parity pass staging smoke checks.

## Reversibility

This slice is reversible:
- Session auth remains primary fallback.
- JWT path can be disabled by removing `SUPABASE_URL`.
- No LMS/TNA logic has been migrated.
- No legacy endpoint has been removed.
