# Supabase Seed Plan (Dev/Staging)

Last updated: 2026-04-03

## Purpose
Provide realistic, deterministic non-production seed data to support:
- auth bridge validation
- LMS read/progress baseline routes
- TNA summary/report baseline routes
- KPI/probation/PIP baseline reads

Seed file:
- `supabase/seeds/seed_dev_staging.sql`

## Seed Coverage

Core/Auth:
- app settings
- module toggles (CORE, KPI, PROBATION, PIP, TNA, LMS)
- employee records with deterministic IDs/emails/roles
- optional profile sync from existing `auth.users`

LMS:
- courses, sections, lessons
- quiz questions + attempts
- enrollments + lesson progress
- certificate completion case

TNA:
- training courses
- training needs config
- training need records with priority/status
- training plans + plan items
- training enrollments

KPI/Probation/PIP:
- kpi definitions + versions + target versions + records
- probation review baseline
- pip plan + action baseline

## Deterministic Test Accounts

Employee identities:
- `ADM001` / `admin.demo@xenos.local` / `superadmin`
- `HR001` / `hr.demo@xenos.local` / `hr`
- `MGR001` / `manager.demo@xenos.local` / `manager`
- `EMP001` / `farhan.demo@xenos.local` / `employee`
- plus additional non-auth baseline employees (`EMP002`, `EMP003`, `DIR001`)

Legacy password hash in employee seed rows:
- bcrypt hash for `Demo123!`

## Supabase Auth User Provisioning

Important:
- SQL seed prepares employee/profile mapping data but does not reliably create `auth.users` accounts by itself.
- Auth users are provisioned via Supabase Auth admin API.

Provision command:
```bash
npm run qa:supabase:auth-users
```

Script:
- `scripts/qa/supabase-provision-auth-users.mjs`

What it does:
1. ensures auth users exist for seed test accounts
2. upserts `public.profiles`
3. updates `public.employees.auth_id` and `auth_email` mappings

Required env:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `SUPABASE_SEED_USER_PASSWORD` (default: `Demo123!`)

## Runbook

Apply schema + seed to linked dev/staging:
```bash
npm run qa:supabase:provision
```

Then provision auth users:
```bash
npm run qa:supabase:auth-users
```

Quick sanity checks:
```bash
npx supabase@latest db query "select count(*) from public.employees;" --linked --output json
npx supabase@latest db query "select count(*) from public.courses;" --linked --output json
npx supabase@latest db query "select count(*) from public.training_need_records;" --linked --output json
npx supabase@latest db query "select count(*) from public.kpi_definitions;" --linked --output json
```

## Validation Snapshot (2026-04-03)
- Provision command: pass (dev + staging)
- Auth-user provisioning: pass
- Current linked baseline sample:
  - `employees`: 7
  - `courses`: 2
  - `training_need_records`: 2
  - `kpi_definitions`: 2
  - `profiles`: 4
  - `employees with auth_id`: 4

## Non-Goals in This Seed Slice
- No production business data claims
- No full workflow migration of LMS/TNA business logic
- No final policy hardening for every future edge case

