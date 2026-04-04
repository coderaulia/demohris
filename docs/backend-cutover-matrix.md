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
| `modules/*` read (`list/get/by-category/active`) | migration-ready -> cut over | Supabase (when `MODULES_READ_SOURCE=auto|supabase` + env configured), else MySQL | contract + adapter integration + smoke script | legacy-only / not in live shell nav | first cutover slice in this milestone |
| `modules/*` write (`update/toggle/activity`) | legacy-only | MySQL | contract only | legacy-only | unchanged in this slice |
| `db/query` | legacy-only | MySQL | contract only | legacy-only | no cutover in this slice |
| `lms/courses/*` | blocked | MySQL | contract only | feature-flagged off | defer to read-first LMS slice |
| `lms/sections/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/lessons/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/enrollments/*` | blocked | MySQL | contract only | feature-flagged off | defer |
| `lms/progress/*` | blocked | MySQL | contract only | feature-flagged off | defer |
| `lms/quizzes/*` | blocked | MySQL | not tested | feature-flagged off | high-risk; defer |
| `lms/dashboard/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/assignments/*` | blocked | MySQL | not tested | feature-flagged off | defer |
| `lms/certificates/*` | blocked | MySQL | not tested | feature-flagged off | high-risk; defer |
| `tna/*` | blocked | MySQL | contract only (`calculate-gaps`) | feature-flagged off | defer read summary first |
| shell-required backend reads | live-safe | N/A for current shell | integration tested via frontend shell smoke | public live | shell currently does not require LMS/TNA backend routes |

## STEP 2 - First Safe Cutover Slice

Selected slice:
- `modules/*` read endpoints (`list`, `get`, `by-category`, `active`)

Why lowest risk:
- read-only shape
- no scoring/progress side effects
- isolated table (`module_settings`)
- no LMS/TNA mutation coupling

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
  - LMS read-only list/overview endpoints after module-read cutover stabilization.

