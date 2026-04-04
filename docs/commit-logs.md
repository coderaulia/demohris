# Commit Logs

Purpose: keep a clean history of what was implemented, what changed, and what still needs follow-up.

## How To Use
1. Add one section per commit or PR merge.
2. Link each entry to `project-status.md` and `api-endpoint.md` when relevant.
3. Always fill `Gap Found` and `Next Follow-up` to avoid losing unfinished work.

## Entry Template

```md
## YYYY-MM-DD - <short title>
- Commit/PR: <hash or link>
- Type: feat | fix | refactor | docs | chore | test
- Scope: <module or feature>
- Completed:
  - <implemented item 1>
  - <implemented item 2>
- Gap Found:
  - <remaining bug, missing edge case, or incomplete feature>
- Next Follow-up:
  - [ ] <next action 1>
  - [ ] <next action 2>
- Notes:
  - <risk/decision/context>
```

## Current Baseline

## 2026-04-04 - First LMS Mutation Cutover (`enrollments/start`) to Supabase
- Commit/PR: pending
- Type: refactor(lms) | test | docs
- Scope: cut over `lms/enrollments/start` with reversible source switch and workflow parity proof
- Completed:
  - Added Supabase mutation adapter:
    - `server/compat/supabaseLmsMutation.js`
  - Added mutation source switch:
    - `LMS_MUTATION_SOURCE=legacy|supabase|auto`
  - Cut over only `lms/enrollments/start` in `server/modules/lms.js` while preserving legacy fallback and leaving all other mutations unchanged.
  - Preserved legacy-visible contract and guarded errors:
    - `404` for non-enrolled course
    - `400` for already completed course
    - success response shape `{ success, enrollment }`
  - Preserved side effects in Supabase path:
    - enrollment status to `in_progress`
    - `started_at` initialization when null
    - first-lesson `lesson_progress` initialization when missing
  - Added mutation cutover contract tests:
    - `tests/contracts/lms-start-mutation-cutover.test.mjs`
  - Updated workflow smoke to verify start-slice parity with mandatory follow-up reads:
    - `scripts/qa/lms-mutation-workflow-smoke.mjs`
    - checks `lms/enrollments/get` + `lms/progress/get` after `start`
  - Validation:
    - `npm run qa:contracts` -> pass (42/42)
    - `npm run qa:lms:workflow` -> pass in Supabase mutation mode
- Gap Found:
  - LMS mutations besides `start` remain legacy-backed.
  - TNA mutation workflow smoke is still blocked by missing workflow IDs/credentials.
- Next Follow-up:
  - [ ] Keep LMS route feature-flagged off until additional mutation-dependent screens are parity-verified.
  - [ ] Choose next single mutation slice (`tna/needs/update-status` or `lms/enrollments/enroll`).
  - [ ] Run `qa:tna:workflow` with seeded workflow IDs to unblock TNA mutation cutover.
- Notes:
  - Rollback remains immediate via `LMS_MUTATION_SOURCE=legacy`.
  - This milestone intentionally avoids quiz/certificate/progress mutation cutovers.

## 2026-04-04 - Supabase Read Cutover Verification Stabilization
- Commit/PR: pending
- Type: test(api) | refactor(auth) | docs
- Scope: execute and stabilize all current Supabase read cutover slices against seeded data
- Completed:
  - Verified seeded test-account mapping used by smoke scripts:
    - `admin.demo@xenos.local` (modules privileged read)
    - `manager.demo@xenos.local` (LMS admin visibility + TNA summary admin)
    - `farhan.demo@xenos.local` (LMS learner + TNA unauthorized-role check)
  - Ran smoke suites successfully:
    - `npm run qa:modules:cutover`
    - `npm run qa:lms:cutover`
    - `npm run qa:tna:cutover`
  - Ran contract suite successfully:
    - `npm run qa:contracts` (37/37)
  - Hardened JWT bridge identity resolution with Supabase employee fallback in `server/app.js` when MySQL lookup is unavailable, keeping dual-auth behavior stable for cutover tests.
  - Updated API/cutover/status docs to reflect verified read-slice state and rollout implications.
