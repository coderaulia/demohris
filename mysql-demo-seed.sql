USE demo_kpi;

-- Demo login password for seeded users: Demo123!
-- bcrypt hash generated for Express auth.
SET @demo_password_hash = '$2b$10$qWRYxAcgGiVmckHGqnjbweH5bPG3ThMFkkMPWMUSTzDDQVPuai6ya';

INSERT INTO app_settings (`key`, `value`) VALUES
    ('company_name', 'Xenos Demo Group'),
    ('company_short', 'XDG'),
    ('department_label', 'People & Performance Office'),
    ('departments', 'Executive, Human Resources, Sales, Marketing, Operations'),
    ('dept_positions', '{"Executive":["Chief Executive Officer","Commercial Director"],"Human Resources":["HR Business Partner"],"Sales":["Regional Sales Manager","Sales Executive"],"Marketing":["Marketing Specialist"],"Operations":["Operations Analyst"]}'),
    ('probation_attendance_rules_json', '{"monthly_cap":20,"events":{"late_in":{"label":"Late Clock In","mode":"tiered","tiers":[{"min_qty":15,"points":5},{"min_qty":9,"points":3},{"min_qty":3,"points":1}]},"missed_clock_out":{"label":"Missed Clock Out","mode":"tiered","tiers":[{"min_qty":15,"points":5},{"min_qty":9,"points":3},{"min_qty":3,"points":1}]},"absent":{"label":"Absence","mode":"tiered","tiers":[{"min_qty":5,"points":5},{"min_qty":3,"points":3},{"min_qty":1,"points":1}]},"event_absent":{"label":"Event/Meeting Absence","mode":"per_qty","per_qty":1,"max_points":10},"discipline":{"label":"Discipline Violation","mode":"per_qty","per_qty":2,"max_points":10},"other":{"label":"Other","mode":"per_qty","per_qty":0,"max_points":20}}}')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

