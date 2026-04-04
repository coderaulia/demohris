# Frontend Architecture (React Strangler Shell)

Last updated: 2026-04-04

## Scope of This Slice
- Added isolated React + TypeScript app at `apps/web-react`.
- Added shared contract layer at `packages/contracts` (Zod + inferred types).
- Added adapter-based data boundary for auth/LMS/TNA/modules calls.
- Rebuilt dashboard from shell placeholder into workflow-oriented HR management dashboard.
- Added Employees module in React shell with list + detail read-first workflow parity.
- Kept legacy frontend untouched for LMS/TNA mutation-heavy screens.

## Folder Layout

```text
apps/web-react
  src/
    adapters/
      authAdapter.ts
      dashboardAdapter.ts
      employeesAdapter.ts
      lmsAdapter.ts
      modulesAdapter.ts
      tnaAdapter.ts
      transport.ts
    components/
      AppErrorBoundary.tsx
      AppLayout.tsx
      RouteGuard.tsx
      ui/
        badge.tsx
        button.tsx
        card.tsx
        input.tsx
        select.tsx
        tabs.tsx
    lib/
      env.ts
      httpClient.ts
      supabaseClient.ts
      utils.ts
    pages/
      DashboardPage.tsx
      DashboardDrilldownPage.tsx
      EmployeeDetailPage.tsx
      EmployeesPage.tsx
      LoginPage.tsx
      LmsPlaceholderPage.tsx
      TnaPlaceholderPage.tsx
    providers/
      AppProviders.tsx
      AuthProvider.tsx
packages/contracts
  src/
    api.ts
    auth.ts
    lms.ts
    modules.ts
    tna.ts
```

## Contract Layer
- Source of truth for frontend request/response validation: `packages/contracts`.
- Schemas are aligned to current golden fixtures:
  - `auth/login`
  - `auth/session`
  - `lms/courses/list|get`
  - `lms/enrollments/*`
  - `lms/progress/*`
  - `tna/calculate-gaps`
  - `tna/summary|gaps-report|lms-report`
  - `modules/*`
- Adapters parse responses with Zod before returning data to React components.

## Adapter Boundary
- All API calls are routed through `src/adapters`.
- Switching between backends is centralized in `src/adapters/transport.ts`.
- `VITE_API_TARGET` controls routing mode:
  - `legacy`
  - `supabase`
  - `auto`
- In `supabase` target mode, only allow-listed cutover actions are callable.
- `modules` domain is routed through `/api/modules?action=*` from adapter transport.
- No direct `fetch` is used in React pages/components.

Current allow-listed Supabase-safe adapter actions:
- modules read: `list|get|by-category|active`
- LMS read: `courses/list|get`, `enrollments/list|get|my-courses`, `progress/get`
- TNA read: `summary`, `gaps-report`, `lms-report`

## Auth Model in React Shell
- `AuthProvider` flow:
1. Attempt Supabase session + `profiles` read directly (`@supabase/supabase-js`).
2. In migration modes (`auto`/`legacy`), fallback to backend `auth/session` path when needed.
3. In production Supabase mode, do not depend on legacy auth routes.
4. Expose unified auth context:
   - `user`
   - `role`
   - `loading`
   - `source` (`jwt` | `session` | `none`)

This keeps dual-auth bridge compatibility while migration is in mixed state.

## Routing and Guards
- Routes:
  - `/dashboard`
  - `/dashboard/drilldown/:mode/:department` (safe placeholder boundary for future detail views)
  - `/employees`
  - `/employees/:employeeId`
  - `/login`
- Feature-flagged routes:
  - `/lms/*` via `VITE_ENABLE_LMS_ROUTE`
  - `/tna/*` via `VITE_ENABLE_TNA_ROUTE`
- `RouteGuard` gates authenticated routes.
- `AppErrorBoundary` isolates shell-level runtime failures.
- `AppLayout` can optionally show legacy app link via `VITE_SHOW_LEGACY_APP_LINK`.
- Employees route is controlled by `VITE_ENABLE_EMPLOYEES_ROUTE` (default: enabled).

## Data Fetching Rules
- TanStack Query is used for async state.
- Session and dashboard snapshot are query-backed.
- Adapters own request shape, transport selection, and schema parsing.

## Dashboard IA (Workflow Parity, Modern UI)

Dashboard now preserves legacy management workflow patterns without visual cloning:

- Filter-first top bar:
  - `department`
  - `manager`
  - `period`
  - apply/clear controls
- Summary tabs:
  - KPI Summary
  - Assessment Summary
- Department overview cards:
  - employee count
  - record count
  - met/target metric when available
  - secondary metric per mode
- Drill-down-ready interaction:
  - each card links to `/dashboard/drilldown/:mode/:department`

Data sources (adapter-only, no direct component fetches):
- `modulesAdapter.active()`
- `tnaAdapter.summary()`
- `tnaAdapter.gapsReport()`
- `tnaAdapter.lmsReport()`
- `lmsAdapter.listCourses()`

Deferred dashboard metrics (explicit boundary, no fake data):
- manager mapping source requires dedicated endpoint parity (currently inferred from available gap rows only)
- weighted KPI score summary remains deferred until KPI score endpoints are safely cut over

## UI System (Tailwind + shadcn)

- Tailwind configured for React shell (`tailwind.config.js`, `postcss.config.js`, `src/styles.css`).
- shadcn-style primitives added under `src/components/ui`.
- Design direction:
  - modern, neutral management interface
  - semantic token-based theming
  - responsive cards/tabs/filter layout with mobile-safe behavior

## Hostinger Deployment Notes
- Build command for React shell:
  - `cd apps/web-react && npm run build`
- Output:
  - `apps/web-react/dist`
- Required SPA fallback behavior (Hostinger/Nginx-style):
  - Route unmatched paths to `index.html`.
- Env vars required for runtime:
  - `VITE_API_BASE_URL`
  - `VITE_API_TARGET`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_LEGACY_APP_URL`
- `VITE_ENABLE_LMS_ROUTE`
- `VITE_ENABLE_TNA_ROUTE`
- `VITE_ENABLE_EMPLOYEES_ROUTE`
- `VITE_SHOW_LEGACY_APP_LINK`
- SPA fallback is provided via `apps/web-react/public/.htaccess`.

## Migration Constraints Preserved
- LMS/TNA production UI flows are not rewritten in this slice.
- Employees module is read-first only; mutation-heavy employee editing remains on legacy path.
- Legacy frontend remains fully operational.
- Contract fixtures remain the compatibility guardrail.
- Adapter switching keeps migration reversible.
