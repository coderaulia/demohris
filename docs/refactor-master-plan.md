# Refactor Master Plan

Purpose: define a reality-based, incremental full-stack migration path for HR Performance Suite (`demo-kpi`) without breaking delivered LMS/TNA/business flows.

## Decision Summary
- Primary direction: **Supabase-first backend**.
- Secondary option: Cloudflare Workers can be added later for edge/reporting workloads, not as first migration target.
- Frontend direction: **React + TypeScript + Vite**, still deployable as static build on Hostinger.
- Auth direction: replace `express-session` with **Supabase Auth (JWT)** and role-aware backend checks.

## Phase 0 - Reality Check (Code-Verified)

### 1) Current Architecture Summary
- Frontend:
  - Vite SPA with vanilla JS modules (`src/modules/*`), global store/event bus (`src/lib/store.js`).
  - Data layer split:
    - generic table-like client in `src/lib/supabase.js` (`db/query` style adapter),
    - domain API clients for LMS/TNA/modules in `src/modules/data/lms.js`, `tna.js`, `modules.js`.
- Backend:
  - Single Express process (`server/app.js`) with action-router pattern:
    - `/api?action=<domain/action>`
    - `/api/modules?action=<...>`
  - Direct SQL via `mysql2/promise`.
  - Domain handlers:
    - LMS in `server/modules/lms.js`
    - TNA in `server/modules/tna.js`
  - Generic table gateway: `db/query` action path in `server/app.js`.
- Auth/session:
  - `express-session` cookie session (`demo_kpi_session`) + bcrypt password hash checks in `employees` table.
  - Role checks distributed across app-level functions and domain handlers.
- Database:
  - MySQL relational schema with many feature tables (KPI, probation, PIP, TNA, LMS).
  - LMS has multi-table transactional flows: enrollments, lesson_progress, quiz_attempts, certificates.
- Deployment:
  - Frontend built by Vite, backend packaged for Hostinger-like environment.

### 2) Stability Risks In Current Stack
- Session-bound auth state creates tight coupling to single backend runtime behavior.
- `db/query` generic gateway increases blast radius for permission or validation regressions.
- Mixed API styles (`db/query`, `auth/*`, `lms/*`, `tna/*`, `/api/modules`) increase contract drift risk.
- Role logic is duplicated across backend paths and some frontend assumptions.
- Large module surface with limited E2E coverage (especially LMS/TNA edge cases) increases migration risk.

### 3) Coupling Hotspots
- `src/lib/supabase.js` query-builder interface is used as pseudo-Supabase client but backed by custom Express `db/query`.
- `server/app.js` central dispatcher couples auth, feature flags, and all domains into one file.
- LMS lesson/enrollment/progress flows depend on specific payload shapes and sequencing.
- TNA endpoints rely on reporting + plan workflows that cross several tables and roles.
- Frontend state (`state.db`, app-wide arrays) is shared across modules and not isolated by domain boundaries.

### 4) Incremental vs Coordinated Cutover
- Incremental-safe:
  - Frontend shell migration to React + TS with adapter-based data layer.
  - Domain-by-domain API migration behind stable endpoint contracts.
  - Read-heavy reporting endpoints (TNA/LMS stats) as early migration candidates.
- Coordinated cutover required:
  - Auth transition from session cookies to JWT (needs dual-auth bridge period).
  - Permission model normalization (central policy source needed before retiring legacy checks).
  - Final decommission of `db/query` generic path.

## Phase 1 - Target Stack Evaluation

### Option A: Supabase-First Backend
Fit against current codebase:
- Auth replacement: strong fit (`auth.users` + JWT, refresh tokens, password reset flows).
- Relational model: strong fit for LMS/TNA/KPI-style schema complexity (Postgres + SQL/RPC).
- Role-based access: strong fit via RLS + custom claims + server-side guard services.
- LMS transactions: good fit (SQL functions/RPC for enroll/progress/quiz/cert workflows).
- TNA/reporting: good fit (views, materialized views, SQL functions).
- File/report storage: good fit via Supabase Storage buckets.
- Ops burden: lower than self-managed Node+MySQL.

Risks:
- MySQL -> Postgres migration complexity (types, SQL dialect differences).
- RLS policy design/testing needs discipline to avoid access regressions.

