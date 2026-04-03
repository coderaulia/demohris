-- 0006_tna_baseline_tables.sql
-- Training Needs Analysis baseline schema.

create table if not exists public.training_courses (
    id uuid primary key default gen_random_uuid(),
    course_name text not null,
    description text,
    provider text,
    duration_hours integer not null default 0,
    cost numeric(12,2) not null default 0,
    competencies_covered jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.training_needs (
    id uuid primary key default gen_random_uuid(),
    position_name text not null,
    competency_name text not null,
    required_level integer not null default 3,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_training_needs_position_competency unique (position_name, competency_name)
);

create table if not exists public.training_need_records (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    training_need_id uuid not null references public.training_needs(id) on delete cascade,
    current_level numeric(5,2) not null,
    gap_level numeric(5,2) not null,
    gap_score numeric(5,2),
    competency text,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
    status text not null default 'identified' check (status in ('identified', 'planned', 'in_progress', 'completed', 'cancelled')),
    identified_by text,
    identified_at timestamptz not null default timezone('utc', now()),
    planned_training_id uuid references public.training_courses(id) on delete set null,
    completed_at timestamptz,
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_training_need_records_employee_need unique (employee_id, training_need_id)
);

create table if not exists public.training_plans (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    plan_name text not null,
    period text not null,
    status text not null default 'draft' check (status in ('draft', 'approved', 'in_progress', 'completed', 'cancelled')),
    total_cost numeric(12,2) not null default 0,
    approved_by text,
    approved_at timestamptz,
    created_by text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_training_plans_employee_period_name unique (employee_id, period, plan_name)
);

create table if not exists public.training_plan_items (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.training_plans(id) on delete cascade,
    training_need_record_id uuid references public.training_need_records(id) on delete set null,
    course_id uuid references public.training_courses(id) on delete set null,
    training_course text not null,
    training_provider text,
    start_date date,
    end_date date,
    cost numeric(12,2) not null default 0,
    status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
    completion_evidence text,
    completion_date date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_training_plan_items_plan_course unique (plan_id, training_course)
);

create table if not exists public.training_enrollments (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null references public.employees(employee_id) on delete cascade,
    course_id uuid not null references public.training_courses(id) on delete cascade,
    enrollment_date date not null,
    status text not null default 'enrolled' check (status in ('enrolled', 'in_progress', 'completed', 'cancelled')),
    completion_date date,
    score numeric(5,2),
    certificate_url text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_training_enrollments_employee_course unique (employee_id, course_id)
);

create index if not exists idx_training_courses_active on public.training_courses(is_active);
create index if not exists idx_training_courses_name on public.training_courses(course_name);
create index if not exists idx_training_need_records_employee on public.training_need_records(employee_id);
create index if not exists idx_training_need_records_priority on public.training_need_records(priority);
create index if not exists idx_training_need_records_status on public.training_need_records(status);
create index if not exists idx_training_plans_employee on public.training_plans(employee_id);
create index if not exists idx_training_plans_status on public.training_plans(status);
create index if not exists idx_training_plan_items_plan on public.training_plan_items(plan_id);
create index if not exists idx_training_enrollments_employee on public.training_enrollments(employee_id);
create index if not exists idx_training_enrollments_status on public.training_enrollments(status);

-- Keep updated_at aligned.
do $$
declare
    table_name text;
begin
    foreach table_name in array array['training_courses','training_needs','training_need_records','training_plans','training_plan_items','training_enrollments']
    loop
        execute format('drop trigger if exists trg_%s_set_updated_at on public.%I', table_name, table_name);
        execute format('create trigger trg_%s_set_updated_at before update on public.%I for each row execute function public.set_row_updated_at()', table_name, table_name);
    end loop;
end
$$;
