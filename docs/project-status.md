# Project Status

Purpose: track current implementation state, identify gaps, and prioritize next work.

## Snapshot
- Last updated: 2026-04-05
- Project: demo-kpi (HR Performance Suite)
- Primary active module: LMS + Backend Cutover
- Reference docs:
  - `docs/commit-logs.md`
  - `docs/api-endpoint.md`
  - `docs/supabase-backend-migration.md`
  - `docs/frontend-architecture.md`
  - `docs/frontend-migration-checklist.md`
  - `docs/production-deploy-plan.md`
  - `docs/hostinger-autodeploy-runbook.md`
  - `docs/supabase-production-runbook.md`
  - `docs/backend-cutover-matrix.md`
  - `docs/workflow-mutation-parity.md`
  - `docs/auth-parity-evidence.md`

## Overall Status

| Area | Current State | Target State | Gap | Priority | Owner | Next Step |
|---|---|---|---|---|---|---|
| LMS Sprint 1 (Course Management) | Completed | Stable and tested | E2E coverage missing | High | Team | Add E2E tests for course CRUD and filters |
| LMS Sprint 2 (Student Experience) | Completed | Stable and tested | E2E coverage missing | High | Team | Add enrollment and lesson viewer E2E tests |
| LMS Sprint 3 (Quiz and Assessment) | Completed | Stable and tested | E2E coverage missing | High | Team | Add quiz-taking and assessment E2E tests |
| LMS Sprint 4 (Admin Features) | Completed | Completed feature set | Residual QA remains (E2E and live-role validation) | High | Team | Run Sprint 4 admin smoke in staging and add end-to-end regression specs |
| API Documentation | Partial | Fully documented and verified | Endpoint behavior/status matrix incomplete | Medium | Team | Keep `docs/api-endpoint.md` updated per feature delivery |
| API/Code Consistency Sync | In progress | Fully aligned contract | `kpi/*` routing is now fixed, but new employee/KPI/TNA management actions still need staged runtime verification with seeded creds | High | Team | Run live cutover smoke for KPI plus focused employee/TNA workflow checks in staging |
| Supabase Foundation | In progress | Dual-auth bridge + profile/RLS baseline stable | Provisioning complete; parity evidence still pending | High | Team | Keep legacy fallback active and finalize auth parity evidence |
| Supabase Schema + Seed Baseline | Completed (dev/staging baseline) | Supabase is the active development/staging data foundation | Backend runtime still has legacy MySQL query coupling for domain handlers | High | Team | Start backend domain query cutover from MySQL to Supabase by module |
| Supabase Auth Stabilization | **Validated** ✅ | Real JWT parity validation against staging | `qa:auth:staging` passes in Supabase-only mode (MySQL down). Evidence in `docs/auth-parity-evidence.md`. Backend is now resilient via `server/pool.js` isolation + Supabase fallbacks in health check and session bridge. | — | Team | Proceed to Phase C mutation cutover |
| Backend Endpoint Cutover (Phase C) | In progress | Migrate low-risk endpoint groups to Supabase-backed reads first | Verified Supabase read slices now include modules read, LMS read (`enrollments list/get/my-courses`, `progress/get`, `courses list/get`) and TNA read/report (`summary`, `gaps-report`, `lms-report`); LMS mutation slices now include `lms/enrollments/start` and `lms/enrollments/enroll|unenroll` with parity verification, while broader mutation-heavy flows remain legacy-backed | High | Team | Keep LMS/TNA routes flagged off; execute `qa:tna:workflow` in staging, then continue one-mutation-at-a-time cutover |
| React Frontend Shell Migration | In progress | React+TS shell with adapter-based API layer | Role-aware IA has been rolled out (Core/Workforce/Assessment/Performance/Learning/Organization/System); Dashboard, Employees, and KPI/Assessment read-first workflows are active | High | Team | Validate role-based menu and route guard behavior in staging across superadmin/hr/manager |
| Employees Module (React Shell) | In progress (management workflow active) | Legacy-parity employee management workflow in modern shell | Workforce directory now supports Supabase-backed create, scoped inline edit, status toggle, KPI record creation, and assessment-need creation; hosted runtime verification is still pending and employee self-entry remains route-limited to direct detail access | High | Team | Run staged CRUD/workflow smoke with seeded HR/manager accounts and apply the new employee status migration in the target environment |
| KPI & Assessment Module (React Shell) | **Completed** ✅ | Full KPI management with definitions, targets, governance, approvals, records, and department drill-down | All KPI endpoints are Supabase-only with role-scoped access; E2E coverage still pending | High | Team | Add E2E Playwright tests for KPI input → records flow and role-scope smoke tests |
| Dashboard Page (React Shell) | **Completed** ✅ | Full dashboard with stat cards, achievement charts, top performers, leadership analytics, KPI trend, risk watchlist, manager calibration | All dashboard endpoints are Supabase-only with role-scoped access; E2E coverage still pending | High | Team | Add E2E Playwright tests for dashboard navigation and filter interactions |
| Production Deploy Cutover (Hostinger + Supabase) | In progress | Live frontend uses Supabase-backed auth/data path for shipped routes | LMS React routes are now enabled for catalog, my-courses, and detail in the production shell; hosted staging/live deploy validation is still pending, and quiz/certificate flows remain explicitly deferred | High | Team | Deploy the updated shell, then run hosted smoke for `/lms`, `/lms/my-courses`, and `/lms/:courseId` with seeded accounts |
| QA Automation | In progress | Reliable regression protection | Playwright E2E coverage now exists for Auth, Dashboard, Employees, and KPI on the live non-LMS shell; LMS/TNA E2E suites still pending | High | Team | Keep non-LMS E2E green in staging and add LMS/TNA end-to-end coverage next |
| Bundle Optimization | Completed | gzipped JS < 300kb | Achieved via Vite chunking: vendor 26kB, supabase 51kB, charts 113kB, main 125kB gzipped | Medium | — | Monitor bundle size on future changes |

