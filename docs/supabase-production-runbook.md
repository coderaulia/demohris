# Supabase Production Runbook

Last updated: 2026-04-03

## Purpose
Prepare and verify Supabase as the live auth/data platform for production-safe routes in `demo-kpi`.

## Production Scope for This Release
- Supabase Auth + `public.profiles` for React shell login/session/logout
- No claim that LMS/TNA domain handlers are fully migrated to Supabase yet
- Legacy MySQL domain dependency is excluded from live frontend route scope

## Required Secrets and Identifiers

Server/ops only:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF_PRODUCTION`
- `SUPABASE_DB_PASSWORD_PRODUCTION`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_AUDIENCE`

Frontend (public-safe):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Apply Production Migrations

From repo root:

```bash
npx supabase@latest link --project-ref "$SUPABASE_PROJECT_REF_PRODUCTION" --password "$SUPABASE_DB_PASSWORD_PRODUCTION" --workdir .
npx supabase@latest db push --yes --workdir .
```

Notes:
- This applies versioned SQL under `supabase/migrations/`.
- Do not run `supabase/seeds/seed_dev_staging.sql` on production.

## Provision Initial Production Users

Options:
1. Supabase dashboard/manual invites for real users
2. controlled admin script flow using service role key (internal only)

Required mapping rule:
- `auth.users.email` must map deterministically to `public.profiles` and app role model.

## Minimal Production Data Baseline

Before exposing authenticated shell:
- at least one admin profile exists
- role mapping is valid for expected test users
- module feature flags/config values required for shell are present

## Security Validation

- [ ] RLS enabled for `profiles` and domain tables
- [ ] anon key only used client-side
- [ ] service role key is not present in frontend env/build output
- [ ] policies allow own-profile reads and admin reads per baseline policy design

## Live Validation Checklist

Auth:
- [ ] sign in with Supabase account
- [ ] refresh preserves session
- [ ] sign out clears session
- [ ] user role + employee identity appear in dashboard shell

Data safety:
- [ ] direct profile read follows RLS scope
- [ ] unauthorized access attempts fail safely

Frontend integration:
- [ ] `VITE_API_TARGET=supabase`
- [ ] LMS/TNA routes remain disabled unless verified migrated

## Incident Rollback

If production validation fails:
1. Keep frontend deployed but restrict to login/error maintenance mode if needed.
2. Revert frontend commit to previous stable SHA.
3. Keep LMS/TNA flags off.
4. Fix Supabase config/policies, then redeploy.

## Deferred Work (Explicit)
- Full LMS Supabase query cutover
- Full TNA Supabase query cutover
- Removal of legacy Express/MySQL domain handlers