- Gap Found:
  - LMS/TNA mutation workflows remain legacy-backed and are not included in this verification milestone.
  - Workflow smoke scripts (`qa:lms:workflow`, `qa:tna:workflow`) still need dedicated workflow credentials/IDs.
- Next Follow-up:
  - [ ] Set workflow env credentials/IDs and run mutation workflow smoke suites.
  - [ ] Cut over first mutation slice (`lms/enrollments/start`) with rollback switch.
  - [ ] Keep LMS/TNA routes feature-flagged off until mutation parity is verified.
- Notes:
  - Read slice verification is complete for modules + LMS reads + TNA summary.
  - Rollback for read slices remains env-driven (`*_READ_SOURCE=legacy`).

## 2026-04-04 - Mutation Workflow Parity Verification Baseline
- Commit/PR: pending
- Type: test(workflows) | docs
- Scope: parity criteria + workflow tests for mutation-heavy LMS/TNA paths before route expansion
- Completed:
  - Added workflow mutation parity matrix doc:
    - `docs/workflow-mutation-parity.md`
  - Added mutation workflow fixtures:
    - `tests/contracts/fixtures/lms.workflow-core-mutation.json`
    - `tests/contracts/fixtures/tna.workflow-basic-mutation.json`
  - Added contract/readiness test:
    - `tests/contracts/workflow-parity-readiness.test.mjs`
  - Added workflow smoke scripts:
    - `scripts/qa/lms-mutation-workflow-smoke.mjs`
    - `scripts/qa/tna-mutation-workflow-smoke.mjs`
  - Added QA commands:
    - `npm run qa:lms:workflow`
    - `npm run qa:tna:workflow`
  - Documented first mutation cutover candidate:
    - `lms/enrollments/start`
- Gap Found:
  - Mutation endpoints are still legacy-backed; no mutation Supabase cutover in this milestone.
  - Workflow smoke execution is blocked in current environment due missing workflow credentials/seed IDs.
- Next Follow-up:
  - [ ] Run workflow smoke checks in staging with real test accounts and IDs.
  - [ ] Cut over `lms/enrollments/start` with env-driven rollback guard.
  - [ ] Keep LMS/TNA routes feature-flagged off until read + mutation parity both pass.
- Notes:
  - This milestone is test-first and reversible by design.

## 2026-04-04 - First TNA Read-Only Supabase Cutover (Summary)
- Commit/PR: pending
- Type: refactor(tna) | test | docs
- Scope: `tna/summary` read-only endpoint cutover from MySQL to Supabase
- Completed:
  - Added Supabase TNA-read adapter:
    - `server/compat/supabaseTnaRead.js`
  - Added source switch:
    - `TNA_READ_SOURCE=legacy|supabase|auto`
  - Cut over `tna/summary` in `server/modules/tna.js` with legacy fallback preserved.
  - Preserved summary response contract keys and numeric semantics.
  - Added contract coverage:
    - `tests/contracts/tna-read-cutover.test.mjs`
    - `tests/contracts/fixtures/tna.summary.json`
    - updated `tests/contracts/golden-fixtures.test.mjs`
  - Added authenticated smoke harness:
    - `scripts/qa/tna-read-cutover-smoke.mjs`
    - `npm run qa:tna:cutover`
  - Updated API/cutover/migration docs for slice status and rollout rules.
- Gap Found:
  - Smoke run is blocked in current environment because `SUPABASE_TNA_ADMIN_TEST_EMAIL` is not set.
  - `tna/gaps-report`, `tna/lms-report`, and all TNA mutations remain legacy-backed.
- Next Follow-up:
  - [ ] Set TNA smoke credentials and run `npm run qa:tna:cutover` against staging/live-safe backend.
  - [ ] Keep TNA frontend route feature-flagged off until smoke parity is verified.
  - [ ] Migrate next TNA read reporting slice (`tna/gaps-report` or `tna/lms-report`) with contract parity tests.
