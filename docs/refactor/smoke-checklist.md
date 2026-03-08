# Refactor Smoke Checklist

Use this checklist after module-splitting changes to verify no behavior regression.

## Build Gate

- Run `npm run build` and confirm success.
- Confirm no new runtime import errors in browser console.

## Core App Flow

1. Login as superadmin.
2. Open Dashboard, Employees, KPI, Records, Settings.
3. Confirm header/company branding still loads from settings.

## Data Flow Checks

1. Employees:
- Create/update an employee.
- Confirm assessment/training history persists.

2. KPI:
- Create/edit KPI definition.
- Insert KPI record and confirm weighted score updates.
- Delete KPI record and confirm score re-calculates.

3. Probation:
- Generate probation draft.
- Save monthly qualitative text.
- Save attendance entry and verify attitude deduction updates.
- Export probation report.

4. PIP:
- Create a PIP plan.
- Add action items and reload page to verify persistence.

## Role Checks

1. Manager account:
- Edit KPI/competency targets for direct reports only.
- Access records limited to team scope.

2. Employee account:
- No manager/superadmin admin panels visible.

## SQL Dependencies

- `public.probation_monthly_scores` exists.
- `public.probation_attendance_records` exists.
- RLS policies still allow expected reads/writes per role.

## Module Wiring Checks

- `records.js` exports resolve from `src/modules/records/*` feature entry points.
- `dashboard.js` exports resolve from `src/modules/dashboard/*` feature entry points.
- `uiContracts.js` imports are valid in both `records/core.js` and `dashboard/core.js`.
