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
- Commit/PR: Multiple commits (see `docs/LMS-PROGRESS.md`)
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
  - [ ] Finish E2E tests listed in `docs/LMS-PROGRESS.md`.
  - [ ] Validate and finalize endpoint-level status in `docs/api-endpoint.md`.
- Notes:
  - Existing progress source: `docs/LMS-PROGRESS.md`.
