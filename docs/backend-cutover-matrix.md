# Backend Cutover Matrix

Last updated: 2026-04-04

Purpose: source-of-truth matrix for API rollout from legacy MySQL handlers to Supabase-backed handlers.

## STEP 0 - Reality Check (Code-Verified)

Files verified:
- `server/app.js`
- `server/modules/lms.js`
- `server/modules/tna.js`
- `server/modules/moduleManager.js`
- `server/compat/*`
- `server/tableMeta.js`
- `apps/web-react/src/adapters/*`
- `packages/contracts/*`
- `tests/contracts/*`
- `scripts/qa/*`

### 1) Endpoint groups currently live in production
- Public frontend routes live:
  - `/login`
  - `/dashboard`
- Backend endpoint groups currently exposed by production shell:
  - none beyond auth bootstrap compatibility (frontend auth is Supabase-first)
- LMS/TNA frontend routes:
  - feature-flagged off

### 2) Endpoint groups still legacy/MySQL-backed
- `auth/*` -> MySQL `employees` still used for legacy login/session and role mapping
- `db/query` -> MySQL generic table gateway
- `lms/*` -> MySQL
- `tna/*` -> MySQL
- `modules/*` write/actions -> MySQL

### 3) Endpoint groups safe to migrate first
- `modules/*` read endpoints:
  - `list`
  - `get`
  - `by-category`
  - `active`
- Reason:
  - read-only
  - low business-critical mutation risk
  - stable contract (`success`, `modules` / `module`)

### 4) Endpoint groups too risky to migrate first
- LMS quiz submission and grading
- LMS progress mutation
- certificate issuance
- TNA plan/need/enrollment mutation workflows

## STEP 1 - Verified Endpoint Matrix

| Endpoint Group | Status | Data Source | Test Status | Frontend Exposure | Notes |
|---|---|---|---|---|---|
| `auth/*` | legacy-only | mixed (Supabase JWT verify + MySQL identity/session) | contract only | public live (`/login`, `/dashboard`) | shell auth is Supabase-first client side, backend parity still mixed |
| `modules/*` read (`list/get/by-category/active`) | verified | Supabase (when `MODULES_READ_SOURCE=auto|supabase` + env configured), else MySQL | contract + integration + smoke verified (`qa:modules:cutover`) | legacy-only / not in live shell nav | verified with seeded superadmin account |
| `modules/*` write (`update/toggle/activity`) | legacy-only | MySQL | contract only | legacy-only | unchanged in this slice |
| `db/query` | legacy-only | MySQL | contract only | legacy-only | no cutover in this slice |
| `lms/courses/*` | blocked | MySQL | contract only | feature-flagged off | defer to read-first LMS slice |
| `lms/sections/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/lessons/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/enrollments/*` | in progress (read actions verified; `start` mutation cut over) | mixed: Supabase for `list/get/my-courses` + `start` via source switch, MySQL for remaining mutations | contract + integration + smoke verified (`qa:lms:cutover`, `qa:lms:workflow`) | feature-flagged off | `start` parity verified with follow-up `enrollments/get` + `progress/get` |
| `lms/progress/*` | in progress (read action verified; mutations legacy) | mixed: Supabase for `get` via source switch, MySQL for mutations | contract + integration + smoke verified (`qa:lms:cutover`) | feature-flagged off | `progress/get` parity verified |
| `lms/quizzes/*` | blocked | MySQL | not tested | feature-flagged off | high-risk; defer |
| `lms/dashboard/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/assignments/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/certificates/*` | blocked | MySQL | not tested | feature-flagged off | high-risk; defer |
| `tna/*` | in progress (summary read verified; remaining actions legacy) | mixed: Supabase for `summary` via source switch, MySQL for all other actions | contract + integration + smoke verified (`qa:tna:cutover`) | feature-flagged off | `tna/summary` verified with manager+employee role checks |
| shell-required backend reads | live-safe | N/A for current shell | integration tested via frontend shell smoke | public live | shell currently does not require LMS/TNA backend routes |

## STEP 2 - First Safe Cutover Slice

Selected slice:
- `modules/*` read endpoints (`list`, `get`, `by-category`, `active`)

Why lowest risk:
- read-only shape
- no scoring/progress side effects
- isolated table (`module_settings`)
- no LMS/TNA mutation coupling

## STEP 3 - Second Safe Cutover Slice

Selected slice:
- LMS read actions:
  - `lms/enrollments/list`
  - `lms/enrollments/get`
  - `lms/enrollments/my-courses`
  - `lms/progress/get`

Implementation:
- Added `server/compat/supabaseLmsRead.js` for Supabase-backed enrollment/progress reads.
- Added source switch:
  - `LMS_READ_SOURCE=legacy|supabase|auto`
  - `auto` uses Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` exist.
- Kept LMS mutation actions (`enroll`, `unenroll`, `start`, `complete`, `progress/update`, `progress/complete-lesson`, quizzes, certificates) on legacy path.

Validation:
- Contract + adapter tests:
  - `tests/contracts/lms-read-cutover.test.mjs`
- Authenticated smoke harness:
  - `scripts/qa/lms-read-cutover-smoke.mjs`
  - `npm run qa:lms:cutover`

## STEP 4 - Third Safe Cutover Slice

Selected slice:
- TNA read action:
  - `tna/summary`

Why lowest risk:
- read-only aggregate counters
- no mutation coupling
- stable existing response contract
- no dependency on mutation-heavy TNA plan/enrollment workflows

Implementation:
- Added `server/compat/supabaseTnaRead.js` for Supabase count-based summary reads.
- Added source switch:
  - `TNA_READ_SOURCE=legacy|supabase|auto`
  - `auto` uses Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` exist.
