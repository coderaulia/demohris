-- ==================================================
-- Sprint 6 post-deploy RLS verification (read-only)
-- ==================================================

-- 1) Confirm RLS enabled on critical tables
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'app_settings',
    'employees',
    'competency_config',
    'kpi_definitions',
    'kpi_records',
    'kpi_definition_versions',
    'employee_kpi_target_versions',
    'probation_reviews',
    'probation_monthly_scores',
    'probation_attendance_records',
    'pip_plans',
    'pip_actions'
  )
ORDER BY c.relname;

-- 2) Check active policies on key tables
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'app_settings',
    'employees',
    'competency_config',
    'kpi_definitions',
    'kpi_definition_versions',
    'employee_kpi_target_versions',
    'probation_monthly_scores',
    'probation_attendance_records'
  )
ORDER BY tablename, policyname;

-- 3) Forbidden broad manager policies should not exist
SELECT
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'kpi_definitions' AND policyname = 'Manager manage kpi definitions')
    OR
    (tablename = 'competency_config' AND policyname = 'Manager manage competency config')
  );

-- Expected result for query #3: 0 rows
