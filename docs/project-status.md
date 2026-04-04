# Project Status

Purpose: track current implementation state, identify gaps, and prioritize next work.

## Snapshot
- Last updated: 2026-04-04
- Project: demo-kpi
- Primary active module: LMS
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

## Overall Status

| Area | Current State | Target State | Gap | Priority | Owner | Next Step |
|---|---|---|---|---|---|---|
| LMS Sprint 1 (Course Management) | Completed | Stable and tested | E2E coverage missing | High | Team | Add E2E tests for course CRUD and filters |
| LMS Sprint 2 (Student Experience) | Completed | Stable and tested | E2E coverage missing | High | Team | Add enrollment and lesson viewer E2E tests |
| LMS Sprint 3 (Quiz and Assessment) | Completed | Stable and tested | E2E coverage missing | High | Team | Add quiz-taking and assessment E2E tests |
| LMS Sprint 4 (Admin Features) | In progress | Completed feature set | Dashboard, bulk assignment, analytics, certificate hardening not finalized | High | Team | Implement Sprint 4 backlog in sequence |
| API Documentation | Partial | Fully documented and verified | Endpoint behavior/status matrix incomplete | Medium | Team | Keep `docs/api-endpoint.md` updated per feature delivery |
| API/Code Consistency Sync | In progress | Fully aligned contract | Endpoint examples + regression tests still pending after route/action sync | High | Team | Add API tests and finalize per-action examples |
| Supabase Foundation | In progress | Dual-auth bridge + profile/RLS baseline stable | Provisioning complete; parity evidence still pending | High | Team | Keep legacy fallback active and finalize auth parity evidence |
| Supabase Schema + Seed Baseline | Completed (dev/staging baseline) | Supabase is the active development/staging data foundation | Backend runtime still has legacy MySQL query coupling for domain handlers | High | Team | Start backend domain query cutover from MySQL to Supabase by module |
| Supabase Auth Stabilization | In progress (blocked) | Real JWT parity validation against staging | Backend target in `BACKEND_BASE_URL` fails health check due MySQL connectivity (`ECONNREFUSED 127.0.0.1:3306`) | High | Team | Run backend with reachable DB (or point to staging backend) and rerun `qa:auth:staging` |
| Backend Endpoint Cutover (Phase C) | In progress | Migrate low-risk endpoint groups to Supabase-backed reads first | Modules read slice + LMS read slice (`enrollments list/get/my-courses`, `progress/get`) + first TNA read-only slice (`tna/summary`) are verified against seeded Supabase data; first LMS mutation slice (`lms/enrollments/start`) is now cut over and parity-verified, while TNA mutation workflow smoke remains blocked by missing workflow test credentials/IDs | High | Team | Keep LMS route flagged off; execute `qa:tna:workflow` in staging, then cut over next single mutation slice |
| React Frontend Shell Migration | In progress | React+TS shell with adapter-based API layer | Shell exists, but LMS/TNA screens are still legacy placeholders | High | Team | Migrate next safe view through adapters after auth parity unblocks |
| Production Deploy Cutover (Hostinger + Supabase) | In progress | Live frontend uses Supabase-backed auth/data path for shipped routes | LMS/TNA routes still feature-flagged off; read slices are smoke-verified, but mutation parity and route-level rollout checks are still pending | High | Team | Keep shell/login/dashboard scope live and expand route-by-route only after read + mutation parity passes |
| QA Automation | Partial | Reliable regression protection | LMS and related end-to-end suites still pending | High | Team | Build and run missing Playwright specs |

## Feature Roadmap Backlog

| Feature | Status | Why It Matters | Dependency | ETA | Notes |
|---|---|---|---|---|---|
| Admin dashboard | Planned | Needed for admin visibility and control | LMS analytics queries | TBD | Sprint 4 item |
| Bulk course assignment | Planned | Speeds up enrollment at scale | Assignments module | TBD | Sprint 4 item |
| Analytics and reports | Planned | Required for learning performance tracking | Course analytics data quality | TBD | Sprint 4 item |
| Certificate generation finalization | Planned | Completion proof for learners | Enrollment/progress accuracy | TBD | Sprint 4 item |
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
- Current release scope for public deployment is intentionally limited to React shell + Supabase-backed auth/dashboard.
- LMS/TNA React routes are feature-flagged and not marked live until their backend paths are Supabase-ready.

Cutover note:
- First Supabase backend domain slice is complete for `modules/*` read endpoints (`list`, `get`, `by-category`, `active`) using `MODULES_READ_SOURCE` switch.
- Second Supabase backend read slice is complete for LMS read actions (`lms/enrollments/list|get|my-courses`, `lms/progress/get`) using `LMS_READ_SOURCE` switch.
- LMS read parity hardening is complete (shape mapper + null ordering alignment + role/not-found contract checks in tests).
- Third Supabase backend read slice is complete for `tna/summary` using `TNA_READ_SOURCE` switch.
- Verified read-cutover smoke run on seeded Supabase users:
  - `qa:modules:cutover` pass
  - `qa:lms:cutover` pass
  - `qa:tna:cutover` pass
  - `qa:contracts` pass (42/42)
- First LMS mutation slice is complete for `lms/enrollments/start` using `LMS_MUTATION_SOURCE` switch, with follow-up read parity verification via `qa:lms:workflow`.
- `modules/*` write actions, LMS mutations, and most TNA routes remain legacy until further tested slices.
- Mutation workflow parity baseline is defined in `docs/workflow-mutation-parity.md` with test assets and smoke harness commands.
- Next mutation cutover candidate is `tna/needs/update-status` or `lms/enrollments/enroll` (single-slice rule).