- Notes:
  - Rollback remains env-driven with `TNA_READ_SOURCE=legacy`.
  - This slice intentionally avoids TNA mutation cutover.

## 2026-04-04 - LMS Read Parity Hardening and Rollout Readiness Checks
- Commit/PR: pending
- Type: test(lms) | refactor(api) | docs
- Scope: Supabase LMS read parity hardening for `enrollments/list|get|my-courses` and `progress/get`
- Completed:
  - Added LMS parity mappers in `server/compat/supabaseLmsRead.js` to keep response shape aligned with legacy handlers.
  - Aligned null-order behavior for my-courses/progress queries using `.nullslast` ordering.
  - Added role/access contract checks for employee vs admin reads and not-found-before-forbidden behavior.
  - Extended LMS smoke harness with edge and access scenarios:
    - unauthorized
    - invalid enrollment id
    - invalid lesson id
    - optional admin/other-user/empty-user checks
  - Updated API and migration docs with explicit route enablement decision.
- Gap Found:
  - LMS mutation/quiz/certificate flows remain legacy-backed and block full LMS route enablement.
  - Staging smoke requires LMS test credentials (`SUPABASE_LMS_TEST_EMAIL/PASSWORD`) to complete live parity evidence.
- Next Follow-up:
  - [ ] Run `npm run qa:lms:cutover` in staging with LMS credential set and capture results.
  - [ ] Keep LMS route feature-flagged off until smoke + role parity is verified end-to-end.
  - [ ] Begin next slice: TNA read-only summary/reporting endpoint cutover.
- Notes:
  - Rollback remains env-driven with `LMS_READ_SOURCE=legacy`.

## 2026-04-04 - Second Backend Domain Cutover Milestone (LMS Read Endpoints)
- Commit/PR: pending
- Type: refactor(api) | test | docs
- Scope: LMS read endpoint cutover (`enrollments/list|get|my-courses`, `progress/get`) from MySQL to Supabase
- Completed:
  - Added Supabase LMS-read adapter:
    - `server/compat/supabaseLmsRead.js`
  - Cut over LMS read actions to source-selectable Supabase path with stable response contracts.
  - Kept LMS mutation-heavy actions on legacy path in this slice.
  - Added contract/integration tests:
    - `tests/contracts/lms-read-cutover.test.mjs`
  - Added authenticated smoke harness:
    - `scripts/qa/lms-read-cutover-smoke.mjs`
    - `npm run qa:lms:cutover`
  - Added env/runbook updates for source switch:
    - `LMS_READ_SOURCE=legacy|supabase|auto`
- Gap Found:
  - LMS mutations, quizzes, assignments, certificates are still legacy-backed.
  - TNA endpoint groups remain legacy/MySQL-backed.
- Next Follow-up:
  - [ ] Run `qa:lms:cutover` in staging/live-safe environment with seeded Supabase user credentials.
  - [ ] Migrate next safe slice: TNA read-only summary/reporting endpoints.
  - [ ] Keep LMS/TNA frontend routes disabled until parity and smoke checks pass.
- Notes:
  - Response keys were preserved to avoid contract drift.
  - Rollback remains env-driven by switching `LMS_READ_SOURCE`.

## 2026-04-04 - First Backend Domain Cutover Milestone (Modules Read)
- Commit/PR: pending
- Type: refactor(api) | test | docs
- Scope: modules read endpoint cutover (`list/get/by-category/active`) from MySQL to Supabase
- Completed:
  - Added Supabase module-read adapter:
    - `server/compat/supabaseModulesRead.js`
  - Cut over `modules/*` read actions to source-selectable Supabase path with stable response contracts.
  - Kept `modules/*` write actions on legacy path to avoid mutation-risk in first slice.
  - Added contract/integration tests:
    - `tests/contracts/modules-cutover.test.mjs`
  - Added authenticated smoke harness for staging/live validation:
    - `scripts/qa/modules-cutover-smoke.mjs`
    - `npm run qa:modules:cutover`
  - Added endpoint matrix doc:
    - `docs/backend-cutover-matrix.md`