## Feature Roadmap Backlog

| Feature | Status | Why It Matters | Dependency | ETA | Notes |
|---|---|---|---|---|---|
| Admin dashboard | Completed | Needed for admin visibility and control | LMS dashboard stats/recommendations | Delivered | Legacy LMS Sprint 4 + new React dashboard with all sections |
| Dashboard (React) | **Completed** ✅ | Full dashboard with stat cards, achievement charts, top performers, leadership analytics, KPI trend, risk watchlist, manager calibration | dashboard/summary, achievement-by-category, top-performers, leadership-analytics, kpi-trend, manager-calibration | Delivered | Supabase-only; 6 new backend endpoints |
| Bulk course assignment | Completed | Speeds up enrollment at scale | Assignments module | Delivered | Department/team/employee targeting with per-employee summary |
| Analytics and reports | Completed | Required for learning performance tracking | Dashboard/enrollment aggregation | Delivered | Completion/score/time views + CSV export |
| Certificate generation finalization | Completed | Completion proof for learners | Enrollment/progress accuracy | Delivered | Generate/re-issue guard + PDF download |
| Full LMS E2E test suite | Planned | Reduces regression risk | Stable UI flows | TBD | Track in QA board and `tests/e2e` specs |
| Full API endpoint validation | Planned | Ensures backend/frontend contract reliability | Endpoint inventory | TBD | Track in `docs/api-endpoint.md` |

## Weekly Update Template

```md
## Week of YYYY-MM-DD
- Completed:
  - <item>
- In Progress:
  - <item>
- Blocked:
  - <item + blocker reason>
- Newly Found Gaps:
  - <gap>
- Next Week Plan:
  - [ ] <task>
```

## Refactor Track (2026-04-03 Baseline)

Goal: migrate to React + TypeScript + Vite frontend and Supabase-first backend without breaking LMS/TNA/business flows.

