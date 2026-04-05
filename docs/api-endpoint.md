# API Endpoint Tracker

Purpose: keep API docs consistent with implementation and frontend usage.

## Sync Metadata
- Last sync date: 2026-04-05
- Scope:
  - backend handlers in `server/app.js`, `server/modules/lms.js`, `server/modules/tna.js`, `server/modules/kpi.js`, `server/modules/employees.js`
  - frontend API callers in `src/modules/data/*.js`
  - React feature flags in `apps/web-react/src/lib/env.ts`
- Result: API/docs/frontend drift reduced; Phase A gate formally closed (2026-04-05 audit pass).

## PHASE 1 - Cross Check

### Route Patterns In Code
- `GET /api/health`
- `ALL /api/modules?action=<list|get|update|toggle|activity|by-category|active>`
- `ALL /api?action=<auth/*|db/query|employees/*|kpi/*|tna/*|lms/*>`

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

## PHASE 5 — Final Audit & Gate Closure (2026-04-05)

### STEP 0 — AUDIT
1. **Actions with no request/response example:**
   - `lms/questions/*`, `lms/sections/*`, `lms/lessons/*` (grouped only)
   - `auth/verify-password` (added below)
2. **Actions with no role documented:**
   - Grouped LMS/TNA write paths (manager/hr/superadmin only)
3. **Stale entries:**
   - `kpi/reporting-summary` [unrouted]: Handler exists in `kpi.js` but `app.js` lacks route mapping.

### STEP 1 — ADD EXAMPLES

#### auth/login
POST /api?action=auth/login
Body: `{ email: string, password: string }`
Success: `{ profile: { employee_id: string, name: string, role: string, ... } }`
Error: `{ error: string, code: "AUTH_INVALID" }` → 401

#### auth/session
POST /api?action=auth/session
Body: `{}`
Success: `{ authenticated: true, employee_id: string, role: string, ... }`
Error: `{ authenticated: false }` → 200

#### employees/insights
POST /api?action=employees/insights
Body: `{ employee_id: string }`
Success: `{ success: true, insights: { kpi: object, assessment: object, lms: object } }`
Error: `{ error: "Access denied", code: "FORBIDDEN" }` → 403

#### kpi/reporting-summary [unrouted]
POST /api?action=kpi/reporting-summary
Body: `{ department?: string, period?: string }`
Success: `{ success: true, rows: [ { department: string, avg_score: number, ... } ] }`
Error: `{ error: string, code: "FORBIDDEN" }` → 403

#### tna/summary
POST /api?action=tna/summary
Body: `{ period?: string }`
Success: `{ data: { total_needs_identified: number, active_plans: number, ... } }`
Error: `{ message: "Access denied", code: "FORBIDDEN" }` → 403

#### tna/gaps-report
POST /api?action=tna/gaps-report
Body: `{ department?: string }`
Success: `{ data: [ { employee_id: string, competency_name: string, gap_level: number, ... } ] }`
Error: `{ message: "Access denied", code: "FORBIDDEN" }` → 403

#### tna/calculate-gaps
POST /api?action=tna/calculate-gaps
Body: `{ employee_id: string, threshold?: number }`
Success: `{ data: { gaps: array, competency_config: object, ... } }`
Error: `{ message: "Employee not found", code: "NOT_FOUND" }` → 404

### STEP 2 — PERMISSION MATRIX

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| auth/login | ✓ | ✓ | ✓ | ✓ |
| auth/logout | ✓ | ✓ | ✓ | ✓ |
| auth/session | ✓ | ✓ | ✓ | ✓ |
| auth/create-user | — | — | — | ✓ [sa] |
| auth/update-password | self | self | self | self |
| auth/verify-password | self | self | self | self |
| employees/insights | self | team | all | all |
| kpi/reporting-summary [unrouted] | 403 | dept | all | all |
| tna/summary | 403 | dept | all | all |
| tna/gaps-report | 403 | dept | all | all |
| tna/calculate-gaps | self | any | any | any |
| tna/plans | self | dept | all | all |
| lms/courses/list | ✓ | ✓ | ✓ | ✓ |
| lms/courses/get | ✓ | ✓ | ✓ | ✓ |
| lms/enrollments/my-courses | self | self | self | self |
| lms/assignments/create | — | — | ✓ | ✓ |
| lms/assignments/list | self | ✓ | ✓ | ✓ |
| lms/dashboard/stats | self | admin | admin | admin |
| lms/certificates/generate | self | — | any | any |
| db/query (select) | self-scoped | dept-scoped | dept-scoped | ✓ |

### STEP 3 — MARK LEGACY/DEFERRED

- **LMS Mutations**: `lms/enrollments/complete`, `lms/progress/update`, `lms/quizzes/*` [legacy-only]
- **LMS Admin Write**: `lms/courses/*`, `lms/sections/*`, `lms/lessons/*` (POST/PATCH/DELETE) [legacy-only]
- **TNA Extension**: `tna/enrollments-with-details`, `tna/migrate-training-history` [legacy-only]
- **LMS Dashboard**: All LMS routes are currently feature-flagged off in FE via `VITE_ENABLE_LMS_ROUTE=false` [fe-deferred]
- **TNA Dashboard**: All TNA routes are currently feature-flagged off in FE via `VITE_ENABLE_TNA_ROUTE=false` [fe-deferred]
- **KPI Reporting**: `kpi/reporting-summary` is implemented in module but unrouted in `app.js` [fe-deferred]