- Updated `server/modules/tna.js` so only `tna/summary` is source-selectable.
- Kept all other TNA endpoints on legacy path.

Validation:
- Contract + adapter tests:
  - `tests/contracts/tna-read-cutover.test.mjs`
  - `tests/contracts/golden-fixtures.test.mjs` includes `tna.summary.json`
- Authenticated smoke harness:
  - `scripts/qa/tna-read-cutover-smoke.mjs`
  - `npm run qa:tna:cutover`
  - current status: pass (seeded role accounts)

Route exposure decision:
- Keep TNA React route feature-flagged off.
- Do not enable TNA route until visible screens are fully backed by migrated and parity-tested reads.

## STEP 6 - Repeatable Cutover Pattern

Use this checklist for every next slice:
1. Endpoint group + action list
2. Old source (`MySQL`)
3. New source (`Supabase`)
4. Contract impact (none/explicit)
5. Added tests:
   - contract
   - integration
   - smoke
6. Frontend exposure decision:
   - keep hidden
   - partial flag
   - enable
7. Rollback:
   - source toggle/env
   - route flag off
   - revert commit

## Current Rollout Decision

- LMS/TNA frontend routes stay disabled.
- No new frontend route exposure in this cutover commit.
- Next recommended slice:
  - one bounded mutation slice (`tna/needs/update-status` or `lms/enrollments/enroll`) after workflow parity gates are met.

## Mutation Parity Readiness (Pre-Cutover Gate)

Reference matrix:
- `docs/workflow-mutation-parity.md`

Current mutation parity test assets:
- Contract/readiness test:
  - `tests/contracts/workflow-parity-readiness.test.mjs`
- Workflow fixtures:
  - `tests/contracts/fixtures/lms.workflow-core-mutation.json`
  - `tests/contracts/fixtures/tna.workflow-basic-mutation.json`
- Workflow smoke scripts:
  - `scripts/qa/lms-mutation-workflow-smoke.mjs` (`npm run qa:lms:workflow`)
  - `scripts/qa/tna-mutation-workflow-smoke.mjs` (`npm run qa:tna:workflow`)

Current smoke status:
- `qa:lms:workflow` pass in Supabase mode (`LMS_MUTATION_SOURCE=supabase`, seeded learner account)
- `qa:tna:workflow` blocked in current environment (missing workflow seed IDs)

First mutation cutover candidate:
- `lms/enrollments/start` (completed in this slice)

Why this slice first:
- bounded side effects
- strong follow-up read verification path
- lower blast radius than quiz/certificate/bulk mutations

Next mutation candidate:
- `tna/needs/update-status` or `lms/enrollments/enroll` (single-slice rule remains)

Route expansion rule remains unchanged:
- keep LMS/TNA frontend routes feature-flagged off until related read + mutation workflows pass parity checks.

## Read Slice Verification Run (2026-04-04)

Verified slices:
- `modules/*` read
- LMS reads: `lms/enrollments/list|get|my-courses`, `lms/progress/get`
- TNA read: `tna/summary`

Smoke commands and results:
- `npm run qa:modules:cutover` -> pass
- `npm run qa:lms:cutover` -> pass
- `npm run qa:tna:cutover` -> pass

Credential mapping used (seeded accounts):
- modules privileged user:
  - `SUPABASE_MODULES_TEST_EMAIL=admin.demo@xenos.local`
- LMS learner:
  - `SUPABASE_LMS_TEST_EMAIL=farhan.demo@xenos.local`
- LMS admin check:
  - `SUPABASE_LMS_ADMIN_TEST_EMAIL=manager.demo@xenos.local`
- TNA summary admin:
  - `SUPABASE_TNA_ADMIN_TEST_EMAIL=manager.demo@xenos.local`
- TNA unauthorized-role check:
  - `SUPABASE_TNA_EMPLOYEE_TEST_EMAIL=farhan.demo@xenos.local`

Verification caveat:
- backend process must be started with `.env` loaded so Supabase auth/read-source env values are available at runtime.

## First Mutation Slice Verification Run (2026-04-04)

Slice:
- `lms/enrollments/start`

Source switch:
- `LMS_MUTATION_SOURCE=legacy|supabase|auto`
- verification run used `LMS_MUTATION_SOURCE=supabase`

Workflow checks:
- `npm run qa:lms:workflow` -> pass
- mandatory follow-up reads after start:
  - `lms/enrollments/get` -> pass
  - `lms/progress/get` -> pass

Seeded workflow inputs used:
- `SUPABASE_LMS_WORKFLOW_TEST_EMAIL=farhan.demo@xenos.local`
- `SUPABASE_LMS_WORKFLOW_TEST_COURSE_ID=a1000000-0000-4000-8000-000000000001`

Rollback:
- set `LMS_MUTATION_SOURCE=legacy`
- keep LMS frontend route feature-flagged off
