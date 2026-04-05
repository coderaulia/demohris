-- 0010_employees_status_column.sql
-- Adds operational status to employees for React shell management workflows.

alter table public.employees
    add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

create index if not exists idx_employees_status
    on public.employees (status);