### STEP 4 — COMMIT
docs(api): add examples and permission matrix for all live actions
Phase A gate formally closed.

---

## PHASE 4 — Examples, Permission Matrix, and Stale Audit (2026-04-04)

### STEP 0 — Audit Findings

#### Actions with no request/response example (before this update)
`auth/login`, `auth/session`, `lms/courses/list`, `lms/progress/get`, `tna/calculate-gaps`, `tna/summary`, `employees/insights`, `kpi/reporting-summary`

#### Actions with no role documented (before this update)
All actions — permission matrix did not exist.

#### Stale / undocumented entries found in code
| Finding | Detail |
|---|---|
| `tna/calculate-gaps` — no `requireRole` guard | Any authenticated role can call with their own `employee_id`. Employee can only resolve their own gaps (no server-side scope enforcement beyond auth). This matches the original design intent but was not documented. |
| `tna/enrollments-with-details` | Exists in `tna.js` (auth-only, no role guard) but was not listed in docs. Added to inventory below with `[legacy-only]` note. |
| `tna/migrate-training-history` | Requires `superadmin` only — was listed but role not documented. Added to matrix. |
| `lms/enrollments/complete` | Listed in inventory but backed only by legacy MySQL path; Supabase cutover not yet done. Marked `[legacy-only]`. |
| `lms/sections/*`, `lms/lessons/*`, `lms/questions/*` | Listed as group entries. These are admin-only write paths (manager/hr/superadmin), read available to all authenticated. Marked `[legacy-only]` on write paths. |
| `lms/quizzes/*`, `lms/reviews/*` | Exist and are functional via legacy MySQL; route is feature-flagged off until full LMS mutation cutover. Marked `[legacy-only]`. |
| `lms/dashboard/*` | Functional. `stats` now includes admin filter support (Sprint 4). |
| `tna/enrollments-with-details` | Auth-only, no role guard. Added as `[legacy-only]`. |
| `auth/password-reset-request` | No rate limiting or email sending — records a DB timestamp only. Noted below. |

---

### STEP 1 — Request/Response Examples

All examples use `POST /api?action=<action>` unless noted.  
Auth header for JWT: `Authorization: Bearer <supabase_access_token>`  
Session-based auth: cookie `demo_kpi_session` set after `auth/login`.

---

#### `auth/login`

**Request**
```http
POST /api?action=auth/login
Content-Type: application/json

{ "email": "farhan@xenos.local", "password": "secret123" }
```

**Response (success)**
```json
{
  "profile": {
    "employee_id": "EMP001",
    "name": "Farhan Akbar",
    "role": "employee",
    "department": "Sales",
    "auth_email": "farhan@xenos.local"
  }
}
```
Sets `demo_kpi_session` cookie. `profile.password_hash` is never returned.

**Response (invalid credentials)**
```json
{ "error": "Invalid credentials.", "code": "AUTH_INVALID" }
```
HTTP 401.

**Response (missing fields)**
```json
{ "error": "Email and password are required.", "code": "AUTH_INVALID" }
```
HTTP 400.

---

#### `auth/session`

**Request**
```http
POST /api?action=auth/session
Authorization: Bearer <access_token>
```
No body required. Works with session cookie OR JWT Bearer token.

**Response (authenticated)**
```json
{
  "authenticated": true,
  "employee_id": "EMP001",
  "name": "Farhan Akbar",
  "role": "employee",
  "department": "Sales",
  "email": "farhan@xenos.local"
}
```

**Response (unauthenticated)**
```json
{ "authenticated": false }
```
HTTP 200 (not 401 — callers must check `authenticated` flag).

---

#### `auth/logout`

**Request**
```http
POST /api?action=auth/logout
```

**Response**
```json
{ "ok": true }
```

---

#### `auth/create-user`

Superadmin only. Creates auth credentials for an existing employee record.

**Request**
```http
POST /api?action=auth/create-user
Authorization: Bearer <superadmin_token>
Content-Type: application/json

{
  "employee_id": "EMP042",
  "email": "new.user@xenos.local",
  "password": "TempPass123!"
}
```

**Response (success)**
```json
{
  "user": { "id": "uuid-auth-id" },
  "profile": { "employee_id": "EMP042", "name": "Budi Santoso", ... }
}
```

**Response (email conflict)**
```json
{ "error": "This email is already registered to another employee.", "code": "EMAIL_EXISTS" }
```
HTTP 409.

---

#### `auth/update-password`

**Request**
```http
POST /api?action=auth/update-password
Authorization: Bearer <token>
Content-Type: application/json

{ "password": "NewSecure456!" }
```

**Response**
```json
{ "ok": true }
```
Password must be ≥ 8 characters. Updates own password only (regardless of role).

---

#### `auth/password-reset-request`

No auth required. Records a reset timestamp in the DB. No email is sent (manual admin flow).

**Request**
```http
POST /api?action=auth/password-reset-request
Content-Type: application/json

{ "email": "user@xenos.local" }
```

**Response**
```json
{
  "message": "If that account exists, a reset request has been recorded. ..."
}
```
Always returns 200 regardless of whether the email exists (prevents enumeration).

---

#### `auth/verify-password`

Auth required. Validates the caller's current password without changing it. Used to confirm identity before sensitive operations (e.g., before showing sensitive data to an already-logged-in user).

**Request**
```http
POST /api?action=auth/verify-password
Authorization: Bearer <token>
Content-Type: application/json

{ "password": "CurrentPassword123!" }
```

