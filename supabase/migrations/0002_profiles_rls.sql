-- 0002_profiles_rls.sql
-- Minimal RLS foundation for profile access.

alter table public.profiles enable row level security;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
    select coalesce((auth.jwt() ->> 'role') in ('manager', 'hr', 'superadmin'), false);
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
using (public.is_admin_role());

