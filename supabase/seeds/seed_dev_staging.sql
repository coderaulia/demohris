-- seed_dev_staging.sql
-- Deterministic non-production seed baseline for Supabase dev/staging.

begin;

insert into public.app_settings (key, value)
values
    ('app_name', 'HR Performance Suite'),
    ('company_name', 'Xenos Demo Group'),
    ('company_short', 'XDG'),
    ('assessment_threshold', '7'),
    ('departments', 'Executive, Human Resources, Sales, Marketing, Operations')
on conflict (key) do update
set value = excluded.value,
    updated_at = timezone('utc', now());

insert into public.module_settings (module_id, module_name, description, category, status, is_enabled, settings, dependencies, created_by)
values
    ('CORE', 'Core HR', 'Employee management', 'core', 'active', true, '{}'::jsonb, '[]'::jsonb, 'seed'),
    ('KPI', 'KPI Management', 'KPI tracking', 'performance', 'active', true, '{}'::jsonb, '["CORE"]'::jsonb, 'seed'),
    ('PROBATION', 'Probation', 'Probation workflow', 'performance', 'active', true, '{}'::jsonb, '["KPI"]'::jsonb, 'seed'),
    ('PIP', 'PIP', 'Improvement plans', 'performance', 'active', true, '{}'::jsonb, '["KPI"]'::jsonb, 'seed'),
    ('TNA', 'Training Needs Analysis', 'Gap analysis', 'talent', 'active', true, '{}'::jsonb, '["CORE"]'::jsonb, 'seed'),
    ('LMS', 'Learning Management', 'Courses and progress', 'talent', 'active', true, '{}'::jsonb, '["TNA"]'::jsonb, 'seed')
on conflict (module_id) do update
set module_name = excluded.module_name,
    description = excluded.description,
    category = excluded.category,
    status = excluded.status,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    dependencies = excluded.dependencies,
    updated_at = timezone('utc', now());