**Response (success)**
```json
{ "ok": true }
```

**Response (wrong password)**
```json
{ "error": "Invalid password.", "code": "AUTH_INVALID" }
```
HTTP 401.

**Response (no session / token)**
```json
{ "error": "Authentication required.", "code": "AUTH_REQUIRED" }
```
HTTP 401. Always verifies against the caller's own account — no `employee_id` override is accepted.

---

#### `lms/courses/list`

**Request**
```http
POST /api?action=lms/courses/list
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "published",
  "category": "Leadership",
  "search": "management",
  "page": 1,
  "limit": 20
}
```
All fields optional. `status` values: `draft`, `published`. `page`/`limit` default to `1`/`20`.

**Response (success)**
```json
{
  "success": true,
  "courses": [
    {
      "id": "uuid-course",
      "title": "Management Fundamentals",
      "category": "Leadership",
      "status": "published",
      "difficulty_level": "intermediate",
      "estimated_duration_minutes": 120,
      "enrollment_count": 14,
      "avg_rating": 4.3,
      "tags": ["leadership", "management"],
      "is_mandatory": false
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Response (not authenticated)**
```json
{ "error": "Unauthorized" }
```
HTTP 401.

---

#### `lms/enrollments/enroll`

**Request**
```http
POST /api?action=lms/enrollments/enroll
Authorization: Bearer <token>
Content-Type: application/json

{ "course_id": "uuid-course" }
```
To enroll another employee (hr/superadmin only via mutation source): add `"employee_id": "EMP042"`.

**Response (success)**
```json
{
  "success": true,
  "enrollment": {
    "id": "uuid-enrollment",
    "course_id": "uuid-course",
    "employee_id": "EMP001",
    "status": "enrolled",
    "enrollment_type": "self",
    "enrolled_by": "EMP001",
    "created_at": "2026-04-04T14:00:00Z"
  }
}
```

**Response (already enrolled — legacy path)**
```json
{ "error": "Already enrolled in this course" }
```
HTTP 400.

**Response (already enrolled — Supabase path)**
```json
{ "error": "Already enrolled in this course" }
```
HTTP 409.

---

#### `lms/enrollments/start`

**Request**
```http
POST /api?action=lms/enrollments/start
Authorization: Bearer <token>
Content-Type: application/json

{ "course_id": "uuid-course" }
```

**Response (success)**
```json
{
  "success": true,
  "enrollment": {
    "id": "uuid-enrollment",
    "status": "in_progress",
    "started_at": "2026-04-04T14:00:00Z",
    "last_accessed_at": "2026-04-04T14:00:00Z"
  }
}
```

**Response (not enrolled)**
```json
{ "error": "Not enrolled in this course" }
```
HTTP 404.

---

#### `lms/progress/get`

**Request**
```http
POST /api?action=lms/progress/get
Authorization: Bearer <token>
Content-Type: application/json

{ "enrollment_id": "uuid-enrollment" }
```
Optional: add `"lesson_id": "uuid-lesson"` to filter to a single lesson.

**Response (success)**
```json
{
  "success": true,
  "progress": {
    "enrollment_id": "uuid-enrollment",
    "progress_percent": 45.0,
    "status": "in_progress",
    "lessons": [
      {
        "id": "uuid-progress-row",
        "lesson_id": "uuid-lesson",
        "status": "completed",
        "progress_percent": 100,
        "time_spent_seconds": 320,
        "completed_at": "2026-04-04T12:00:00Z",
        "last_accessed_at": "2026-04-04T12:00:00Z"
      }
    ]
  }
}
```
When `lesson_id` is supplied, `progress.lesson` is also set to the first matching row.

**Response (enrollment not found)**
```json
{ "error": "Enrollment not found" }
```
HTTP 404.

**Response (not authorized)**
```json
{ "error": "Not authorized" }
```
HTTP 403 — returned when a non-admin requests another employee's progress.

---

#### `lms/certificates/generate`

**Request**
```http
POST /api?action=lms/certificates/generate
Authorization: Bearer <token>
Content-Type: application/json

{ "enrollment_id": "uuid-enrollment" }
```
To force reissue (superadmin only): add `"reissue": true`.

**Response (success — new issuance)**
```json
{
  "success": true,
  "certificate": {
    "id": "uuid-cert",
    "certificate_number": "CERT-1743775200000-AB12CD3",
    "employee_id": "EMP001",
    "course_id": "uuid-course",
    "issued_at": "2026-04-04T14:00:00Z",
    "employee_name": "Farhan Akbar",
    "title": "Management Fundamentals"
  },
  "already_issued": false,
  "reissued": false
}
```

**Response (already issued, no reissue flag)**
```json
{
  "success": true,
  "certificate": { ... },
  "already_issued": true,
  "reissued": false
}
```

**Response (enrollment not completed)**
```json
{ "error": "Certificate can only be issued for completed enrollment" }
```
HTTP 400.

---

#### `lms/assignments/create`

**Request**
```http
POST /api?action=lms/assignments/create
Authorization: Bearer <hr_or_superadmin_token>
Content-Type: application/json

