-- seed_demo_baseline.sql
-- Expanded non-production baseline data for dashboard, workforce, KPI, TNA, and organization views.

begin;

delete from public.training_plan_items
where id in (
    'b5000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000002'
);

delete from public.training_plans
where id in (
    'b4000000-0000-4000-8000-000000000001'
);

delete from public.training_need_records
where id in (
    'b3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000002'
);

delete from public.training_enrollments
where id in (
    'b6000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000002'
);

delete from public.training_needs
where id in (
    'b2000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000002'
);

delete from public.training_courses
where id in (
    'b1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000002'
);

delete from public.kpi_records
where id in (
    'eeeeeeee-1111-4111-8111-111111111111',
    'eeeeeeee-2222-4111-8111-111111111111'
);

delete from public.employee_kpi_target_versions
where id in (
    'bbbbbbbb-1111-4111-8111-111111111111'
);

delete from public.kpi_definition_versions
where id in (
    'aaaaaaaa-1111-4111-8111-111111111111',
    'aaaaaaaa-2222-4222-8222-222222222222'
);

delete from public.kpi_definitions
where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
);

delete from public.competency_config
where position_name in ('Sales Executive', 'Marketing Specialist');

insert into public.app_settings (key, value)
values
    ('app_name', 'HR Performance Suite'),
    ('company_name', 'Vanaila Group Demo'),
    ('company_short', 'VGD'),
    ('department_label', 'People & Performance Office'),
    ('departments', 'BoD, Sales, Operation, HR, Finance'),
    ('levels', 'Board, Director, Manager, Senior, Intermediate, Junior'),
    ('dept_positions', '{"BoD":["Chief Executive Officer","Chief Operating Officer","Chief Financial Officer"],"Sales":["Sales Manager","Senior Account Executive","Key Account Executive"],"Operation":["Operations Manager","Operations Supervisor","Logistics Coordinator"],"HR":["HR Manager","Talent Development Specialist","HR Generalist"],"Finance":["Finance Manager","Finance Analyst","Payroll Officer"]}')
on conflict (key) do update
set value = excluded.value,
    updated_at = timezone('utc', now());

insert into public.org_settings (id, seniority_levels)
values ('default', '["Board","Director","Manager","Senior","Intermediate","Junior"]'::jsonb)
on conflict (id) do update
set seniority_levels = excluded.seniority_levels,
    updated_at = timezone('utc', now());

insert into public.departments (id, name)
values
    ('d1000000-0000-4000-8000-000000000001', 'BoD'),
    ('d1000000-0000-4000-8000-000000000002', 'Sales'),
    ('d1000000-0000-4000-8000-000000000003', 'Operation'),
    ('d1000000-0000-4000-8000-000000000004', 'HR'),
    ('d1000000-0000-4000-8000-000000000005', 'Finance')
on conflict (id) do update
set name = excluded.name,
    updated_at = timezone('utc', now());

