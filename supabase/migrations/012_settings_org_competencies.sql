create extension if not exists pgcrypto;

create table if not exists public.org_settings (
    id text primary key default 'default',
    seniority_levels jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.positions (
    id uuid primary key default gen_random_uuid(),
    department_id uuid references public.departments(id) on delete cascade,
    name text not null unique,
    competencies jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.org_settings (id, seniority_levels)
values ('default', '[]'::jsonb)
on conflict (id) do nothing;
