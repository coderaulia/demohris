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
- `lms/enrollments/complete`
- `lms/progress/update|complete-lesson`
- `lms/quizzes/*`
- `lms/assignments/*`
- `lms/certificates/*`
- `lms/courses/create|update|delete|publish`
- `lms/sections/*`, `lms/lessons/*`, `lms/questions/*`, `lms/reviews/*`, `lms/dashboard/*`

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
- `tna/gaps-report` and `tna/lms-report` remained legacy/MySQL-backed in this slice (superseded by later 2026-04-04 report-read cutover update below)
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
- `npm run qa:lms:workflow` -> pass in Supabase mode for first mutation slice (`lms/enrollments/start`)
- `npm run qa:tna:workflow` -> blocked in current environment (missing workflow seed credentials/IDs)

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

## 2026-04-04 Cutover Update - First LMS Mutation Slice (`lms/enrollments/start`)

Cutover scope:
- `lms/enrollments/start` only

Data-source behavior:
- `LMS_MUTATION_SOURCE=supabase` -> force Supabase mutation path
- `LMS_MUTATION_SOURCE=auto` -> Supabase when configured, else legacy MySQL
- `LMS_MUTATION_SOURCE=legacy` -> force legacy MySQL mutation path

## 2026-04-04 React Employees Module - Read Path Mapping

Frontend routes:
- `/employees`
- `/employees/:employeeId`

API/data path used by Employees shell:
- Supabase mode (`VITE_API_TARGET=supabase`):
  - adapter reads from Supabase `employees` directly (client + RLS)
  - optional per-employee LMS/TNA summary counts use direct Supabase reads when available
- Legacy mode (`VITE_API_TARGET=legacy`):
  - adapter reads employee records through `db/query` (`table=employees`)
  - detail summary falls back to read-available legacy data only
- Auto mode (`VITE_API_TARGET=auto`):
  - adapter prefers Supabase reads and falls back to legacy `db/query` if Supabase read fails

Contract and behavior notes:
- React layer uses `packages/contracts/src/employees.ts` for list/detail parsing
- no mutation-heavy employee actions are enabled in React shell
- superadmin-only CRUD action is intentionally linked to legacy Employees screen
- LMS/TNA employee-level summary cards are marked deferred when endpoint/source coverage is not available

## 2026-04-04 React KPI/Assessment Module - Read Path Mapping

Frontend routes:
- `/kpi`
- `/kpi/drilldown/:mode/:group`

API/data path used by KPI/Assessment shell:
- verified reads:
  - `tna/summary`
  - `tna/gaps-report`
  - `tna/lms-report`
  - employees directory read (Supabase direct in `supabase` mode or `db/query` fallback in `auto|legacy`)
- KPI records:
  - Supabase mode: direct read from `kpi_records`
  - auto/legacy mode: fallback read via `db/query` (`table=kpi_records`)

Contract and behavior notes:
- React reporting view model is validated with `packages/contracts/src/kpi.ts`
- KPI achievement percentages are only shown when usable target fields are available
- when KPI target/value parity is unavailable, UI marks those metrics as `Deferred` instead of fabricating totals
- no KPI/assessment mutation tools are exposed in this shell slice

Legacy-visible contract preserved:
- request: `{ course_id }`
- success response: `{ success: true, enrollment }`
- guarded errors:
  - `404` -> `Not enrolled in this course`
  - `400` -> `Course already completed`

Side-effects preserved:
- enrollment status transition to `in_progress`
- `started_at` initialized if null
- `last_accessed_at` refreshed
- first lesson `lesson_progress` row initialized as `not_started` when missing

Mandatory follow-up reads verified:
- `lms/enrollments/get`
- `lms/progress/get`

Validation status:
- `npm run qa:contracts` -> pass
- `npm run qa:lms:workflow` -> pass (start-slice focused workflow)

Route enablement decision:
- LMS route remains feature-flagged off.
- one mutation slice is not sufficient to expose full LMS screens.

## 2026-04-04 Cutover Update - Second LMS Mutation Slice (`lms/enrollments/enroll|unenroll`)

Cutover scope:
- `lms/enrollments/enroll`
- `lms/enrollments/unenroll`

Source behavior:
- `LMS_MUTATION_SOURCE=supabase` -> force Supabase mutation path
- `LMS_MUTATION_SOURCE=auto` -> Supabase when configured, else legacy MySQL
- `LMS_MUTATION_SOURCE=legacy` -> force legacy MySQL mutation path

Contract parity notes:
- `lms/enrollments/enroll` keeps legacy top-level shape:
  - success response: `{ success: true, enrollment }`
  - missing/invalid course guard: `404` (`Course not found or not published`)
  - duplicate guard:
    - legacy path: `400` (`Already enrolled in this course`)
    - Supabase path: `409` (`Already enrolled in this course`)
- `lms/enrollments/unenroll` keeps:
  - success response: `{ success: true }`
  - `404` when enrollment does not exist
  - `403` for ownership/role violations
  - now also supports `course_id` fallback for self-unenroll when `enrollment_id` is not provided

Supabase side effects:
- enroll:
  - inserts into `course_enrollments` with `status='enrolled'`
- unenroll:
  - explicitly deletes `lesson_progress` rows for target enrollment
  - deletes target `course_enrollments` row

