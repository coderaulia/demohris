# API Endpoint Tracker

Purpose: keep API docs consistent with implementation and frontend usage.

## Sync Metadata
- Last sync date: 2026-04-03
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
- [ ] Add automated API tests for `lms/enrollments/get` and `lms/progress/get`
- [ ] Add regression tests ensuring TNA accepts POST payload filters

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