insert into public.employees (
    employee_id, name, position, seniority, join_date, department, manager_id,
    email, auth_email, role, password_hash, scores, self_scores, history, training_history, kpi_targets
)
values
    ('ADM001', 'Aulia Pratama', 'Chief Executive Officer', 'Director', '2023-01-03', 'Executive', null, 'admin.demo@xenos.local', 'admin.demo@xenos.local', 'superadmin', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
    ('HR001', 'Maya Suryani', 'HR Business Partner', 'Manager', '2024-02-12', 'Human Resources', 'ADM001', 'hr.demo@xenos.local', 'hr.demo@xenos.local', 'hr', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
    ('DIR001', 'Raka Permana', 'Commercial Director', 'Director', '2023-05-16', 'Executive', 'ADM001', 'director.demo@xenos.local', 'director.demo@xenos.local', 'director', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
    ('MGR001', 'Sinta Wibowo', 'Regional Sales Manager', 'Manager', '2024-01-08', 'Sales', 'DIR001', 'manager.demo@xenos.local', 'manager.demo@xenos.local', 'manager', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
    ('EMP001', 'Farhan Akbar', 'Sales Executive', 'Senior', '2024-07-01', 'Sales', 'MGR001', 'farhan.demo@xenos.local', 'farhan.demo@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[{"q":"Pipeline Management","s":9}]'::jsonb, '[{"q":"Pipeline Management","s":8}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"default":{"11111111-1111-4111-8111-111111111111":100}}'::jsonb),
    ('EMP002', 'Nadia Lestari', 'Sales Executive', 'Intermediate', '2025-02-17', 'Sales', 'MGR001', 'nadia.demo@xenos.local', 'nadia.demo@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[{"q":"Pipeline Management","s":7}]'::jsonb, '[{"q":"Pipeline Management","s":7}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"default":{"11111111-1111-4111-8111-111111111111":120}}'::jsonb),
    ('EMP003', 'Kevin Mahendra', 'Marketing Specialist', 'Junior', '2026-01-06', 'Marketing', 'MGR001', 'kevin.demo@xenos.local', 'kevin.demo@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', '[{"q":"Campaign Planning","s":7}]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"default":{"33333333-3333-4333-8333-333333333333":4.5}}'::jsonb)
on conflict (employee_id) do update
set name = excluded.name,
    position = excluded.position,
    seniority = excluded.seniority,
    join_date = excluded.join_date,
    department = excluded.department,
    manager_id = excluded.manager_id,
    email = excluded.email,
    auth_email = excluded.auth_email,
    role = excluded.role,
    password_hash = excluded.password_hash,
    scores = excluded.scores,
    self_scores = excluded.self_scores,
    history = excluded.history,
    training_history = excluded.training_history,
    kpi_targets = excluded.kpi_targets,
    updated_at = timezone('utc', now());

insert into public.profiles (id, email, role, metadata)
select
    au.id,
    lower(au.email),
    e.role::public.app_role,
    jsonb_build_object('employee_id', e.employee_id, 'source', 'seed_dev_staging')
from auth.users au
join public.employees e on lower(e.auth_email) = lower(au.email)
where au.email is not null
on conflict (id) do update
set email = excluded.email,
    role = excluded.role,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now());

insert into public.competency_config (position_name, competencies)
values
    ('Sales Executive', '[{"name":"Pipeline Management","rec":"Sales Cadence Bootcamp"},{"name":"Client Negotiation","rec":"Advanced Negotiation Lab"}]'::jsonb),
    ('Marketing Specialist', '[{"name":"Campaign Planning","rec":"Integrated Campaign Design"},{"name":"Performance Reporting","rec":"GA4 Essentials"}]'::jsonb)
on conflict (position_name) do update
set competencies = excluded.competencies,
    updated_at = timezone('utc', now());

insert into public.courses (id, title, description, category, difficulty_level, estimated_duration_minutes, author_employee_id, status, competencies_covered, passing_score, published_at)
values
    ('a1000000-0000-4000-8000-000000000001', 'Sales Fundamentals', 'Sales pipeline and negotiation fundamentals.', 'Sales', 'beginner', 90, 'MGR001', 'published', '["Pipeline Management","Client Negotiation"]'::jsonb, 70, timezone('utc', now())),
    ('a1000000-0000-4000-8000-000000000002', 'Leadership Essentials', 'Leadership fundamentals for managers.', 'Leadership', 'intermediate', 120, 'DIR001', 'published', '["Coaching"]'::jsonb, 75, timezone('utc', now()))
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    difficulty_level = excluded.difficulty_level,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    author_employee_id = excluded.author_employee_id,
    status = excluded.status,
    competencies_covered = excluded.competencies_covered,
    passing_score = excluded.passing_score,
    published_at = excluded.published_at,
    updated_at = timezone('utc', now());

insert into public.course_sections (id, course_id, title, description, ordinal)
values
    ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Introduction to Sales', 'Mindset and foundations.', 1),
    ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Negotiation', 'Objection handling and closing.', 2)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    ordinal = excluded.ordinal,
    updated_at = timezone('utc', now());

insert into public.lessons (id, section_id, course_id, title, content_type, content_text, ordinal, estimated_duration_minutes)
values
    ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'What is Sales?', 'text', '<p>Sales is helping customers solve the right problem.</p>', 1, 15),
    ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Negotiation Quiz', 'quiz', null, 1, 10)
on conflict (id) do update
set title = excluded.title,
    content_type = excluded.content_type,
    content_text = excluded.content_text,
    ordinal = excluded.ordinal,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    updated_at = timezone('utc', now());

insert into public.quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, points, ordinal)
values
    ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'What is a key negotiation principle?', 'multiple_choice', '["Trust","Pressure","Discount first"]'::jsonb, '"Trust"'::jsonb, 1, 1)
on conflict (id) do update
set question_text = excluded.question_text,
    question_type = excluded.question_type,
    options = excluded.options,
    correct_answer = excluded.correct_answer,
    points = excluded.points,
    ordinal = excluded.ordinal,
    updated_at = timezone('utc', now());

