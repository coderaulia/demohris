# Supabase Migration Foundation

This folder contains ordered SQL migrations for the Supabase-first backend transition.

## Versioning Rules
- File pattern: `NNNN_<description>.sql`
- Apply files in lexical order.
- Never edit applied migrations in place; create a new migration for changes.

## Current Scope
- Foundation only:
  - `profiles` table
  - auth.users -> profiles sync trigger
  - minimal RLS policies for profile access

Domain migrations for LMS/TNA/KPI are intentionally deferred until dual-auth bridge and contract parity are stable.

