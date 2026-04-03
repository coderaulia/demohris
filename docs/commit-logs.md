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
