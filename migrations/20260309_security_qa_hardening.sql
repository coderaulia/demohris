-- ==================================================
-- Sprint 6: Security + QA Hardening (RLS policy normalization)
-- Date: 2026-03-09
-- Safe: policy/function hardening only (no destructive data operations)
-- ==================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_hr_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.employee_id = auth_employee_id()
      AND (
        e.role = 'hr'
        OR lower(coalesce(e.department, '')) = 'hr'
        OR lower(coalesce(e.department, '')) LIKE '%human resource%'
        OR lower(coalesce(e.department, '')) LIKE '%human resources%'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_kpi_category(target_category TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    is_superadmin()
    OR is_hr_user()
    OR (
      is_manager()
      AND (
        COALESCE(NULLIF(target_category, ''), 'General') = 'General'
        OR EXISTS (
          SELECT 1
          FROM public.employees scoped
          WHERE scoped.role = 'employee'
            AND scoped.position = COALESCE(NULLIF(target_category, ''), 'General')
            AND (
              scoped.manager_id = auth_employee_id()
              OR (
                scoped.department <> ''
                AND scoped.department = auth_department()
              )
            )
        )
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_competency_position(target_position TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    is_superadmin()
    OR is_hr_user()
    OR (
      is_manager()
      AND EXISTS (
        SELECT 1
        FROM public.employees scoped
        WHERE scoped.role = 'employee'
          AND scoped.position = COALESCE(NULLIF(target_position, ''), '')
          AND (
            scoped.manager_id = auth_employee_id()
            OR (
              scoped.department <> ''
              AND scoped.department = auth_department()
            )
          )
      )
    )
  );
$$;

DO $$
BEGIN
  IF to_regclass('public.kpi_definitions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Manager manage kpi definitions" ON public.kpi_definitions';
    EXECUTE 'DROP POLICY IF EXISTS "Manage KPI definitions by category" ON public.kpi_definitions';

    EXECUTE 'CREATE POLICY "Manage KPI definitions by category" ON public.kpi_definitions FOR ALL TO authenticated USING (can_manage_kpi_category(category)) WITH CHECK (can_manage_kpi_category(category))';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.competency_config') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.competency_config ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Manager manage competency config" ON public.competency_config';
    EXECUTE 'DROP POLICY IF EXISTS "Manage competency config by position scope" ON public.competency_config';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'competency_config'
        AND policyname = 'Read competency config'
    ) THEN
      EXECUTE 'CREATE POLICY "Read competency config" ON public.competency_config FOR SELECT TO authenticated USING (true)';
    END IF;

    EXECUTE 'CREATE POLICY "Manage competency config by position scope" ON public.competency_config FOR ALL TO authenticated USING (can_manage_competency_position(position_name)) WITH CHECK (can_manage_competency_position(position_name))';
  END IF;
END $$;

COMMIT;
