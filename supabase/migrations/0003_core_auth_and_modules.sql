-- 0003_core_auth_and_modules.sql
-- Core tables required for auth bridge, app boot, and module toggles.

create extension if not exists pgcrypto;

-- Existing enum from 0001 may not include director yet.
do $$
begin
    alter type public.app_role add value if not exists 'director';
exception
    when duplicate_object then null;
end
$$;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.app_settings (
    key text primary key,
    value text not null default '',
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employees (
    employee_id text primary key,
    name text not null,
    position text not null default '',
    seniority text not null default '',
    join_date date,
    department text not null default '',
    manager_id text null references public.employees(employee_id) on delete set null,
    email text,
    auth_email text,
    auth_id uuid,
    password_hash text,
    password_reset_requested_at timestamptz,
    role public.app_role not null default 'employee',
    percentage numeric(7,2) not null default 0,
    scores jsonb not null default '[]'::jsonb,
    self_scores jsonb not null default '[]'::jsonb,
    self_percentage numeric(7,2) not null default 0,
    self_date text default '',
    history jsonb not null default '[]'::jsonb,
    training_history jsonb not null default '[]'::jsonb,
    date_created text not null default '-',
    date_updated text not null default '-',
    date_next text not null default '-',
    tenure_display text not null default '',
    kpi_targets jsonb not null default '{}'::jsonb,
    must_change_password boolean not null default false,
    assessment_updated_by text,
    assessment_updated_at timestamptz,
    self_assessment_updated_by text,
    self_assessment_updated_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uq_employees_auth_email unique (auth_email),
    constraint uq_employees_auth_id unique (auth_id)
);

-- Link to auth.users if present. Wrapped to avoid hard failures if existing incompatible FK state.
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_employees_auth_id_auth_users'
    ) then
        alter table public.employees
            add constraint fk_employees_auth_id_auth_users
            foreign key (auth_id)
            references auth.users(id)
            on delete set null;
    end if;
exception
    when others then
        null;
end
$$;

create table if not exists public.competency_config (
    position_name text primary key,
    competencies jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.module_settings (
    id bigint generated always as identity primary key,
    module_id text not null unique,
    module_name text not null,
    description text,
    category text not null default 'core' check (category in ('core', 'performance', 'talent', 'operations', 'analytics')),
    status text not null default 'inactive' check (status in ('active', 'inactive', 'coming_soon', 'deprecated')),
    is_enabled boolean not null default false,
    settings jsonb not null default '{}'::jsonb,
    version text not null default '1.0.0',
    dependencies jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    created_by text
);

create table if not exists public.module_activity_log (
    id bigint generated always as identity primary key,
    module_id text not null,
    action text not null check (action in ('enabled', 'disabled', 'configured', 'viewed')),
    actor_employee_id text,
    actor_role text,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_module_activity_log_module_id'
    ) then
        alter table public.module_activity_log
            add constraint fk_module_activity_log_module_id
            foreign key (module_id)
            references public.module_settings(module_id)
            on delete cascade;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_module_activity_log_actor_employee'
    ) then
        alter table public.module_activity_log
            add constraint fk_module_activity_log_actor_employee
            foreign key (actor_employee_id)
            references public.employees(employee_id)
            on delete set null;
    end if;
exception
    when others then
        null;
end
$$;

create index if not exists idx_employees_department on public.employees(department);
create index if not exists idx_employees_manager_id on public.employees(manager_id);
create index if not exists idx_employees_role on public.employees(role);
create index if not exists idx_employees_auth_email_lower on public.employees(lower(auth_email));
create index if not exists idx_module_settings_category on public.module_settings(category);
create index if not exists idx_module_settings_status on public.module_settings(status);
create index if not exists idx_module_settings_enabled on public.module_settings(is_enabled);
create index if not exists idx_module_activity_module_id on public.module_activity_log(module_id);
create index if not exists idx_module_activity_actor_employee on public.module_activity_log(actor_employee_id);
create index if not exists idx_module_activity_created_at on public.module_activity_log(created_at desc);

-- Keep updated_at aligned for mutable tables.
drop trigger if exists trg_app_settings_set_updated_at on public.app_settings;
create trigger trg_app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_employees_set_updated_at on public.employees;
create trigger trg_employees_set_updated_at
before update on public.employees
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_competency_config_set_updated_at on public.competency_config;
create trigger trg_competency_config_set_updated_at
before update on public.competency_config
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_module_settings_set_updated_at on public.module_settings;
create trigger trg_module_settings_set_updated_at
before update on public.module_settings
for each row
execute function public.set_row_updated_at();
