-- 0001_profiles_auth.sql
-- Foundation for Supabase Auth role resolution in demo-kpi migration.

create type if not exists public.app_role as enum ('employee', 'manager', 'hr', 'superadmin');

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    role public.app_role not null default 'employee',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profile_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    default_role public.app_role;
begin
    default_role := coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'employee');

    insert into public.profiles (id, email, role, metadata)
    values (
        new.id,
        coalesce(new.email, ''),
        default_role,
        coalesce(new.raw_user_meta_data, '{}'::jsonb)
    )
    on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        metadata = excluded.metadata;

    return new;
exception
    when invalid_text_representation then
        insert into public.profiles (id, email, role, metadata)
        values (
            new.id,
            coalesce(new.email, ''),
            'employee',
            coalesce(new.raw_user_meta_data, '{}'::jsonb)
        )
        on conflict (id) do update
        set email = excluded.email,
            role = excluded.role,
            metadata = excluded.metadata;
        return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

