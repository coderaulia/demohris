# demo-kpi React Shell

## Purpose
- Incremental frontend migration shell for `demo-kpi`.
- Keeps legacy UI operational while React routes are introduced gradually.

## Commands
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Environment
Copy `.env.example` and provide values:
- `VITE_API_BASE_URL`
- `VITE_API_TARGET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LEGACY_APP_URL`

## Current Scope
- Dashboard shell migrated.
- LMS/TNA routes are placeholders that keep links to legacy app.
- All backend interaction goes through adapters.