INSERT INTO employees (
    employee_id, name, position, seniority, join_date, department, manager_id, auth_email, auth_id, password_hash, role,
    percentage, scores, self_scores, self_percentage, self_date, history, training_history,
    date_created, date_updated, date_next, tenure_display, kpi_targets, must_change_password,
    assessment_updated_by, assessment_updated_at, self_assessment_updated_by, self_assessment_updated_at
) VALUES
    ('ADM001', 'Aulia Pratama', 'Chief Executive Officer', 'Director', '2023-01-03', 'Executive', NULL, 'admin.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000001', @demo_password_hash, 'superadmin', 0, '[]', '[]', 0, '', '[]', '[]', '-', '-', '-', '', '{}', 0, NULL, NULL, NULL, NULL),
    ('HR001', 'Maya Suryani', 'HR Business Partner', 'Manager', '2024-02-12', 'Human Resources', 'ADM001', 'hr.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000002', @demo_password_hash, 'hr', 0, '[]', '[]', 0, '', '[]', '[]', '-', '-', '-', '', '{}', 0, NULL, NULL, NULL, NULL),
    ('DIR001', 'Raka Permana', 'Commercial Director', 'Director', '2023-05-16', 'Executive', 'ADM001', 'director.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000003', @demo_password_hash, 'director', 0, '[]', '[]', 0, '', '[]', '[]', '-', '-', '-', '', '{}', 0, NULL, NULL, NULL, NULL),
    ('MGR001', 'Sinta Wibowo', 'Regional Sales Manager', 'Manager', '2024-01-08', 'Sales', 'DIR001', 'manager.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000004', @demo_password_hash, 'manager', 0, '[]', '[]', 0, '', '[]', '[]', '-', '-', '-', '', '{}', 0, NULL, NULL, NULL, NULL),
    ('EMP001', 'Farhan Akbar', 'Sales Executive', 'Senior', '2024-07-01', 'Sales', 'MGR001', 'farhan.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000005', @demo_password_hash, 'employee', 87, '[{"q":"Pipeline Management","s":9,"n":"Consistently maintains funnel hygiene."},{"q":"Client Negotiation","s":8,"n":"Strong close rate on enterprise prospects."},{"q":"CRM Discipline","s":9,"n":"Data quality is reliable."}]', '[{"q":"Pipeline Management","s":8,"n":"Feels confident managing follow-up cadence."},{"q":"Client Negotiation","s":8,"n":"Wants to improve proposal framing."},{"q":"CRM Discipline","s":9,"n":"Maintains personal dashboards weekly."}]', 83, '3/11/2026', '[{"date":"12/15/2025","score":79,"seniority":"Senior","position":"Sales Executive"}]', '[{"course":"Advanced Negotiation Lab","start":"2025-12-10","end":"2025-12-12","provider":"Mercury Academy","status":"approved"}]', '12/15/2025', '3/10/2026', '6/10/2026', '', '{"default":{"11111111-1111-4111-8111-111111111111":100,"22222222-2222-4222-8222-222222222222":15,"44444444-4444-4444-8444-444444444444":95}}', 0, 'MGR001', '2026-03-10 09:00:00', 'EMP001', '2026-03-11 08:45:00'),
    ('EMP002', 'Nadia Lestari', 'Sales Executive', 'Intermediate', '2025-02-17', 'Sales', 'MGR001', 'nadia.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000006', @demo_password_hash, 'employee', 64, '[{"q":"Pipeline Management","s":7,"n":"Opportunity coverage is improving but inconsistent."},{"q":"Client Negotiation","s":6,"n":"Needs stronger objection handling."},{"q":"CRM Discipline","s":6,"n":"Several activities updated late."}]', '[{"q":"Pipeline Management","s":7,"n":"Feels more confident with follow-up process."},{"q":"Client Negotiation","s":5,"n":"Requests coaching on pricing conversations."},{"q":"CRM Discipline","s":7,"n":"Working on daily update habits."}]', 62, '3/12/2026', '[{"date":"12/15/2025","score":71,"seniority":"Intermediate","position":"Sales Executive"}]', '[{"course":"Sales Cadence Bootcamp","start":"2026-03-18","end":"","provider":"Internal Enablement","status":"approved"}]', '12/15/2025', '3/10/2026', '6/10/2026', '', '{"default":{"11111111-1111-4111-8111-111111111111":100,"22222222-2222-4222-8222-222222222222":12,"44444444-4444-4444-8444-444444444444":95},"monthly":{"2026-03":{"11111111-1111-4111-8111-111111111111":120}}}', 0, 'MGR001', '2026-03-10 09:20:00', 'EMP002', '2026-03-12 10:15:00'),
    ('EMP003', 'Kevin Mahendra', 'Marketing Specialist', 'Junior', '2026-01-06', 'Marketing', 'MGR001', 'kevin.demo@xenos.local', '4a15d5bd-4eb6-4d0d-a45f-000000000007', @demo_password_hash, 'employee', 72, '[{"q":"Campaign Planning","s":7,"n":"Can scope simple campaigns independently."},{"q":"Performance Reporting","s":8,"n":"Builds weekly campaign summaries."},{"q":"Stakeholder Communication","s":7,"n":"Clear updates with the sales team."}]', '[]', 0, '', '[]', '[{"course":"GA4 Essentials","start":"2026-02-20","end":"2026-02-21","provider":"Analytics Guild","status":"approved"}]', '2/28/2026', '3/08/2026', '6/08/2026', '', '{"default":{"33333333-3333-4333-8333-333333333333":4.5,"44444444-4444-4444-8444-444444444444":96}}', 0, 'MGR001', '2026-03-08 14:00:00', NULL, NULL)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    position = VALUES(position),
    seniority = VALUES(seniority),
    join_date = VALUES(join_date),
    department = VALUES(department),
    manager_id = VALUES(manager_id),
    auth_email = VALUES(auth_email),
    auth_id = VALUES(auth_id),
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    percentage = VALUES(percentage),
    scores = VALUES(scores),
    self_scores = VALUES(self_scores),
    self_percentage = VALUES(self_percentage),
    self_date = VALUES(self_date),
    history = VALUES(history),
    training_history = VALUES(training_history),
    date_created = VALUES(date_created),
    date_updated = VALUES(date_updated),
    date_next = VALUES(date_next),
    kpi_targets = VALUES(kpi_targets),
    must_change_password = VALUES(must_change_password),
    assessment_updated_by = VALUES(assessment_updated_by),
    assessment_updated_at = VALUES(assessment_updated_at),
    self_assessment_updated_by = VALUES(self_assessment_updated_by),
    self_assessment_updated_at = VALUES(self_assessment_updated_at);

