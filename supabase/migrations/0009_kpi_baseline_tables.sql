-- 0009_kpi_baseline_tables.sql
-- KPI, probation, and PIP baseline schema required by current runtime table registry.

create table if not exists public.kpi_definitions (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    category text not null default 'General',
    target numeric(12,2) not null default 0,
    unit text not null default '',
    effective_period text not null default '2026-01',
    approval_status text not null default 'approved' check (approval_status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
    approval_required boolean not null default false,
    is_active boolean not null default true,
    latest_version_no integer not null default 0,
    approved_by text,
    approved_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.kpi_definition_versions (
    id uuid primary key default gen_random_uuid(),
    kpi_definition_id uuid not null references public.kpi_definitions(id) on delete cascade,
    version_no integer not null,
    effective_period text not null,
    name text not null,
    description text,
    category text not null default 'General',
    target numeric(12,2) not null default 0,
    unit text not null default '',
    status text not null default 'approved' check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
    request_note text,
    requested_by text,
    requested_at timestamptz not null default timezone('utc', now()),
    approved_by text,
    approved_at timestamptz,
    rejected_by text,
    rejected_at timestamptz,
    rejection_reason text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_kpi_definition_versions unique (kpi_definition_id, version_no)
);

create table if not exists public.employee_kpi_target_versions (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    kpi_id uuid not null references public.kpi_definitions(id) on delete cascade,
    effective_period text not null,
    version_no integer not null default 1,
    target_value numeric(12,2),
    unit text not null default '',
    status text not null default 'approved' check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
    request_note text,
    requested_by text,
    requested_at timestamptz not null default timezone('utc', now()),
    approved_by text,
    approved_at timestamptz,
    rejected_by text,
    rejected_at timestamptz,
    rejection_reason text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_employee_kpi_target_versions unique (employee_id, kpi_id, effective_period, version_no)
);

create table if not exists public.kpi_records (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    kpi_id uuid not null references public.kpi_definitions(id) on delete cascade,
    period text not null,
    value numeric(12,2) not null default 0,
    notes text,
    submitted_by text,
    submitted_at timestamptz not null default timezone('utc', now()),
    updated_by text,
    target_snapshot numeric(12,2),
    kpi_name_snapshot text,
    kpi_unit_snapshot text,
    kpi_category_snapshot text,
    definition_version_id uuid references public.kpi_definition_versions(id) on delete set null,
    target_version_id uuid references public.employee_kpi_target_versions(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_activity_log (
    id bigint generated always as identity primary key,
    actor_employee_id text references public.employees(employee_id) on delete set null,
    actor_role text,
    action text not null,
    entity_type text not null default 'general',
    entity_id text,
    details jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_assessments (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    assessment_type text not null check (assessment_type in ('manager', 'self')),
    percentage numeric(7,2) not null default 0,
    seniority text not null default '',
    assessed_at timestamptz,
    assessed_by text,
    source_date text not null default '-',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_employee_assessments unique (employee_id, assessment_type)
);

create table if not exists public.employee_assessment_scores (
    id uuid primary key default gen_random_uuid(),
    assessment_id uuid not null references public.employee_assessments(id) on delete cascade,
    competency_name text not null,
    score numeric(7,2) not null default 0,
    note text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_employee_assessment_scores unique (assessment_id, competency_name)
);

create table if not exists public.employee_assessment_history (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    assessment_type text not null default 'manager',
    assessed_on text not null default '-',
    percentage numeric(7,2) not null default 0,
    seniority text not null default '',
    position text not null default '',
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_training_records (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    course text not null,
    start_date text,
    end_date text,
    provider text,
    status text not null default 'ongoing',
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employee_performance_scores (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    period text not null,
    score_type text not null default 'kpi_weighted',
    total_score numeric(12,2) not null default 0,
    detail jsonb,
    calculated_by text,
    calculated_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_employee_performance_scores unique (employee_id, period, score_type)
);

create table if not exists public.kpi_weight_profiles (
    id uuid primary key default gen_random_uuid(),
    profile_name text not null,
    department text not null default '',
    position text not null default '',
    active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_kpi_weight_profiles unique (profile_name, department, position)
);

create table if not exists public.kpi_weight_items (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.kpi_weight_profiles(id) on delete cascade,
    kpi_id uuid not null references public.kpi_definitions(id) on delete cascade,
    weight_pct numeric(7,2) not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_kpi_weight_items unique (profile_id, kpi_id)
);

create table if not exists public.probation_reviews (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    review_period_start date,
    review_period_end date,
    quantitative_score numeric(7,2) not null default 0,
    qualitative_score numeric(7,2) not null default 0,
    final_score numeric(7,2) not null default 0,
    decision text not null default 'pending' check (decision in ('pending', 'pass', 'extend', 'fail')),
    manager_notes text,
    reviewed_by text,
    reviewed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.probation_qualitative_items (
    id uuid primary key default gen_random_uuid(),
    probation_review_id uuid not null references public.probation_reviews(id) on delete cascade,
    item_name text not null,
    score numeric(7,2) not null default 0,
    note text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_probation_qualitative_items unique (probation_review_id, item_name)
);

create table if not exists public.probation_monthly_scores (
    id uuid primary key default gen_random_uuid(),
    probation_review_id uuid not null references public.probation_reviews(id) on delete cascade,
    month_no integer not null,
    period_start date not null,
    period_end date not null,
    work_performance_score numeric(7,2) not null default 0,
    managing_task_score numeric(7,2) not null default 0,
    manager_qualitative_text text,
    manager_note text,
    attendance_deduction numeric(7,2) not null default 0,
    attitude_score numeric(7,2) not null default 20,
    monthly_total numeric(7,2) not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_probation_monthly_scores unique (probation_review_id, month_no)
);

create table if not exists public.probation_attendance_records (
    id uuid primary key default gen_random_uuid(),
    probation_review_id uuid not null references public.probation_reviews(id) on delete cascade,
    month_no integer not null,
    event_date date,
    event_type text not null default 'attendance',
    qty numeric(7,2) not null default 1,
    deduction_points numeric(7,2) not null default 0,
    note text,
    entered_by text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pip_plans (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    trigger_reason text,
    trigger_period text,
    start_date date,
    target_end_date date,
    status text not null default 'active' check (status in ('draft', 'active', 'completed', 'cancelled')),
    owner_manager_id text references public.employees(employee_id) on delete set null,
    summary text,
    closed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pip_actions (
    id uuid primary key default gen_random_uuid(),
    pip_plan_id uuid not null references public.pip_plans(id) on delete cascade,
    action_title text not null,
    action_detail text,
    due_date date,
    progress_pct numeric(7,2) not null default 0,
    status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
    checkpoint_note text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_kpi_definitions_category on public.kpi_definitions(category);
create index if not exists idx_kpi_definitions_effective_period on public.kpi_definitions(effective_period);
create index if not exists idx_kpi_definition_versions_status on public.kpi_definition_versions(status, requested_at desc);
create index if not exists idx_employee_kpi_target_versions_status on public.employee_kpi_target_versions(status, requested_at desc);
create index if not exists idx_kpi_records_employee_period on public.kpi_records(employee_id, period);
create index if not exists idx_kpi_records_kpi on public.kpi_records(kpi_id);
create index if not exists idx_admin_activity_log_created_at on public.admin_activity_log(created_at desc);
create index if not exists idx_admin_activity_log_actor on public.admin_activity_log(actor_employee_id);
create index if not exists idx_employee_assessment_history_employee on public.employee_assessment_history(employee_id);
create index if not exists idx_employee_training_records_employee on public.employee_training_records(employee_id);
create index if not exists idx_probation_reviews_employee on public.probation_reviews(employee_id);
create index if not exists idx_probation_attendance_review_month on public.probation_attendance_records(probation_review_id, month_no);
create index if not exists idx_pip_plans_employee_status on public.pip_plans(employee_id, status);
create index if not exists idx_pip_actions_plan_status on public.pip_actions(pip_plan_id, status);

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'kpi_definitions',
        'kpi_definition_versions',
        'employee_kpi_target_versions',
        'kpi_records',
        'employee_assessments',
        'employee_assessment_scores',
        'employee_training_records',
        'employee_performance_scores',
        'kpi_weight_profiles',
        'kpi_weight_items',
        'probation_reviews',
        'probation_qualitative_items',
        'probation_monthly_scores',
        'probation_attendance_records',
        'pip_plans',
        'pip_actions'
    ]
    loop
        execute format('drop trigger if exists trg_%s_set_updated_at on public.%I', table_name, table_name);
        execute format('create trigger trg_%s_set_updated_at before update on public.%I for each row execute function public.set_row_updated_at()', table_name, table_name);
    end loop;
end
$$;

-- RLS baseline for KPI/probation/PIP tables
alter table public.kpi_definitions enable row level security;
alter table public.kpi_definition_versions enable row level security;
alter table public.employee_kpi_target_versions enable row level security;
alter table public.kpi_records enable row level security;
alter table public.admin_activity_log enable row level security;
alter table public.employee_assessments enable row level security;
alter table public.employee_assessment_scores enable row level security;
alter table public.employee_assessment_history enable row level security;
alter table public.employee_training_records enable row level security;
alter table public.employee_performance_scores enable row level security;
alter table public.kpi_weight_profiles enable row level security;
alter table public.kpi_weight_items enable row level security;
alter table public.probation_reviews enable row level security;
alter table public.probation_qualitative_items enable row level security;
alter table public.probation_monthly_scores enable row level security;
alter table public.probation_attendance_records enable row level security;
alter table public.pip_plans enable row level security;
alter table public.pip_actions enable row level security;

drop policy if exists kpi_definitions_select_auth on public.kpi_definitions;
drop policy if exists kpi_definitions_write_admin on public.kpi_definitions;
create policy kpi_definitions_select_auth
on public.kpi_definitions
for select
to authenticated
using (true);
create policy kpi_definitions_write_admin
on public.kpi_definitions
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists kpi_definition_versions_select_auth on public.kpi_definition_versions;
drop policy if exists kpi_definition_versions_write_admin on public.kpi_definition_versions;
create policy kpi_definition_versions_select_auth
on public.kpi_definition_versions
for select
to authenticated
using (true);
create policy kpi_definition_versions_write_admin
on public.kpi_definition_versions
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists kpi_weight_profiles_select_auth on public.kpi_weight_profiles;
drop policy if exists kpi_weight_profiles_write_admin on public.kpi_weight_profiles;
drop policy if exists kpi_weight_items_select_auth on public.kpi_weight_items;
drop policy if exists kpi_weight_items_write_admin on public.kpi_weight_items;
create policy kpi_weight_profiles_select_auth
on public.kpi_weight_profiles
for select
to authenticated
using (true);
create policy kpi_weight_profiles_write_admin
on public.kpi_weight_profiles
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'hr'))
with check (public.current_app_role() in ('superadmin', 'hr'));
create policy kpi_weight_items_select_auth
on public.kpi_weight_items
for select
to authenticated
using (true);
create policy kpi_weight_items_write_admin
on public.kpi_weight_items
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'hr'))
with check (public.current_app_role() in ('superadmin', 'hr'));

drop policy if exists employee_kpi_target_versions_select_scope on public.employee_kpi_target_versions;
drop policy if exists employee_kpi_target_versions_write_scope on public.employee_kpi_target_versions;
create policy employee_kpi_target_versions_select_scope
on public.employee_kpi_target_versions
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy employee_kpi_target_versions_write_scope
on public.employee_kpi_target_versions
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id())
with check (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id());

drop policy if exists kpi_records_select_scope on public.kpi_records;
drop policy if exists kpi_records_write_scope on public.kpi_records;
create policy kpi_records_select_scope
on public.kpi_records
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy kpi_records_write_scope
on public.kpi_records
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id())
with check (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id());

drop policy if exists admin_activity_log_select_scope on public.admin_activity_log;
drop policy if exists admin_activity_log_insert_scope on public.admin_activity_log;
create policy admin_activity_log_select_scope
on public.admin_activity_log
for select
to authenticated
using (public.is_admin_role() or actor_employee_id = public.current_employee_id());
create policy admin_activity_log_insert_scope
on public.admin_activity_log
for insert
to authenticated
with check (public.is_admin_role() or actor_employee_id = public.current_employee_id());

drop policy if exists employee_assessments_select_scope on public.employee_assessments;
drop policy if exists employee_assessments_write_scope on public.employee_assessments;
create policy employee_assessments_select_scope
on public.employee_assessments
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy employee_assessments_write_scope
on public.employee_assessments
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id())
with check (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id());

drop policy if exists employee_assessment_scores_select_scope on public.employee_assessment_scores;
drop policy if exists employee_assessment_scores_write_scope on public.employee_assessment_scores;
create policy employee_assessment_scores_select_scope
on public.employee_assessment_scores
for select
to authenticated
using (
    exists (
        select 1
        from public.employee_assessments ea
        where ea.id = employee_assessment_scores.assessment_id
          and (public.is_admin_role() or ea.employee_id = public.current_employee_id())
    )
);
create policy employee_assessment_scores_write_scope
on public.employee_assessment_scores
for all
to authenticated
using (
    exists (
        select 1
        from public.employee_assessments ea
        where ea.id = employee_assessment_scores.assessment_id
          and (public.current_app_role() in ('superadmin', 'manager', 'hr') or ea.employee_id = public.current_employee_id())
    )
)
with check (
    exists (
        select 1
        from public.employee_assessments ea
        where ea.id = employee_assessment_scores.assessment_id
          and (public.current_app_role() in ('superadmin', 'manager', 'hr') or ea.employee_id = public.current_employee_id())
    )
);

drop policy if exists employee_assessment_history_select_scope on public.employee_assessment_history;
drop policy if exists employee_assessment_history_write_scope on public.employee_assessment_history;
create policy employee_assessment_history_select_scope
on public.employee_assessment_history
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy employee_assessment_history_write_scope
on public.employee_assessment_history
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id())
with check (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id());

drop policy if exists employee_training_records_select_scope on public.employee_training_records;
drop policy if exists employee_training_records_write_scope on public.employee_training_records;
create policy employee_training_records_select_scope
on public.employee_training_records
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy employee_training_records_write_scope
on public.employee_training_records
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id())
with check (public.current_app_role() in ('superadmin', 'manager', 'hr') or employee_id = public.current_employee_id());

drop policy if exists employee_performance_scores_select_scope on public.employee_performance_scores;
drop policy if exists employee_performance_scores_write_admin on public.employee_performance_scores;
create policy employee_performance_scores_select_scope
on public.employee_performance_scores
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy employee_performance_scores_write_admin
on public.employee_performance_scores
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists probation_reviews_select_scope on public.probation_reviews;
drop policy if exists probation_reviews_write_admin on public.probation_reviews;
create policy probation_reviews_select_scope
on public.probation_reviews
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy probation_reviews_write_admin
on public.probation_reviews
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists probation_qualitative_items_select_scope on public.probation_qualitative_items;
drop policy if exists probation_qualitative_items_write_admin on public.probation_qualitative_items;
create policy probation_qualitative_items_select_scope
on public.probation_qualitative_items
for select
to authenticated
using (
    exists (
        select 1
        from public.probation_reviews pr
        where pr.id = probation_qualitative_items.probation_review_id
          and (public.is_admin_role() or pr.employee_id = public.current_employee_id())
    )
);
create policy probation_qualitative_items_write_admin
on public.probation_qualitative_items
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists probation_monthly_scores_select_scope on public.probation_monthly_scores;
drop policy if exists probation_monthly_scores_write_admin on public.probation_monthly_scores;
create policy probation_monthly_scores_select_scope
on public.probation_monthly_scores
for select
to authenticated
using (
    exists (
        select 1
        from public.probation_reviews pr
        where pr.id = probation_monthly_scores.probation_review_id
          and (public.is_admin_role() or pr.employee_id = public.current_employee_id())
    )
);
create policy probation_monthly_scores_write_admin
on public.probation_monthly_scores
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists probation_attendance_records_select_scope on public.probation_attendance_records;
drop policy if exists probation_attendance_records_write_admin on public.probation_attendance_records;
create policy probation_attendance_records_select_scope
on public.probation_attendance_records
for select
to authenticated
using (
    exists (
        select 1
        from public.probation_reviews pr
        where pr.id = probation_attendance_records.probation_review_id
          and (public.is_admin_role() or pr.employee_id = public.current_employee_id())
    )
);
create policy probation_attendance_records_write_admin
on public.probation_attendance_records
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists pip_plans_select_scope on public.pip_plans;
drop policy if exists pip_plans_write_admin on public.pip_plans;
create policy pip_plans_select_scope
on public.pip_plans
for select
to authenticated
using (public.is_admin_role() or employee_id = public.current_employee_id());
create policy pip_plans_write_admin
on public.pip_plans
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));

drop policy if exists pip_actions_select_scope on public.pip_actions;
drop policy if exists pip_actions_write_admin on public.pip_actions;
create policy pip_actions_select_scope
on public.pip_actions
for select
to authenticated
using (
    exists (
        select 1
        from public.pip_plans pp
        where pp.id = pip_actions.pip_plan_id
          and (public.is_admin_role() or pp.employee_id = public.current_employee_id())
    )
);
create policy pip_actions_write_admin
on public.pip_actions
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'manager', 'hr'))
with check (public.current_app_role() in ('superadmin', 'manager', 'hr'));