### Option B: Cloudflare Workers Backend
Fit against current codebase:
- Stateless API routing + validation: good fit.
- Auth replacement: workable but requires more assembly (JWT/OAuth/session replacement stack).
- Relational complexity: medium/weak if using D1 for current domain depth; stronger only if paired with external Postgres/MySQL.
- LMS/TNA transactional behavior: doable but higher engineering effort for consistency + migrations.
- Deploy simplicity: good for edge functions; less straightforward when paired with legacy relational DB needs.

Risks:
- Higher migration engineering load for solo/lean team.
- If keeping MySQL during transition, networking/data-access complexity remains.
- More moving parts for auth + data strategy than Supabase-first.

### Comparative Verdict
- Migration risk: **Supabase-first lower**
- Auth complexity: **Supabase-first lower**
- Data model fit: **Supabase-first stronger**
- Solo development ergonomics: **Supabase-first stronger**
- Hostinger frontend compatibility: both workable (frontend is static build either way)

## Recommended Primary Direction
**Choose Supabase-first.**

Reason:
- This codebase is heavily relational and role-sensitive; Supabase gives the fastest path to replacing session auth while preserving SQL-centric domain behavior (especially LMS/TNA) with lower operational complexity than Workers-first.

## Phase 2 - Target Architecture Definition

### Frontend Target (React + TypeScript + Vite)
- App shell:
  - `React Router` for route-level module boundaries.
- Data fetching/state:
  - `TanStack Query` for server state + retries/cache/invalidation.
  - Keep lightweight local UI state with Zustand or React context where needed.
- Forms/validation:
  - `react-hook-form` + `zod` schemas shared with API contracts.
- Migration preservation strategy:
  - Keep legacy module behavior via compatibility adapters (`/src/legacy-adapters/*`).
  - Migrate module UI by vertical slices (LMS views first to protect highest-risk flows).
- Hostinger deploy:
  - Continue static output from Vite (`dist`).
  - Ensure SPA fallback rewrite to `index.html` in hosting config.

### Backend Target (Supabase-First)
- Auth:
  - Supabase Auth JWT replacing express-session.
  - Map roles from profile table/custom claims (`employee`, `manager`, `director`, `hr`, `superadmin`).
- API/function approach:
  - Domain APIs through Supabase Edge Functions (for orchestrated workflows) + Postgres RPC for transactional logic.
  - No generic `db/query` in final state.
- Database direction:
  - Postgres schema organized by domain (`core`, `kpi`, `tna`, `lms`).
  - SQL migrations versioned in repo.
- Role/permission:
  - RLS for table-level read/write.
  - Edge function guards for cross-table business rules.
- File/report strategy:
  - Supabase Storage buckets for certificates/exports.
  - Keep PDF/report generation in edge/server functions.

### Integration Boundary
- Env model:
  - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (during transition).
  - Backend/functions: service role keys kept server-side only.
- API contract strategy:
  - Versioned domain contracts (`/api/v1/*`) and typed DTO schemas.
  - Add contract tests for LMS/TNA critical paths.
- Module isolation:
  - Domain service boundaries: `lms-service`, `tna-service`, `auth-service`.
  - Legacy endpoints remain until each module passes cutover checklist.

## Phase 3 - Migration Strategy (Strangler)

### Phase A: Architecture Hardening / Inventory
- Freeze and map current contracts (LMS/TNA/auth/modules).
- Add baseline contract tests + golden payload fixtures.
- Add migration dashboard in docs.

### Phase B: Database and Auth Foundation
- Stand up Supabase project (dev/staging/prod separation).
- Migrate schema from MySQL to Postgres (core + LMS + TNA first).
- Implement Supabase Auth + role claims.
- Add dual-auth bridge window (legacy session + JWT acceptance in backend gateway).

### Phase C: Backend Domain Migration
- Move auth endpoints first (`auth/*` replacement).
- Migrate LMS backend flows next (high risk):
  - enroll/start/progress/quiz/certificate paths.
- Migrate TNA APIs after LMS core paths stabilize.
- Keep legacy Express handlers as fallback until parity tests pass.

### Phase D: Frontend Shell Migration
- Create React+TS app shell with shared layout, route guards, auth context.
- Wrap legacy APIs behind typed client SDK.
- Start with non-destructive pages first (dashboard/read-only reports), then forms.

