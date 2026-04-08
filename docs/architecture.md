# Architecture

## Layers
- UI Layer
- Adapter Layer
- Contract Layer
- API Layer
- Domain Modules
- Data Access Layer

## Frontend Structure
- `apps/web-react/src/components`
- `apps/web-react/src/pages`
- `apps/web-react/src/adapters`
- `apps/web-react/src/lib`
- `apps/web-react/src/router.tsx`

## Backend Structure
- `server/app.js`
- `server/modules/*`
- `server/compat/*`
- `server/features.js`

## Shared Packages
- `packages/contracts/src/*`

## Data and Auth
- Supabase Postgres
- Supabase Auth (JWT)
- Legacy session bridge

## Deployment Units
- Frontend static build (`apps/web-react/dist`)
- Backend runtime (`server`)
- Supabase project (schema, RLS, auth)

## QA and Verification
- `tests/contracts/*`
- `scripts/qa/*`
- `tests/e2e/*`

## Documentation
- `docs/project-status.md`
- `docs/commit-logs.md`
- `docs/api-endpoint.md`
- `docs/backend-cutover-matrix.md`
- `docs/supabase-backend-migration.md`
