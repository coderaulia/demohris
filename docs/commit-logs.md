# Commit Logs

Purpose: keep only active migration context and recent high-signal changes.

## 2026-04-08 Active Baseline

### Recent Commits (kept)
- `218f3ca` — `feat(backend): cut over lms/enrollments/enroll and unenroll to Supabase`
  - Added Supabase handlers for enroll/unenroll.
  - Added env-driven mutation source switch behavior.
  - Added follow-up read checks in workflow smoke.
- `949cd47` — `feat(backend): cut over lms/enrollments/complete to Supabase`
  - Completion status transition moved to Supabase.
  - Completion guard behavior preserved.
- `c54fbec` — `feat(backend): TNA mutation partial cutover`
  - Added first safe TNA mutation slice with fallback control.

### Verification Snapshot
- `qa:lms:workflow` -> pass in stabilized local run.
- `qa:contracts` -> pass (latest baseline).
- `qa:lms:cutover` -> must be rerun as release gate before LMS route enablement.

### Open Follow-up
- Complete remaining TNA mutation slices one at a time.
- Keep LMS/TNA frontend exposure gated by verified parity.
- Expand E2E coverage for LMS and TNA critical journeys.
- Keep rollback path ready via env source switches (`legacy|supabase|auto`).

### Rules for New Entries
- Add only migration-relevant commits.
- Remove obsolete “completed history” details after baseline is captured.
- Each new entry must include:
  - contract impact
  - smoke/test status
  - rollback note
  - next slice recommendation