Follow-up read verification:
- after enroll:
  - `lms/enrollments/get`
  - `lms/progress/get`
- after unenroll:
  - `lms/enrollments/get` -> not found
  - `lms/progress/get` -> not found

Validation status:
- `npm run qa:contracts` -> pass (51/51)
- `npm run qa:lms:workflow` -> blocked in local run due auth mapping (`401` on enroll call for configured workflow account)

Rollback:
- set `LMS_MUTATION_SOURCE=legacy`
- keep LMS React route feature-flagged off

## 2026-04-04 Cutover Update - Additional LMS/TNA Read-Only Slices

Cutover scope in this milestone:
- LMS read actions:
  - `lms/courses/list`
  - `lms/courses/get`
- TNA read/report actions:
  - `tna/gaps-report`
  - `tna/lms-report`

Data-source behavior:
- LMS:
  - `LMS_READ_SOURCE=supabase` -> force Supabase for enrolled/progress/course reads
  - `LMS_READ_SOURCE=auto` -> Supabase when configured, else legacy
  - `LMS_READ_SOURCE=legacy` -> force legacy
- TNA:
  - `TNA_READ_SOURCE=supabase` -> force Supabase for `summary`, `gaps-report`, `lms-report`
  - `TNA_READ_SOURCE=auto` -> Supabase when configured, else legacy
  - `TNA_READ_SOURCE=legacy` -> force legacy

Contract parity notes:
- `lms/courses/list` keeps:
  - `success`, `courses`, `total`, `page`, `limit`
- `lms/courses/get` keeps:
  - `success`, `course` (with nested `sections[].lessons[]` and optional `my_enrollment`)
- `tna/gaps-report` keeps:
  - `data[]` with `employee_id`, `employee_name`, `position`, `department`, `competency_name`, `required_level`, `current_level`, `gap_level`, `priority`, `status`, `identified_at`
- `tna/lms-report` keeps:
  - `data.summary` + `data.by_course[]`
- parity hardening fix applied:
  - `tna/lms-report` average score now ignores null scores to match legacy SQL `AVG` semantics

Validation status:
- Contract tests:
  - `tests/contracts/lms-catalog-read-cutover.test.mjs` -> pass
  - `tests/contracts/tna-read-cutover.test.mjs` (extended) -> pass
- Smoke tests:
  - `npm run qa:lms:cutover` -> pass (now includes `lms/courses/list|get`)
  - `npm run qa:tna:cutover` -> pass (now includes `tna/gaps-report` + `tna/lms-report`)
  - `npm run qa:modules:cutover` -> pass
- Full contract suite:
  - `npm run qa:contracts` -> pass (48/48)

Route readiness decision:
- LMS/TNA routes remain feature-flagged off.
- Read coverage is now broader, but visible LMS/TNA screens still depend on mutation-heavy actions that remain legacy-backed.

## 2026-04-04 Legacy LMS Sprint 4 Admin Completion

Scope in this legacy-only update:
- no React shell changes
- no Supabase cutover-path changes
- verified read cutover endpoints preserved (`lms/courses/list|get`, `lms/enrollments/*`)

Updated endpoint behavior:

### `lms/dashboard/stats`
- Admin now supports filter payload:
  - `department` (optional)
  - `period` in `YYYY-MM` (optional)
- Response keeps `success` + `stats`, and now includes stable admin metrics used by Sprint 4 UI:
  - `total_enrollments`
  - `courses_in_progress`
  - `courses_completed`
  - `completion_rate`
  - `avg_score`
  - `avg_time_on_course_minutes`

### `lms/dashboard/recommendations`
- For admin roles, response now returns operational course-performance aggregates:
  - `course_performance[]`
  - `recommendations[]`
  - `attention_courses[]`
  - `filters`
- Non-admin recommendation behavior remains existing competency/recent recommendation flow.

### `lms/assignments/create`
- Bulk assignment now supports:
  - `course_id` or `course_ids[]`
  - `target_type`: `department|manager|employee_ids|role`
  - `target_value` (for non-employee_ids modes)
  - `employee_ids[]` (explicit mode)
- Response now includes:
  - `assignments[]` (created items)
  - `results[]` (per-employee per-course statuses)
  - `summary` (`total_created`, `total_skipped`, `total_failed`)
  - `target` metadata
- Guard tightened for bulk assignment:
  - `superadmin` and `hr` only.

### `lms/certificates/list`
- Supports admin query scope:
  - `employee_id` (optional)
  - `enrollment_id` (optional)
  - `limit` (optional)
- Returns:
  - `certificates[]` with `employee_name` and `enrollment_status`
  - `meta` scope flags (`scope`, `can_reissue`)

### `lms/certificates/generate`
- Hardened issuance rule:
  - certificate can only be issued for `completed` enrollments.
- Supports optional reissue path:
  - request payload `reissue=true`
  - only `superadmin` can re-issue.
- Response includes:
  - `certificate`
  - `already_issued`
  - `reissued`

Contract/QA additions:
- `tests/contracts/fixtures/lms.sprint4-admin.group.json`
- `tests/contracts/lms-sprint4-admin.test.mjs`
- `scripts/qa/lms-sprint4-admin-smoke.mjs` (`npm run qa:lms:sprint4`)
- `npm run qa:contracts` -> pass
