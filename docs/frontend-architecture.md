# Frontend Architecture (React Strangler Shell)

Last updated: 2026-04-03

## Scope of This Slice
- Added isolated React + TypeScript app at `apps/web-react`.
- Added shared contract layer at `packages/contracts` (Zod + inferred types).
- Added adapter-based data boundary for auth/LMS/TNA calls.
- Kept legacy frontend untouched.
- Migrated only the dashboard shell route, not LMS/TNA feature screens.

## Folder Layout

```text
apps/web-react
  src/
    adapters/
      authAdapter.ts
      lmsAdapter.ts
      tnaAdapter.ts
      transport.ts
    components/
      AppErrorBoundary.tsx
      AppLayout.tsx
      RouteGuard.tsx
    lib/
      env.ts
      httpClient.ts
      supabaseClient.ts
    pages/
      DashboardPage.tsx
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
  - `lms/enrollments/*`
  - `lms/progress/*`
  - `tna/calculate-gaps`
  - `modules/*`
- Adapters parse responses with Zod before returning data to React components.

## Adapter Boundary
- All API calls are routed through `src/adapters`.
- Switching between backends is centralized in `src/adapters/transport.ts`.
- `VITE_API_TARGET` controls routing mode:
  - `legacy`
  - `supabase`
  - `auto`
- In `supabase` target mode, non-cutover actions are blocked (no silent fallback to legacy).
- No direct `fetch` is used in React pages/components.

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
  - `/login`
- Feature-flagged routes:
  - `/lms/*` via `VITE_ENABLE_LMS_ROUTE`
  - `/tna/*` via `VITE_ENABLE_TNA_ROUTE`
- `RouteGuard` gates authenticated routes.
- `AppErrorBoundary` isolates shell-level runtime failures.
- `AppLayout` can optionally show legacy app link via `VITE_SHOW_LEGACY_APP_LINK`.

## Data Fetching Rules
- TanStack Query is used for async state.
- Session and dashboard snapshot are query-backed.
- Adapters own request shape, transport selection, and schema parsing.

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
  - `VITE_SHOW_LEGACY_APP_LINK`
- SPA fallback is provided via `apps/web-react/public/.htaccess`.

## Migration Constraints Preserved
- LMS/TNA production UI flows are not rewritten in this slice.
- Legacy frontend remains fully operational.
- Contract fixtures remain the compatibility guardrail.
- Adapter switching keeps migration reversible.
