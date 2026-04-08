# Project Status

Last updated: 2026-04-08
Project: demo-kpi (HR Performance Suite)

## Done
- Dual-auth bridge is active: legacy session + Supabase JWT.
- Supabase schema baseline, seed baseline, and role/profile mapping are in place.
- Read cutovers are stable for modules, LMS catalog/enrollments/progress reads, and TNA summary/report reads.
- LMS mutation slices already cut over and parity-tested: `start`, `enroll`, `unenroll`, `complete`.
- React shell is live with core routes and role-aware navigation.

## In Progress
- Production-safe LMS rollout in React shell (`/lms`, `/lms/my-courses`, `/lms/:courseId`) is gated by smoke checks and route hardening.
- TNA mutation cutover is partial and still needs strict parity verification before route expansion.
- End-to-end regression coverage is incomplete for LMS/TNA full workflows.
- Staging/live operational validation is still needed after each backend cutover slice.

## Next
- Stabilize and pass mandatory gates consistently:
  - `npm run qa:lms:cutover`
  - `npm run qa:lms:workflow`
  - `npm run qa:contracts`
  - `npm run build --prefix apps/web-react`
- Complete next single mutation slice for TNA (`tna/needs/update-status` or `tna/plan/add-item`).
- Keep LMS/TNA route exposure conservative: enable only when read + mutation parity is proven.
- Add Playwright E2E for LMS and TNA critical user paths.

## Current Risks
- Hidden contract drift between legacy and Supabase responses.
- Role-scope regression in manager/team visibility.
- Production route enablement before parity evidence is complete.
- Environment misconfiguration across local, staging, and Hostinger deploy.
