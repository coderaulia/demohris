-- 0007_rls_baseline.sql
-- Baseline RLS policies for core + LMS/TNA tables used in this migration phase.

create or replace function public.current_employee_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        nullif((auth.jwt() -> 'user_metadata' ->> 'employee_id'), ''),
        (
            select e.employee_id
            from public.employees e
            where e.auth_id = auth.uid()
            limit 1
        ),
        (
            select e.employee_id
            from public.employees e
            where lower(coalesce(e.auth_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            limit 1
        )
    );
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select p.role::text from public.profiles p where p.id = auth.uid() limit 1),
        (select e.role::text from public.employees e where e.employee_id = public.current_employee_id() limit 1),
        'employee'
    );
$$;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_app_role() in ('manager', 'director', 'hr', 'superadmin');
$$;

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.module_settings enable row level security;
alter table public.module_activity_log enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.course_reviews enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_certificates enable row level security;
alter table public.training_courses enable row level security;
alter table public.training_needs enable row level security;
alter table public.training_need_records enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_plan_items enable row level security;
alter table public.training_enrollments enable row level security;

-- Profiles

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_select_admin
on public.profiles
for select
to authenticated
using (public.is_admin_role());

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

-- Employees

drop policy if exists employees_select_scope on public.employees;
drop policy if exists employees_update_admin on public.employees;
drop policy if exists employees_insert_admin on public.employees;

create policy employees_select_scope
on public.employees
for select
to authenticated
using (
    public.is_admin_role()
    or employee_id = public.current_employee_id()
    or manager_id = public.current_employee_id()
);

create policy employees_insert_admin
on public.employees
for insert
to authenticated
with check (public.current_app_role() in ('hr', 'superadmin'));

create policy employees_update_admin
on public.employees
for update
to authenticated
using (public.current_app_role() in ('hr', 'superadmin'))
with check (public.current_app_role() in ('hr', 'superadmin'));

-- Modules

drop policy if exists module_settings_select_auth on public.module_settings;
drop policy if exists module_settings_write_admin on public.module_settings;
drop policy if exists module_activity_select_scope on public.module_activity_log;
drop policy if exists module_activity_insert_admin on public.module_activity_log;

create policy module_settings_select_auth
on public.module_settings
for select
to authenticated
using (true);

create policy module_settings_write_admin
on public.module_settings
for all
to authenticated
using (public.current_app_role() in ('hr', 'superadmin'))
with check (public.current_app_role() in ('hr', 'superadmin'));

create policy module_activity_select_scope
on public.module_activity_log
for select
to authenticated
using (
    public.is_admin_role()
    or actor_employee_id = public.current_employee_id()
);

create policy module_activity_insert_admin
on public.module_activity_log
for insert
to authenticated
with check (public.current_app_role() in ('hr', 'superadmin'));

-- LMS read baseline

drop policy if exists courses_select_auth on public.courses;
drop policy if exists courses_write_admin on public.courses;
drop policy if exists course_sections_select_auth on public.course_sections;
drop policy if exists lessons_select_auth on public.lessons;
drop policy if exists course_enrollments_select_scope on public.course_enrollments;
drop policy if exists course_enrollments_write_admin on public.course_enrollments;
drop policy if exists lesson_progress_select_scope on public.lesson_progress;
drop policy if exists quiz_questions_select_auth on public.quiz_questions;
drop policy if exists quiz_attempts_select_scope on public.quiz_attempts;
drop policy if exists course_reviews_select_auth on public.course_reviews;
drop policy if exists course_reviews_write_scope on public.course_reviews;
drop policy if exists course_assignments_select_scope on public.course_assignments;
drop policy if exists course_assignments_write_admin on public.course_assignments;
drop policy if exists course_certificates_select_scope on public.course_certificates;

create policy courses_select_auth
on public.courses
for select
to authenticated
using (true);

create policy courses_write_admin
on public.courses
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy course_sections_select_auth
on public.course_sections
for select
to authenticated
using (true);

create policy lessons_select_auth
on public.lessons
for select
to authenticated
using (true);

create policy course_enrollments_select_scope
on public.course_enrollments
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());

create policy course_enrollments_write_admin
on public.course_enrollments
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy lesson_progress_select_scope
on public.lesson_progress
for select
to authenticated
using (
    exists (
        select 1
        from public.course_enrollments ce
        where ce.id = lesson_progress.enrollment_id
          and (public.is_admin_role() or ce.employee_id = public.current_employee_id())
    )
);

create policy quiz_questions_select_auth
on public.quiz_questions
for select
to authenticated
using (true);

create policy quiz_attempts_select_scope
on public.quiz_attempts
for select
to authenticated
using (
    exists (
        select 1
        from public.course_enrollments ce
        where ce.id = quiz_attempts.enrollment_id
          and (public.is_admin_role() or ce.employee_id = public.current_employee_id())
    )
);

create policy course_reviews_select_auth
on public.course_reviews
for select
to authenticated
using (true);

create policy course_reviews_write_scope
on public.course_reviews
for all
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id())
with check (public.is_admin_role() or employee_id = public.current_employee_id());

create policy course_assignments_select_scope
on public.course_assignments
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());

create policy course_assignments_write_admin
on public.course_assignments
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy course_certificates_select_scope
on public.course_certificates
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());

-- TNA read baseline

drop policy if exists training_courses_select_auth on public.training_courses;
drop policy if exists training_courses_write_admin on public.training_courses;
drop policy if exists training_needs_select_auth on public.training_needs;
drop policy if exists training_needs_write_admin on public.training_needs;
drop policy if exists training_need_records_select_scope on public.training_need_records;
drop policy if exists training_need_records_write_admin on public.training_need_records;
drop policy if exists training_plans_select_scope on public.training_plans;
drop policy if exists training_plans_write_admin on public.training_plans;
drop policy if exists training_plan_items_select_scope on public.training_plan_items;
drop policy if exists training_plan_items_write_admin on public.training_plan_items;
drop policy if exists training_enrollments_select_scope on public.training_enrollments;
drop policy if exists training_enrollments_write_admin on public.training_enrollments;

create policy training_courses_select_auth
on public.training_courses
for select
to authenticated
using (true);

create policy training_courses_write_admin
on public.training_courses
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy training_needs_select_auth
on public.training_needs
for select
to authenticated
using (public.is_admin_role());

create policy training_needs_write_admin
on public.training_needs
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy training_need_records_select_scope
on public.training_need_records
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());

create policy training_need_records_write_admin
on public.training_need_records
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy training_plans_select_scope
on public.training_plans
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());

create policy training_plans_write_admin
on public.training_plans
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy training_plan_items_select_scope
on public.training_plan_items
for select
to authenticated
using (
    exists (
        select 1
        from public.training_plans tp
        where tp.id = training_plan_items.plan_id
          and (public.is_admin_role() or tp.employee_id = public.current_employee_id())
    )
);

create policy training_plan_items_write_admin
on public.training_plan_items
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

create policy training_enrollments_select_scope
on public.training_enrollments
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());

create policy training_enrollments_write_admin
on public.training_enrollments
for all
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());