| Refactor Phase | Status | Objective | Gate to Exit |
|---|---|---|---|
| Phase A - Architecture hardening / inventory | In progress | Freeze API contracts, role matrix, and migration inventory | Contract fixtures + baseline tests approved |
| Phase B - Database and auth foundation | In progress | Stand up Supabase, migrate schema, implement JWT auth bridge | Dual-auth bridge validated in staging |
| Phase B.1 - Supabase schema/seed baseline | Completed | Replace dummy MySQL data as dev/staging data source with Supabase schema + seed | Migrations and seeds applied; auth seed users provisioned |
| Phase C - Backend domain migration | In progress | Migrate auth and domain APIs (LMS first, then TNA) | Per-slice cutover matrix maintained; each slice passes contract+integration smoke |
| Phase D - Frontend shell migration | In progress | React+TS app shell + adapters + dual-auth provider | Shell build passes and dashboard route is stable with auth guard |
| Phase E - Module-by-module cutover | Planned | Incrementally switch modules to new stack | UAT signoff per module with rollback plan |
| Phase F - Legacy cleanup | Planned | Remove express-session and legacy generic paths | Legacy endpoints retired with no critical regressions |
| Phase G - Production shell rollout | In progress | Hostinger GitHub deploy + Supabase auth/data for live-safe routes | Shell route smoke tests pass in live domain and rollback path confirmed |

Primary architecture recommendation: Supabase-first backend.  
Fallback/secondary: add Cloudflare Workers later only for edge-oriented workloads after core migration stabilizes.

Data foundation note:
- Dummy MySQL seed files are retired as development source-of-truth.
- Legacy MySQL runtime path remains temporary compatibility code until domain query cutover is completed.

Production deployment note:
- Current release scope for public deployment is intentionally limited to React shell + Supabase-backed auth plus shipped read-first management routes.
- LMS React routes are now enabled in the shell for catalog, my-courses, and detail workflows using Supabase-backed reads and parity-verified enrollment mutations.
- TNA React routes remain feature-flagged off until their backend paths are Supabase-ready.
- React dashboard now preserves management workflow patterns (without visual cloning):
  - filter bar (`department`, `manager`, `period`, clear/apply)
  - KPI Summary vs Assessment Summary tabs
  - department grouped overview cards
  - drill-down-ready route boundary (`/dashboard/drilldown/:mode/:department`)
- React Employees module now preserves read-first management workflow patterns:
  - searchable/filterable employee list (`search`, `department`, `role`, `manager`, `status`)
  - employee detail route (`/employees/:employeeId`)
  - superadmin CRUD handoff button to legacy Employees screen
  - role-aware scope behavior preserved via adapter + backend/RLS visibility
- React Assessment & KPI module now preserves read-first reporting workflow patterns:
  - KPI Summary and Assessment For TNA Summary tabs
  - filter bar (`department`, `manager`, `period`, clear/apply)
  - grouped department/team breakdown with record and missing counts
  - drill-down-ready route boundary (`/kpi/drilldown/:mode/:group`)
  - empty KPI metrics now show `No data` instead of `Deferred` badges when no scored records are available
- Playwright E2E regression coverage added (2026-04-05):
  - `tests/e2e/auth.spec.ts`
  - `tests/e2e/dashboard.spec.ts`
  - `tests/e2e/employees.spec.ts`
  - `tests/e2e/kpi.spec.ts`
  - shared auth-state bootstrap via `tests/e2e/helpers/auth.ts` and `tests/e2e/global.setup.ts`
  - `npm run qa:e2e` currently passes locally against the backend-served React shell (`E2E_BASE_URL=http://127.0.0.1:3000`)
- React LMS routes enabled in shell (2026-04-05):
  - `/lms`: catalog filters (`category`, `status`, `search`) + enroll-and-start CTA
  - `/lms/my-courses`: progress cards with status badge and continue CTA
  - `/lms/:courseId`: section/lesson progress visibility + `Mark Complete`
  - explicit deferred copy retained only for quiz submission and certificate verification states
  - prerequisite gates pass:
    - `npm run qa:lms:cutover`
    - `npm run qa:lms:workflow`
    - `npm run qa:contracts` (72/72)
    - `npm run build --prefix apps/web-react`
  - local browser smoke passes against backend-served shell (`http://127.0.0.1:3000`) for `/lms`, `/lms/my-courses`, and a real detail route