- Gap Found:
  - LMS/TNA endpoint groups remain legacy/MySQL-backed.
  - Modules write actions (`update/toggle/activity`) remain legacy-backed by design in this slice.
- Next Follow-up:
  - [ ] Run `qa:modules:cutover` with privileged test account env (`SUPABASE_MODULES_TEST_EMAIL/PASSWORD`).
  - [ ] Migrate next safe slice: LMS read-only list/overview endpoints.
  - [ ] Keep LMS/TNA frontend routes disabled until endpoint parity tests pass.
- Notes:
  - Cutover source is controlled via `MODULES_READ_SOURCE` (`legacy|supabase|auto`).
  - API response required keys were preserved.

## 2026-04-04 - Hard Fix For Hostinger Output Directory Detection
- Commit/PR: pending
- Type: fix(deploy)
- Scope: ensure build artifacts are detectable regardless Hostinger root/output path interpretation
- Completed:
  - Added `apps/web-react/scripts/mirror-dist.mjs` to mirror `dist` to fallback locations.
  - Updated React build scripts to run mirror step automatically.
  - Updated Hostinger runbook with correct root/output pairs for Vite preset.
- Gap Found:
  - Hostinger project-level root/output settings can still override valid build outputs if mispaired.
- Next Follow-up:
  - [ ] Use one valid root/output pair and redeploy.
  - [ ] Confirm logs no longer show `No output directory found after build`.
- Notes:
  - This fix targets Hostinger output discovery behavior after a successful Vite build.

## 2026-04-04 - Fix Hostinger Rollup `zod` Resolution
- Commit/PR: pending
- Type: fix(deploy)
- Scope: monorepo package resolution in Hostinger CI build
- Completed:
  - Added `zod` to root runtime dependencies so linked contracts path resolves in CI.
  - Enabled `preserveSymlinks` in `apps/web-react/vite.config.ts` to avoid realpath resolution drift for local `file:` package linkage.
  - Verified `npm run build` passes with frontend-only pipeline.
- Gap Found:
  - Hostinger may still use cached previous build settings.
- Next Follow-up:
  - [ ] Trigger manual redeploy after confirming build command is `npm run build`.
  - [ ] Confirm logs no longer show `Rollup failed to resolve import "zod"`.
- Notes:
  - This specifically addresses failure from `packages/contracts/src/api.ts` during Vite/Rollup build.

## 2026-04-04 - Hard Fix For Hostinger Build Toolchain
- Commit/PR: pending
- Type: fix(deploy)
- Scope: remove CI dependence on missing `tsc` binary and enforce frontend-only build path
- Completed:
  - Changed `apps/web-react` build script to `vite build` for deployment robustness.
  - Added strict local build script (`build:strict`) that keeps typecheck gate available.
  - Changed root `build` to frontend-only Hostinger pipeline.
  - Hardened build pipeline to install frontend dependencies with `--include=dev` before building.
- Gap Found:
  - Hostinger project may still be using old cached settings/commands from previous deploy config.
- Next Follow-up:
  - [ ] Confirm Hostinger build command is `npm run build` and start command is `npm run hostinger:start`.
  - [ ] Trigger fresh redeploy and verify successful build logs include dependency install step for `apps/web-react`.
- Notes:
  - This specifically addresses `sh: tsc: command not found` in CI.

## 2026-04-04 - Hostinger Frontend-Only Runtime Fix
- Commit/PR: pending
- Type: fix(deploy) | chore
- Scope: Hostinger CI/CD build/start alignment for frontend-only deployment
- Completed:
  - Switched default root build script to React shell build path.
  - Added Hostinger static SPA runtime script:
    - `scripts/hostinger-frontend-server.mjs`
  - Updated Hostinger config to frontend-only deploy:
    - `hostinger.json` now uses `npm run hostinger:build` and `npm run hostinger:start`
    - dist directory set to `apps/web-react/dist`
  - Updated deployment docs with required start-command override.
