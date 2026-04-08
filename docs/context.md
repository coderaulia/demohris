# Project Context

## Stack
- Frontend: React + TypeScript + Vite (`apps/web-react`)
- Backend: Node.js + Express (`server`)
- Database: Supabase Postgres (primary), legacy MySQL fallback (migration compatibility)
- Auth: Supabase JWT + legacy session bridge
- Contracts: Zod schemas (`packages/contracts`)
- Deployment: Hostinger GitHub auto-deploy (frontend), Supabase (auth/data)

## Current Migration Context
- Strategy: read-first -> mutation-by-slice -> route enablement
- LMS/TNA rollout rule: no route expansion without parity tests
- Source switches used for rollback-safe cutovers:
  - `LMS_READ_SOURCE`
  - `LMS_MUTATION_SOURCE`
  - `TNA_READ_SOURCE`
  - `TNA_MUTATION_SOURCE`

## Required Quality Gates
- `npm run qa:contracts`
- `npm run qa:lms:cutover`
- `npm run qa:lms:workflow`
- `npm run build --prefix apps/web-react`

## Naming Rules (Essential)
- Backend action format: `domain/resource/action` (e.g., `lms/enrollments/enroll`)
- API response baseline:
  - success: `{ success: true, ... }`
  - error: `{ error: "..." }`
- Roles: `employee`, `manager`, `hr`, `superadmin`
- Feature flags/env keys: uppercase snake case
- New endpoints must be registered in docs and contract tests in the same slice
- No silent response-shape changes; update fixture + docs explicitly
