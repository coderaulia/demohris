# API Endpoint Tracker

Purpose: keep API docs consistent with implementation and frontend usage.

## Sync Metadata
- Last sync date: 2026-04-04
- Scope:
  - backend handlers in `server/app.js`, `server/modules/lms.js`, `server/modules/tna.js`
  - frontend API callers in `src/modules/data/*.js`
- Result: API/docs/frontend drift reduced and key runtime mismatches fixed.

## PHASE 1 - Cross Check

### Route Patterns In Code
- `GET /api/health`
- `ALL /api/modules?action=<list|get|update|toggle|activity|by-category|active>`
- `ALL /api?action=<auth/*|db/query|tna/*|lms/*>`

### Frontend Usage Patterns
- Generic API caller: `src/lib/supabase.js` -> `/api?action=<...>`
- Module manager caller: `src/modules/data/modules.js` -> `/api/modules?action=<...>` (synced in this pass)
- LMS caller: `src/modules/data/lms.js`
- TNA caller: `src/modules/data/tna.js`

## PHASE 2 - Drift Findings

### Undocumented Endpoints (previous docs gap)
- `auth/login`, `auth/logout`, `auth/session`, `auth/create-user`, `auth/password-reset-request`, `auth/update-password`, `auth/verify-password`
- All `tna/*` actions
- `/api/modules?action=*` action list
- `lms/enrollments/get` (now implemented in this sync)

### Outdated Docs
- Docs previously centered on LMS only and did not describe auth, TNA, module routes, or parameter transport behavior.

### Missing Validation / Behavior Gaps Found
- `lms/progress/get` was routed but had no handler (runtime failure risk).
- Frontend called `lms/enrollments/get` but backend did not implement it.
- TNA read several filters from `req.query` while frontend sends POST body payload.

### Inconsistent Naming / Transport
- Frontend used `modules/*` actions through `/api?action=...`, while backend modules are served at `/api/modules`.
- Frontend LMS consumer used `updateProgress({...})` while data layer exposed only `updateLessonProgress(...)`.

## PHASE 3 - Fixes Applied

### Code Sync
- Added missing LMS endpoint handler:
  - `lms/enrollments/get` in `server/modules/lms.js`
- Added missing LMS progress reader:
  - `lms/progress/get` handler (`getLessonProgress`) in `server/modules/lms.js`
- Aligned TNA input parsing:
  - Added `getInput(req, key)` fallback (body -> query) in `server/modules/tna.js`
  - Updated all TNA endpoints that previously relied on `req.query`
- Aligned module API client route:
  - `src/modules/data/modules.js` now calls `/api/modules?action=...`
- Aligned LMS data-layer naming:
  - Added `updateProgress(payload)` wrapper in `src/modules/data/lms.js`
  - `completeLesson` now accepts object payload or positional args
- Removed dead code:
  - Unused `LMS_TABLES` constant removed from `server/modules/lms.js`

## Current Endpoint Inventory