- Gap Found:
  - Legacy root Vite build warnings are unrelated to the new React shell but can still appear if Hostinger uses old build command.
- Next Follow-up:
  - [ ] Confirm Hostinger project settings match `hostinger.json` overrides.
  - [ ] Redeploy and verify `/dashboard` refresh + Supabase login on live domain.
- Notes:
  - Build warnings about large chunks are warnings, not build failures.
  - Previous deployment failures were likely caused by wrong build/start target selection.

## 2026-04-03 - Production Deploy Cutover Preparation (Hostinger + Supabase)
- Commit/PR: pending
- Type: chore(deploy) | refactor(frontend) | docs
- Scope: live-safe frontend routing, Supabase-first auth path, Hostinger/Supabase runbooks
- Completed:
  - Updated React env model for production-safe defaults (`VITE_API_TARGET=supabase`).
  - Added route-level feature flags for non-migrated modules:
    - `VITE_ENABLE_LMS_ROUTE`
    - `VITE_ENABLE_TNA_ROUTE`
    - `VITE_SHOW_LEGACY_APP_LINK`
  - Updated auth adapter to use Supabase session/profile directly for login/session/logout in Supabase mode.
  - Added strict transport guard so Supabase target does not silently call legacy endpoints for non-cutover actions.
  - Added SPA fallback file for Hostinger static serving:
    - `apps/web-react/public/.htaccess`
  - Added production deployment docs:
    - `docs/production-deploy-plan.md`
    - `docs/hostinger-autodeploy-runbook.md`
    - `docs/supabase-production-runbook.md`
  - Updated architecture/status docs with live scope classification and rollout constraints.
- Gap Found:
  - LMS/TNA domain handlers are still legacy MySQL-coupled and are intentionally not live in this release scope.
  - Full production backend domain cutover to Supabase is still pending.
- Next Follow-up:
  - [ ] Apply migrations to production Supabase project and validate RLS/auth with real production users.
  - [ ] Execute Hostinger GitHub auto-deploy using `apps/web-react` build settings and run smoke checklist.
  - [ ] Migrate first LMS/TNA read-only endpoint to Supabase before enabling route flags.
- Notes:
  - Production launch scope is intentionally minimal and reversible.
  - Service-role credentials remain backend/ops-only and are not used in frontend build/runtime.
  - Deployment execution status: pending external run on Hostinger/Supabase production credentials.

## 2026-04-03 - Supabase Schema + Seed Baseline Milestone
- Commit/PR: pending
- Type: refactor(db) | docs | chore
- Scope: full Supabase baseline migrations, deterministic seed data, auth-profile provisioning runbook
- Completed:
  - Added Supabase migrations for core/module, LMS, TNA, compatibility triggers, RLS baseline, and KPI/probation/PIP baseline (`0003`-`0009`).
  - Added deterministic non-production seed file: `supabase/seeds/seed_dev_staging.sql`.
  - Updated provisioning script to apply schema + seed in one command:
    - `npm run qa:supabase:provision`
  - Added auth user/profile provisioning script:
    - `npm run qa:supabase:auth-users`
  - Applied migrations and seed to linked dev/staging Supabase targets.
  - Added schema and seed docs:
    - `docs/supabase-schema-baseline.md`
    - `docs/supabase-seed-plan.md`
  - Updated migration/project status docs with baseline validation outcomes.
- Gap Found:
  - Legacy Express runtime still executes most domain SQL via MySQL pool.
  - Backend health/auth parity remains blocked when MySQL is unavailable.
- Next Follow-up:
  - [ ] Begin module-by-module backend query cutover to Supabase (start with low-risk read endpoints).
  - [ ] Add Supabase-backed integration smoke tests for one LMS and one TNA authenticated path.
  - [ ] Keep contract fixtures frozen; update only with explicit drift documentation.