### Phase E: Module-by-Module Cutover
- Suggested order:
  1. Auth/session experience
  2. LMS learner flows
  3. LMS admin flows
  4. TNA planning/reporting
  5. KPI/probation/PIP
- For each module: run parity checklist (API, role checks, regression tests, UAT signoff).

### Phase F: Legacy Cleanup
- Remove `express-session`, legacy auth tables/fields no longer needed.
- Remove `db/query` generic endpoint.
- Retire legacy module scripts after full React cutover.
- Finalize runbooks and rollback procedures.

## Phase 4 - Risk Register

| Risk | Impact | Trigger | Mitigation | Rollback |
|---|---|---|---|---|
| Session auth migration regression | Users locked out / privilege errors | JWT rollout without dual validation | Dual-auth bridge + staged role-claim rollout + auth smoke tests | Re-enable legacy session auth path temporarily |
| API contract drift | Frontend runtime failures | Endpoint payload changes without contract tests | Typed DTO schemas + snapshot contract tests | Route traffic back to legacy handlers |
| LMS regression | Learning flow breakage, data inconsistency | Enroll/progress/quiz logic diverges during migration | LMS-first parity suite + shadow reads + staged canary users | Switch LMS API calls back to legacy endpoints |
| TNA transport mismatch regression | Missing filter/report data | Request parsing differences body/query | Strict API validators + compatibility input parsing during transition | Fallback to legacy TNA handlers |
| Data migration errors (MySQL->Postgres) | Data loss or semantic corruption | Type conversion, nullability, JSON differences | Dry-run migration + checksums + table-by-table reconciliation | Keep MySQL read-only fallback and re-run migration |
| Role/permission regression | Over/under-authorized access | RLS policy gaps | Policy matrix tests by role + audit logs | Disable risky policies and use temporary server guards |
| Report/certificate/export breakage | Operational disruption for HR/admin | Storage/generation moved without compatibility | Keep legacy export path until new output parity confirmed | Serve exports from legacy backend |
| Hostinger SPA route issues | Blank screens on refresh/deep links | Missing rewrite/fallback config | Explicit rewrite rules + deployment smoke tests | Revert to previous static bundle |
| Environment/config mistakes | Production outage or cross-env leakage | Missing keys or wrong endpoint URLs | `.env` contract checklist + startup validation + CI checks | Restore previous env set and redeploy known-good artifact |

## Phase 5 - Documentation & Migration Checklist

### Required docs in repo
- `docs/refactor-master-plan.md` (this file)
- `docs/project-status.md` (refactor track added)
- `docs/commit-logs.md` (refactor baseline recorded)

### Execution checklist (next)
1. Freeze API contract fixtures for LMS and TNA.
2. Define role-permission matrix as machine-testable spec.
3. Provision Supabase environments and migration pipeline.
4. Build auth bridge and validate side-by-side login/session behavior.
5. Implement LMS parity tests before first domain cutover.
6. Scaffold React+TS shell with adapter layer (no business logic rewrite yet).

## Phase 6 - Deliverables

### 1) Recommended architecture decision
- **Supabase-first backend + React/TypeScript frontend, incremental strangler migration.**

### 2) Target folder structure
```text
demo-kpi/
  apps/
    web-react/                  # React + TS + Vite frontend
  services/
    api-legacy/                 # existing Express app (transition period)
    edge-functions/             # Supabase Edge Functions by domain
  packages/
    contracts/                  # zod schemas + typed DTOs
    domain-lms/
    domain-tna/
    domain-auth/
    ui-kit/
  db/
    migrations/
    seeds/
    policies/
  docs/
    refactor-master-plan.md
    api-endpoint.md
    project-status.md
    commit-logs.md
```

### 3) Phased migration roadmap
- A: Hardening/inventory
- B: DB+auth foundation
- C: Backend domain migration
- D: Frontend shell migration
- E: Module cutover
- F: Legacy cleanup

### 4) Risk register
- Included in Phase 4 table.

### 5) Checklist of next execution tasks
- Included in Phase 5 execution checklist.

### 6) Exact platform recommendation
- **Choose Supabase first for this codebase.**
- Cloudflare Workers can be introduced later for edge-specific workloads after core auth/data migration stabilizes.