Cutover note:
- First Supabase backend domain slice is complete for `modules/*` read endpoints (`list`, `get`, `by-category`, `active`) using `MODULES_READ_SOURCE` switch.
- Second Supabase backend read slice is complete for LMS read actions (`lms/enrollments/list|get|my-courses`, `lms/progress/get`) using `LMS_READ_SOURCE` switch.
- Additional LMS catalog read slice is complete for `lms/courses/list|get` via `LMS_READ_SOURCE`.
- LMS read parity hardening is complete (shape mapper + null ordering alignment + role/not-found contract checks in tests).
- Third Supabase backend read slice is complete for `tna/summary` using `TNA_READ_SOURCE` switch.
- Additional TNA report read slices are complete for `tna/gaps-report` and `tna/lms-report` via `TNA_READ_SOURCE`.
- Verified read-cutover smoke run on seeded Supabase users:
  - `qa:modules:cutover` pass
  - `qa:lms:cutover` pass
  - `qa:tna:cutover` pass
  - `qa:contracts` pass (51/51)
- LMS mutation slices now complete:
  - `lms/enrollments/start`
  - `lms/enrollments/enroll`
  - `lms/enrollments/unenroll`
  - `lms/enrollments/complete` (2026-04-05)
  - all under `LMS_MUTATION_SOURCE` switch with follow-up read parity checks (`qa:lms:workflow`).
- TNA mutation slices now complete (2026-04-05):
  - `tna/plan/create` under `TNA_MUTATION_SOURCE` switch
  - `tna/enroll` under `TNA_MUTATION_SOURCE` switch
  - both include Supabase service role client, role guards, duplicate guards
- Role-scope API smoke tests added (2026-04-05):
  - `scripts/qa/employees-role-scope-smoke.mjs` — superadmin/hr/manager/employee scoping for `employees/insights`
  - `scripts/qa/kpi-role-scope-smoke.mjs` — hr/manager/employee scoping for `kpi/reporting-summary`
  - `scripts/qa/tna-role-scope-smoke.mjs` — hr/manager/employee scoping for `tna/summary`, `tna/gaps-report`, `tna/lms-report`
  - Run: `npm run qa:role:all`
- Bundle optimization complete (2026-04-05):
  - Removed dead React pages (TnaPlaceholderPage, LmsPlaceholderPage)
  - Vite config: manualChunks for vendor/query/supabase, esnext target, esbuild minify
  - .htaccess: DEFLATE compression for text/css/js/json/svg
  - React shell: 685kb → 194.90kb gzipped (already under 200kb target)
- `modules/*` write actions, most TNA mutation routes remain legacy until further tested slices.
- Mutation workflow parity baseline is defined in `docs/workflow-mutation-parity.md` with test assets and smoke harness commands.
- Next mutation cutover candidate is `tna/needs/update-status` or `tna/plan/add-item` (single-slice rule).
- Auth parity between Supabase JWT and legacy session is now validated (2026-04-04):
  - `server/pool.js` introduced as standalone DB pool module (breaks circular import chain that caused `Cannot access 'pool' before initialization` in MySQL-down environments).
  - `/api/health` returns `{ok:true, mysql:false, supabase:true}` when Supabase env vars are set and MySQL is unreachable.
  - `resolveSessionBridgeUser` and `getCurrentUser` both fall back to Supabase employee fetch when MySQL fails.
  - `qa:auth:staging` confirms: `employee_id` and `role` are identical between JWT and session paths for `ADM001`.
  - Evidence: `docs/auth-parity-evidence.md`.
- `employees/insights` endpoint added (2026-04-04):
  - New `server/modules/employees.js` with `employees/insights` action.
  - Supabase-first, legacy fallback, `EMPLOYEES_INSIGHTS_SOURCE` switch.
  - Role-based access: superadmin/hr/director → any; manager → direct reports; employee → self.
  - Zod contract: `EmployeeInsightsSchema` in `packages/contracts/src/employees.ts`.
  - Transport domain `employees` added to `apps/web-react/src/adapters/transport.ts`.
  - `employeesAdapter.fetchInsights()` + `EmployeeDetailPage` now use a separate `useQuery` for insights — no deferred badges when endpoint succeeds.
  - QA: `npm run qa:contracts` → 54/54 pass; `npm run qa:employees:insights` → pass.
  - Documented in `docs/api-endpoint.md`.