INSERT INTO competency_config (position_name, competencies) VALUES
    ('Sales Executive', '[{"name":"Pipeline Management","desc":"Build and advance qualified opportunities with consistent cadence.","rec":"Sales Cadence Bootcamp"},{"name":"Client Negotiation","desc":"Navigate objections and close on value.","rec":"Advanced Negotiation Lab"},{"name":"CRM Discipline","desc":"Keep customer data current and reliable.","rec":"CRM Hygiene Workshop"}]'),
    ('Marketing Specialist', '[{"name":"Campaign Planning","desc":"Translate briefs into executable campaign plans.","rec":"Integrated Campaign Design"},{"name":"Performance Reporting","desc":"Report on ROAS and channel performance.","rec":"GA4 Essentials"},{"name":"Stakeholder Communication","desc":"Communicate campaign outcomes clearly.","rec":"Business Storytelling"}]'),
    ('Regional Sales Manager', '[{"name":"Coaching","desc":"Run weekly coaching and deal reviews.","rec":"Manager Coaching Sprint"},{"name":"Forecast Accuracy","desc":"Maintain forecast confidence and pacing.","rec":"Forecasting Masterclass"},{"name":"Cross-Functional Leadership","desc":"Coordinate with marketing and operations.","rec":"Leadership Alignment Lab"}]')
ON DUPLICATE KEY UPDATE competencies = VALUES(competencies);

INSERT INTO kpi_definitions (id, name, description, category, target, unit, effective_period, approval_status, approval_required, is_active, latest_version_no, approved_by, approved_at) VALUES
    ('11111111-1111-4111-8111-111111111111', 'Monthly Revenue', 'Closed-won revenue booked in the month.', 'Sales Executive', 100, 'IDR', '2026-01', 'approved', 0, 1, 1, 'ADM001', '2026-01-01 09:00:00'),
    ('22222222-2222-4222-8222-222222222222', 'New Clients', 'Number of first-time paying customers.', 'Sales Executive', 15, 'Clients', '2026-01', 'approved', 0, 1, 1, 'ADM001', '2026-01-01 09:00:00'),
    ('33333333-3333-4333-8333-333333333333', 'Campaign ROAS', 'Return on ad spend for active campaigns.', 'Marketing Specialist', 4.5, 'Point', '2026-01', 'approved', 0, 1, 1, 'ADM001', '2026-01-01 09:00:00'),
    ('44444444-4444-4444-8444-444444444444', 'Attendance Compliance', 'Monthly attendance quality score.', 'General', 95, '%', '2026-01', 'approved', 0, 1, 1, 'ADM001', '2026-01-01 09:00:00')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    target = VALUES(target),
    unit = VALUES(unit),
    effective_period = VALUES(effective_period),
    approval_status = VALUES(approval_status),
    is_active = VALUES(is_active),
    latest_version_no = VALUES(latest_version_no),
    approved_by = VALUES(approved_by),
    approved_at = VALUES(approved_at);

