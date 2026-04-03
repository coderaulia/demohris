# Supabase Schema Baseline (Dev/Staging)

Last updated: 2026-04-03

## Purpose
Define the first complete Supabase Postgres schema baseline that replaces dummy MySQL data files as the development/staging data foundation for `demo-kpi`.

## Reality Check Summary (Code-Verified)

Source files reviewed:
- `server/app.js`
- `server/modules/lms.js`
- `server/modules/tna.js`
- `server/modules/moduleManager.js`
- `server/tableMeta.js`
- `server/compat/authBridge.js`
- `server/compat/supabaseClient.js`
- `supabase/migrations/*.sql`
- legacy SQL files under `migrations/`, `mysql-setup.sql`, `mysql-demo-seed.sql`, `mysql-demo-lms-courses.sql`

### Required-Now Runtime Inventory
Core/Auth:
- `app_settings`
- `employees`
- `competency_config`
- `module_settings`
- `module_activity_log`
- `profiles` (Supabase auth bridge)

LMS:
- `courses`
- `course_sections`
- `lessons`
- `quiz_questions`
- `course_enrollments`
- `lesson_progress`
- `quiz_attempts`
- `course_reviews`
- `course_assignments`
- `course_certificates`

TNA:
- `training_courses`
- `training_needs`
- `training_need_records`
- `training_plans`
- `training_plan_items`
- `training_enrollments`

KPI / Probation / PIP:
- `kpi_definitions`
- `kpi_definition_versions`
- `employee_kpi_target_versions`
- `kpi_records`
- `employee_performance_scores`
- `kpi_weight_profiles`
- `kpi_weight_items`
- `admin_activity_log`
- `employee_assessments`
- `employee_assessment_scores`
- `employee_assessment_history`
- `employee_training_records`
- `probation_reviews`
- `probation_qualitative_items`
- `probation_monthly_scores`
- `probation_attendance_records`
- `pip_plans`
- `pip_actions`

### Defer-Later Inventory
- Learning path and analytics tables from legacy LMS SQL:
  - `learning_paths`
  - `learning_path_courses`
  - `course_analytics`
- Any non-runtime speculative domains not referenced in current route handlers.

### Naming Mismatches Identified
- LMS recommendations path reads `training_need_records.competency` + `gap_score`.
- TNA core writes/uses `training_need_records.gap_level` and joins `training_needs.competency_name`.
- Baseline keeps compatibility columns (`competency`, `gap_score`) and trigger sync to avoid drift.

### Dangerous Assumptions in Dummy SQL
- Legacy demo LMS SQL inserts email-like values into `employee_id` fields.
- Legacy files mix runtime-critical schema with demo-only convenience data.
- Legacy MySQL syntax (`ON DUPLICATE KEY`, `JSON_OVERLAPS`, `IF`) is not portable to Postgres.

## Supabase Migration Set

Applied migration files:
1. `supabase/migrations/0001_profiles_auth.sql`
2. `supabase/migrations/0002_profiles_rls.sql`
3. `supabase/migrations/0003_core_auth_and_modules.sql`
4. `supabase/migrations/0004_lms_core_tables.sql`
5. `supabase/migrations/0005_lms_progress_quiz_tables.sql`
6. `supabase/migrations/0006_tna_baseline_tables.sql`
7. `supabase/migrations/0007_rls_baseline.sql`
8. `supabase/migrations/0008_seed_helpers_and_triggers.sql`
9. `supabase/migrations/0009_kpi_baseline_tables.sql`

## RLS Baseline Coverage
- Core/LMS/TNA baseline policies in `0007`.
- KPI/Probation/PIP baseline policies in `0009`.
- `profiles`, `employees`, and domain tables enforce own-scope vs admin-scope access.
- Write access is restricted to admin roles unless explicit self-scope behavior is required.

## Deprecated Legacy Data Sources
These are now legacy/demo references, not development source-of-truth:
- `mysql-demo-seed.sql`
- `mysql-demo-lms-courses.sql`
- `complete-setup.sql`
- ad-hoc SQL under `migrations/` used for old MySQL path

Note: legacy backend runtime still contains MySQL query paths and remains in compatibility mode while domain cutover is pending.

## Validation Results

Executed on 2026-04-03:
1. `npm run qa:supabase:provision`
- result: pass
- migrations applied through `0009`
- seed file applied on linked dev and staging project refs

2. `npm run qa:contracts`
- result: pass (10/10)

3. Backend smoke (`node server/app.js` + HTTP checks)
- `/api/health` returns `500` with `ECONNREFUSED 127.0.0.1:3306` when legacy MySQL is unavailable
- unauthenticated LMS/TNA routes still return expected `401` gate behavior

Inference:
- Supabase schema/seed foundation is now usable and applied.
- Legacy backend is still partially coupled to MySQL runtime connectivity for current domain handlers.

## Runbook (Dev/Staging)

Apply migrations + seeds to linked projects:
```bash
npm run qa:supabase:provision
```

Ad-hoc sanity query:
```bash
npx supabase@latest db query "select (select count(*) from public.employees) as employees;" --linked --output json
```