insert into public.course_enrollments (id, course_id, employee_id, enrolled_by, enrollment_type, status, progress_percent, score, certificate_issued, time_spent_seconds, attempts_count, due_date)
values
    ('a5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'EMP001', 'MGR001', 'assigned', 'in_progress', 50, null, false, 1500, 1, current_date + 14),
    ('a5000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'EMP002', 'MGR001', 'assigned', 'completed', 100, 86, true, 3600, 2, current_date - 2)
on conflict (id) do update
set status = excluded.status,
    progress_percent = excluded.progress_percent,
    score = excluded.score,
    certificate_issued = excluded.certificate_issued,
    time_spent_seconds = excluded.time_spent_seconds,
    attempts_count = excluded.attempts_count,
    due_date = excluded.due_date,
    updated_at = timezone('utc', now());

insert into public.lesson_progress (id, enrollment_id, lesson_id, status, progress_percent, time_spent_seconds, completed_at)
values
    ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'completed', 100, 900, timezone('utc', now()) - interval '2 days'),
    ('a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'in_progress', 50, 600, null),
    ('a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'completed', 100, 1000, timezone('utc', now()) - interval '7 days'),
    ('a6000000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'completed', 100, 1200, timezone('utc', now()) - interval '7 days')
on conflict (enrollment_id, lesson_id) do update
set status = excluded.status,
    progress_percent = excluded.progress_percent,
    time_spent_seconds = excluded.time_spent_seconds,
    completed_at = excluded.completed_at,
    updated_at = timezone('utc', now());

insert into public.quiz_attempts (id, enrollment_id, lesson_id, attempt_number, answers, score, passed, submitted_at)
values
    ('a7000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 1, '{"a4000000-0000-4000-8000-000000000001":"Trust"}'::jsonb, 100, true, timezone('utc', now()) - interval '7 days')
on conflict (id) do update
set answers = excluded.answers,
    score = excluded.score,
    passed = excluded.passed,
    submitted_at = excluded.submitted_at;

insert into public.course_certificates (id, enrollment_id, employee_id, course_id, certificate_number, issued_at)
values
    ('aa000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'EMP002', 'a1000000-0000-4000-8000-000000000001', 'CERT-2026-EMP002-001', timezone('utc', now()) - interval '7 days')
on conflict (id) do update
set certificate_number = excluded.certificate_number,
    issued_at = excluded.issued_at;

insert into public.training_courses (id, course_name, description, provider, duration_hours, cost, competencies_covered, is_active)
values
    ('b1000000-0000-4000-8000-000000000001', 'Advanced Negotiation Lab', 'Objection handling and deal framing.', 'Mercury Academy', 16, 2500000, '[{"competency":"Client Negotiation"}]'::jsonb, true),
    ('b1000000-0000-4000-8000-000000000002', 'Sales Cadence Bootcamp', 'Pipeline cadence and follow-up.', 'Internal Enablement', 8, 0, '[{"competency":"Pipeline Management"}]'::jsonb, true)
on conflict (id) do update
set course_name = excluded.course_name,
    description = excluded.description,
    provider = excluded.provider,
    duration_hours = excluded.duration_hours,
    cost = excluded.cost,
    competencies_covered = excluded.competencies_covered,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

insert into public.training_needs (id, position_name, competency_name, required_level)
values
    ('b2000000-0000-4000-8000-000000000001', 'Sales Executive', 'Pipeline Management', 4),
    ('b2000000-0000-4000-8000-000000000002', 'Sales Executive', 'Client Negotiation', 4)
on conflict (id) do update
set required_level = excluded.required_level,
    updated_at = timezone('utc', now());

insert into public.training_need_records (id, employee_id, training_need_id, current_level, gap_level, gap_score, competency, priority, status, identified_by, planned_training_id, notes)
values
    ('b3000000-0000-4000-8000-000000000001', 'EMP001', 'b2000000-0000-4000-8000-000000000002', 2.5, 1.5, 1.5, 'Client Negotiation', 'high', 'identified', 'MGR001', 'b1000000-0000-4000-8000-000000000001', 'Needs stronger objection handling.'),
    ('b3000000-0000-4000-8000-000000000002', 'EMP002', 'b2000000-0000-4000-8000-000000000001', 2.0, 2.0, 2.0, 'Pipeline Management', 'critical', 'planned', 'MGR001', 'b1000000-0000-4000-8000-000000000002', 'Pipeline coverage inconsistent.')
on conflict (employee_id, training_need_id) do update
set current_level = excluded.current_level,
    gap_level = excluded.gap_level,
    gap_score = excluded.gap_score,
    competency = excluded.competency,
    priority = excluded.priority,
    status = excluded.status,
    identified_by = excluded.identified_by,
    planned_training_id = excluded.planned_training_id,
    notes = excluded.notes,
    updated_at = timezone('utc', now());

insert into public.training_plans (id, employee_id, plan_name, period, status, approved_by, approved_at, created_by)
values
    ('b4000000-0000-4000-8000-000000000001', 'EMP002', 'Q2 2026 Sales Recovery', '2026-04', 'approved', 'HR001', timezone('utc', now()) - interval '3 days', 'MGR001')
on conflict (id) do update
set plan_name = excluded.plan_name,
    period = excluded.period,
    status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    created_by = excluded.created_by,
    updated_at = timezone('utc', now());

insert into public.training_plan_items (id, plan_id, training_need_record_id, course_id, training_course, training_provider, start_date, end_date, cost, status)
values
    ('b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Sales Cadence Bootcamp', 'Internal Enablement', current_date - 1, current_date + 1, 0, 'in_progress'),
    ('b5000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Advanced Negotiation Lab', 'Mercury Academy', current_date + 14, current_date + 16, 2500000, 'planned')
on conflict (plan_id, training_course) do update
set status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    cost = excluded.cost,
    updated_at = timezone('utc', now());

insert into public.training_enrollments (id, employee_id, course_id, enrollment_date, status, completion_date, score)
values
    ('b6000000-0000-4000-8000-000000000001', 'EMP002', 'b1000000-0000-4000-8000-000000000002', current_date - 2, 'in_progress', null, null),
    ('b6000000-0000-4000-8000-000000000002', 'EMP001', 'b1000000-0000-4000-8000-000000000001', current_date - 30, 'completed', current_date - 14, 88)
on conflict (employee_id, course_id) do update
set status = excluded.status,
    completion_date = excluded.completion_date,
    score = excluded.score,
    updated_at = timezone('utc', now());

insert into public.kpi_definitions (id, name, description, category, target, unit, effective_period, approval_status, is_active, latest_version_no, approved_by, approved_at)
values
    ('11111111-1111-4111-8111-111111111111', 'Monthly Revenue', 'Closed-won revenue booked in the month.', 'Sales Executive', 100, 'IDR (M)', '2026-01', 'approved', true, 1, 'ADM001', '2026-01-01 09:00:00+00'),
    ('22222222-2222-4222-8222-222222222222', 'New Clients', 'Number of first-time paying customers.', 'Sales Executive', 15, 'Clients', '2026-01', 'approved', true, 1, 'ADM001', '2026-01-01 09:00:00+00')
on conflict (id) do update
set name = excluded.name,
    target = excluded.target,
    unit = excluded.unit,
    approval_status = excluded.approval_status,
    latest_version_no = excluded.latest_version_no,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = timezone('utc', now());

insert into public.kpi_definition_versions (id, kpi_definition_id, version_no, effective_period, name, description, category, target, unit, status, requested_by, approved_by, approved_at)
values
    ('aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 1, '2026-01', 'Monthly Revenue', 'Closed-won revenue booked in the month.', 'Sales Executive', 100, 'IDR (M)', 'approved', 'ADM001', 'ADM001', '2026-01-01 09:00:00+00'),
    ('aaaaaaaa-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 1, '2026-01', 'New Clients', 'Number of first-time paying customers.', 'Sales Executive', 15, 'Clients', 'approved', 'ADM001', 'ADM001', '2026-01-01 09:00:00+00')
on conflict (id) do update
set status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = timezone('utc', now());

insert into public.employee_kpi_target_versions (id, employee_id, kpi_id, effective_period, version_no, target_value, unit, status, requested_by, approved_by, approved_at)
values
    ('bbbbbbbb-1111-4111-8111-111111111111', 'EMP002', '11111111-1111-4111-8111-111111111111', '2026-03', 1, 120, 'IDR (M)', 'approved', 'MGR001', 'HR001', '2026-03-01 10:00:00+00')
on conflict (id) do update
set target_value = excluded.target_value,
    unit = excluded.unit,
    status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = timezone('utc', now());

insert into public.kpi_records (id, employee_id, kpi_id, period, value, notes, submitted_by, target_snapshot, definition_version_id, target_version_id)
values
    ('eeeeeeee-1111-4111-8111-111111111111', 'EMP001', '11111111-1111-4111-8111-111111111111', '2026-01', 108, 'Strong enterprise close at month end.', 'EMP001', 100, 'aaaaaaaa-1111-4111-8111-111111111111', null),
    ('eeeeeeee-2222-4111-8111-111111111111', 'EMP002', '11111111-1111-4111-8111-111111111111', '2026-03', 82, 'Pipeline slipped due to delayed procurement.', 'EMP002', 120, 'aaaaaaaa-1111-4111-8111-111111111111', 'bbbbbbbb-1111-4111-8111-111111111111')
on conflict (id) do update
set value = excluded.value,
    notes = excluded.notes,
    submitted_by = excluded.submitted_by,
    target_snapshot = excluded.target_snapshot,
    target_version_id = excluded.target_version_id,
    updated_at = timezone('utc', now());

insert into public.probation_reviews (id, employee_id, review_period_start, review_period_end, quantitative_score, qualitative_score, final_score, decision, manager_notes, reviewed_by, reviewed_at)
values
    ('55555555-3333-4333-8333-333333333333', 'EMP003', '2026-01-06', '2026-04-05', 47.33, 27.67, 75, 'pass', 'Solid probation performance.', 'MGR001', '2026-04-05 16:30:00+00')
on conflict (id) do update
set final_score = excluded.final_score,
    decision = excluded.decision,
    manager_notes = excluded.manager_notes,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = timezone('utc', now());

insert into public.pip_plans (id, employee_id, trigger_reason, trigger_period, start_date, target_end_date, status, owner_manager_id, summary)
values
    ('11112222-2222-4222-8222-222222222222', 'EMP002', 'KPI weighted score below threshold for period 2026-03.', '2026-03', '2026-04-01', '2026-04-30', 'active', 'MGR001', 'Recovery plan for revenue pacing and CRM hygiene.')
on conflict (id) do update
set status = excluded.status,
    summary = excluded.summary,
    updated_at = timezone('utc', now());

insert into public.pip_actions (id, pip_plan_id, action_title, action_detail, due_date, progress_pct, status, checkpoint_note)
values
    ('12121212-1111-4111-8111-111111111111', '11112222-2222-4222-8222-222222222222', 'Weekly coaching check-in', 'Review blocked deals and close plans.', '2026-04-30', 40, 'in_progress', 'Two of four sessions completed.')
on conflict (id) do update
set progress_pct = excluded.progress_pct,
    status = excluded.status,
    checkpoint_note = excluded.checkpoint_note,
    updated_at = timezone('utc', now());

insert into public.admin_activity_log (actor_employee_id, actor_role, action, entity_type, entity_id, details)
values
    ('ADM001', 'superadmin', 'seed.supabase.load', 'system', 'seed_dev_staging', '{"dataset":"dev-staging","source":"sql"}'::jsonb)
on conflict do nothing;

commit;