- Notes:
  - Dummy MySQL seed files are no longer treated as development source-of-truth for data.
  - Migration remains reversible while legacy runtime compatibility path is still present.

## 2026-04-03 - React Shell + Adapter Migration Baseline
- Commit/PR: pending
- Type: refactor(frontend) | docs
- Scope: React + TypeScript shell, adapter architecture, shared contracts
- Completed:
  - Added isolated React app at `apps/web-react` (React 19, TypeScript, Vite, Router, TanStack Query).
  - Added shared contract package at `packages/contracts` using Zod schemas aligned to golden fixtures.
  - Added centralized adapter transport switch with `authAdapter`, `lmsAdapter`, and `tnaAdapter`.
  - Added `AuthProvider` that resolves Supabase JWT session first and falls back to legacy `auth/session`.
  - Added shell routes (`/dashboard`, `/lms/*`, `/tna/*`) with route guard, layout, and error boundary.
  - Migrated first safe frontend slice: dashboard shell only.
  - Added docs:
    - `docs/frontend-architecture.md`
    - `docs/frontend-migration-checklist.md`
  - Verified `apps/web-react` production build passes.
- Gap Found:
  - LMS and TNA screens remain placeholders in React shell by design.
  - Auth parity evidence in staging is still blocked by backend DB connectivity for configured local target.
- Next Follow-up:
  - [ ] Complete auth parity validation against staging-ready backend target.
  - [ ] Migrate next safe slice (module list or read-only LMS summary) via adapters.
  - [ ] Add adapter-level contract regression tests in frontend workspace.
- Notes:
  - Legacy frontend remains untouched and available as fallback.
  - Migration remains reversible through centralized adapter routing.

## 2026-04-03 - Supabase Auth Stabilization and Staging Validation Harness
- Commit/PR: pending
- Type: refactor(auth) | test | docs
- Scope: Supabase JWT stabilization, deterministic profile sync, staging validation scripts
- Completed:
  - Implemented deterministic first-JWT identity binding (`auth_id` + `auth_email`) with collision guard.
  - Added best-effort Supabase `profiles` sync from legacy employee role mapping.
  - Added staging/provision command scripts:
    - `npm run qa:supabase:provision`
    - `npm run qa:auth:staging`
  - Updated QA scripts to load `.env` directly (no external dotenv dependency).
  - Fixed `supabase/migrations/0001_profiles_auth.sql` to use a Postgres-compatible enum creation block.
  - Fixed provisioning script workdir to run from repository root and enabled non-interactive `db push`.
  - Ran Supabase provisioning successfully; migrations are up to date for dev and staging targets.
  - Added strict backend health preflight in staging auth check to detect DB/connectivity issues before parity assertions.
  - Added failure-case contract tests for invalid JWT and missing-role safety behavior.
  - Updated migration docs with auth dependency map and validation workflow.
- Gap Found:
  - Real auth parity validation is blocked because backend target fails health check (MySQL `ECONNREFUSED 127.0.0.1:3306`).
  - Expired JWT and unmapped-user runtime checks depend on optional test tokens/accounts.
- Next Follow-up:
  - [ ] Run backend with reachable DB (or point `BACKEND_BASE_URL` to staging backend) and rerun `npm run qa:auth:staging`.
  - [ ] Capture parity report (session vs JWT) for same test user.
  - [ ] Record real failure-case outcomes in migration doc.
- Notes:
  - Legacy session fallback remains active and unchanged.
  - LMS/TNA logic was intentionally not migrated.

## 2026-04-03 - Supabase Foundation + Dual-Auth Bridge Baseline
- Commit/PR: pending
- Type: refactor(backend) | test | docs
- Scope: auth bridge foundation, contract freeze, Supabase profile/RLS base
- Completed:
  - Added golden contract fixtures for auth, LMS enrollments/progress, TNA calculate-gaps, and module endpoints.
  - Added contract and auth-bridge tests (`npm run qa:contracts`).
  - Implemented backend dual-auth bridge middleware (legacy session first, then Supabase JWT).
  - Added Supabase migration foundation (`profiles` table + minimal RLS policies).
  - Added migration runbook doc: `docs/supabase-backend-migration.md`.
