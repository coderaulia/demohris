# Supabase Migration Baseline

This folder contains ordered SQL migrations for the Supabase-first backend transition.

## Versioning Rules
- File pattern: `NNNN_<description>.sql`
- Apply files in lexical order.
- Never edit applied migrations in place; create a new migration for changes.

## Current Scope
- Auth/profile:
  - `0001_profiles_auth.sql`
  - `0002_profiles_rls.sql`
- Core/module baseline:
  - `0003_core_auth_and_modules.sql`
- LMS baseline:
  - `0004_lms_core_tables.sql`
  - `0005_lms_progress_quiz_tables.sql`
- TNA baseline:
  - `0006_tna_baseline_tables.sql`
- RLS and compatibility helpers:
  - `0007_rls_baseline.sql`
  - `0008_seed_helpers_and_triggers.sql`
- KPI/probation/PIP baseline:
  - `0009_kpi_baseline_tables.sql`
