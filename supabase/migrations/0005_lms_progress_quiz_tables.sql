-- 0005_lms_progress_quiz_tables.sql
-- LMS progress, quiz, reviews, assignments, certificates.

create table if not exists public.quiz_questions (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    question_text text not null,
    question_type text not null default 'multiple_choice' check (question_type in ('multiple_choice', 'true_false', 'multiple_select', 'short_answer', 'matching')),
    options jsonb not null default '[]'::jsonb,
    correct_answer jsonb not null,
    points numeric(5,2) not null default 1.00,
    explanation text,
    ordinal integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lesson_progress (
    id uuid primary key default gen_random_uuid(),
    enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'failed')),
    progress_percent numeric(5,2) not null default 0,
    score numeric(5,2),
    time_spent_seconds integer not null default 0,
    first_accessed_at timestamptz,
    completed_at timestamptz,
    last_accessed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uk_lesson_progress_enrollment_lesson unique (enrollment_id, lesson_id)
);

create table if not exists public.quiz_attempts (
    id uuid primary key default gen_random_uuid(),
    enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    attempt_number integer not null,
    answers jsonb not null default '{}'::jsonb,
    score numeric(5,2),
    passed boolean not null default false,
    started_at timestamptz not null default timezone('utc', now()),
    submitted_at timestamptz,
    time_spent_seconds integer not null default 0
);

create table if not exists public.course_reviews (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    employee_id text not null references public.employees(employee_id) on delete cascade,
    rating integer not null check (rating between 1 and 5),
    review_text text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint uk_course_reviews_course_employee unique (course_id, employee_id)
);

create table if not exists public.course_assignments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    employee_id text not null references public.employees(employee_id) on delete cascade,
    assigned_by text references public.employees(employee_id) on delete set null,
    due_date date,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    notes text,
    status text not null default 'pending' check (status in ('pending', 'notified', 'acknowledged')),
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.course_certificates (
    id uuid primary key default gen_random_uuid(),
    enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
    employee_id text not null references public.employees(employee_id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    certificate_number text not null unique,
    issued_at timestamptz not null default timezone('utc', now()),
    valid_until date,
    certificate_url text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_quiz_questions_lesson on public.quiz_questions(lesson_id);
create index if not exists idx_lesson_progress_status on public.lesson_progress(status);
create index if not exists idx_quiz_attempts_enrollment on public.quiz_attempts(enrollment_id);
create index if not exists idx_quiz_attempts_lesson on public.quiz_attempts(lesson_id);
create index if not exists idx_course_reviews_course on public.course_reviews(course_id);
create index if not exists idx_course_reviews_rating on public.course_reviews(rating);
create index if not exists idx_course_assignments_employee on public.course_assignments(employee_id);
create index if not exists idx_course_assignments_course on public.course_assignments(course_id);
create index if not exists idx_course_assignments_due_date on public.course_assignments(due_date);
create index if not exists idx_course_certificates_employee on public.course_certificates(employee_id);
create index if not exists idx_course_certificates_course on public.course_certificates(course_id);
create index if not exists idx_course_certificates_number on public.course_certificates(certificate_number);

-- Keep updated_at aligned where present.
do $$
declare
    table_name text;
begin
    foreach table_name in array array['quiz_questions','lesson_progress','course_reviews']
    loop
        execute format('drop trigger if exists trg_%s_set_updated_at on public.%I', table_name, table_name);
        execute format('create trigger trg_%s_set_updated_at before update on public.%I for each row execute function public.set_row_updated_at()', table_name, table_name);
    end loop;
end
$$;