{
  "course_id": "uuid-course",
  "target_type": "department",
  "target_value": "Sales",
  "due_date": "2026-05-01",
  "priority": "high",
  "notes": "Mandatory Q2 training"
}
```
`target_type` options: `department`, `manager`, `role`, `employee_ids`.  
Use `employee_ids: ["EMP001", "EMP002"]` for explicit targeting.  
Use `course_ids: [...]` to assign multiple courses at once.

**Response (success)**
```json
{
  "success": true,
  "assignments": [
    { "assignment_id": "uuid-a", "enrollment_id": "uuid-e", "employee_id": "EMP001", "course_id": "uuid-course" }
  ],
  "results": [
    { "course_id": "uuid-course", "employee_id": "EMP001", "status": "created", ... },
    { "course_id": "uuid-course", "employee_id": "EMP002", "status": "already_enrolled", ... }
  ],
  "summary": { "total_targets": 5, "total_created": 4, "total_skipped": 1, "total_failed": 0 },
  "target": { "target_type": "department", "target_value": "Sales", "employee_count": 5, "course_count": 1 }
}
```

---

#### `tna/calculate-gaps`

**Request**
```http
POST /api?action=tna/calculate-gaps
Authorization: Bearer <token>
Content-Type: application/json

{ "employee_id": "EMP001" }
```
Optional: `"threshold": 7` (default 7, score below this is always flagged).  
Requires TNA module enabled.

**Response (success)**
```json
{
  "data": {
    "employee_id": "EMP001",
    "employee_name": "Farhan Akbar",
    "position": "Sales Executive",
    "assessment_id": "uuid-assessment",
    "assessment_date": "2026-03-15T00:00:00Z",
    "gaps": [
      {
        "competency_name": "Negotiation",
        "description": "Ability to reach mutually beneficial agreements",
        "current_score": 5,
        "current_level_normalized": 2.5,
        "required_level": 4,
        "gap": 1.5,
        "recommended_training": "Advanced Sales Negotiation",
        "priority": "high",
        "score_below_threshold": true,
        "has_training_need_config": true
      }
    ],
    "competency_config": [...],
    "training_needs_config": { "Negotiation": { "required_level": 4, ... } }
  }
}
```

**Response (no competency config found)**
```json
{
  "data": {
    "gaps": [],
    "competency_config": null,
    "message": "No competency config found for position"
  }
}
```

**Response (employee not found)**
```json
{ "message": "Employee not found", "code": "NOT_FOUND" }
```
HTTP 404.

**Response (TNA module disabled)**
```json
{ "message": "TNA module is not enabled", "code": "MODULE_DISABLED" }
```
HTTP 404.

---

#### `tna/summary`

**Request**
```http
POST /api?action=tna/summary
Authorization: Bearer <manager_or_above_token>
Content-Type: application/json

{ "period": "2026-04" }
```
Optional period filter (currently informational; Supabase path does not apply a period filter on counts).

**Response (success)**
```json
{
  "data": {
    "total_needs_identified": 47,
    "needs_completed": 12,
    "active_plans": 8,
    "total_enrollments": 93,
    "enrollments_completed": 34,
    "critical_gaps": 5,
    "high_gaps": 18
  }
}
```

**Response (employee role — forbidden)**
```json
{ "message": "Access denied", "code": "FORBIDDEN" }
```
HTTP 403.

---

#### `tna/gaps-report`

**Request**
```http
POST /api?action=tna/gaps-report
Authorization: Bearer <manager_or_above_token>
Content-Type: application/json

{ "department": "Sales" }
```
`department` is optional.

**Response (success)**
```json
{
  "data": [
    {
      "employee_id": "EMP001",
      "employee_name": "Farhan Akbar",
      "position": "Sales Executive",
      "department": "Sales",
      "competency_name": "Negotiation",
      "required_level": 4,
      "current_level": 2,
      "gap_level": 2,
      "priority": "high",
      "status": "identified",
      "identified_at": "2026-03-01T00:00:00Z"
    }
  ]
}
```

---

#### `tna/lms-report`

**Request**
```http
POST /api?action=tna/lms-report
Authorization: Bearer <manager_or_above_token>
Content-Type: application/json

{ "department": "Sales" }
```

**Response (success)**
```json
{
  "data": {
    "summary": {
      "total_enrollments": 93,
      "completed": 34,
      "in_progress": 21,
      "enrolled": 38,
      "avg_score": 78.5
    },
    "by_course": [
      {
        "department": "Sales",
        "course_name": "Sales Fundamentals",
        "provider": "Internal",
        "total_enrolled": 12,
        "completed": 8,
        "in_progress": 3,
        "avg_score": 82.1
      }
    ]
  }
}
```

---

#### `employees/insights`

**Request**
```http
POST /api?action=employees/insights
Authorization: Bearer <token>
Content-Type: application/json

{ "employee_id": "EMP001" }
```

**Response (success)**
```json
{
  "success": true,
  "source": "supabase",
  "insights": {
    "kpi": {
      "latest_score": 87.5,
      "trend": "up",
      "record_count": 12
    },
    "assessment": {
      "gap_level": "medium",
      "last_assessed_at": "2026-03-01T00:00:00Z",
      "history_count": 4
    },
    "lms": {
      "enrolled_count": 5,
      "completed_count": 3,
      "completion_pct": 60
    }
  }
}
```

**Response (no data — valid but empty)**
```json
{
  "success": true,
  "source": "supabase",
  "insights": {
    "kpi": { "latest_score": null, "trend": null, "record_count": 0 },
    "assessment": { "gap_level": null, "last_assessed_at": null, "history_count": 0 },
    "lms": { "enrolled_count": 0, "completed_count": 0, "completion_pct": 0 }
  }
}
```

**Response (employee accesses another employee)**
```json
{ "error": "Access denied", "code": "FORBIDDEN" }
```
HTTP 403.

---

#### `kpi/reporting-summary`

**Request**
```http
POST /api?action=kpi/reporting-summary
Authorization: Bearer <manager_or_above_token>
Content-Type: application/json

