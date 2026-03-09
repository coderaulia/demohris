# Sprint 6: Security + QA Hardening

This sprint adds automated hardening checks for production safety:

- RLS policy audit by role scope (employee/manager/hr/superadmin)
- Migration safety checks
- Runtime negative-path RLS tests (optional, env-driven)
- E2E regression coverage for KPI + probation + export flows

## 1) Run Static Hardening Checks

```bash
npm run qa:hardening
```

This runs:

- `qa:migrations`: validates migration safety rules (transaction wrapper, no destructive SQL patterns)
- `qa:rls-audit`: validates final policy state from SQL assets and flags broad manager policies

## 2) Run Runtime Negative-Path RLS Checks (Optional)

```bash
npm run qa:negative
```

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TEST_EMPLOYEE_EMAIL`, `TEST_EMPLOYEE_PASSWORD`
- `TEST_MANAGER_EMAIL`, `TEST_MANAGER_PASSWORD`
- `TEST_HR_EMAIL`, `TEST_HR_PASSWORD`
- `TEST_SUPERADMIN_EMAIL`, `TEST_SUPERADMIN_PASSWORD`

The script verifies denied writes for non-authorized roles and basic success reads for superadmin.

## 3) Run E2E Regression (KPI + Probation + Export)

```bash
npm run qa:e2e
```

Required environment variables:

- `E2E_BASE_URL` (default: `http://127.0.0.1:5173`)
- `E2E_MANAGER_EMAIL`
- `E2E_MANAGER_PASSWORD`

The E2E suite checks:

- KPI definition save flow uses dropdown unit and does not surface schema/duplicate-key regressions
- KPI input flow submits without runtime crash
- Probation export actions are reachable (download or explicit dialog feedback)
- Dashboard KPI records sublabel renders

## 4) Database Post-Deploy RLS Verification

Run the SQL in [rls_postcheck.sql](/F:/Onedrive/Documents/TNA/docs/qa/rls_postcheck.sql) after applying migrations.

## 5) Hardening Migration Included

Apply:

- [20260309_security_qa_hardening.sql](/F:/Onedrive/Documents/TNA/migrations/20260309_security_qa_hardening.sql)

This migration removes broad manager policies and enforces scoped manager access for KPI definitions and competency config.
