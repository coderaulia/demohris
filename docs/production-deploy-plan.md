# Production Deploy Plan (Hostinger + Supabase)

Last updated: 2026-04-03

## Objective
Launch a safe public slice of `demo-kpi` where:
- frontend is deployed from GitHub using Hostinger auto-deploy
- auth/data path for live routes is Supabase-backed
- public routes do not depend on unavailable MySQL runtime

## Execution Status
- Code/config/docs preparation: complete in repository.
- Production apply/deploy action: pending (requires Hostinger dashboard access and production Supabase credentials).

## Step 0 - Reality Check (Code + Docs Verified)

### 1) Frontend routes production-ready now
- `/login` -> ready (Supabase sign-in in `VITE_API_TARGET=supabase`)
- `/dashboard` -> ready (auth/profile snapshot from Supabase session/profile)
- `/lms/*` -> not live by default (feature-flagged)
- `/tna/*` -> not live by default (feature-flagged)

### 2) Backend calls already fully Supabase-backed
- No LMS/TNA legacy domain handler is fully Supabase-native yet.
- Live slice avoids those handlers by design.
- Dual-auth bridge remains available on backend for migration mode, not required for live shell-only release.

### 3) Routes still coupled to legacy MySQL handlers
- `auth/*` routes on legacy Express runtime
- `lms/*` routes
- `tna/*` routes
- `/api/health` currently checks MySQL pool

### 4) Minimum safe production slice
- Live now:
  - React shell
  - Supabase login/session/logout
  - Dashboard identity shell
- Hidden/flagged off:
  - LMS and TNA React routes
- Legacy only:
  - full LMS/TNA flows (access via optional legacy link only)

## Step 1 - Live Scope Classification

| Route/Area | Status | Rule |
|---|---|---|
| `/login` | LIVE NOW | Supabase auth only in production target |
| `/dashboard` | LIVE NOW | Uses Supabase session/profile context |
| `/lms/*` | HIDDEN / FEATURE-FLAGGED | Enable only after Supabase-backed path is migrated and tested |
| `/tna/*` | HIDDEN / FEATURE-FLAGGED | Enable only after Supabase-backed path is migrated and tested |
| Legacy UI | LEGACY ONLY | Optional external link; not part of new live route guarantees |

## Step 2 - Production Routing Safety Rules

Implemented in React shell:
- `VITE_API_TARGET=supabase` is the intended live mode.
- Supabase mode no longer silently falls back to legacy transport for non-cutover actions.
- LMS/TNA routes are controlled by:
  - `VITE_ENABLE_LMS_ROUTE`
  - `VITE_ENABLE_TNA_ROUTE`

## Step 3 - Production Env Contract

### Hostinger frontend env
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_TARGET=supabase`
- `VITE_API_BASE_URL=/api` (kept for compatibility, unused by shell-only live routes)
- `VITE_LEGACY_APP_URL` (optional fallback link)
- `VITE_ENABLE_LMS_ROUTE=false` (until migrated)
- `VITE_ENABLE_TNA_ROUTE=false` (until migrated)
- `VITE_SHOW_LEGACY_APP_LINK=true|false` (release choice)

### Backend/Supabase env (server/scripts only)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_AUDIENCE`
- project refs and access token for provisioning/deploy scripts

Security rule:
- anon key is client-visible
- service role key must never be exposed to frontend or Hostinger static client env

## Step 4 - Smoke Test Checklist (Pre and Post Go-Live)

Frontend:
- [ ] Hostinger build command set to `npm run hostinger:build`
- [ ] Hostinger start command set to `npm run hostinger:start`
- [ ] Hostinger output directory set to `apps/web-react/dist`
- [ ] Build succeeds from `apps/web-react`
- [ ] `/dashboard` page refresh resolves to SPA fallback (no 404)
- [ ] static assets load with no missing file errors

Auth:
- [ ] Supabase sign-in works
- [ ] session restore after refresh works
- [ ] logout works
- [ ] role and employee identity are resolved in shell

Safety:
- [ ] LMS route hidden when `VITE_ENABLE_LMS_ROUTE=false`
- [ ] TNA route hidden when `VITE_ENABLE_TNA_ROUTE=false`
- [ ] no production page requires legacy MySQL-backed domain handler
- [ ] no service role key in built frontend assets

## Step 5 - Rollback Plan

If deployment fails:
1. Revert Hostinger deployment to previous known-good commit.
2. Keep LMS/TNA routes disabled in env flags.
3. If Supabase auth outage occurs, switch `VITE_API_TARGET=legacy` only for controlled temporary fallback environments (not default public mode).
4. Record failure cause and corrective action in `docs/commit-logs.md`.

## Release Gate

Production release is approved only when:
- smoke checklist is complete
- live routes are Supabase-backed
- non-migrated routes are explicitly hidden/flagged
- rollback path is confirmed