INSERT INTO kpi_definition_versions (id, kpi_definition_id, version_no, effective_period, name, description, category, target, unit, status, requested_by, requested_at, approved_by, approved_at) VALUES
    ('aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 1, '2026-01', 'Monthly Revenue', 'Closed-won revenue booked in the month.', 'Sales Executive', 100, 'IDR', 'approved', 'ADM001', '2026-01-01 09:00:00', 'ADM001', '2026-01-01 09:00:00'),
    ('aaaaaaaa-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 1, '2026-01', 'New Clients', 'Number of first-time paying customers.', 'Sales Executive', 15, 'Clients', 'approved', 'ADM001', '2026-01-01 09:00:00', 'ADM001', '2026-01-01 09:00:00'),
    ('aaaaaaaa-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 1, '2026-01', 'Campaign ROAS', 'Return on ad spend for active campaigns.', 'Marketing Specialist', 4.5, 'Point', 'approved', 'ADM001', '2026-01-01 09:00:00', 'ADM001', '2026-01-01 09:00:00'),
    ('aaaaaaaa-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', 1, '2026-01', 'Attendance Compliance', 'Monthly attendance quality score.', 'General', 95, '%', 'approved', 'ADM001', '2026-01-01 09:00:00', 'ADM001', '2026-01-01 09:00:00')
ON DUPLICATE KEY UPDATE name = VALUES(name), target = VALUES(target), unit = VALUES(unit), status = VALUES(status), approved_at = VALUES(approved_at);

INSERT INTO employee_kpi_target_versions (id, employee_id, kpi_id, effective_period, version_no, target_value, unit, status, requested_by, requested_at, approved_by, approved_at) VALUES
    ('bbbbbbbb-1111-4111-8111-111111111111', 'EMP002', '11111111-1111-4111-8111-111111111111', '2026-03', 1, 120, 'IDR', 'approved', 'MGR001', '2026-03-01 08:00:00', 'HR001', '2026-03-01 10:00:00')
ON DUPLICATE KEY UPDATE target_value = VALUES(target_value), status = VALUES(status), approved_at = VALUES(approved_at);

INSERT INTO kpi_weight_profiles (id, profile_name, department, position, active) VALUES
    ('cccccccc-1111-4111-8111-111111111111', 'Sales Executive Weighted Score', 'Sales', 'Sales Executive', 1),
    ('cccccccc-3333-4333-8333-333333333333', 'Marketing Specialist Weighted Score', 'Marketing', 'Marketing Specialist', 1)
ON DUPLICATE KEY UPDATE active = VALUES(active);

INSERT INTO kpi_weight_items (id, profile_id, kpi_id, weight_pct) VALUES
    ('dddddddd-1111-4111-8111-111111111111', 'cccccccc-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 60),
    ('dddddddd-2222-4222-8222-222222222222', 'cccccccc-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 25),
    ('dddddddd-4444-4444-8444-444444444444', 'cccccccc-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 15),
    ('dddddddd-5555-4555-8555-555555555555', 'cccccccc-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 70),
    ('dddddddd-6666-4666-8666-666666666666', 'cccccccc-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 30)
ON DUPLICATE KEY UPDATE weight_pct = VALUES(weight_pct);

INSERT INTO kpi_records (id, employee_id, kpi_id, period, value, notes, submitted_by, submitted_at, updated_by, target_snapshot, kpi_name_snapshot, kpi_unit_snapshot, kpi_category_snapshot, definition_version_id, target_version_id) VALUES
    ('eeeeeeee-1111-4111-8111-111111111111', 'EMP001', '11111111-1111-4111-8111-111111111111', '2026-01', 108, 'Strong enterprise close at month end.', 'EMP001', '2026-01-31 18:00:00', 'EMP001', 100, 'Monthly Revenue', 'IDR', 'Sales Executive', 'aaaaaaaa-1111-4111-8111-111111111111', NULL),
    ('eeeeeeee-1111-4222-8222-222222222222', 'EMP001', '22222222-2222-4222-8222-222222222222', '2026-01', 16, 'Added two new SME logos.', 'EMP001', '2026-01-31 18:05:00', 'EMP001', 15, 'New Clients', 'Clients', 'Sales Executive', 'aaaaaaaa-2222-4222-8222-222222222222', NULL),
    ('eeeeeeee-1111-4444-8444-444444444444', 'EMP001', '44444444-4444-4444-8444-444444444444', '2026-01', 97, 'Attendance remained steady.', 'EMP001', '2026-01-31 18:10:00', 'EMP001', 95, 'Attendance Compliance', '%', 'General', 'aaaaaaaa-4444-4444-8444-444444444444', NULL),
    ('eeeeeeee-2222-4111-8111-111111111111', 'EMP002', '11111111-1111-4111-8111-111111111111', '2026-03', 82, 'Pipeline slipped due to delayed procurement.', 'EMP002', '2026-03-31 17:30:00', 'EMP002', 120, 'Monthly Revenue', 'IDR', 'Sales Executive', 'aaaaaaaa-1111-4111-8111-111111111111', 'bbbbbbbb-1111-4111-8111-111111111111'),
    ('eeeeeeee-2222-4222-8222-222222222222', 'EMP002', '22222222-2222-4222-8222-222222222222', '2026-03', 9, 'Conversion rate dropped on inbound leads.', 'EMP002', '2026-03-31 17:35:00', 'EMP002', 12, 'New Clients', 'Clients', 'Sales Executive', 'aaaaaaaa-2222-4222-8222-222222222222', NULL),
    ('eeeeeeee-2222-4444-8444-444444444444', 'EMP002', '44444444-4444-4444-8444-444444444444', '2026-03', 92, 'Several missed daily CRM close-outs.', 'EMP002', '2026-03-31 17:40:00', 'EMP002', 95, 'Attendance Compliance', '%', 'General', 'aaaaaaaa-4444-4444-8444-444444444444', NULL),
    ('eeeeeeee-3333-4333-8333-333333333333', 'EMP003', '33333333-3333-4333-8333-333333333333', '2026-02', 4.8, 'Paid social campaign outperformed target.', 'EMP003', '2026-02-28 17:00:00', 'EMP003', 4.5, 'Campaign ROAS', 'Point', 'Marketing Specialist', 'aaaaaaaa-3333-4333-8333-333333333333', NULL),
    ('eeeeeeee-3333-4444-8444-444444444444', 'EMP003', '44444444-4444-4444-8444-444444444444', '2026-02', 96, 'Only one late clock-in recorded.', 'EMP003', '2026-02-28 17:10:00', 'EMP003', 96, 'Attendance Compliance', '%', 'General', 'aaaaaaaa-4444-4444-8444-444444444444', NULL)
ON DUPLICATE KEY UPDATE value = VALUES(value), notes = VALUES(notes), updated_by = VALUES(updated_by), target_snapshot = VALUES(target_snapshot), target_version_id = VALUES(target_version_id);

INSERT INTO employee_performance_scores (id, employee_id, period, score_type, total_score, detail, calculated_by, calculated_at) VALUES
    ('ffffeeee-1111-4111-8111-111111111111', 'EMP001', '2026-01', 'kpi_weighted', 105.85, '{"weighted":true,"metric_count":3,"profile_name":"Sales Executive Weighted Score","items":[{"kpi_id":"11111111-1111-4111-8111-111111111111","achievement_pct":108,"contribution":64.8},{"kpi_id":"22222222-2222-4222-8222-222222222222","achievement_pct":106.67,"contribution":26.67},{"kpi_id":"44444444-4444-4444-8444-444444444444","achievement_pct":102.11,"contribution":15.32}]}', 'MGR001', '2026-02-01 08:00:00'),
    ('ffffeeee-2222-4222-8222-222222222222', 'EMP002', '2026-03', 'kpi_weighted', 74.4, '{"weighted":true,"metric_count":3,"profile_name":"Sales Executive Weighted Score","items":[{"kpi_id":"11111111-1111-4111-8111-111111111111","achievement_pct":68.33,"contribution":41.0},{"kpi_id":"22222222-2222-4222-8222-222222222222","achievement_pct":75.0,"contribution":18.75},{"kpi_id":"44444444-4444-4444-8444-444444444444","achievement_pct":96.84,"contribution":14.65}]}', 'MGR001', '2026-04-01 08:10:00'),
    ('ffffeeee-3333-4333-8333-333333333333', 'EMP003', '2026-02', 'kpi_weighted', 104.67, '{"weighted":true,"metric_count":2,"profile_name":"Marketing Specialist Weighted Score","items":[{"kpi_id":"33333333-3333-4333-8333-333333333333","achievement_pct":106.67,"contribution":74.67},{"kpi_id":"44444444-4444-4444-8444-444444444444","achievement_pct":100.0,"contribution":30.0}]}', 'MGR001', '2026-03-01 09:00:00')
ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), detail = VALUES(detail), calculated_at = VALUES(calculated_at);

INSERT INTO employee_assessments (id, employee_id, assessment_type, percentage, seniority, assessed_at, assessed_by, source_date) VALUES
    ('99999999-1111-4111-8111-111111111111', 'EMP001', 'manager', 87, 'Senior', '2026-03-10 09:00:00', 'MGR001', '3/10/2026'),
    ('99999999-1111-4222-8222-222222222222', 'EMP001', 'self', 83, 'Senior', '2026-03-11 08:45:00', 'EMP001', '3/11/2026'),
    ('99999999-2222-4111-8111-111111111111', 'EMP002', 'manager', 64, 'Intermediate', '2026-03-10 09:20:00', 'MGR001', '3/10/2026'),
    ('99999999-2222-4222-8222-222222222222', 'EMP002', 'self', 62, 'Intermediate', '2026-03-12 10:15:00', 'EMP002', '3/12/2026'),
    ('99999999-3333-4111-8111-111111111111', 'EMP003', 'manager', 72, 'Junior', '2026-03-08 14:00:00', 'MGR001', '3/8/2026')
ON DUPLICATE KEY UPDATE percentage = VALUES(percentage), assessed_at = VALUES(assessed_at), assessed_by = VALUES(assessed_by), source_date = VALUES(source_date);

INSERT INTO employee_assessment_scores (id, assessment_id, competency_name, score, note) VALUES
    ('88888888-1111-4111-8111-111111111111', '99999999-1111-4111-8111-111111111111', 'Pipeline Management', 9, 'Consistently maintains funnel hygiene.'),
    ('88888888-1111-4222-8222-222222222222', '99999999-1111-4111-8111-111111111111', 'Client Negotiation', 8, 'Strong close rate on enterprise prospects.'),
    ('88888888-1111-4333-8333-333333333333', '99999999-1111-4111-8111-111111111111', 'CRM Discipline', 9, 'Data quality is reliable.'),
    ('88888888-1111-4444-8444-444444444444', '99999999-1111-4222-8222-222222222222', 'Pipeline Management', 8, 'Feels confident managing follow-up cadence.'),
    ('88888888-1111-4555-8555-555555555555', '99999999-1111-4222-8222-222222222222', 'Client Negotiation', 8, 'Wants to improve proposal framing.'),
    ('88888888-1111-4666-8666-666666666666', '99999999-1111-4222-8222-222222222222', 'CRM Discipline', 9, 'Maintains personal dashboards weekly.'),
    ('88888888-2222-4111-8111-111111111111', '99999999-2222-4111-8111-111111111111', 'Pipeline Management', 7, 'Coverage is improving but inconsistent.'),
    ('88888888-2222-4222-8222-222222222222', '99999999-2222-4111-8111-111111111111', 'Client Negotiation', 6, 'Needs stronger objection handling.'),
    ('88888888-2222-4333-8333-333333333333', '99999999-2222-4111-8111-111111111111', 'CRM Discipline', 6, 'Several activities updated late.'),
    ('88888888-2222-4444-8444-444444444444', '99999999-2222-4222-8222-222222222222', 'Pipeline Management', 7, 'Feels more confident with follow-up process.'),
    ('88888888-2222-4555-8555-555555555555', '99999999-2222-4222-8222-222222222222', 'Client Negotiation', 5, 'Requests coaching on pricing conversations.'),
    ('88888888-2222-4666-8666-666666666666', '99999999-2222-4222-8222-222222222222', 'CRM Discipline', 7, 'Working on daily update habits.'),
    ('88888888-3333-4111-8111-111111111111', '99999999-3333-4111-8111-111111111111', 'Campaign Planning', 7, 'Can scope simple campaigns independently.'),
    ('88888888-3333-4222-8222-222222222222', '99999999-3333-4111-8111-111111111111', 'Performance Reporting', 8, 'Builds weekly campaign summaries.'),
    ('88888888-3333-4333-8333-333333333333', '99999999-3333-4111-8111-111111111111', 'Stakeholder Communication', 7, 'Clear updates with the sales team.')
ON DUPLICATE KEY UPDATE score = VALUES(score), note = VALUES(note);

INSERT INTO employee_assessment_history (id, employee_id, assessment_type, assessed_on, percentage, seniority, position) VALUES
    ('77777777-1111-4111-8111-111111111111', 'EMP001', 'manager', '12/15/2025', 79, 'Senior', 'Sales Executive'),
    ('77777777-2222-4222-8222-222222222222', 'EMP002', 'manager', '12/15/2025', 71, 'Intermediate', 'Sales Executive')
ON DUPLICATE KEY UPDATE percentage = VALUES(percentage);

INSERT INTO employee_training_records (id, employee_id, course, start_date, end_date, provider, status, notes) VALUES
    ('66666666-1111-4111-8111-111111111111', 'EMP001', 'Advanced Negotiation Lab', '2025-12-10', '2025-12-12', 'Mercury Academy', 'approved', ''),
    ('66666666-2222-4222-8222-222222222222', 'EMP002', 'Sales Cadence Bootcamp', '2026-03-18', '', 'Internal Enablement', 'approved', 'Focus on activity hygiene and call planning.'),
    ('66666666-3333-4333-8333-333333333333', 'EMP003', 'GA4 Essentials', '2026-02-20', '2026-02-21', 'Analytics Guild', 'approved', '')
ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes);

INSERT INTO probation_reviews (id, employee_id, review_period_start, review_period_end, quantitative_score, qualitative_score, final_score, decision, manager_notes, reviewed_by, reviewed_at) VALUES
    ('55555555-3333-4333-8333-333333333333', 'EMP003', '2026-01-06', '2026-04-05', 47.33, 27.67, 75.00, 'pass', 'Kevin met the ROAS target early and adapted well to campaign reporting. Continue strengthening stakeholder confidence and independent planning.', 'MGR001', '2026-04-05 16:30:00')
ON DUPLICATE KEY UPDATE final_score = VALUES(final_score), decision = VALUES(decision), manager_notes = VALUES(manager_notes), reviewed_at = VALUES(reviewed_at);

INSERT INTO probation_qualitative_items (id, probation_review_id, item_name, score, note) VALUES
    ('44444444-3333-4333-8333-333333333333', '55555555-3333-4333-8333-333333333333', 'Responsibility', 10, 'Delivers reporting on time.'),
    ('44444444-3333-4444-8444-444444444444', '55555555-3333-4333-8333-333333333333', 'Innovation', 9, 'Experimented with a new landing page test.'),
    ('44444444-3333-4555-8555-555555555555', '55555555-3333-4333-8333-333333333333', 'Communication', 8.67, 'Clear weekly updates to cross-functional partners.')
ON DUPLICATE KEY UPDATE score = VALUES(score), note = VALUES(note);

INSERT INTO probation_monthly_scores (id, probation_review_id, month_no, period_start, period_end, work_performance_score, managing_task_score, manager_qualitative_text, manager_note, attendance_deduction, attitude_score, monthly_total) VALUES
    ('33333333-1111-4111-8111-111111111111', '55555555-3333-4333-8333-333333333333', 1, '2026-01-06', '2026-02-05', 44.00, 25.00, 'Quick learner with good campaign execution discipline.', 'Strong onboarding month.', 1, 19, 88.00),
    ('33333333-2222-4222-8222-222222222222', '55555555-3333-4333-8333-333333333333', 2, '2026-02-06', '2026-03-05', 46.00, 26.00, 'ROAS target exceeded and insights were shared proactively.', 'Best probation month.', 0, 20, 92.00),
    ('33333333-3333-4333-8333-333333333333', '55555555-3333-4333-8333-333333333333', 3, '2026-03-06', '2026-04-05', 52.00, 32.00, 'Handled stakeholder asks well during launch pressure.', 'Ready to pass probation.', 9, 11, 95.00)
ON DUPLICATE KEY UPDATE monthly_total = VALUES(monthly_total), manager_note = VALUES(manager_note);

INSERT INTO probation_attendance_records (id, probation_review_id, month_no, event_date, event_type, qty, deduction_points, note, entered_by) VALUES
    ('22222222-1111-4111-8111-111111111111', '55555555-3333-4333-8333-333333333333', 1, '2026-01-22', 'late_in', 3, 1, 'Three late check-ins in month 1.', 'HR001'),
    ('22222222-3333-4333-8333-333333333333', '55555555-3333-4333-8333-333333333333', 3, '2026-03-29', 'discipline', 1, 2, 'Missed campaign status meeting.', 'HR001'),
    ('22222222-3333-4444-8444-444444444444', '55555555-3333-4333-8333-333333333333', 3, '2026-03-31', 'late_in', 9, 3, 'Multiple late arrivals during launch week.', 'HR001'),
    ('22222222-3333-4555-8555-555555555555', '55555555-3333-4333-8333-333333333333', 3, '2026-04-02', 'event_absent', 4, 4, 'Missed recap workshop and follow-up session.', 'HR001')
ON DUPLICATE KEY UPDATE deduction_points = VALUES(deduction_points), note = VALUES(note);

INSERT INTO pip_plans (id, employee_id, trigger_reason, trigger_period, start_date, target_end_date, status, owner_manager_id, summary, closed_at) VALUES
    ('11112222-2222-4222-8222-222222222222', 'EMP002', 'KPI weighted score 74.4 below threshold 85 for March 2026.', '2026-03', '2026-04-01', '2026-04-30', 'active', 'MGR001', 'Auto-generated recovery plan focused on revenue pacing, CRM hygiene, and objection handling.', NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), summary = VALUES(summary);

INSERT INTO pip_actions (id, pip_plan_id, action_title, action_detail, due_date, progress_pct, status, checkpoint_note) VALUES
    ('12121212-1111-4111-8111-111111111111', '11112222-2222-4222-8222-222222222222', 'Weekly coaching check-in', 'Review funnel coverage, blocked deals, and close plan with manager.', '2026-04-30', 40, 'in_progress', 'Two of four weekly check-ins completed.'),
    ('12121212-2222-4222-8222-222222222222', '11112222-2222-4222-8222-222222222222', 'Submit KPI recovery target', 'Set measurable weekly revenue and new-client goals for the rest of the month.', '2026-04-05', 100, 'done', 'Target submitted and approved.'),
    ('12121212-3333-4333-8333-333333333333', '11112222-2222-4222-8222-222222222222', 'CRM hygiene remediation', 'Zero overdue activities for the final two weeks of the month.', '2026-04-20', 55, 'in_progress', 'Overdue activity count down from 11 to 4.')
ON DUPLICATE KEY UPDATE progress_pct = VALUES(progress_pct), status = VALUES(status), checkpoint_note = VALUES(checkpoint_note);

INSERT INTO admin_activity_log (actor_employee_id, actor_role, action, entity_type, entity_id, details) VALUES
    ('ADM001', 'superadmin', 'seed.demo.load', 'system', 'mysql-demo-seed', '{"dataset":"demo","loaded_by":"sql"}'),
    ('MGR001', 'manager', 'assessment.manager.submit', 'assessment', 'EMP001', '{"employee_name":"Farhan Akbar","score":87}'),
    ('MGR001', 'manager', 'pip.generate.from_kpi', 'pip_plan', '2026-03', '{"threshold":85,"created":1,"skipped":2,"period":"2026-03"}');
