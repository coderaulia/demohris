alter table public.positions
    add column if not exists description text,
    add column if not exists job_level text not null default '',
    add column if not exists grade_class text not null default '',
    add column if not exists reports_to_position text;

create index if not exists idx_positions_department_id on public.positions(department_id);
create index if not exists idx_positions_job_level on public.positions(job_level);
create index if not exists idx_positions_grade_class on public.positions(grade_class);

drop trigger if exists trg_org_settings_set_updated_at on public.org_settings;
create trigger trg_org_settings_set_updated_at
before update on public.org_settings
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_departments_set_updated_at on public.departments;
create trigger trg_departments_set_updated_at
before update on public.departments
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_positions_set_updated_at on public.positions;
create trigger trg_positions_set_updated_at
before update on public.positions
for each row
execute function public.set_row_updated_at();