### Core
| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/api/health` | GET | Implemented | DB health check |
| `/api?action=db/query` | ALL | Implemented | Table CRUD gateway with access controls |
| `/api/modules?action=list|get|update|toggle|activity|by-category|active` | ALL | Implemented | Role-gated (`superadmin`, `hr`) |

### Auth Actions
| Action | Status | Validation |
|---|---|---|
| `auth/login` | Implemented | Requires `email`, `password` |
| `auth/logout` | Implemented | Session invalidate |
| `auth/session` | Implemented | Returns current session profile |
| `auth/create-user` | Implemented | Superadmin only, min password rules |
| `auth/password-reset-request` | Implemented | Accepts `email` |
| `auth/update-password` | Implemented | Auth required, min length 8 |
| `auth/verify-password` | Implemented | Auth required |

### LMS Actions
| Action Group | Status | Notes |
|---|---|---|
| `lms/courses/*` | Implemented | List/get/create/update/delete/publish |
| `lms/sections/*` | Implemented | List/create/update/delete/reorder |
| `lms/lessons/*` | Implemented | List/get/create/update/delete/reorder |
| `lms/questions/*` | Implemented | List/create/update/delete |
| `lms/enrollments/*` | Implemented | Includes `get`, `list`, `my-courses`, `start`, `complete` |
| `lms/progress/*` | Implemented | `update`, `get`, `complete-lesson` |
| `lms/quizzes/*` | Implemented | `submit`, `get-attempt` |
| `lms/reviews/*` | Implemented | List/create/update/delete |
| `lms/dashboard/*` | Implemented | Stats, recommendations |
| `lms/assignments/*` | Implemented | Create/list/complete |
| `lms/certificates/*` | Implemented | List/generate |

### TNA Actions
| Action Group | Status | Notes |
|---|---|---|
| `tna/calculate-gaps` | Implemented | Employee gap analysis |
| `tna/needs*` | Implemented | Need records and status changes |
| `tna/plans*` | Implemented | Plan CRUD and items |
| `tna/needs-config*` | Implemented | Position competency requirements |
| `tna/courses`, `tna/course-*` | Implemented | Training course management |
| `tna/enrollments*`, `tna/enroll*` | Implemented | Enrollment lifecycle |
| `tna/summary`, `tna/gaps-report`, `tna/lms-report` | Implemented | Reporting |
| `tna/import-competencies`, `tna/bulk-create-need-records` | Implemented | Bulk operations |
| `tna/migrate-training-history`, `tna/training-history-stats` | Implemented | Migration/admin utilities |

## Open Follow-up Checklist
- [ ] Add request/response examples per high-traffic action (`lms/courses/list`, `lms/progress/get`, `tna/calculate-gaps`, `auth/login`)
- [ ] Add explicit permission matrix per action (employee/manager/hr/superadmin)
- [x] Add automated API tests for LMS read cutover (`lms/enrollments/get`, `lms/progress/get`) via `tests/contracts/lms-read-cutover.test.mjs`
- [x] Add regression tests ensuring TNA accepts POST payload filters (`tests/contracts/tna-read-cutover.test.mjs`, `scripts/qa/tna-read-cutover-smoke.mjs`)

## 2026-04-04 Cutover Update - First Supabase Endpoint Slice

Cutover scope in this milestone:
- `modules/*` read endpoints:
  - `list`
  - `get`
  - `by-category`
  - `active`

Data-source behavior:
- `MODULES_READ_SOURCE=supabase` -> force Supabase reads (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- `MODULES_READ_SOURCE=auto` -> Supabase when configured, else legacy MySQL
- `MODULES_READ_SOURCE=legacy` -> force legacy MySQL reads

Contract impact:
- no required key changes
- existing response keys remain:
  - list/active/by-category: `success`, `modules`
  - get: `success`, `module`

Out of scope in this slice:
- `modules/*` write actions (`update`, `toggle`, `activity`) remain legacy/MySQL-backed
- LMS/TNA endpoint groups remain legacy/MySQL-backed and frontend-flagged off

## 2026-04-04 Cutover Update - Second Supabase Endpoint Slice (LMS Reads)

Cutover scope in this milestone:
- `lms/enrollments/list`
- `lms/enrollments/get`
- `lms/enrollments/my-courses`
- `lms/progress/get`

Data-source behavior:
- `LMS_READ_SOURCE=supabase` -> force Supabase reads (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- `LMS_READ_SOURCE=auto` -> Supabase when configured, else legacy MySQL
- `LMS_READ_SOURCE=legacy` -> force legacy MySQL reads

Contract impact:
- no required key changes
- existing response keys remain:
  - enrollments list/my-courses: `success`, `enrollments`, `page`, `limit`
  - enrollment get: `success`, `enrollment`
  - progress get: `success`, `progress`

Out of scope in this slice:
- LMS mutation and assessment/certificate actions stay on legacy/MySQL path.
- TNA endpoint groups remain legacy/MySQL-backed and frontend-flagged off.

## 2026-04-04 LMS Read Parity Hardening Audit

Supabase-backed LMS read endpoints (via `LMS_READ_SOURCE`):
- `lms/enrollments/list`
- `lms/enrollments/get`
- `lms/enrollments/my-courses`
- `lms/progress/get`

Remaining legacy LMS endpoints:
- `lms/enrollments/enroll|unenroll|start|complete`
- `lms/progress/update|complete-lesson`
- `lms/quizzes/*`
- `lms/assignments/*`
- `lms/certificates/*`
- `lms/courses/*`, `lms/sections/*`, `lms/lessons/*`, `lms/questions/*`, `lms/reviews/*`, `lms/dashboard/*`

Parity hardening applied:
- response-shape compatibility mappers added in `server/compat/supabaseLmsRead.js`:
  - `toEnrollmentListParityRow`
  - `toEnrollmentGetParityRow`
  - `toMyCoursesParityRow`
- `certificate_issued` is normalized to legacy-compatible numeric shape (`0|1`) in parity mappers.
- my-courses ordering aligned with legacy null behavior:
  - `last_accessed_at.desc.nullslast,created_at.desc`
- progress ordering aligned to null-safe legacy behavior:
  - `last_accessed_at.desc.nullslast`

Role/access parity assumptions (unchanged from legacy):
- employee:
  - can read own enrollments and own progress
  - `lms/enrollments/list` requires `course_id` and is not scoped to self by design (legacy behavior)
- manager/hr/superadmin:
  - treated as admin for read checks via `isAdmin`
- `get` and `progress/get` keep not-found before forbidden distinction:
  - missing enrollment -> `404`
  - enrollment exists but not authorized -> `403`

Route enablement decision:
- LMS React route remains feature-flagged off.
- blocker: full LMS visible route still depends on non-migrated mutation and quiz/certificate flows.
- verification status: `npm run qa:lms:cutover` passed with seeded Supabase learner/admin credentials.

## 2026-04-04 Cutover Update - Third Supabase Endpoint Slice (TNA Read)

Cutover scope in this milestone:
- `tna/summary`

Selected first TNA read-only slice and risk rationale:
- selected: `tna/summary`
- lowest-risk reason:
  - aggregate read-only counts
  - no mutation side effects
  - no complex report joins
  - supports admin shell reporting checks without enabling full TNA module

Data-source behavior:
- `TNA_READ_SOURCE=supabase` -> force Supabase reads (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- `TNA_READ_SOURCE=auto` -> Supabase when configured, else legacy MySQL
- `TNA_READ_SOURCE=legacy` -> force legacy MySQL reads

Supabase tables required for this slice:
- `training_need_records`
- `training_plans`
- `training_enrollments`

Contract impact:
- no required key changes
- existing response keys remain:
  - `total_needs_identified`
  - `needs_completed`
  - `active_plans`
  - `total_enrollments`
  - `enrollments_completed`
  - `critical_gaps`
  - `high_gaps`

Out of scope in this slice:
- all TNA mutations remain on legacy/MySQL path
- `tna/gaps-report` and `tna/lms-report` remain legacy/MySQL-backed
- TNA frontend route remains feature-flagged off

Validation status:
- `npm run qa:contracts` -> pass (includes `tests/contracts/tna-read-cutover.test.mjs`)
- `npm run qa:tna:cutover` -> pass with seeded Supabase manager + employee credentials

## 2026-04-04 Workflow Mutation Parity Verification Baseline

Purpose:
- freeze mutation-heavy workflow expectations before mutation cutover and before LMS/TNA route expansion.

Parity assets added:
- workflow matrix/spec:
  - `docs/workflow-mutation-parity.md`
- workflow fixtures:
  - `tests/contracts/fixtures/lms.workflow-core-mutation.json`
  - `tests/contracts/fixtures/tna.workflow-basic-mutation.json`
- contract/readiness checks:
  - `tests/contracts/workflow-parity-readiness.test.mjs`
- integration smoke harness:
  - `scripts/qa/lms-mutation-workflow-smoke.mjs` (`npm run qa:lms:workflow`)
  - `scripts/qa/tna-mutation-workflow-smoke.mjs` (`npm run qa:tna:workflow`)

First mutation cutover candidate (readiness decision only):
- `lms/enrollments/start`

Reason:
- smallest safe mutation slice with deterministic side effects and straightforward follow-up read verification.

Mutation workflow route rule:
- do not enable LMS/TNA frontend routes from read parity alone.
- route exposure requires passing both read parity and relevant mutation workflow parity checks.

Current workflow smoke status:
- `npm run qa:lms:workflow` -> blocked in current environment (missing `SUPABASE_LMS_WORKFLOW_TEST_EMAIL`)
- `npm run qa:tna:workflow` -> blocked in current environment (missing `SUPABASE_TNA_WORKFLOW_TEST_EMAIL`)

## 2026-04-04 Supabase Read Slice Verification (Seeded Data)

Verification run scope:
- modules read slice
- LMS read slice
- TNA summary read slice

Environment/source switches used:
- `MODULES_READ_SOURCE=supabase`
- `LMS_READ_SOURCE=supabase`
- `TNA_READ_SOURCE=supabase`

Seeded test users used:
- modules privileged read: `admin.demo@xenos.local`
- LMS learner read: `farhan.demo@xenos.local`
- LMS admin visibility check: `manager.demo@xenos.local`
- TNA summary admin read: `manager.demo@xenos.local`
- TNA unauthorized check: `farhan.demo@xenos.local`

Execution result:
- `npm run qa:modules:cutover` -> pass
- `npm run qa:lms:cutover` -> pass
- `npm run qa:tna:cutover` -> pass
- `npm run qa:contracts` -> pass (37/37)

Rollout implication:
- read slices are verified against seeded Supabase data
- LMS/TNA routes remain feature-flagged off until mutation workflow parity (`qa:lms:workflow`, `qa:tna:workflow`) is verified