{ "period": "2026-04", "department": "Sales" }
```
Both fields optional. `period`: `YYYY-MM` (exact) or `YYYY` (year LIKE). Managers are automatically scoped to their own department.

**Response (success)**
```json
{
  "success": true,
  "source": "supabase",
  "period": "2026-04",
  "department": "Sales",
  "rows": [
    {
      "department": "Sales",
      "manager": "Budi Santoso",
      "employee_count": 8,
      "record_count": 24,
      "met_count": 16,
      "not_met_count": 8,
      "avg_score": 87.5,
      "missing_count": 2
    }
  ]
}
```

**Response (employee role)**
```json
{ "error": "KPI reporting summary is not available for the employee role.", "code": "FORBIDDEN" }
```
HTTP 403.

---

### STEP 2 — Full Permission Matrix

> **Legend:**  
> `✓` = allowed (all targets)  `self` = own record only  `dept` = own department only  `team` = direct reports  `any` = any employee  `—` = not permitted  `[sa]` = superadmin only

#### Auth

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `auth/login` | ✓ | ✓ | ✓ | ✓ |
| `auth/logout` | ✓ | ✓ | ✓ | ✓ |
| `auth/session` | ✓ | ✓ | ✓ | ✓ |
| `auth/password-reset-request` | ✓ (open) | ✓ (open) | ✓ (open) | ✓ (open) |
| `auth/update-password` | self | self | self | self |
| `auth/verify-password` | self | self | self | self |
| `auth/create-user` | — | — | — | ✓ [sa] |

#### Core / System

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `GET /api/health` | ✓ (open) | ✓ (open) | ✓ (open) | ✓ (open) |
| `db/query` (select) | scoped | scoped | scoped | ✓ |
| `db/query` (insert/update/delete) | self-scoped rows | dept-scoped | dept-scoped | ✓ |

#### Modules (`/api/modules?action=`)

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `list` | — | — | ✓ | ✓ |
| `get` | — | — | ✓ | ✓ |
| `by-category` | — | — | ✓ | ✓ |
| `active` | — | — | ✓ | ✓ |
| `update` | — | — | ✓ | ✓ |
| `toggle` | — | — | ✓ | ✓ |
| `activity` | — | — | ✓ | ✓ |

#### LMS — Courses

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `lms/courses/list` | ✓ | ✓ | ✓ | ✓ |
| `lms/courses/get` | ✓ | ✓ | ✓ | ✓ |
| `lms/courses/create` [legacy-only] | — | ✓ | ✓ | ✓ |
| `lms/courses/update` [legacy-only] | — | ✓ | ✓ | ✓ |
| `lms/courses/delete` [legacy-only] | — | — | — | ✓ [sa] |
| `lms/courses/publish` [legacy-only] | — | ✓ | ✓ | ✓ |

#### LMS — Sections / Lessons / Questions (all `[legacy-only]`)

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `lms/sections/list` | ✓ | ✓ | ✓ | ✓ |
| `lms/sections/create` | — | ✓ | ✓ | ✓ |
| `lms/sections/update` | — | ✓ | ✓ | ✓ |
| `lms/sections/delete` | — | ✓ | ✓ | ✓ |
| `lms/sections/reorder` | — | ✓ | ✓ | ✓ |
| `lms/lessons/list` | ✓ | ✓ | ✓ | ✓ |
| `lms/lessons/get` | ✓ | ✓ | ✓ | ✓ |
| `lms/lessons/create` | — | ✓ | ✓ | ✓ |
| `lms/lessons/update` | — | ✓ | ✓ | ✓ |
| `lms/lessons/delete` | — | ✓ | ✓ | ✓ |
| `lms/lessons/reorder` | — | ✓ | ✓ | ✓ |
| `lms/questions/list` | ✓ | ✓ | ✓ | ✓ |
| `lms/questions/create` | — | ✓ | ✓ | ✓ |
| `lms/questions/update` | — | ✓ | ✓ | ✓ |
| `lms/questions/delete` | — | ✓ | ✓ | ✓ |

#### LMS — Enrollments

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `lms/enrollments/list` | ✓ (requires `course_id`) | ✓ | ✓ | ✓ |
| `lms/enrollments/get` | self | self+admin | any | any |
| `lms/enrollments/my-courses` | self | self | self | self |
| `lms/enrollments/enroll` | self | self | any | any |
| `lms/enrollments/unenroll` | self | self | any | any |
| `lms/enrollments/start` | self | self | self | self |
| `lms/enrollments/complete` [legacy-only] | self | self | any | any |

#### LMS — Progress, Quizzes, Reviews

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `lms/progress/get` | self | self+admin | any | any |
| `lms/progress/update` [legacy-only] | self | — | — | — |
| `lms/progress/complete-lesson` [legacy-only] | self | — | — | — |
| `lms/quizzes/submit` [legacy-only] | self | — | — | — |
| `lms/quizzes/get-attempt` [legacy-only] | self | — | — | — |
| `lms/reviews/list` | ✓ | ✓ | ✓ | ✓ |
| `lms/reviews/create` [legacy-only] | self | self | self | self |
| `lms/reviews/update` [legacy-only] | self | — | — | — |
| `lms/reviews/delete` [legacy-only] | self | ✓ | ✓ | ✓ |

#### LMS — Dashboard, Assignments, Certificates

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `lms/dashboard/stats` | self-view | admin-view | admin-view | admin-view |
| `lms/dashboard/recommendations` | competency-based | admin course perf | admin course perf | admin course perf |
| `lms/assignments/list` | self | ✓ | ✓ | ✓ |
| `lms/assignments/create` | — | — | ✓ | ✓ |
| `lms/assignments/complete` | self | ✓ | ✓ | ✓ |
| `lms/certificates/list` | self | any | any | any |
| `lms/certificates/generate` | self (completed) | — | any (completed) | any + reissue |

> Note: `manager` in `isAdmin()` check = `true` for LMS read/guard purposes (same as hr/superadmin for most read gates). For `lms/assignments/create` the code explicitly checks `['superadmin','hr']` only.

> Note: `lms/certificates/generate` — employee can request their own certificate when enrollment is `completed`. Reissue (`reissue: true`) is `superadmin` only.

#### TNA (all require TNA feature flag enabled)

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `tna/calculate-gaps` | self (no server scope) | any | any | any |
| `tna/needs` | self (filter by `employee_id`) | dept | all | all |
| `tna/needs/create` | — | ✓ | ✓ | ✓ |
| `tna/needs/update-status` | — | ✓ | ✓ | ✓ |
| `tna/plans` | self (filter param) | dept | all | all |
| `tna/plan/create` | — | ✓ | ✓ | ✓ |
| `tna/plan/get` | self | ✓ | ✓ | ✓ |
| `tna/plan/add-item` | — | ✓ | ✓ | ✓ |
| `tna/plan/update-item` | — | ✓ | ✓ | ✓ |
| `tna/plan/approve` | — | ✓ | ✓ | ✓ |
| `tna/plan/delete` | — | ✓ | ✓ | ✓ |
| `tna/needs-config` | ✓ (read) | ✓ | ✓ | ✓ |
| `tna/needs-config/create` | — | ✓ | ✓ | ✓ |
| `tna/courses` | ✓ (read) | ✓ | ✓ | ✓ |
| `tna/course-create` | — | ✓ | ✓ | ✓ |
| `tna/course-update` | — | ✓ | ✓ | ✓ |
| `tna/enrollments` | self (param) | dept | all | all |
| `tna/enrollments-with-details` [legacy-only] | self (param) | dept | all | all |
| `tna/enroll` | — | ✓ | ✓ | ✓ |
| `tna/enrollment-update-status` | — | ✓ | ✓ | ✓ |
| `tna/summary` | — | dept | all | all |
| `tna/gaps-report` | — | dept | all | all |
| `tna/lms-report` | — | dept | all | all |
| `tna/import-competencies` | — | ✓ | ✓ | ✓ |
| `tna/bulk-create-need-records` | — | ✓ | ✓ | ✓ |
| `tna/training-history-stats` | — | ✓ | ✓ | ✓ |
| `tna/migrate-training-history` | — | — | — | ✓ [sa] |

#### Employees

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `employees/insights` | self | team (`manager_id` match) | any | any |

#### KPI

| Action | employee | manager | hr | superadmin |
|---|---|---|---|---|
| `kpi/reporting-summary` | — | dept (forced) | all | all |

---

### STEP 3 — Stale / Blocked Entry Notes

| Action | Tag | Notes |
|---|---|---|
| `lms/enrollments/complete` | `[legacy-only]` | MySQL-backed only; `LMS_MUTATION_SOURCE=supabase` path not yet implemented. Do not enable LMS route until this slice is cut over. |
| `lms/progress/update` | `[legacy-only]` | MySQL-backed only. Enforces `employee_id === currentUser.employee_id` strictly. |
| `lms/progress/complete-lesson` | `[legacy-only]` | MySQL-backed only. |
| `lms/quizzes/submit` | `[legacy-only]` | MySQL-backed only. No Supabase cutover planned yet. |
| `lms/quizzes/get-attempt` | `[legacy-only]` | MySQL-backed only. |
| `lms/reviews/create` | `[legacy-only]` | MySQL-backed only. |
| `lms/reviews/update` | `[legacy-only]` | MySQL-backed only. |
| `lms/reviews/delete` | `[legacy-only]` | MySQL-backed only. |
| `lms/courses/create` | `[legacy-only]` | MySQL-backed only. |
| `lms/courses/update` | `[legacy-only]` | MySQL-backed only. |
| `lms/courses/delete` | `[legacy-only]` | MySQL-backed only. |
| `lms/courses/publish` | `[legacy-only]` | MySQL-backed only. |
| `lms/sections/*` (write) | `[legacy-only]` | MySQL-backed only. |
| `lms/lessons/*` (write) | `[legacy-only]` | MySQL-backed only. |
| `lms/questions/*` (write) | `[legacy-only]` | MySQL-backed only. |
| `tna/enrollments-with-details` | `[legacy-only]` `[undocumented]` | Exists in code (`tna.js`); auth-only, no role guard. Not in prior docs — added to inventory here. |
| `tna/migrate-training-history` | `[legacy-only]` `[admin-util]` | One-shot migration utility. `superadmin` only. Not for regular use. |
| `auth/password-reset-request` | `[no-email]` | Records a DB timestamp only. No email delivery. Admin must manually issue a temp password or use `auth/create-user`. |


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

### Employees Actions
| Action | Status | Notes |
|---|---|---|
| `employees/insights` | Implemented | Per-employee KPI + Assessment + LMS aggregates |

### KPI Actions
| Action | Status | Notes |
|---|---|---|
| `kpi/reporting-summary` | Implemented | Department-grouped KPI achievement summary; Supabase-backed read with legacy fallback |

## 2026-04-04 New Endpoint - `employees/insights`

Action: `employees/insights`  
Method: POST  
Module: `server/modules/employees.js`  
Source switch: `EMPLOYEES_INSIGHTS_SOURCE=legacy|supabase|auto` (default: `auto`)

### Request
```json
{ "employee_id": "EMP001" }
```

### Response
```json
{
  "success": true,
  "source": "supabase",
  "insights": {
    "kpi": {
      "latest_score": 87.5,
      "trend": "up",
      "record_count": 12
    },
    "assessment": {
      "gap_level": "medium",
      "last_assessed_at": "2026-03-01T00:00:00Z",
      "history_count": 4
    },
    "lms": {
      "enrolled_count": 5,
      "completed_count": 3,
      "completion_pct": 60
    }
  }
}
```

### Field notes
- `kpi.latest_score`: if `target_snapshot` is available, expressed as % of target; otherwise raw value. `null` when no records.
- `kpi.trend`: `"up"` / `"down"` / `"flat"` / `null`. Requires ≥ 2 scored periods.
- `assessment.gap_level`: derived from `training_need_records.gap_level` average. `null` when no records.
- `lms.completion_pct`: `0` when `enrolled_count = 0`.

### Source behavior
- `EMPLOYEES_INSIGHTS_SOURCE=supabase` → direct Supabase REST queries on `kpi_records`, `training_need_records`, `course_enrollments`
- `EMPLOYEES_INSIGHTS_SOURCE=legacy` → `db/query` reads from MySQL
- `EMPLOYEES_INSIGHTS_SOURCE=auto` (default) → Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, else legacy

### Access guard
| Role | Allowed targets |
|---|---|
| `superadmin` | Any employee |
| `hr` | Any employee |
| `director` | Any employee |
| `manager` | Self + direct reports (`employees.manager_id = req.user.employee_id`) |
| `employee` | Self only |

### Error responses
| Status | Code | Condition |
|---|---|---|
| 400 | `INVALID_INPUT` | `employee_id` missing |
| 401 | `AUTH_REQUIRED` | No session or JWT |
| 403 | `FORBIDDEN` | Access to non-authorized employee |

### Contract
- Zod schema: `EmployeeInsightsSchema` in `packages/contracts/src/employees.ts`
- Contract test: `tests/contracts/employees-insights.test.mjs` (54 pass total after addition)
- Smoke test: `scripts/qa/employees-insights-smoke.mjs` (`npm run qa:employees:insights`)

### React integration
- `employeesAdapter.fetchInsights(employeeId)` in `apps/web-react/src/adapters/employeesAdapter.ts`
- Separate `useQuery` in `EmployeeDetailPage` with `enabled` gated on `detailQuery` resolving
- Skeleton loading state during fetch; no `Deferred` badges when insights load successfully
- Graceful amber error banner if insights endpoint fails (detail page still works)

## 2026-04-04 Cutover Update - KPI Read Slice (`kpi/reporting-summary`)

Cutover scope:
- `kpi/reporting-summary`

Data-source behavior:
- `KPI_READ_SOURCE=supabase` → force Supabase reads (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- `KPI_READ_SOURCE=auto` → Supabase when configured, else legacy MySQL
- `KPI_READ_SOURCE=legacy` → force legacy MySQL reads

Supabase tables required:
- `kpi_records` (`employee_id`, `period`, `value`, `target_snapshot`)
- `employees` (`employee_id`, `department`, `manager_id`, `role`, `name`)

### Request
```json
{ "department": "Sales", "period": "2026-04" }
```
All fields optional. Period accepts `YYYY-MM` (exact) or `YYYY` (year-range LIKE filter).

### Response
```json
{
  "success": true,
  "source": "supabase",
  "period": "2026-04",
  "department": null,
  "rows": [
    {
      "department": "Sales",
      "manager": "Budi Santoso",
      "employee_count": 5,
      "record_count": 12,
      "met_count": 8,
      "not_met_count": 4,
      "avg_score": 87.5,
      "missing_count": 2
    }
  ]
}
```

### Field notes
- `met_count`: KPI records where `value >= target_snapshot`.
- `not_met_count`: KPI records where `value < target_snapshot`.
- `avg_score`: average `(value/target) * 100` across scored records (non-null, target > 0). `null` when no scoreable records.
- `missing_count`: employee count minus employees who have at least one KPI record in scope.
- `manager`: display name of the manager for the department derived from `employees.manager_id`. `null` when not resolvable.

### Access guard
| Role | Allowed scope |
|---|---|
| `superadmin` | All departments |
| `hr` | All departments |
| `director` | All departments |
| `manager` | Own department only (forced via `user.department`) |
| `employee` | `403` — not permitted |

### Error responses
| Status | Code | Condition |
|---|---|---|
| 401 | `AUTH_REQUIRED` | No session or JWT |
| 403 | `FORBIDDEN` | Employee role attempted access |

### Contract
- Zod schema: `KpiReportingSummaryResponseSchema`, `KpiReportingSummaryRowSchema` in `packages/contracts/src/kpi.ts`
- Contract test: `tests/contracts/kpi-read-cutover.test.mjs` (18 tests)
- Smoke test: `scripts/qa/kpi-read-cutover-smoke.mjs` (`npm run qa:kpi:cutover`)

### Environment variables
- `SUPABASE_KPI_ADMIN_TEST_EMAIL` / `SUPABASE_KPI_ADMIN_TEST_PASSWORD` — admin/manager account for smoke test
- `SUPABASE_KPI_EMPLOYEE_TEST_EMAIL` / `SUPABASE_KPI_EMPLOYEE_TEST_PASSWORD` — optional, for 403 guard check

### Validation status
- `npm run qa:contracts` → pass (72/72 after this addition)
- `npm run qa:kpi:cutover` → run after backend server is up with `KPI_READ_SOURCE=supabase`

### Route enablement decision
- KPI React route already has read-first workflow active (`/kpi`, `/kpi/drilldown/:mode/:group`).
- `kpi/reporting-summary` is now Supabase-safe and can back the grouped department breakdown in the React KPI shell.
- Deeper drill-down record pages (`/kpi/drilldown/:mode/:group`) remain deferred until per-employee KPI detail endpoint is added.

## 2026-04-05 Employees Management Workflow Promotion

Scope in this update:
- `employees/list`
- `employees/get`
- `employees/create`
- `employees/update`
- `employees/toggle-status`
- `kpi/record/create`
- `kpi/record/update`
- `tna/needs/create` (Supabase-backed record creation)
- `kpi/*` route wiring in `server/app.js`

### Employees Actions

#### `employees/list`
- Request: `POST /api?action=employees/list`
- Body: `{ search?, department?, role?, manager_id?, status?, page?, limit? }`
- Success: `{ success: true, source: "supabase", employees: [], total: number, page: number }`
- Role scope:
  - `superadmin`, `hr`: full workforce
  - `manager`: direct reports only (`manager_id = current_user.employee_id`)
  - `employee`: `403`
- Notes:
  - search matches `name`, `email`, `auth_email`, `department`, `position`
  - `status` now refers to operational employee status (`active|inactive`)

#### `employees/get`
- Request: `POST /api?action=employees/get`
- Body: `{ employee_id: string }`
- Success: `{ success: true, employee: { ...all fields } }`
- Role scope:
  - `superadmin`, `hr`, `director`: any employee
  - `manager`: direct reports only
  - `employee`: self only

#### `employees/create`
- Request: `POST /api?action=employees/create`
- Body: `{ name, email, department, position, role, manager_id?, join_date? }`
- Success: `{ success: true, employee }`
- Role scope:
  - `superadmin`, `hr` only
- Supabase behavior:
  - creates auth user through `auth/v1/admin/users`
  - inserts `employees` row with `status='active'`
  - upserts `profiles` row metadata
  - rolls back auth user if employee/profile write fails
- Notes:
  - employee IDs are generated server-side (`EMP###` style)
  - a temporary password is provisioned server-side; user follow-up/reset flow remains operational work

#### `employees/update`
- Request: `POST /api?action=employees/update`
- Body: `{ employee_id, ...fields }`
- Success: `{ success: true, employee }`
- Role scope:
  - `superadmin`, `hr`: can update `name`, `email`, `department`, `position`, `role`, `manager_id`, `join_date`
  - `manager`: can update `department`, `position` for direct reports only
- Notes:
  - email/role changes sync the mapped Supabase auth user and `profiles` row when `auth_id` exists

#### `employees/toggle-status`
- Request: `POST /api?action=employees/toggle-status`
- Body: `{ employee_id, status: "active"|"inactive" }`
- Success: `{ success: true, employee }`
- Role scope:
  - `superadmin`, `hr` only
- Notes:
  - updates `employees.status`
  - does not delete or disable the Supabase auth user

### KPI Write Actions

#### `kpi/record/create`
- Request: `POST /api?action=kpi/record/create`
- Body: `{ employee_id, period, score|actual_value, target_value?, notes?, kpi_id? }`
- Success: `{ success: true, record }`
- Role scope:
  - `superadmin`, `hr` only
- Notes:
  - handler resolves an active KPI definition (or uses provided `kpi_id`)
  - stores score as `kpi_records.value`
  - persists `target_snapshot` when `target_value` is supplied or an active target exists

#### `kpi/record/update`
- Request: `POST /api?action=kpi/record/update`
- Body: `{ record_id, period?, score?, actual_value?, target_value?, notes?, kpi_id? }`
- Success: `{ success: true, record }`
- Role scope:
  - `superadmin`, `hr` only

### Assessment / TNA Write Action

#### `tna/needs/create`
- Request: `POST /api?action=tna/needs/create`
- Body: `{ employee_id, competency_name, required_level, current_level, priority?, notes? }`
- Success: `{ success: true, need }`
- Role scope:
  - `superadmin`, `hr`: any employee
  - `manager`: direct reports only
- Supabase behavior:
  - finds or creates the `training_needs` competency row for the employee position
  - inserts a `training_need_records` row with `status='identified'`
  - calculates `gap_level = required_level - current_level`

### Routing Fix
- `server/app.js` now dispatches `kpi/*` actions to `handleKpiAction` before the generic feature-flag check.
- `npm run qa:kpi:cutover` is now a declared npm script (`scripts/qa/kpi-read-cutover-smoke.mjs`).
- Current local verification blocker:
  - smoke requires `SUPABASE_KPI_ADMIN_TEST_EMAIL` / `SUPABASE_KPI_ADMIN_TEST_PASSWORD`
  - without those env vars the script exits before live endpoint validation