insert into public.positions (id, department_id, name, description, job_level, grade_class, reports_to_position, competencies)
values
    ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Chief Executive Officer', 'Owns company direction, governance cadence, and executive scorecard.', 'Executive Board', 'G16-A', null, '[{"name":"Strategic Leadership","level":5,"description":"Translate board priorities into enterprise direction.","recommendation":"Executive Strategy Summit"},{"name":"Board Governance","level":5,"description":"Run governance, risk, and board reporting with discipline.","recommendation":"Governance & Risk Forum"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'Chief Operating Officer', 'Leads operating rhythm, delivery health, and execution stability.', 'Executive Board', 'G15-A', 'Chief Executive Officer', '[{"name":"Operational Excellence","level":5,"description":"Scale execution systems and process performance.","recommendation":"Operational Leadership Masterclass"},{"name":"Change Leadership","level":4,"description":"Lead cross-functional transformation with minimal disruption.","recommendation":"Enterprise Change Leadership"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'Chief Financial Officer', 'Owns budget accuracy, compliance posture, and cash discipline.', 'Executive Board', 'G15-B', 'Chief Executive Officer', '[{"name":"Financial Stewardship","level":5,"description":"Direct budget controls and enterprise financial health.","recommendation":"Finance Governance Intensive"},{"name":"Risk Control","level":4,"description":"Maintain internal controls and audit readiness.","recommendation":"Risk & Compliance Leadership"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000002', 'Sales Manager', 'Owns team quota, pipeline cadence, and coaching quality.', 'Department Head', 'G12-A', 'Chief Operating Officer', '[{"name":"Pipeline Leadership","level":4,"description":"Drive forecast discipline and pipeline coverage.","recommendation":"Sales Leadership Accelerator"},{"name":"Coaching & Forecasting","level":4,"description":"Coach reps and improve forecast quality.","recommendation":"Forecast Coaching Clinic"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000002', 'Senior Account Executive', 'Closes strategic accounts and expands high-value opportunities.', 'Professional IC', 'G10-A', 'Sales Manager', '[{"name":"Key Account Growth","level":4,"description":"Grow strategic accounts with value-led planning.","recommendation":"Strategic Account Growth Lab"},{"name":"Solution Selling","level":4,"description":"Position solutions around client pain points.","recommendation":"Consultative Selling Intensive"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000002', 'Key Account Executive', 'Retains major clients while converting qualified opportunities.', 'Professional IC', 'G09-B', 'Sales Manager', '[{"name":"Client Retention","level":4,"description":"Protect recurring revenue through account care.","recommendation":"Client Retention Playbook"},{"name":"Opportunity Conversion","level":3,"description":"Advance qualified opportunities to closed deals.","recommendation":"Conversion Pipeline Workshop"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000003', 'Operations Manager', 'Leads operating efficiency, throughput, and service consistency.', 'Department Head', 'G12-B', 'Chief Operating Officer', '[{"name":"Process Optimization","level":4,"description":"Improve throughput, cycle time, and standard work.","recommendation":"Operational Planning Masterclass"},{"name":"Cross-Functional Coordination","level":4,"description":"Coordinate service delivery with sales and finance.","recommendation":"Operations Coordination Lab"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000003', 'Operations Supervisor', 'Owns shift execution, staffing balance, and floor quality.', 'Team Lead', 'G08-A', 'Operations Manager', '[{"name":"Workforce Scheduling","level":3,"description":"Match staffing to expected workload and service demand.","recommendation":"Shift Planning Bootcamp"},{"name":"Quality Control","level":4,"description":"Maintain output quality and escalation handling.","recommendation":"Quality Control Essentials"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000009', 'd1000000-0000-4000-8000-000000000003', 'Logistics Coordinator', 'Coordinates dispatch, stock integrity, and shipment readiness.', 'Professional IC', 'G07-B', 'Operations Supervisor', '[{"name":"Inventory Accuracy","level":3,"description":"Maintain stock integrity and document movement cleanly.","recommendation":"Inventory Accuracy Workshop"},{"name":"Dispatch Coordination","level":3,"description":"Coordinate shipment readiness and carrier handoff.","recommendation":"Dispatch Control Basics"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000010', 'd1000000-0000-4000-8000-000000000004', 'HR Manager', 'Leads people operations, workforce planning, and policy execution.', 'Department Head', 'G12-C', 'Chief Executive Officer', '[{"name":"Workforce Planning","level":4,"description":"Forecast talent demand and shape hiring priorities.","recommendation":"Strategic Workforce Planning"},{"name":"Policy Governance","level":4,"description":"Maintain policy quality and compliance posture.","recommendation":"HR Policy Governance Forum"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000004', 'Talent Development Specialist', 'Owns capability mapping, learning plans, and facilitation quality.', 'Professional IC', 'G09-A', 'HR Manager', '[{"name":"Learning Design","level":4,"description":"Design practical learning interventions from capability gaps.","recommendation":"Learning Design Studio"},{"name":"Facilitation","level":3,"description":"Facilitate workshops and internal academies effectively.","recommendation":"Facilitation for Learning Leaders"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000012', 'd1000000-0000-4000-8000-000000000004', 'HR Generalist', 'Runs employee support, HR operations, and case handling.', 'Professional IC', 'G08-B', 'HR Manager', '[{"name":"Employee Relations","level":3,"description":"Handle employee cases with empathy and documentation quality.","recommendation":"Employee Relations Essentials"},{"name":"HR Administration","level":3,"description":"Keep HR records and routine operations accurate.","recommendation":"HR Operations Fundamentals"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000013', 'd1000000-0000-4000-8000-000000000005', 'Finance Manager', 'Owns close quality, planning rhythm, and financial visibility.', 'Department Head', 'G12-D', 'Chief Financial Officer', '[{"name":"Budget Control","level":4,"description":"Control spending and budget adherence across functions.","recommendation":"Budget Control Workshop"},{"name":"Financial Analysis","level":4,"description":"Translate financial signals into management insight.","recommendation":"Financial Analysis Lab"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000014', 'd1000000-0000-4000-8000-000000000005', 'Finance Analyst', 'Builds forecast views, variance analysis, and reporting packs.', 'Professional IC', 'G09-C', 'Finance Manager', '[{"name":"Forecast Modelling","level":4,"description":"Build usable forecasts from business drivers.","recommendation":"Forecast Modelling Bootcamp"},{"name":"Variance Analysis","level":3,"description":"Explain performance deltas with clear narratives.","recommendation":"Variance Analysis Workshop"}]'::jsonb),
    ('e1000000-0000-4000-8000-000000000015', 'd1000000-0000-4000-8000-000000000005', 'Payroll Officer', 'Runs accurate payroll processing and payroll compliance checks.', 'Professional IC', 'G07-C', 'Finance Manager', '[{"name":"Payroll Accuracy","level":4,"description":"Process payroll accurately and on time.","recommendation":"Payroll Accuracy Clinic"},{"name":"Compliance Administration","level":3,"description":"Keep payroll compliance documents current and audit-ready.","recommendation":"Payroll Compliance Essentials"}]'::jsonb)
on conflict (id) do update
set department_id = excluded.department_id,
    name = excluded.name,
    description = excluded.description,
    job_level = excluded.job_level,
    grade_class = excluded.grade_class,
    reports_to_position = excluded.reports_to_position,
    competencies = excluded.competencies,
    updated_at = timezone('utc', now());

insert into public.employees (
    employee_id, name, position, seniority, join_date, department, manager_id,
    email, auth_email, role, password_hash, percentage, self_percentage,
    scores, self_scores, history, training_history, kpi_targets
)
values
    ('ADM001', 'Aulia Pratama', 'Chief Executive Officer', 'Board', '2023-01-03', 'BoD', null, 'admin.demo@xenos.local', 'admin.demo@xenos.local', 'superadmin', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 91, 89, '[{"q":"Strategic Leadership","s":92},{"q":"Board Governance","s":90}]'::jsonb, '[{"q":"Strategic Leadership","s":89},{"q":"Board Governance","s":88}]'::jsonb, '[]'::jsonb, '[{"course":"Executive Strategy Summit","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000001":18}}'::jsonb),
    ('DIR001', 'Raka Permana', 'Chief Operating Officer', 'Director', '2023-05-16', 'BoD', 'ADM001', 'director.demo@xenos.local', 'director.demo@xenos.local', 'director', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 88, 86, '[{"q":"Operational Excellence","s":89},{"q":"Change Leadership","s":87}]'::jsonb, '[{"q":"Operational Excellence","s":86},{"q":"Change Leadership","s":85}]'::jsonb, '[]'::jsonb, '[{"course":"Operational Leadership Masterclass","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000002":92}}'::jsonb),
    ('BOD003', 'Ananta Wijaya', 'Chief Financial Officer', 'Director', '2023-07-01', 'BoD', 'ADM001', 'cfo.demo@xenos.local', 'cfo.demo@xenos.local', 'director', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 89, 87, '[{"q":"Financial Stewardship","s":90},{"q":"Risk Control","s":88}]'::jsonb, '[{"q":"Financial Stewardship","s":87},{"q":"Risk Control","s":86}]'::jsonb, '[]'::jsonb, '[{"course":"Finance Governance Intensive","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000003":98}}'::jsonb),
    ('MGR001', 'Sinta Wibowo', 'Sales Manager', 'Manager', '2024-01-08', 'Sales', 'DIR001', 'manager.demo@xenos.local', 'manager.demo@xenos.local', 'manager', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 84, 82, '[{"q":"Pipeline Leadership","s":85},{"q":"Coaching & Forecasting","s":83}]'::jsonb, '[{"q":"Pipeline Leadership","s":82},{"q":"Coaching & Forecasting","s":81}]'::jsonb, '[]'::jsonb, '[{"course":"Sales Leadership Accelerator","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000004":95}}'::jsonb),
    ('EMP001', 'Farhan Akbar', 'Senior Account Executive', 'Senior', '2024-07-01', 'Sales', 'MGR001', 'farhan.demo@xenos.local', 'farhan.demo@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 79, 78, '[{"q":"Key Account Growth","s":80},{"q":"Solution Selling","s":78}]'::jsonb, '[{"q":"Key Account Growth","s":78},{"q":"Solution Selling","s":77}]'::jsonb, '[]'::jsonb, '[{"course":"Strategic Account Growth Lab","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000005":850}}'::jsonb),
    ('EMP002', 'Nadia Lestari', 'Key Account Executive', 'Intermediate', '2025-02-17', 'Sales', 'MGR001', 'nadia.demo@xenos.local', 'nadia.demo@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 76, 75, '[{"q":"Client Retention","s":77},{"q":"Opportunity Conversion","s":75}]'::jsonb, '[{"q":"Client Retention","s":75},{"q":"Opportunity Conversion","s":74}]'::jsonb, '[]'::jsonb, '[{"course":"Client Retention Playbook","status":"in_progress"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000006":92}}'::jsonb),
    ('OPS001', 'Bima Prakoso', 'Operations Manager', 'Manager', '2024-02-05', 'Operation', 'DIR001', 'ops.manager@xenos.local', 'ops.manager@xenos.local', 'manager', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 85, 83, '[{"q":"Process Optimization","s":86},{"q":"Cross-Functional Coordination","s":84}]'::jsonb, '[{"q":"Process Optimization","s":83},{"q":"Cross-Functional Coordination","s":82}]'::jsonb, '[]'::jsonb, '[{"course":"Operational Planning Masterclass","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000007":96}}'::jsonb),
    ('OPS002', 'Citra Ramadhani', 'Operations Supervisor', 'Senior', '2024-08-12', 'Operation', 'OPS001', 'ops.supervisor@xenos.local', 'ops.supervisor@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 80, 79, '[{"q":"Workforce Scheduling","s":81},{"q":"Quality Control","s":79}]'::jsonb, '[{"q":"Workforce Scheduling","s":79},{"q":"Quality Control","s":78}]'::jsonb, '[]'::jsonb, '[{"course":"Shift Planning Bootcamp","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000008":90}}'::jsonb),
    ('EMP003', 'Kevin Mahendra', 'Logistics Coordinator', 'Intermediate', '2026-01-06', 'Operation', 'OPS002', 'kevin.demo@xenos.local', 'kevin.demo@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 77, 76, '[{"q":"Inventory Accuracy","s":78},{"q":"Dispatch Coordination","s":76}]'::jsonb, '[{"q":"Inventory Accuracy","s":76},{"q":"Dispatch Coordination","s":75}]'::jsonb, '[]'::jsonb, '[{"course":"Inventory Accuracy Workshop","status":"in_progress"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000009":97}}'::jsonb),
    ('HR001', 'Maya Suryani', 'HR Manager', 'Manager', '2024-02-12', 'HR', 'ADM001', 'hr.demo@xenos.local', 'hr.demo@xenos.local', 'hr', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 86, 84, '[{"q":"Workforce Planning","s":87},{"q":"Policy Governance","s":85}]'::jsonb, '[{"q":"Workforce Planning","s":84},{"q":"Policy Governance","s":83}]'::jsonb, '[]'::jsonb, '[{"course":"Strategic Workforce Planning","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000010":30}}'::jsonb),
    ('HR002', 'Nisa Putri', 'Talent Development Specialist', 'Senior', '2024-09-02', 'HR', 'HR001', 'talent.dev@xenos.local', 'talent.dev@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 83, 82, '[{"q":"Learning Design","s":84},{"q":"Facilitation","s":82}]'::jsonb, '[{"q":"Learning Design","s":82},{"q":"Facilitation","s":81}]'::jsonb, '[]'::jsonb, '[{"course":"Learning Design Studio","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000011":95}}'::jsonb),
    ('HR003', 'Rio Prasetyo', 'HR Generalist', 'Intermediate', '2025-01-15', 'HR', 'HR001', 'hr.generalist@xenos.local', 'hr.generalist@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 81, 80, '[{"q":"Employee Relations","s":82},{"q":"HR Administration","s":80}]'::jsonb, '[{"q":"Employee Relations","s":80},{"q":"HR Administration","s":79}]'::jsonb, '[]'::jsonb, '[{"course":"Employee Relations Essentials","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000012":3}}'::jsonb),
    ('FIN001', 'Anindya Putra', 'Finance Manager', 'Manager', '2024-03-04', 'Finance', 'BOD003', 'finance.manager@xenos.local', 'finance.manager@xenos.local', 'manager', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 87, 85, '[{"q":"Budget Control","s":88},{"q":"Financial Analysis","s":86}]'::jsonb, '[{"q":"Budget Control","s":85},{"q":"Financial Analysis","s":84}]'::jsonb, '[]'::jsonb, '[{"course":"Budget Control Workshop","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000013":99}}'::jsonb),
    ('FIN002', 'Lina Kurnia', 'Finance Analyst', 'Senior', '2025-03-10', 'Finance', 'FIN001', 'finance.analyst@xenos.local', 'finance.analyst@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 82, 81, '[{"q":"Forecast Modelling","s":83},{"q":"Variance Analysis","s":81}]'::jsonb, '[{"q":"Forecast Modelling","s":81},{"q":"Variance Analysis","s":80}]'::jsonb, '[]'::jsonb, '[{"course":"Forecast Modelling Bootcamp","status":"completed"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000014":95}}'::jsonb),
    ('FIN003', 'Yusuf Hidayat', 'Payroll Officer', 'Intermediate', '2025-06-16', 'Finance', 'FIN001', 'payroll@xenos.local', 'payroll@xenos.local', 'employee', '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya', 78, 77, '[{"q":"Payroll Accuracy","s":79},{"q":"Compliance Administration","s":77}]'::jsonb, '[{"q":"Payroll Accuracy","s":77},{"q":"Compliance Administration","s":76}]'::jsonb, '[]'::jsonb, '[{"course":"Payroll Accuracy Clinic","status":"in_progress"}]'::jsonb, '{"default":{"d2000000-0000-4000-8000-000000000015":99.5}}'::jsonb)
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
    percentage = excluded.percentage,
    self_percentage = excluded.self_percentage,
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
    jsonb_build_object('employee_id', e.employee_id, 'source', 'seed_demo_baseline')
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
    ('Chief Executive Officer', '[{"name":"Strategic Leadership","description":"Translate board priorities into enterprise direction.","required_level":5,"recommendation":"Executive Strategy Summit"},{"name":"Board Governance","description":"Run governance, risk, and board reporting with discipline.","required_level":5,"recommendation":"Governance & Risk Forum"}]'::jsonb),
    ('Chief Operating Officer', '[{"name":"Operational Excellence","description":"Scale execution systems and process performance.","required_level":5,"recommendation":"Operational Leadership Masterclass"},{"name":"Change Leadership","description":"Lead cross-functional transformation with minimal disruption.","required_level":4,"recommendation":"Enterprise Change Leadership"}]'::jsonb),
    ('Chief Financial Officer', '[{"name":"Financial Stewardship","description":"Direct budget controls and enterprise financial health.","required_level":5,"recommendation":"Finance Governance Intensive"},{"name":"Risk Control","description":"Maintain internal controls and audit readiness.","required_level":4,"recommendation":"Risk & Compliance Leadership"}]'::jsonb),
    ('Sales Manager', '[{"name":"Pipeline Leadership","description":"Drive forecast discipline and pipeline coverage.","required_level":4,"recommendation":"Sales Leadership Accelerator"},{"name":"Coaching & Forecasting","description":"Coach reps and improve forecast quality.","required_level":4,"recommendation":"Forecast Coaching Clinic"}]'::jsonb),
    ('Senior Account Executive', '[{"name":"Key Account Growth","description":"Grow strategic accounts with value-led planning.","required_level":4,"recommendation":"Strategic Account Growth Lab"},{"name":"Solution Selling","description":"Position solutions around client pain points.","required_level":4,"recommendation":"Consultative Selling Intensive"}]'::jsonb),
    ('Key Account Executive', '[{"name":"Client Retention","description":"Protect recurring revenue through account care.","required_level":4,"recommendation":"Client Retention Playbook"},{"name":"Opportunity Conversion","description":"Advance qualified opportunities to closed deals.","required_level":3,"recommendation":"Conversion Pipeline Workshop"}]'::jsonb),
    ('Operations Manager', '[{"name":"Process Optimization","description":"Improve throughput, cycle time, and standard work.","required_level":4,"recommendation":"Operational Planning Masterclass"},{"name":"Cross-Functional Coordination","description":"Coordinate service delivery with sales and finance.","required_level":4,"recommendation":"Operations Coordination Lab"}]'::jsonb),
    ('Operations Supervisor', '[{"name":"Workforce Scheduling","description":"Match staffing to expected workload and service demand.","required_level":3,"recommendation":"Shift Planning Bootcamp"},{"name":"Quality Control","description":"Maintain output quality and escalation handling.","required_level":4,"recommendation":"Quality Control Essentials"}]'::jsonb),
    ('Logistics Coordinator', '[{"name":"Inventory Accuracy","description":"Maintain stock integrity and document movement cleanly.","required_level":3,"recommendation":"Inventory Accuracy Workshop"},{"name":"Dispatch Coordination","description":"Coordinate shipment readiness and carrier handoff.","required_level":3,"recommendation":"Dispatch Control Basics"}]'::jsonb),
    ('HR Manager', '[{"name":"Workforce Planning","description":"Forecast talent demand and shape hiring priorities.","required_level":4,"recommendation":"Strategic Workforce Planning"},{"name":"Policy Governance","description":"Maintain policy quality and compliance posture.","required_level":4,"recommendation":"HR Policy Governance Forum"}]'::jsonb),
    ('Talent Development Specialist', '[{"name":"Learning Design","description":"Design practical learning interventions from capability gaps.","required_level":4,"recommendation":"Learning Design Studio"},{"name":"Facilitation","description":"Facilitate workshops and internal academies effectively.","required_level":3,"recommendation":"Facilitation for Learning Leaders"}]'::jsonb),
    ('HR Generalist', '[{"name":"Employee Relations","description":"Handle employee cases with empathy and documentation quality.","required_level":3,"recommendation":"Employee Relations Essentials"},{"name":"HR Administration","description":"Keep HR records and routine operations accurate.","required_level":3,"recommendation":"HR Operations Fundamentals"}]'::jsonb),
    ('Finance Manager', '[{"name":"Budget Control","description":"Control spending and budget adherence across functions.","required_level":4,"recommendation":"Budget Control Workshop"},{"name":"Financial Analysis","description":"Translate financial signals into management insight.","required_level":4,"recommendation":"Financial Analysis Lab"}]'::jsonb),
    ('Finance Analyst', '[{"name":"Forecast Modelling","description":"Build usable forecasts from business drivers.","required_level":4,"recommendation":"Forecast Modelling Bootcamp"},{"name":"Variance Analysis","description":"Explain performance deltas with clear narratives.","required_level":3,"recommendation":"Variance Analysis Workshop"}]'::jsonb),
    ('Payroll Officer', '[{"name":"Payroll Accuracy","description":"Process payroll accurately and on time.","required_level":4,"recommendation":"Payroll Accuracy Clinic"},{"name":"Compliance Administration","description":"Keep payroll compliance documents current and audit-ready.","required_level":3,"recommendation":"Payroll Compliance Essentials"}]'::jsonb)
on conflict (position_name) do update
set competencies = excluded.competencies,
    updated_at = timezone('utc', now());

insert into public.training_courses (id, course_name, description, provider, duration_hours, cost, competencies_covered, is_active)
values
    ('f1000000-0000-4000-8000-000000000001', 'Executive Strategy Summit', 'Strategic planning and board execution clinic.', 'Vanaila Leadership Lab', 12, 0, '[{"competency":"Strategic Leadership"},{"competency":"Board Governance"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000002', 'Operational Leadership Masterclass', 'Operational cadence and transformation leadership.', 'Mercury Ops Institute', 16, 3200000, '[{"competency":"Operational Excellence"},{"competency":"Change Leadership"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000003', 'Finance Governance Intensive', 'Finance control, planning, and risk discipline.', 'Northbridge Finance Academy', 14, 3400000, '[{"competency":"Financial Stewardship"},{"competency":"Risk Control"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000004', 'Sales Leadership Accelerator', 'Pipeline coaching and team quota management.', 'Internal Revenue Academy', 10, 0, '[{"competency":"Pipeline Leadership"},{"competency":"Coaching & Forecasting"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000005', 'Strategic Account Growth Lab', 'Strategic account planning and deal growth.', 'Vanaila Sales Academy', 8, 1800000, '[{"competency":"Key Account Growth"},{"competency":"Solution Selling"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000006', 'Client Retention Playbook', 'Protecting renewals and improving conversion quality.', 'Vanaila Sales Academy', 8, 1250000, '[{"competency":"Client Retention"},{"competency":"Opportunity Conversion"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000007', 'Operational Planning Masterclass', 'Throughput planning and cross-functional operating rhythm.', 'Mercury Ops Institute', 12, 2100000, '[{"competency":"Process Optimization"},{"competency":"Cross-Functional Coordination"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000008', 'Shift Planning Bootcamp', 'Work scheduling and floor supervision essentials.', 'Internal Operations Academy', 6, 0, '[{"competency":"Workforce Scheduling"},{"competency":"Quality Control"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000009', 'Inventory Accuracy Workshop', 'Inventory discipline and dispatch readiness.', 'Supply Chain School', 6, 950000, '[{"competency":"Inventory Accuracy"},{"competency":"Dispatch Coordination"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000010', 'Strategic Workforce Planning', 'Headcount planning, capability planning, and hiring rhythm.', 'PeopleOps Academy', 8, 1350000, '[{"competency":"Workforce Planning"},{"competency":"Policy Governance"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000011', 'Learning Design Studio', 'Designing practical capability interventions.', 'PeopleOps Academy', 8, 1200000, '[{"competency":"Learning Design"},{"competency":"Facilitation"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000012', 'Employee Relations Essentials', 'Case handling and HR operational discipline.', 'PeopleOps Academy', 6, 850000, '[{"competency":"Employee Relations"},{"competency":"HR Administration"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000013', 'Budget Control Workshop', 'Budget visibility and management reporting.', 'Northbridge Finance Academy', 8, 1500000, '[{"competency":"Budget Control"},{"competency":"Financial Analysis"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000014', 'Forecast Modelling Bootcamp', 'Forecast building and variance narrative skills.', 'Northbridge Finance Academy', 8, 1450000, '[{"competency":"Forecast Modelling"},{"competency":"Variance Analysis"}]'::jsonb, true),
    ('f1000000-0000-4000-8000-000000000015', 'Payroll Accuracy Clinic', 'Payroll process accuracy and compliance routines.', 'Compliance Center', 6, 980000, '[{"competency":"Payroll Accuracy"},{"competency":"Compliance Administration"}]'::jsonb, true)
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
    ('f2000000-0000-4000-8000-000000000001', 'Chief Executive Officer', 'Strategic Leadership', 5),
    ('f2000000-0000-4000-8000-000000000002', 'Chief Executive Officer', 'Board Governance', 5),
    ('f2000000-0000-4000-8000-000000000003', 'Chief Operating Officer', 'Operational Excellence', 5),
    ('f2000000-0000-4000-8000-000000000004', 'Chief Operating Officer', 'Change Leadership', 4),
    ('f2000000-0000-4000-8000-000000000005', 'Chief Financial Officer', 'Financial Stewardship', 5),
    ('f2000000-0000-4000-8000-000000000006', 'Chief Financial Officer', 'Risk Control', 4),
    ('f2000000-0000-4000-8000-000000000007', 'Sales Manager', 'Pipeline Leadership', 4),
    ('f2000000-0000-4000-8000-000000000008', 'Sales Manager', 'Coaching & Forecasting', 4),
    ('f2000000-0000-4000-8000-000000000009', 'Senior Account Executive', 'Key Account Growth', 4),
    ('f2000000-0000-4000-8000-000000000010', 'Senior Account Executive', 'Solution Selling', 4),
    ('f2000000-0000-4000-8000-000000000011', 'Key Account Executive', 'Client Retention', 4),
    ('f2000000-0000-4000-8000-000000000012', 'Key Account Executive', 'Opportunity Conversion', 3),
    ('f2000000-0000-4000-8000-000000000013', 'Operations Manager', 'Process Optimization', 4),
    ('f2000000-0000-4000-8000-000000000014', 'Operations Manager', 'Cross-Functional Coordination', 4),
    ('f2000000-0000-4000-8000-000000000015', 'Operations Supervisor', 'Workforce Scheduling', 3),
    ('f2000000-0000-4000-8000-000000000016', 'Operations Supervisor', 'Quality Control', 4),
    ('f2000000-0000-4000-8000-000000000017', 'Logistics Coordinator', 'Inventory Accuracy', 3),
    ('f2000000-0000-4000-8000-000000000018', 'Logistics Coordinator', 'Dispatch Coordination', 3),
    ('f2000000-0000-4000-8000-000000000019', 'HR Manager', 'Workforce Planning', 4),
    ('f2000000-0000-4000-8000-000000000020', 'HR Manager', 'Policy Governance', 4),
    ('f2000000-0000-4000-8000-000000000021', 'Talent Development Specialist', 'Learning Design', 4),
    ('f2000000-0000-4000-8000-000000000022', 'Talent Development Specialist', 'Facilitation', 3),
    ('f2000000-0000-4000-8000-000000000023', 'HR Generalist', 'Employee Relations', 3),
    ('f2000000-0000-4000-8000-000000000024', 'HR Generalist', 'HR Administration', 3),
    ('f2000000-0000-4000-8000-000000000025', 'Finance Manager', 'Budget Control', 4),
    ('f2000000-0000-4000-8000-000000000026', 'Finance Manager', 'Financial Analysis', 4),
    ('f2000000-0000-4000-8000-000000000027', 'Finance Analyst', 'Forecast Modelling', 4),
    ('f2000000-0000-4000-8000-000000000028', 'Finance Analyst', 'Variance Analysis', 3),
    ('f2000000-0000-4000-8000-000000000029', 'Payroll Officer', 'Payroll Accuracy', 4),
    ('f2000000-0000-4000-8000-000000000030', 'Payroll Officer', 'Compliance Administration', 3)
on conflict (id) do update
set position_name = excluded.position_name,
    competency_name = excluded.competency_name,
    required_level = excluded.required_level,
    updated_at = timezone('utc', now());

insert into public.training_need_records (id, employee_id, training_need_id, current_level, gap_level, gap_score, competency, priority, status, identified_by, planned_training_id, notes)
values
    ('f3000000-0000-4000-8000-000000000001', 'ADM001', 'f2000000-0000-4000-8000-000000000001', 4.6, 0.4, 0.4, 'Strategic Leadership', 'medium', 'planned', 'ADM001', 'f1000000-0000-4000-8000-000000000001', 'Board strategy cadence is strong but still tracked.'),
    ('f3000000-0000-4000-8000-000000000002', 'ADM001', 'f2000000-0000-4000-8000-000000000002', 4.5, 0.5, 0.5, 'Board Governance', 'medium', 'planned', 'ADM001', 'f1000000-0000-4000-8000-000000000001', 'Governance reporting remains an improvement theme.'),
    ('f3000000-0000-4000-8000-000000000003', 'DIR001', 'f2000000-0000-4000-8000-000000000003', 4.2, 0.8, 0.8, 'Operational Excellence', 'high', 'planned', 'ADM001', 'f1000000-0000-4000-8000-000000000002', 'Ops rhythm needs stronger weekly review discipline.'),
    ('f3000000-0000-4000-8000-000000000004', 'DIR001', 'f2000000-0000-4000-8000-000000000004', 3.9, 0.1, 0.1, 'Change Leadership', 'medium', 'identified', 'ADM001', 'f1000000-0000-4000-8000-000000000002', 'Transformation comms are mostly stable.'),
    ('f3000000-0000-4000-8000-000000000005', 'BOD003', 'f2000000-0000-4000-8000-000000000005', 4.4, 0.6, 0.6, 'Financial Stewardship', 'high', 'planned', 'ADM001', 'f1000000-0000-4000-8000-000000000003', 'Better monthly cadence for budget checkpoints needed.'),
    ('f3000000-0000-4000-8000-000000000006', 'BOD003', 'f2000000-0000-4000-8000-000000000006', 4.1, 0.0, 0.0, 'Risk Control', 'medium', 'identified', 'ADM001', 'f1000000-0000-4000-8000-000000000003', 'Risk routines are healthy and monitored.'),
    ('f3000000-0000-4000-8000-000000000007', 'MGR001', 'f2000000-0000-4000-8000-000000000007', 3.5, 0.5, 0.5, 'Pipeline Leadership', 'high', 'planned', 'DIR001', 'f1000000-0000-4000-8000-000000000004', 'Needs tighter forecast review with reps.'),
    ('f3000000-0000-4000-8000-000000000008', 'MGR001', 'f2000000-0000-4000-8000-000000000008', 3.4, 0.6, 0.6, 'Coaching & Forecasting', 'high', 'planned', 'DIR001', 'f1000000-0000-4000-8000-000000000004', 'Coaching quality is improving but inconsistent.'),
    ('f3000000-0000-4000-8000-000000000009', 'EMP001', 'f2000000-0000-4000-8000-000000000009', 3.2, 0.8, 0.8, 'Key Account Growth', 'high', 'planned', 'MGR001', 'f1000000-0000-4000-8000-000000000005', 'Needs stronger expansion planning on top accounts.'),
    ('f3000000-0000-4000-8000-000000000010', 'EMP001', 'f2000000-0000-4000-8000-000000000010', 3.1, 0.9, 0.9, 'Solution Selling', 'high', 'planned', 'MGR001', 'f1000000-0000-4000-8000-000000000005', 'Discovery quality is good but not yet consistent.'),
    ('f3000000-0000-4000-8000-000000000011', 'EMP002', 'f2000000-0000-4000-8000-000000000011', 3.0, 1.0, 1.0, 'Client Retention', 'critical', 'planned', 'MGR001', 'f1000000-0000-4000-8000-000000000006', 'Renewal risk remains visible on two major accounts.'),
    ('f3000000-0000-4000-8000-000000000012', 'EMP002', 'f2000000-0000-4000-8000-000000000012', 2.8, 0.2, 0.2, 'Opportunity Conversion', 'medium', 'identified', 'MGR001', 'f1000000-0000-4000-8000-000000000006', 'Conversion process is improving.'),
    ('f3000000-0000-4000-8000-000000000013', 'OPS001', 'f2000000-0000-4000-8000-000000000013', 3.6, 0.4, 0.4, 'Process Optimization', 'medium', 'planned', 'DIR001', 'f1000000-0000-4000-8000-000000000007', 'WIP balancing is stable with room for improvement.'),
    ('f3000000-0000-4000-8000-000000000014', 'OPS001', 'f2000000-0000-4000-8000-000000000014', 3.5, 0.5, 0.5, 'Cross-Functional Coordination', 'medium', 'planned', 'DIR001', 'f1000000-0000-4000-8000-000000000007', 'Coordination with sales handoff needs clearer ownership.'),
    ('f3000000-0000-4000-8000-000000000015', 'OPS002', 'f2000000-0000-4000-8000-000000000015', 2.7, 0.3, 0.3, 'Workforce Scheduling', 'medium', 'planned', 'OPS001', 'f1000000-0000-4000-8000-000000000008', 'Scheduling coverage is adequate but reactive.'),
    ('f3000000-0000-4000-8000-000000000016', 'OPS002', 'f2000000-0000-4000-8000-000000000016', 3.2, 0.8, 0.8, 'Quality Control', 'high', 'planned', 'OPS001', 'f1000000-0000-4000-8000-000000000008', 'Escalation closure needs more consistency.'),
    ('f3000000-0000-4000-8000-000000000017', 'EMP003', 'f2000000-0000-4000-8000-000000000017', 2.8, 0.2, 0.2, 'Inventory Accuracy', 'medium', 'identified', 'OPS002', 'f1000000-0000-4000-8000-000000000009', 'Inventory checks are trending up.'),
    ('f3000000-0000-4000-8000-000000000018', 'EMP003', 'f2000000-0000-4000-8000-000000000018', 2.7, 0.3, 0.3, 'Dispatch Coordination', 'medium', 'planned', 'OPS002', 'f1000000-0000-4000-8000-000000000009', 'Carrier handoff accuracy still needs attention.'),
    ('f3000000-0000-4000-8000-000000000019', 'HR001', 'f2000000-0000-4000-8000-000000000019', 3.8, 0.2, 0.2, 'Workforce Planning', 'medium', 'identified', 'ADM001', 'f1000000-0000-4000-8000-000000000010', 'Hiring roadmap is healthy and monitored quarterly.'),
    ('f3000000-0000-4000-8000-000000000020', 'HR001', 'f2000000-0000-4000-8000-000000000020', 3.6, 0.4, 0.4, 'Policy Governance', 'medium', 'planned', 'ADM001', 'f1000000-0000-4000-8000-000000000010', 'Policy revision cycle is in progress.'),
    ('f3000000-0000-4000-8000-000000000021', 'HR002', 'f2000000-0000-4000-8000-000000000021', 3.3, 0.7, 0.7, 'Learning Design', 'high', 'planned', 'HR001', 'f1000000-0000-4000-8000-000000000011', 'Needs stronger learning path structuring.'),
    ('f3000000-0000-4000-8000-000000000022', 'HR002', 'f2000000-0000-4000-8000-000000000022', 3.0, 0.0, 0.0, 'Facilitation', 'medium', 'identified', 'HR001', 'f1000000-0000-4000-8000-000000000011', 'Facilitation baseline is acceptable.'),
    ('f3000000-0000-4000-8000-000000000023', 'HR003', 'f2000000-0000-4000-8000-000000000023', 2.9, 0.1, 0.1, 'Employee Relations', 'medium', 'identified', 'HR001', 'f1000000-0000-4000-8000-000000000012', 'Case quality improving with coaching.'),
    ('f3000000-0000-4000-8000-000000000024', 'HR003', 'f2000000-0000-4000-8000-000000000024', 2.8, 0.2, 0.2, 'HR Administration', 'medium', 'planned', 'HR001', 'f1000000-0000-4000-8000-000000000012', 'Admin accuracy still has small misses.'),
    ('f3000000-0000-4000-8000-000000000025', 'FIN001', 'f2000000-0000-4000-8000-000000000025', 3.7, 0.3, 0.3, 'Budget Control', 'medium', 'identified', 'BOD003', 'f1000000-0000-4000-8000-000000000013', 'Department spend visibility is good and reviewed monthly.'),
    ('f3000000-0000-4000-8000-000000000026', 'FIN001', 'f2000000-0000-4000-8000-000000000026', 3.6, 0.4, 0.4, 'Financial Analysis', 'medium', 'planned', 'BOD003', 'f1000000-0000-4000-8000-000000000013', 'Management narrative needs sharper insight framing.'),
    ('f3000000-0000-4000-8000-000000000027', 'FIN002', 'f2000000-0000-4000-8000-000000000027', 3.1, 0.9, 0.9, 'Forecast Modelling', 'high', 'planned', 'FIN001', 'f1000000-0000-4000-8000-000000000014', 'Forecast model drivers need better sensitivity ranges.'),
    ('f3000000-0000-4000-8000-000000000028', 'FIN002', 'f2000000-0000-4000-8000-000000000028', 3.0, 0.0, 0.0, 'Variance Analysis', 'medium', 'identified', 'FIN001', 'f1000000-0000-4000-8000-000000000014', 'Variance narrative baseline is acceptable.'),
    ('f3000000-0000-4000-8000-000000000029', 'FIN003', 'f2000000-0000-4000-8000-000000000029', 3.2, 0.8, 0.8, 'Payroll Accuracy', 'high', 'planned', 'FIN001', 'f1000000-0000-4000-8000-000000000015', 'Late adjustment handling needs tighter validation.'),
    ('f3000000-0000-4000-8000-000000000030', 'FIN003', 'f2000000-0000-4000-8000-000000000030', 2.9, 0.1, 0.1, 'Compliance Administration', 'medium', 'identified', 'FIN001', 'f1000000-0000-4000-8000-000000000015', 'Compliance filing quality is stable.')
on conflict (id) do update
set employee_id = excluded.employee_id,
    training_need_id = excluded.training_need_id,
    current_level = excluded.current_level,
    gap_level = excluded.gap_level,
    gap_score = excluded.gap_score,
    competency = excluded.competency,
    priority = excluded.priority,
    status = excluded.status,
    identified_by = excluded.identified_by,
    planned_training_id = excluded.planned_training_id,
    notes = excluded.notes,
    updated_at = timezone('utc', now());

insert into public.kpi_definitions (id, name, description, category, target, unit, effective_period, approval_status, is_active, latest_version_no, approved_by, approved_at)
values
    ('d2000000-0000-4000-8000-000000000001', 'Enterprise Growth Index', 'Quarterly enterprise growth delivery against board plan.', 'Chief Executive Officer', 18, '%', '2026-Q2', 'approved', true, 1, 'ADM001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000002', 'Operational Efficiency Index', 'Cross-company operational efficiency and service stability.', 'Chief Operating Officer', 92, '%', '2026-Q2', 'approved', true, 1, 'ADM001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000003', 'Budget Accuracy', 'Monthly budget accuracy across approved plan lines.', 'Chief Financial Officer', 98, '%', '2026-Q2', 'approved', true, 1, 'ADM001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000004', 'Team Revenue Attainment', 'Sales team quota attainment versus approved target.', 'Sales Manager', 95, '%', '2026-Q2', 'approved', true, 1, 'DIR001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000005', 'Revenue Closed', 'Closed won revenue booked in the quarter.', 'Senior Account Executive', 850, 'IDR (M)', '2026-Q2', 'approved', true, 1, 'MGR001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000006', 'Client Retention Rate', 'Retained key client percentage in active portfolio.', 'Key Account Executive', 92, '%', '2026-Q2', 'approved', true, 1, 'MGR001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000007', 'On-Time Fulfilment', 'Operations throughput completed on agreed schedule.', 'Operations Manager', 96, '%', '2026-Q2', 'approved', true, 1, 'DIR001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000008', 'Shift Productivity', 'Productive output against planned shift volume.', 'Operations Supervisor', 90, '%', '2026-Q2', 'approved', true, 1, 'OPS001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000009', 'Delivery Accuracy', 'Orders dispatched without quantity or destination error.', 'Logistics Coordinator', 97, '%', '2026-Q2', 'approved', true, 1, 'OPS001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000010', 'Hiring SLA', 'Average days to close approved vacancies.', 'HR Manager', 30, 'Days', '2026-Q2', 'approved', true, 1, 'ADM001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000011', 'Training Completion Rate', 'Planned learning programs completed on schedule.', 'Talent Development Specialist', 95, '%', '2026-Q2', 'approved', true, 1, 'HR001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000012', 'Case Resolution SLA', 'Average days to close employee case handling.', 'HR Generalist', 3, 'Days', '2026-Q2', 'approved', true, 1, 'HR001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000013', 'Monthly Close Accuracy', 'Quality and timeliness of monthly close package.', 'Finance Manager', 99, '%', '2026-Q2', 'approved', true, 1, 'BOD003', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000014', 'Forecast Accuracy', 'Forecast output versus actuals across tracked accounts.', 'Finance Analyst', 95, '%', '2026-Q2', 'approved', true, 1, 'FIN001', timezone('utc', now())),
    ('d2000000-0000-4000-8000-000000000015', 'Payroll Accuracy Rate', 'Payroll runs completed without correction tickets.', 'Payroll Officer', 99.5, '%', '2026-Q2', 'approved', true, 1, 'FIN001', timezone('utc', now()))
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    target = excluded.target,
    unit = excluded.unit,
    effective_period = excluded.effective_period,
    approval_status = excluded.approval_status,
    is_active = excluded.is_active,
    latest_version_no = excluded.latest_version_no,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = timezone('utc', now());

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_definitions' and column_name = 'applies_to_position'
    ) then
        update public.kpi_definitions
        set applies_to_position = coalesce(nullif(applies_to_position, ''), category)
        where id like 'd2000000-%';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_definitions' and column_name = 'target_value'
    ) then
        update public.kpi_definitions
        set target_value = coalesce(target_value, target)
        where id like 'd2000000-%';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_definitions' and column_name = 'effective_date'
    ) then
        update public.kpi_definitions
        set effective_date = coalesce(effective_date, date '2026-04-01')
        where id like 'd2000000-%';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_definitions' and column_name = 'status'
    ) then
        update public.kpi_definitions
        set status = coalesce(nullif(status, ''), approval_status)
        where id like 'd2000000-%';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_definitions' and column_name = 'version'
    ) then
        update public.kpi_definitions
        set version = coalesce(version, latest_version_no, 1)
        where id like 'd2000000-%';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_definitions' and column_name = 'created_by'
    ) then
        update public.kpi_definitions
        set created_by = coalesce(created_by, approved_by)
        where id like 'd2000000-%';
    end if;
end $$;

insert into public.kpi_definition_versions (id, kpi_definition_id, version_no, effective_period, name, description, category, target, unit, status, requested_by, approved_by, approved_at)
values
    ('d2100000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 1, '2026-Q2', 'Enterprise Growth Index', 'Quarterly enterprise growth delivery against board plan.', 'Chief Executive Officer', 18, '%', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 1, '2026-Q2', 'Operational Efficiency Index', 'Cross-company operational efficiency and service stability.', 'Chief Operating Officer', 92, '%', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000003', 1, '2026-Q2', 'Budget Accuracy', 'Monthly budget accuracy across approved plan lines.', 'Chief Financial Officer', 98, '%', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000004', 1, '2026-Q2', 'Team Revenue Attainment', 'Sales team quota attainment versus approved target.', 'Sales Manager', 95, '%', 'approved', 'DIR001', 'DIR001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000005', 1, '2026-Q2', 'Revenue Closed', 'Closed won revenue booked in the quarter.', 'Senior Account Executive', 850, 'IDR (M)', 'approved', 'MGR001', 'MGR001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000006', 'd2000000-0000-4000-8000-000000000006', 1, '2026-Q2', 'Client Retention Rate', 'Retained key client percentage in active portfolio.', 'Key Account Executive', 92, '%', 'approved', 'MGR001', 'MGR001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000007', 'd2000000-0000-4000-8000-000000000007', 1, '2026-Q2', 'On-Time Fulfilment', 'Operations throughput completed on agreed schedule.', 'Operations Manager', 96, '%', 'approved', 'DIR001', 'DIR001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000008', 'd2000000-0000-4000-8000-000000000008', 1, '2026-Q2', 'Shift Productivity', 'Productive output against planned shift volume.', 'Operations Supervisor', 90, '%', 'approved', 'OPS001', 'OPS001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000009', 'd2000000-0000-4000-8000-000000000009', 1, '2026-Q2', 'Delivery Accuracy', 'Orders dispatched without quantity or destination error.', 'Logistics Coordinator', 97, '%', 'approved', 'OPS001', 'OPS001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000010', 'd2000000-0000-4000-8000-000000000010', 1, '2026-Q2', 'Hiring SLA', 'Average days to close approved vacancies.', 'HR Manager', 30, 'Days', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000011', 'd2000000-0000-4000-8000-000000000011', 1, '2026-Q2', 'Training Completion Rate', 'Planned learning programs completed on schedule.', 'Talent Development Specialist', 95, '%', 'approved', 'HR001', 'HR001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000012', 'd2000000-0000-4000-8000-000000000012', 1, '2026-Q2', 'Case Resolution SLA', 'Average days to close employee case handling.', 'HR Generalist', 3, 'Days', 'approved', 'HR001', 'HR001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000013', 'd2000000-0000-4000-8000-000000000013', 1, '2026-Q2', 'Monthly Close Accuracy', 'Quality and timeliness of monthly close package.', 'Finance Manager', 99, '%', 'approved', 'BOD003', 'BOD003', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000014', 'd2000000-0000-4000-8000-000000000014', 1, '2026-Q2', 'Forecast Accuracy', 'Forecast output versus actuals across tracked accounts.', 'Finance Analyst', 95, '%', 'approved', 'FIN001', 'FIN001', timezone('utc', now())),
    ('d2100000-0000-4000-8000-000000000015', 'd2000000-0000-4000-8000-000000000015', 1, '2026-Q2', 'Payroll Accuracy Rate', 'Payroll runs completed without correction tickets.', 'Payroll Officer', 99.5, '%', 'approved', 'FIN001', 'FIN001', timezone('utc', now()))
on conflict (id) do update
set status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = timezone('utc', now());

insert into public.employee_kpi_target_versions (id, employee_id, kpi_id, effective_period, version_no, target_value, unit, status, requested_by, approved_by, approved_at)
values
    ('d2200000-0000-4000-8000-000000000001', 'ADM001', 'd2000000-0000-4000-8000-000000000001', '2026-Q2', 1, 18, '%', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000002', 'DIR001', 'd2000000-0000-4000-8000-000000000002', '2026-Q2', 1, 92, '%', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000003', 'BOD003', 'd2000000-0000-4000-8000-000000000003', '2026-Q2', 1, 98, '%', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000004', 'MGR001', 'd2000000-0000-4000-8000-000000000004', '2026-Q2', 1, 95, '%', 'approved', 'DIR001', 'DIR001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000005', 'EMP001', 'd2000000-0000-4000-8000-000000000005', '2026-Q2', 1, 850, 'IDR (M)', 'approved', 'MGR001', 'MGR001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000006', 'EMP002', 'd2000000-0000-4000-8000-000000000006', '2026-Q2', 1, 92, '%', 'approved', 'MGR001', 'MGR001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000007', 'OPS001', 'd2000000-0000-4000-8000-000000000007', '2026-Q2', 1, 96, '%', 'approved', 'DIR001', 'DIR001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000008', 'OPS002', 'd2000000-0000-4000-8000-000000000008', '2026-Q2', 1, 90, '%', 'approved', 'OPS001', 'OPS001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000009', 'EMP003', 'd2000000-0000-4000-8000-000000000009', '2026-Q2', 1, 97, '%', 'approved', 'OPS001', 'OPS001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000010', 'HR001', 'd2000000-0000-4000-8000-000000000010', '2026-Q2', 1, 30, 'Days', 'approved', 'ADM001', 'ADM001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000011', 'HR002', 'd2000000-0000-4000-8000-000000000011', '2026-Q2', 1, 95, '%', 'approved', 'HR001', 'HR001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000012', 'HR003', 'd2000000-0000-4000-8000-000000000012', '2026-Q2', 1, 3, 'Days', 'approved', 'HR001', 'HR001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000013', 'FIN001', 'd2000000-0000-4000-8000-000000000013', '2026-Q2', 1, 99, '%', 'approved', 'BOD003', 'BOD003', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000014', 'FIN002', 'd2000000-0000-4000-8000-000000000014', '2026-Q2', 1, 95, '%', 'approved', 'FIN001', 'FIN001', timezone('utc', now())),
    ('d2200000-0000-4000-8000-000000000015', 'FIN003', 'd2000000-0000-4000-8000-000000000015', '2026-Q2', 1, 99.5, '%', 'approved', 'FIN001', 'FIN001', timezone('utc', now()))
on conflict (id) do update
set target_value = excluded.target_value,
    unit = excluded.unit,
    status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = timezone('utc', now());

insert into public.kpi_records (id, employee_id, kpi_id, period, value, notes, submitted_by, target_snapshot, definition_version_id, target_version_id, kpi_name_snapshot, kpi_unit_snapshot, kpi_category_snapshot)
values
    ('d2300000-0000-4000-8000-000000000001', 'ADM001', 'd2000000-0000-4000-8000-000000000001', '2026-Q2', 16.8, 'Enterprise expansion is on track with two strategic initiatives delayed slightly.', 'ADM001', 18, 'd2100000-0000-4000-8000-000000000001', 'd2200000-0000-4000-8000-000000000001', 'Enterprise Growth Index', '%', 'Chief Executive Officer'),
    ('d2300000-0000-4000-8000-000000000002', 'DIR001', 'd2000000-0000-4000-8000-000000000002', '2026-Q2', 90.4, 'Operating rhythm improved, but fulfillment variance remains on one region.', 'DIR001', 92, 'd2100000-0000-4000-8000-000000000002', 'd2200000-0000-4000-8000-000000000002', 'Operational Efficiency Index', '%', 'Chief Operating Officer'),
    ('d2300000-0000-4000-8000-000000000003', 'BOD003', 'd2000000-0000-4000-8000-000000000003', '2026-Q2', 97.2, 'Budget posture is healthy with minor variance in shared services.', 'BOD003', 98, 'd2100000-0000-4000-8000-000000000003', 'd2200000-0000-4000-8000-000000000003', 'Budget Accuracy', '%', 'Chief Financial Officer'),
    ('d2300000-0000-4000-8000-000000000004', 'MGR001', 'd2000000-0000-4000-8000-000000000004', '2026-Q2', 93.8, 'Team performance is strong but one territory is behind quota.', 'MGR001', 95, 'd2100000-0000-4000-8000-000000000004', 'd2200000-0000-4000-8000-000000000004', 'Team Revenue Attainment', '%', 'Sales Manager'),
    ('d2300000-0000-4000-8000-000000000005', 'EMP001', 'd2000000-0000-4000-8000-000000000005', '2026-Q2', 812, 'Closed two strategic accounts and advanced one renewal expansion.', 'EMP001', 850, 'd2100000-0000-4000-8000-000000000005', 'd2200000-0000-4000-8000-000000000005', 'Revenue Closed', 'IDR (M)', 'Senior Account Executive'),
    ('d2300000-0000-4000-8000-000000000006', 'EMP002', 'd2000000-0000-4000-8000-000000000006', '2026-Q2', 90.5, 'Renewal coverage improved, but one key account remains at risk.', 'EMP002', 92, 'd2100000-0000-4000-8000-000000000006', 'd2200000-0000-4000-8000-000000000006', 'Client Retention Rate', '%', 'Key Account Executive'),
    ('d2300000-0000-4000-8000-000000000007', 'OPS001', 'd2000000-0000-4000-8000-000000000007', '2026-Q2', 94.7, 'Fulfilment is improving after roster balancing and SOP review.', 'OPS001', 96, 'd2100000-0000-4000-8000-000000000007', 'd2200000-0000-4000-8000-000000000007', 'On-Time Fulfilment', '%', 'Operations Manager'),
    ('d2300000-0000-4000-8000-000000000008', 'OPS002', 'd2000000-0000-4000-8000-000000000008', '2026-Q2', 88.6, 'Shift productivity improved after scheduling changes but still below target.', 'OPS002', 90, 'd2100000-0000-4000-8000-000000000008', 'd2200000-0000-4000-8000-000000000008', 'Shift Productivity', '%', 'Operations Supervisor'),
    ('d2300000-0000-4000-8000-000000000009', 'EMP003', 'd2000000-0000-4000-8000-000000000009', '2026-Q2', 96.3, 'Dispatch accuracy is strong with minor inventory variance.', 'EMP003', 97, 'd2100000-0000-4000-8000-000000000009', 'd2200000-0000-4000-8000-000000000009', 'Delivery Accuracy', '%', 'Logistics Coordinator'),
    ('d2300000-0000-4000-8000-000000000010', 'HR001', 'd2000000-0000-4000-8000-000000000010', '2026-Q2', 27, 'Hiring closure time improved after intake standardization.', 'HR001', 30, 'd2100000-0000-4000-8000-000000000010', 'd2200000-0000-4000-8000-000000000010', 'Hiring SLA', 'Days', 'HR Manager'),
    ('d2300000-0000-4000-8000-000000000011', 'HR002', 'd2000000-0000-4000-8000-000000000011', '2026-Q2', 92, 'Most programs delivered on time with one postponed cohort.', 'HR002', 95, 'd2100000-0000-4000-8000-000000000011', 'd2200000-0000-4000-8000-000000000011', 'Training Completion Rate', '%', 'Talent Development Specialist'),
    ('d2300000-0000-4000-8000-000000000012', 'HR003', 'd2000000-0000-4000-8000-000000000012', '2026-Q2', 2.5, 'Employee cases are generally resolved within service expectation.', 'HR003', 3, 'd2100000-0000-4000-8000-000000000012', 'd2200000-0000-4000-8000-000000000012', 'Case Resolution SLA', 'Days', 'HR Generalist'),
    ('d2300000-0000-4000-8000-000000000013', 'FIN001', 'd2000000-0000-4000-8000-000000000013', '2026-Q2', 98.4, 'Close package quality remains high with minor ledger adjustment.', 'FIN001', 99, 'd2100000-0000-4000-8000-000000000013', 'd2200000-0000-4000-8000-000000000013', 'Monthly Close Accuracy', '%', 'Finance Manager'),
    ('d2300000-0000-4000-8000-000000000014', 'FIN002', 'd2000000-0000-4000-8000-000000000014', '2026-Q2', 93.6, 'Forecast narrative is improving with better driver assumptions.', 'FIN002', 95, 'd2100000-0000-4000-8000-000000000014', 'd2200000-0000-4000-8000-000000000014', 'Forecast Accuracy', '%', 'Finance Analyst'),
    ('d2300000-0000-4000-8000-000000000015', 'FIN003', 'd2000000-0000-4000-8000-000000000015', '2026-Q2', 99.1, 'Payroll run quality is high with one manual correction this quarter.', 'FIN003', 99.5, 'd2100000-0000-4000-8000-000000000015', 'd2200000-0000-4000-8000-000000000015', 'Payroll Accuracy Rate', '%', 'Payroll Officer')
on conflict (id) do update
set value = excluded.value,
    notes = excluded.notes,
    submitted_by = excluded.submitted_by,
    target_snapshot = excluded.target_snapshot,
    definition_version_id = excluded.definition_version_id,
    target_version_id = excluded.target_version_id,
    kpi_name_snapshot = excluded.kpi_name_snapshot,
    kpi_unit_snapshot = excluded.kpi_unit_snapshot,
    kpi_category_snapshot = excluded.kpi_category_snapshot,
    updated_at = timezone('utc', now());

insert into public.kpi_records (id, employee_id, kpi_id, period, value, notes, submitted_by, target_snapshot, definition_version_id, target_version_id, kpi_name_snapshot, kpi_unit_snapshot, kpi_category_snapshot)
values
    ('d2310000-0000-4000-8000-000000000001', 'ADM001', 'd2000000-0000-4000-8000-000000000001', '2026-04', 16.8, 'Monthly dashboard baseline for April 2026.', 'ADM001', 18, 'd2100000-0000-4000-8000-000000000001', 'd2200000-0000-4000-8000-000000000001', 'Enterprise Growth Index', '%', 'Chief Executive Officer'),
    ('d2310000-0000-4000-8000-000000000002', 'DIR001', 'd2000000-0000-4000-8000-000000000002', '2026-04', 90.4, 'Monthly dashboard baseline for April 2026.', 'DIR001', 92, 'd2100000-0000-4000-8000-000000000002', 'd2200000-0000-4000-8000-000000000002', 'Operational Efficiency Index', '%', 'Chief Operating Officer'),
    ('d2310000-0000-4000-8000-000000000003', 'BOD003', 'd2000000-0000-4000-8000-000000000003', '2026-04', 97.2, 'Monthly dashboard baseline for April 2026.', 'BOD003', 98, 'd2100000-0000-4000-8000-000000000003', 'd2200000-0000-4000-8000-000000000003', 'Budget Accuracy', '%', 'Chief Financial Officer'),
    ('d2310000-0000-4000-8000-000000000004', 'MGR001', 'd2000000-0000-4000-8000-000000000004', '2026-04', 93.8, 'Monthly dashboard baseline for April 2026.', 'MGR001', 95, 'd2100000-0000-4000-8000-000000000004', 'd2200000-0000-4000-8000-000000000004', 'Team Revenue Attainment', '%', 'Sales Manager'),
    ('d2310000-0000-4000-8000-000000000005', 'EMP001', 'd2000000-0000-4000-8000-000000000005', '2026-04', 812, 'Monthly dashboard baseline for April 2026.', 'EMP001', 850, 'd2100000-0000-4000-8000-000000000005', 'd2200000-0000-4000-8000-000000000005', 'Revenue Closed', 'IDR (M)', 'Senior Account Executive'),
    ('d2310000-0000-4000-8000-000000000006', 'EMP002', 'd2000000-0000-4000-8000-000000000006', '2026-04', 90.5, 'Monthly dashboard baseline for April 2026.', 'EMP002', 92, 'd2100000-0000-4000-8000-000000000006', 'd2200000-0000-4000-8000-000000000006', 'Client Retention Rate', '%', 'Key Account Executive'),
    ('d2310000-0000-4000-8000-000000000007', 'OPS001', 'd2000000-0000-4000-8000-000000000007', '2026-04', 94.7, 'Monthly dashboard baseline for April 2026.', 'OPS001', 96, 'd2100000-0000-4000-8000-000000000007', 'd2200000-0000-4000-8000-000000000007', 'On-Time Fulfilment', '%', 'Operations Manager'),
    ('d2310000-0000-4000-8000-000000000008', 'OPS002', 'd2000000-0000-4000-8000-000000000008', '2026-04', 88.6, 'Monthly dashboard baseline for April 2026.', 'OPS002', 90, 'd2100000-0000-4000-8000-000000000008', 'd2200000-0000-4000-8000-000000000008', 'Shift Productivity', '%', 'Operations Supervisor'),
    ('d2310000-0000-4000-8000-000000000009', 'EMP003', 'd2000000-0000-4000-8000-000000000009', '2026-04', 96.3, 'Monthly dashboard baseline for April 2026.', 'EMP003', 97, 'd2100000-0000-4000-8000-000000000009', 'd2200000-0000-4000-8000-000000000009', 'Delivery Accuracy', '%', 'Logistics Coordinator'),
    ('d2310000-0000-4000-8000-000000000010', 'HR001', 'd2000000-0000-4000-8000-000000000010', '2026-04', 27, 'Monthly dashboard baseline for April 2026.', 'HR001', 30, 'd2100000-0000-4000-8000-000000000010', 'd2200000-0000-4000-8000-000000000010', 'Hiring SLA', 'Days', 'HR Manager'),
    ('d2310000-0000-4000-8000-000000000011', 'HR002', 'd2000000-0000-4000-8000-000000000011', '2026-04', 92, 'Monthly dashboard baseline for April 2026.', 'HR002', 95, 'd2100000-0000-4000-8000-000000000011', 'd2200000-0000-4000-8000-000000000011', 'Training Completion Rate', '%', 'Talent Development Specialist'),
    ('d2310000-0000-4000-8000-000000000012', 'HR003', 'd2000000-0000-4000-8000-000000000012', '2026-04', 2.5, 'Monthly dashboard baseline for April 2026.', 'HR003', 3, 'd2100000-0000-4000-8000-000000000012', 'd2200000-0000-4000-8000-000000000012', 'Case Resolution SLA', 'Days', 'HR Generalist'),
    ('d2310000-0000-4000-8000-000000000013', 'FIN001', 'd2000000-0000-4000-8000-000000000013', '2026-04', 98.4, 'Monthly dashboard baseline for April 2026.', 'FIN001', 99, 'd2100000-0000-4000-8000-000000000013', 'd2200000-0000-4000-8000-000000000013', 'Monthly Close Accuracy', '%', 'Finance Manager'),
    ('d2310000-0000-4000-8000-000000000014', 'FIN002', 'd2000000-0000-4000-8000-000000000014', '2026-04', 93.6, 'Monthly dashboard baseline for April 2026.', 'FIN002', 95, 'd2100000-0000-4000-8000-000000000014', 'd2200000-0000-4000-8000-000000000014', 'Forecast Accuracy', '%', 'Finance Analyst'),
    ('d2310000-0000-4000-8000-000000000015', 'FIN003', 'd2000000-0000-4000-8000-000000000015', '2026-04', 99.1, 'Monthly dashboard baseline for April 2026.', 'FIN003', 99.5, 'd2100000-0000-4000-8000-000000000015', 'd2200000-0000-4000-8000-000000000015', 'Payroll Accuracy Rate', '%', 'Payroll Officer')
on conflict (id) do update
set period = excluded.period,
    value = excluded.value,
    notes = excluded.notes,
    submitted_by = excluded.submitted_by,
    target_snapshot = excluded.target_snapshot,
    definition_version_id = excluded.definition_version_id,
    target_version_id = excluded.target_version_id,
    kpi_name_snapshot = excluded.kpi_name_snapshot,
    kpi_unit_snapshot = excluded.kpi_unit_snapshot,
    kpi_category_snapshot = excluded.kpi_category_snapshot,
    updated_at = timezone('utc', now());

do $$
declare
    target_snapshot_type text;
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'kpi_records' and column_name = 'achievement_pct'
    ) then
        select data_type
        into target_snapshot_type
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'kpi_records'
          and column_name = 'target_snapshot';

        if target_snapshot_type in ('numeric', 'integer', 'bigint', 'real', 'double precision') then
            update public.kpi_records
            set achievement_pct = round(((value / nullif(target_snapshot::numeric, 0)) * 100)::numeric, 1)
            where id like 'd23%'
              and target_snapshot is not null;
        elsif target_snapshot_type in ('json', 'jsonb') then
            update public.kpi_records
            set achievement_pct = round((
                value / nullif(((target_snapshot ->> 'target_value')::numeric), 0)
            * 100)::numeric, 1)
            where id like 'd23%'
              and target_snapshot is not null
              and (target_snapshot ->> 'target_value') is not null;
        end if;
    end if;
end $$;

insert into public.courses (id, title, description, short_description, category, tags, difficulty_level, estimated_duration_minutes, author_employee_id, status, is_mandatory, competencies_covered, passing_score, published_at)
values
    ('c1000000-0000-4000-8000-000000000001', 'Executive Communication Essentials', 'Strengthen board-ready communication, executive updates, and alignment rituals.', 'Executive storytelling and communication cadence.', 'Leadership', '["Leadership","Communication"]'::jsonb, 'intermediate', 95, 'ADM001', 'published', false, '["Strategic Leadership","Board Governance"]'::jsonb, 75, timezone('utc', now()) - interval '30 days'),
    ('c1000000-0000-4000-8000-000000000002', 'Sales Pipeline Mastery', 'Build a healthier pipeline, stronger qualification discipline, and better forecast quality.', 'Pipeline building and qualification discipline.', 'Sales', '["Sales","Pipeline"]'::jsonb, 'beginner', 120, 'MGR001', 'published', true, '["Pipeline Leadership","Opportunity Conversion"]'::jsonb, 70, timezone('utc', now()) - interval '28 days'),
    ('c1000000-0000-4000-8000-000000000003', 'Strategic Account Management', 'Run account plans, stakeholder maps, and expansion plays for larger clients.', 'Account planning for strategic growth.', 'Sales', '["Sales","Account Management"]'::jsonb, 'intermediate', 140, 'EMP001', 'published', false, '["Key Account Growth","Client Retention"]'::jsonb, 75, timezone('utc', now()) - interval '26 days'),
    ('c1000000-0000-4000-8000-000000000004', 'Operations Control Room', 'Improve dispatch rhythm, service visibility, and floor escalation handling.', 'Operational control and service stability.', 'Operations', '["Operations","Quality"]'::jsonb, 'intermediate', 110, 'OPS001', 'published', true, '["Process Optimization","Quality Control"]'::jsonb, 72, timezone('utc', now()) - interval '24 days'),
    ('c1000000-0000-4000-8000-000000000005', 'People Operations Foundations', 'Cover workforce planning basics, employee case handling, and HR service quality.', 'Core HR operations and workforce planning.', 'HR', '["HR","People Operations"]'::jsonb, 'beginner', 105, 'HR001', 'published', false, '["Workforce Planning","Employee Relations"]'::jsonb, 70, timezone('utc', now()) - interval '22 days'),
    ('c1000000-0000-4000-8000-000000000006', 'Finance Business Partnering', 'Translate financial analysis into clear business recommendations and operating decisions.', 'Finance analysis and business partnering.', 'Finance', '["Finance","Analysis"]'::jsonb, 'intermediate', 130, 'FIN001', 'published', false, '["Financial Analysis","Forecast Modelling"]'::jsonb, 75, timezone('utc', now()) - interval '20 days')
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    short_description = excluded.short_description,
    category = excluded.category,
    tags = excluded.tags,
    difficulty_level = excluded.difficulty_level,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    author_employee_id = excluded.author_employee_id,
    status = excluded.status,
    is_mandatory = excluded.is_mandatory,
    competencies_covered = excluded.competencies_covered,
    passing_score = excluded.passing_score,
    published_at = excluded.published_at,
    updated_at = timezone('utc', now());

insert into public.course_sections (id, course_id, title, description, ordinal)
values
    ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Executive Message Design', 'How to frame concise updates and strategic narratives.', 1),
    ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Stakeholder Alignment', 'Cadence and communication routines for leadership teams.', 2),
    ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'Pipeline Structure', 'Qualification and stage discipline basics.', 1),
    ('c2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'Forecast Rhythm', 'Review rhythm and conversion planning.', 2),
    ('c2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000003', 'Account Planning', 'Mapping stakeholders and whitespace opportunities.', 1),
    ('c2000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000003', 'Expansion Plays', 'Retention and growth plays for existing accounts.', 2),
    ('c2000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000004', 'Control Tower Basics', 'How to monitor service health and escalations.', 1),
    ('c2000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000004', 'Floor Quality', 'Quality routines and daily management.', 2),
    ('c2000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000005', 'Workforce Planning Basics', 'Capacity planning and staffing assumptions.', 1),
    ('c2000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000005', 'Employee Case Handling', 'Case triage and documentation quality.', 2),
    ('c2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006', 'Financial Storytelling', 'Turn numbers into better management decisions.', 1),
    ('c2000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000006', 'Forecast Review', 'Lead forecast conversations with confidence.', 2)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    ordinal = excluded.ordinal,
    updated_at = timezone('utc', now());

insert into public.lessons (id, section_id, course_id, title, description, content_type, content_text, ordinal, is_preview, estimated_duration_minutes)
values
    ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Executive Update Framework', 'Build sharper executive updates.', 'text', '<p>Use context, signal, risk, and next-step framing.</p>', 1, true, 20),
    ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Stakeholder Communication Check', 'Quick comprehension quiz.', 'quiz', null, 1, false, 10),
    ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'Pipeline Stages That Matter', 'Define stage exit criteria and quality gates.', 'text', '<p>Qualification quality protects forecast accuracy.</p>', 1, true, 18),
    ('c3000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'Forecast Review Quiz', 'Quiz on review cadence and coverage.', 'quiz', null, 1, false, 12),
    ('c3000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000003', 'Stakeholder Mapping', 'Map influence, risk, and expansion routes.', 'text', '<p>Keep one living stakeholder map for each key account.</p>', 1, true, 22),
    ('c3000000-0000-4000-8000-000000000006', 'c2000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000003', 'Retention Signals', 'Spot warning signs before renewal risk grows.', 'text', '<p>Monitor usage, sponsorship, and unresolved blockers.</p>', 1, false, 20),
    ('c3000000-0000-4000-8000-000000000007', 'c2000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000004', 'Control Room Metrics', 'Choose the metrics that keep daily ops stable.', 'text', '<p>Watch throughput, queue age, and escalation volume.</p>', 1, true, 18),
    ('c3000000-0000-4000-8000-000000000008', 'c2000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000004', 'Quality Escalation Drill', 'Apply quality escalation logic.', 'practice', '<p>Run the escalation decision tree for sample cases.</p>', 1, false, 18),
    ('c3000000-0000-4000-8000-000000000009', 'c2000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000005', 'Capacity Planning Basics', 'Translate hiring demand into staffing plans.', 'text', '<p>Use workload assumptions, ramp time, and hiring lead time.</p>', 1, true, 16),
    ('c3000000-0000-4000-8000-000000000010', 'c2000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000005', 'Case Note Quality', 'Improve case resolution notes and closure quality.', 'text', '<p>Document issue, action, decision, and follow-up clearly.</p>', 1, false, 17),
    ('c3000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006', 'Tell The Financial Story', 'Present financial patterns in operational language.', 'text', '<p>Lead with signal, driver, implication, and action.</p>', 1, true, 19),
    ('c3000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000006', 'Forecast Review Habits', 'Build a reliable forecast review habit.', 'text', '<p>Review assumptions weekly and flag movement early.</p>', 1, false, 18)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    content_type = excluded.content_type,
    content_text = excluded.content_text,
    ordinal = excluded.ordinal,
    is_preview = excluded.is_preview,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    updated_at = timezone('utc', now());

insert into public.quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, points, ordinal)
values
    ('c4000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000002', 'Which structure best fits an executive update?', 'multiple_choice', '["Problem, opinion, details","Context, signal, risk, next step","Greeting, agenda, appendix"]'::jsonb, '"Context, signal, risk, next step"'::jsonb, 1, 1),
    ('c4000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000004', 'What protects forecast accuracy most?', 'multiple_choice', '["More late-stage deals","Clear stage exit criteria","Larger contact lists"]'::jsonb, '"Clear stage exit criteria"'::jsonb, 1, 1)
on conflict (id) do update
set question_text = excluded.question_text,
    question_type = excluded.question_type,
    options = excluded.options,
    correct_answer = excluded.correct_answer,
    points = excluded.points,
    ordinal = excluded.ordinal,
    updated_at = timezone('utc', now());

insert into public.course_enrollments (id, course_id, employee_id, enrolled_by, enrollment_type, status, progress_percent, score, started_at, completed_at, due_date, certificate_issued, time_spent_seconds, attempts_count, last_accessed_at)
values
    ('c5000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'EMP001', 'MGR001', 'assigned', 'in_progress', 50, null, timezone('utc', now()) - interval '10 days', null, current_date + 10, false, 1800, 1, timezone('utc', now()) - interval '1 day'),
    ('c5000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 'EMP002', 'MGR001', 'assigned', 'completed', 100, 88, timezone('utc', now()) - interval '16 days', timezone('utc', now()) - interval '5 days', current_date - 5, true, 4200, 2, timezone('utc', now()) - interval '5 days'),
    ('c5000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000004', 'OPS002', 'OPS001', 'assigned', 'in_progress', 45, null, timezone('utc', now()) - interval '8 days', null, current_date + 14, false, 1600, 1, timezone('utc', now()) - interval '2 days'),
    ('c5000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000005', 'HR003', 'HR001', 'assigned', 'completed', 100, 92, timezone('utc', now()) - interval '20 days', timezone('utc', now()) - interval '7 days', current_date - 7, true, 3900, 1, timezone('utc', now()) - interval '7 days'),
    ('c5000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000006', 'FIN002', 'FIN001', 'assigned', 'in_progress', 60, null, timezone('utc', now()) - interval '9 days', null, current_date + 12, false, 2100, 1, timezone('utc', now()) - interval '1 day'),
    ('c5000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'ADM001', 'ADM001', 'self', 'completed', 100, 95, timezone('utc', now()) - interval '18 days', timezone('utc', now()) - interval '4 days', current_date - 4, true, 2600, 1, timezone('utc', now()) - interval '4 days'),
    ('c5000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000005', 'HR001', 'HR001', 'self', 'in_progress', 40, null, timezone('utc', now()) - interval '6 days', null, current_date + 21, false, 1500, 1, timezone('utc', now()) - interval '1 day'),
    ('c5000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000002', 'MGR001', 'MGR001', 'self', 'completed', 100, 90, timezone('utc', now()) - interval '14 days', timezone('utc', now()) - interval '3 days', current_date - 3, true, 3200, 1, timezone('utc', now()) - interval '3 days')
on conflict (id) do update
set status = excluded.status,
    progress_percent = excluded.progress_percent,
    score = excluded.score,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    due_date = excluded.due_date,
    certificate_issued = excluded.certificate_issued,
    time_spent_seconds = excluded.time_spent_seconds,
    attempts_count = excluded.attempts_count,
    last_accessed_at = excluded.last_accessed_at,
    updated_at = timezone('utc', now());

insert into public.lesson_progress (id, enrollment_id, lesson_id, status, progress_percent, score, time_spent_seconds, first_accessed_at, completed_at, last_accessed_at)
values
    ('c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000003', 'completed', 100, null, 900, timezone('utc', now()) - interval '10 days', timezone('utc', now()) - interval '8 days', timezone('utc', now()) - interval '8 days'),
    ('c6000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000004', 'in_progress', 50, null, 900, timezone('utc', now()) - interval '2 days', null, timezone('utc', now()) - interval '1 day'),
    ('c6000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000005', 'completed', 100, null, 1200, timezone('utc', now()) - interval '16 days', timezone('utc', now()) - interval '10 days', timezone('utc', now()) - interval '10 days'),
    ('c6000000-0000-4000-8000-000000000004', 'c5000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000006', 'completed', 100, null, 1100, timezone('utc', now()) - interval '9 days', timezone('utc', now()) - interval '5 days', timezone('utc', now()) - interval '5 days'),
    ('c6000000-0000-4000-8000-000000000005', 'c5000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000007', 'completed', 100, null, 800, timezone('utc', now()) - interval '8 days', timezone('utc', now()) - interval '6 days', timezone('utc', now()) - interval '6 days'),
    ('c6000000-0000-4000-8000-000000000006', 'c5000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000008', 'in_progress', 30, null, 800, timezone('utc', now()) - interval '2 days', null, timezone('utc', now()) - interval '2 days'),
    ('c6000000-0000-4000-8000-000000000007', 'c5000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000009', 'completed', 100, null, 900, timezone('utc', now()) - interval '20 days', timezone('utc', now()) - interval '14 days', timezone('utc', now()) - interval '14 days'),
    ('c6000000-0000-4000-8000-000000000008', 'c5000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000010', 'completed', 100, null, 1000, timezone('utc', now()) - interval '13 days', timezone('utc', now()) - interval '7 days', timezone('utc', now()) - interval '7 days'),
    ('c6000000-0000-4000-8000-000000000009', 'c5000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000011', 'completed', 100, null, 1000, timezone('utc', now()) - interval '9 days', timezone('utc', now()) - interval '6 days', timezone('utc', now()) - interval '6 days'),
    ('c6000000-0000-4000-8000-000000000010', 'c5000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000012', 'in_progress', 20, null, 1100, timezone('utc', now()) - interval '1 day', null, timezone('utc', now()) - interval '1 day'),
    ('c6000000-0000-4000-8000-000000000011', 'c5000000-0000-4000-8000-000000000006', 'c3000000-0000-4000-8000-000000000001', 'completed', 100, null, 1000, timezone('utc', now()) - interval '18 days', timezone('utc', now()) - interval '12 days', timezone('utc', now()) - interval '12 days'),
    ('c6000000-0000-4000-8000-000000000012', 'c5000000-0000-4000-8000-000000000006', 'c3000000-0000-4000-8000-000000000002', 'completed', 100, 95, 900, timezone('utc', now()) - interval '8 days', timezone('utc', now()) - interval '4 days', timezone('utc', now()) - interval '4 days'),
    ('c6000000-0000-4000-8000-000000000013', 'c5000000-0000-4000-8000-000000000007', 'c3000000-0000-4000-8000-000000000009', 'completed', 100, null, 700, timezone('utc', now()) - interval '6 days', timezone('utc', now()) - interval '4 days', timezone('utc', now()) - interval '4 days'),
    ('c6000000-0000-4000-8000-000000000014', 'c5000000-0000-4000-8000-000000000007', 'c3000000-0000-4000-8000-000000000010', 'in_progress', 40, null, 800, timezone('utc', now()) - interval '2 days', null, timezone('utc', now()) - interval '1 day'),
    ('c6000000-0000-4000-8000-000000000015', 'c5000000-0000-4000-8000-000000000008', 'c3000000-0000-4000-8000-000000000003', 'completed', 100, null, 950, timezone('utc', now()) - interval '14 days', timezone('utc', now()) - interval '10 days', timezone('utc', now()) - interval '10 days'),
    ('c6000000-0000-4000-8000-000000000016', 'c5000000-0000-4000-8000-000000000008', 'c3000000-0000-4000-8000-000000000004', 'completed', 100, 90, 980, timezone('utc', now()) - interval '8 days', timezone('utc', now()) - interval '3 days', timezone('utc', now()) - interval '3 days')
on conflict (enrollment_id, lesson_id) do update
set status = excluded.status,
    progress_percent = excluded.progress_percent,
    score = excluded.score,
    time_spent_seconds = excluded.time_spent_seconds,
    first_accessed_at = excluded.first_accessed_at,
    completed_at = excluded.completed_at,
    last_accessed_at = excluded.last_accessed_at,
    updated_at = timezone('utc', now());

insert into public.quiz_attempts (id, enrollment_id, lesson_id, attempt_number, answers, score, passed, submitted_at, time_spent_seconds)
values
    ('c7000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000006', 'c3000000-0000-4000-8000-000000000002', 1, '{"c4000000-0000-4000-8000-000000000001":"Context, signal, risk, next step"}'::jsonb, 100, true, timezone('utc', now()) - interval '4 days', 540),
    ('c7000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000004', 1, '{"c4000000-0000-4000-8000-000000000002":"Clear stage exit criteria"}'::jsonb, 100, true, timezone('utc', now()) - interval '5 days', 480)
on conflict (id) do update
set answers = excluded.answers,
    score = excluded.score,
    passed = excluded.passed,
    submitted_at = excluded.submitted_at,
    time_spent_seconds = excluded.time_spent_seconds;

insert into public.course_reviews (id, course_id, employee_id, rating, review_text)
values
    ('c8000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'EMP002', 5, 'Very practical for renewal planning and account reviews.'),
    ('c8000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005', 'HR003', 4, 'Clear and easy to use in day-to-day HR case handling.'),
    ('c8000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'ADM001', 5, 'Good refresher for leadership communication discipline.')
on conflict (id) do update
set rating = excluded.rating,
    review_text = excluded.review_text,
    updated_at = timezone('utc', now());

insert into public.admin_activity_log (actor_employee_id, actor_role, action, entity_type, entity_id, details)
values
    ('ADM001', 'superadmin', 'seed.supabase.load', 'system', 'seed_demo_baseline', '{"dataset":"demo-baseline","employees":15,"departments":["BoD","Sales","Operation","HR","Finance"]}'::jsonb)
on conflict do nothing;

commit;
