# Workflow Mutation Parity Matrix

Last updated: 2026-04-04

Purpose: define test-backed parity gates for mutation-heavy LMS/TNA workflows before any route expansion.

## Step 0 - Reality Check (Code-Verified)

Audited:
- `server/modules/lms.js`
- `server/modules/tna.js`
- `src/modules/data/lms.js`
- `src/modules/data/tna.js`
- `apps/web-react/src/adapters/lmsAdapter.ts`
- `apps/web-react/src/adapters/tnaAdapter.ts`
- `packages/contracts/src/*`
- `tests/contracts/*`
- `tests/e2e/*`

## Ordered Mutation-Risk Matrix

| Order | Workflow Group | Risk | Why |
|---|---|---|---|
| 1 | `lms/enrollments/start` | Low-Medium | Single enrollment status transition + deterministic first-lesson progress initialization |
| 2 | `lms/enrollments/enroll` | Medium | Enrollment creation + duplicate guard, referenced by downstream progress and quiz flows |
| 3 | `tna/needs/update-status` | Medium | Bounded status transition on one row, easy follow-up read verification |
| 4 | `tna/needs/create` | Medium | Insert/update semantics and priority/gap values, feeds summary/reporting |
| 5 | `lms/progress/update` + `lms/progress/complete-lesson` | Medium-High | Upsert behavior + enrollment progress recalculation side effects |
| 6 | `lms/assignments/create|complete` | High | Multi-row write path touching assignments and enrollments |
| 7 | `tna/plan/*` and `tna/enroll*` | High | Multi-table workflow state transitions and cost/status rollups |
| 8 | `lms/quizzes/submit` + `lms/quizzes/get-attempt` | High | Scoring rules + attempt history + conditional progress updates |
| 9 | `lms/certificates/generate` | High | Completion gate + idempotent issuance + persisted certificate identity |
| 10 | `tna/import-competencies` / `tna/bulk-create-need-records` | Very High | Bulk mutations, high blast radius, hard rollback without job tracking |

## Workflow Dependencies

LMS core learner workflow:
1. `lms/enrollments/enroll`
2. `lms/enrollments/start`
3. `lms/progress/get`
4. `lms/progress/complete-lesson`
5. `lms/quizzes/submit`
6. `lms/quizzes/get-attempt`

TNA basic workflow:
1. `tna/needs/create`
2. `tna/needs/update-status`
3. `tna/needs`
4. `tna/summary`

## Required Seed / Fixture Inputs

LMS workflow smoke:
- Supabase user with learner role
- Published course ID
- Lesson ID (or resolvable from progress read)
- Optional quiz answers JSON for deterministic quiz submission checks

TNA workflow smoke:
- Supabase user with `superadmin|manager|hr` role
- Employee ID target
- Training need ID target

Fixture files:
- `tests/contracts/fixtures/lms.workflow-core-mutation.json`
- `tests/contracts/fixtures/tna.workflow-basic-mutation.json`

## Parity Acceptance Criteria (Per Mutation)

Each mutation is considered parity-ready only when all pass:
1. Request shape matches frozen fixture/spec.
2. Response shape preserves required keys.
3. Expected side-effect rows update correctly.
4. Follow-up reads reflect mutation state.
5. Role/permission gates match legacy behavior.
6. Duplicate/idempotency behavior is explicit and stable.
7. Rollback path remains env-driven and documented.

## Recommended First Mutation Cutover Slice

Selected first slice:
- `lms/enrollments/start`

Reason:
- Lower complexity than quiz/certificate/assignment workflows.
- Deterministic side effects (`course_enrollments` status + first `lesson_progress` row).
- Easy verification through follow-up reads (`lms/progress/get`, `lms/enrollments/get`).
- Reversible by env switch and route feature flag without broad data migration.

## Current Route Exposure Rule

- LMS/TNA routes remain feature-flagged off until both:
  - read parity for visible screens is proven
  - mutation workflow parity for those screens is proven
- Do not enable full LMS/TNA route from a single endpoint success.
- Enable smallest safe slice only after parity smoke passes.
