# Frontend Migration Checklist

Last updated: 2026-04-03

## Phase D - React Shell (Current Slice)
- [x] Create isolated React app in `apps/web-react` (React + TS + Vite).
- [x] Add React Router route shell (`/dashboard`, `/lms/*`, `/tna/*`).
- [x] Add TanStack Query provider and query-based data loading.
- [x] Add adapter layer (`authAdapter`, `lmsAdapter`, `tnaAdapter`) with centralized transport switch.
- [x] Add shared contract package (`packages/contracts`) with Zod schemas.
- [x] Add auth context using Supabase session + legacy session fallback.
- [x] Add route guard and shell error boundary.
- [x] Migrate first safe module: dashboard shell.
- [x] Keep LMS/TNA pages as legacy placeholders.
- [x] Build check passes for React shell (`npm run build` in `apps/web-react`).

## Blockers
- [ ] Auth parity validation is still blocked on backend DB health for configured `BACKEND_BASE_URL`.
- [ ] Staging evidence for JWT/session parity must be completed before deeper frontend cutover.

## Next Execution Slice
- [ ] Add module metadata adapter and migrate module list view, if auth parity is green.
- [ ] Add adapter-level contract regression tests for shell calls.
- [ ] Add role-aware route guard policy matrix from backend roles.
- [ ] Add LMS read-only overview screen (no quiz/progress mutations yet).
- [ ] Define shared UI state strategy for gradual cutover between legacy and React routes.

## Safety Rules (Must Stay True)
- [x] No direct API calls in components.
- [x] No LMS quiz/progress migration in this phase.
- [x] No TNA feature migration in this phase.
- [x] Legacy frontend remains available as fallback entry point.
- [x] Adapter switch remains centralized and reversible.