- Gap Found:
  - Supabase staging rollout and real JWT integration tests are not executed yet.
  - LMS/TNA domain logic is intentionally still on legacy backend.
- Next Follow-up:
  - [ ] Validate dual-auth bridge in staging with real Supabase JWT.
  - [ ] Add integration contract tests for auth/session parity.
  - [ ] Prepare first non-critical domain cutover after auth stabilization.
- Notes:
  - Session auth remains active fallback by design.
  - No legacy endpoint removal in this slice.

## 2026-04-03 - Full-Stack Refactor Planning Baseline
- Commit/PR: pending
- Type: docs(refactor)
- Scope: architecture decision, migration phases, risk register, execution checklist
- Completed:
  - Added `docs/refactor-master-plan.md` with code-verified current-state analysis.
  - Evaluated Supabase-first vs Workers-first against current LMS/TNA/auth coupling.
  - Defined target architecture (React+TS+Vite + Supabase-first), migration phases A-F, and rollback-driven risk register.
  - Added refactor track into `docs/project-status.md` without removing LMS progress history.
- Gap Found:
  - No automated contract test suite yet for migration-critical LMS/TNA paths.
  - Auth bridge implementation details still pending execution phase.
- Next Follow-up:
  - [ ] Build API contract fixtures and parity tests for LMS/TNA/auth.
  - [ ] Provision Supabase staging and define schema migration runbook.
  - [ ] Implement dual-auth bridge before any production cutover.
- Notes:
  - Refactor strategy explicitly avoids big-bang rewrite and preserves Hostinger frontend deploy compatibility.

## 2026-04-03 - API/Docs/Implementation Consistency Sync
- Commit/PR: pending
- Type: docs | fix | refactor
- Scope: API routing alignment (LMS, TNA, Modules), documentation sync
- Completed:
  - Added missing LMS handlers for `lms/enrollments/get` and `lms/progress/get`.
  - Aligned TNA input parsing to support POST body payloads used by frontend.
  - Updated module frontend client to call `/api/modules?action=...` route directly.
  - Updated `docs/api-endpoint.md` with full cross-check and drift report.
  - Removed unused `LMS_TABLES` dead constant.
- Gap Found:
  - Endpoint examples and permission matrix are still not fully documented per action.
  - New sync fixes are not covered by dedicated API regression tests yet.
- Next Follow-up:
  - [ ] Add regression tests for LMS progress/enrollment read actions.
  - [ ] Add regression tests for TNA POST filter payload behavior.
  - [ ] Document request/response examples for highest-traffic actions.
- Notes:
  - This sync specifically targets backend/frontend/docs consistency drift.

## 2026-03-31 - LMS Sprint 1 to Sprint 3 Delivered
- Commit/PR: Multiple commits (legacy LMS progress doc history)
- Type: feat
- Scope: LMS course management, student experience, quiz and assessment
- Completed:
  - Base LMS module structure integrated into application.
  - Course catalog, create/edit flow, and lesson viewer implemented.
  - Enrollment flow, progress tracking UI, quiz interface, and auto-grading implemented.
- Gap Found:
  - Sprint 4 admin capabilities are not completed yet.
  - E2E suite for LMS and related flows is still pending.
  - Full API endpoint documentation is still incomplete.
- Next Follow-up:
  - [ ] Implement admin dashboard, bulk assignment, analytics, and certificate generation completion checks.
  - [ ] Finish LMS E2E tests in `tests/e2e`.
  - [ ] Validate and finalize endpoint-level status in `docs/api-endpoint.md`.
- Notes:
  - Existing progress references were originally tracked in LMS progress docs.
