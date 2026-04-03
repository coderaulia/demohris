-- 0004_lms_core_tables.sql
-- LMS core catalog and enrollment baseline.

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    short_description text,
    thumbnail_url text,
    category text not null default 'General',
    tags jsonb not null default '[]'::jsonb,
    difficulty_level text not null default 'beginner' check (difficulty_level in ('beginner', 'intermediate', 'advanced', 'expert')),
    estimated_duration_minutes integer not null default 0,
    author_employee_id text,
    status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
    is_mandatory boolean not null default false,
    prerequisites jsonb not null default '[]'::jsonb,
    competencies_covered jsonb not null default '[]'::jsonb,
    passing_score numeric(5,2) not null default 70.00,
    max_attempts integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    published_at timestamptz,
    constraint fk_courses_author_employee
        foreign key (author_employee_id)
        references public.employees(employee_id)
        on delete set null
);

create table if not exists public.course_sections (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text,
    ordinal integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lessons (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.course_sections(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text,
    content_type text not null default 'text' check (content_type in ('video', 'document', 'quiz', 'scorm', 'text', 'external', 'practice')),
    content_url text,
    content_text text,
    video_duration_seconds integer not null default 0,
    ordinal integer not null default 0,
    is_preview boolean not null default false,
    estimated_duration_minutes integer not null default 0,
    attachment_urls jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.course_enrollments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    employee_id text not null references public.employees(employee_id) on delete cascade,
    enrolled_by text references public.employees(employee_id) on delete set null,
    enrollment_type text not null default 'self' check (enrollment_type in ('self', 'assigned', 'required')),
    status text not null default 'enrolled' check (status in ('enrolled', 'in_progress', 'completed', 'failed', 'expired')),
    progress_percent numeric(5,2) not null default 0,
    score numeric(5,2),
    started_at timestamptz,
    completed_at timestamptz,
    due_date date,
    certificate_issued boolean not null default false,
    certificate_url text,
    time_spent_seconds integer not null default 0,
    attempts_count integer not null default 0,
    last_accessed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uk_course_enrollments_course_employee unique (course_id, employee_id)
);

create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_courses_category on public.courses(category);
create index if not exists idx_courses_author on public.courses(author_employee_id);
create index if not exists idx_courses_mandatory on public.courses(is_mandatory);
create index if not exists idx_course_sections_course on public.course_sections(course_id);
create index if not exists idx_lessons_section on public.lessons(section_id);
create index if not exists idx_lessons_course on public.lessons(course_id);
create index if not exists idx_lessons_type on public.lessons(content_type);
create index if not exists idx_course_enrollments_employee on public.course_enrollments(employee_id);
create index if not exists idx_course_enrollments_status on public.course_enrollments(status);
create index if not exists idx_course_enrollments_due_date on public.course_enrollments(due_date);

-- updated_at triggers
do $$
declare
    _table text;
begin
    foreach _table in array array['courses','course_sections','lessons','course_enrollments']
    loop
        execute format('drop trigger if exists trg_%s_set_updated_at on public.%I', _table, _table);
        execute format('create trigger trg_%s_set_updated_at before update on public.%I for each row execute function public.set_row_updated_at()', _table, _table);
    end loop;
end
$$;
