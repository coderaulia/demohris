# E2E Regression Tests

This folder contains Playwright smoke/regression tests for Phase A/B hardening:

- **Management Workflows**: Employee creation, KPI definition, and KPI achievement input (hr/superadmin).
- **KPI Dashboards**: Manager drill-down and department summary views.
- **Probation**: Export action reachability (PDF/Excel).

## Run

```bash
npm run qa:e2e
```

## Required credentials
Tests use `tests/e2e/helpers/auth.ts` to provision state. Ensure one of the following is available or already cached in `.auth/`:
- `hr`: `E2E_HR_EMAIL` / `E2E_HR_PASSWORD`
- `manager`: `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD`
- `employee`: `E2E_EMPLOYEE_EMAIL` / `E2E_EMPLOYEE_PASSWORD`

If specific credentials for a role are missing, the corresponding suite will skip.
