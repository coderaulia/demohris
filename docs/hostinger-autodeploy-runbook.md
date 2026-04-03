# Hostinger GitHub Auto-Deploy Runbook (React Shell)

Last updated: 2026-04-03

## Scope
This runbook deploys only the React shell at `apps/web-react` from GitHub auto-deploy.

Production intent:
- frontend served by Hostinger
- auth/data for live routes served by Supabase
- LMS/TNA React routes remain feature-flagged off until migrated

## Repository/Branch Setup

- Repository: `xenosweb-org/hris-system`
- Deploy branch: `main` (or release branch if your Hostinger project uses one)
- App subdirectory: `apps/web-react`

## Hostinger Build Settings

Use these exact values in Hostinger Git deployment:

- Install command:
  - `npm ci --prefix apps/web-react`
- Build command:
  - `npm run build --prefix apps/web-react`
- Publish directory:
  - `apps/web-react/dist`

If Hostinger UI asks for root directory only:
- keep repo root as source
- keep commands above with `--prefix apps/web-react`

## Hostinger Environment Variables (Frontend)

Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_TARGET=supabase`
- `VITE_ENABLE_LMS_ROUTE=false`
- `VITE_ENABLE_TNA_ROUTE=false`

Optional:
- `VITE_API_BASE_URL=/api`
- `VITE_LEGACY_APP_URL=https://legacy.your-domain.example`
- `VITE_SHOW_LEGACY_APP_LINK=true`

Security:
- Never put `SUPABASE_SERVICE_ROLE_KEY` in Hostinger frontend env vars.

## SPA Fallback Requirement

React Router browser history mode requires fallback rewrites.

Included in app:
- `apps/web-react/public/.htaccess`

Expected behavior:
- direct refresh on `/dashboard` returns `index.html`
- existing files/assets continue to resolve normally

## Deployment Procedure

1. Push deploy commit to the configured branch.
2. Trigger Hostinger redeploy (or wait for automatic webhook deploy).
3. Verify build logs:
   - dependency install succeeded
   - `vite build` succeeded
   - publish directory detected
4. Smoke test live domain:
   - `/login`
   - `/dashboard` refresh
   - login/logout flow
   - hidden LMS/TNA routes

## Quick Validation Commands (Local)

```bash
npm ci --prefix apps/web-react
npm run build --prefix apps/web-react
```

Optional check that `.htaccess` is in dist output:

```bash
dir apps\web-react\dist
```

## Rollback

If deploy is bad:
1. Redeploy previous stable commit from Hostinger dashboard.
2. Keep `VITE_ENABLE_LMS_ROUTE=false` and `VITE_ENABLE_TNA_ROUTE=false`.
3. If needed, disable `VITE_SHOW_LEGACY_APP_LINK` to reduce user confusion during incident response.
