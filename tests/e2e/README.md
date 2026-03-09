# E2E Regression Tests

This folder contains Playwright smoke/regression tests for Sprint 6 hardening:

- KPI definition save flow
- KPI input flow
- Probation export action reachability (PDF/Excel)

## Run

```bash
npm run qa:e2e
```

## Required env vars

- `E2E_BASE_URL` (optional; defaults to `http://127.0.0.1:5173`)
- `E2E_MANAGER_EMAIL`
- `E2E_MANAGER_PASSWORD`

If credentials are missing, tests are skipped.
