CREATE DATABASE IF NOT EXISTS demo_kpi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE demo_kpi;

CREATE TABLE IF NOT EXISTS app_settings (
    `key` VARCHAR(120) NOT NULL PRIMARY KEY,
    `value` LONGTEXT NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO app_settings (`key`, `value`) VALUES
    ('app_name', 'HR Performance Suite'),
    ('company_name', 'Your Company'),
    ('company_short', 'COMPANY'),
    ('department_label', 'Human Resources Department'),
    ('assessment_scale_max', '10'),
    ('assessment_threshold', '7'),
    ('probation_pass_threshold', '75'),
    ('probation_weight_work', '50'),
    ('probation_weight_managing', '30'),
    ('probation_weight_attitude', '20'),
    ('kpi_hr_approval_required', 'false'),
    ('levels', 'Junior, Intermediate, Senior, Lead, Manager, Director'),
    ('departments', 'Human Resources, Finance, IT, Operations, Marketing, Sales'),
    ('dept_positions', '{}')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

CREATE TABLE IF NOT EXISTS employees (
    employee_id VARCHAR(60) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL DEFAULT '',
    seniority VARCHAR(120) NOT NULL DEFAULT '',
    join_date DATE NULL,
    department VARCHAR(255) NOT NULL DEFAULT '',
    manager_id VARCHAR(60) NULL,
    auth_email VARCHAR(255) NULL,
    auth_id CHAR(36) NULL,
    password_hash VARCHAR(255) NULL,
    password_reset_requested_at DATETIME NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'employee',
    percentage DECIMAL(7,2) NOT NULL DEFAULT 0,
    scores LONGTEXT NULL,
    self_scores LONGTEXT NULL,
    self_percentage DECIMAL(7,2) NOT NULL DEFAULT 0,
    self_date VARCHAR(40) NULL,
    history LONGTEXT NULL,
    training_history LONGTEXT NULL,
    date_created VARCHAR(40) NOT NULL DEFAULT '-',
    date_updated VARCHAR(40) NOT NULL DEFAULT '-',
    date_next VARCHAR(40) NOT NULL DEFAULT '-',
    tenure_display VARCHAR(120) NOT NULL DEFAULT '',
    kpi_targets LONGTEXT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    assessment_updated_by VARCHAR(60) NULL,
    assessment_updated_at DATETIME NULL,
    self_assessment_updated_by VARCHAR(60) NULL,
    self_assessment_updated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_employees_auth_email (auth_email),
    UNIQUE KEY uq_employees_auth_id (auth_id),
    KEY idx_employees_department (department),
    KEY idx_employees_manager_id (manager_id),
    CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(employee_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS competency_config (
    position_name VARCHAR(255) NOT NULL PRIMARY KEY,
    competencies LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_definitions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(255) NOT NULL DEFAULT 'General',
    target DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit VARCHAR(40) NOT NULL DEFAULT '',
    effective_period VARCHAR(7) NOT NULL DEFAULT '2026-01',
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved',
    approval_required TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    latest_version_no INT NOT NULL DEFAULT 0,
    approved_by VARCHAR(60) NULL,
    approved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_kpi_definitions_category (category),
    KEY idx_kpi_definitions_effective_period (effective_period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_definition_versions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    kpi_definition_id CHAR(36) NOT NULL,
    version_no INT NOT NULL,
    effective_period VARCHAR(7) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(255) NOT NULL DEFAULT 'General',
    target DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    request_note TEXT NULL,
    requested_by VARCHAR(60) NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(60) NULL,
    approved_at DATETIME NULL,
    rejected_by VARCHAR(60) NULL,
    rejected_at DATETIME NULL,
    rejection_reason TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kpi_definition_versions (kpi_definition_id, version_no),
    KEY idx_kpi_definition_versions_status (status, requested_at),
    CONSTRAINT fk_kpi_definition_versions_definition FOREIGN KEY (kpi_definition_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_kpi_target_versions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    kpi_id CHAR(36) NOT NULL,
    effective_period VARCHAR(7) NOT NULL,
    version_no INT NOT NULL,
    target_value DECIMAL(12,2) NULL,
    unit VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    request_note TEXT NULL,
    requested_by VARCHAR(60) NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(60) NULL,
    approved_at DATETIME NULL,
    rejected_by VARCHAR(60) NULL,
    rejected_at DATETIME NULL,
    rejection_reason TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_employee_kpi_target_versions (employee_id, kpi_id, effective_period, version_no),
    KEY idx_employee_kpi_target_versions_status (status, requested_at),
    CONSTRAINT fk_employee_kpi_target_versions_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT fk_employee_kpi_target_versions_kpi FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_records (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    kpi_id CHAR(36) NOT NULL,
    period VARCHAR(7) NOT NULL,
    value DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    submitted_by VARCHAR(60) NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(60) NULL,
    target_snapshot DECIMAL(12,2) NULL,
    kpi_name_snapshot VARCHAR(255) NULL,
    kpi_unit_snapshot VARCHAR(40) NULL,
    kpi_category_snapshot VARCHAR(255) NULL,
    definition_version_id CHAR(36) NULL,
    target_version_id CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_kpi_records_employee_period (employee_id, period),
    KEY idx_kpi_records_kpi_id (kpi_id),
    CONSTRAINT fk_kpi_records_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT fk_kpi_records_kpi FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    CONSTRAINT fk_kpi_records_definition_version FOREIGN KEY (definition_version_id) REFERENCES kpi_definition_versions(id) ON DELETE SET NULL,
    CONSTRAINT fk_kpi_records_target_version FOREIGN KEY (target_version_id) REFERENCES employee_kpi_target_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_employee_id VARCHAR(60) NULL,
    actor_role VARCHAR(20) NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(60) NOT NULL DEFAULT 'general',
    entity_id VARCHAR(120) NULL,
    details LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_admin_activity_log_created_at (created_at),
    KEY idx_admin_activity_log_actor (actor_employee_id),
    CONSTRAINT fk_admin_activity_log_actor FOREIGN KEY (actor_employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_assessments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    assessment_type VARCHAR(20) NOT NULL,
    percentage DECIMAL(7,2) NOT NULL DEFAULT 0,
    seniority VARCHAR(120) NOT NULL DEFAULT '',
    assessed_at DATETIME NULL,
    assessed_by VARCHAR(60) NULL,
    source_date VARCHAR(40) NOT NULL DEFAULT '-',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_employee_assessments (employee_id, assessment_type),
    CONSTRAINT fk_employee_assessments_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_assessment_scores (
    id CHAR(36) NOT NULL PRIMARY KEY,
    assessment_id CHAR(36) NOT NULL,
    competency_name VARCHAR(255) NOT NULL,
    score DECIMAL(7,2) NOT NULL DEFAULT 0,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_employee_assessment_scores (assessment_id, competency_name),
    CONSTRAINT fk_employee_assessment_scores_assessment FOREIGN KEY (assessment_id) REFERENCES employee_assessments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_assessment_history (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    assessment_type VARCHAR(20) NOT NULL DEFAULT 'manager',
    assessed_on VARCHAR(40) NOT NULL DEFAULT '-',
    percentage DECIMAL(7,2) NOT NULL DEFAULT 0,
    seniority VARCHAR(120) NOT NULL DEFAULT '',
    position VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_employee_assessment_history_employee (employee_id),
    CONSTRAINT fk_employee_assessment_history_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_training_records (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    course VARCHAR(255) NOT NULL,
    start_date VARCHAR(40) NULL,
    end_date VARCHAR(40) NULL,
    provider VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ongoing',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_employee_training_records_employee (employee_id),
    CONSTRAINT fk_employee_training_records_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_performance_scores (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    period VARCHAR(7) NOT NULL,
    score_type VARCHAR(40) NOT NULL DEFAULT 'kpi_weighted',
    total_score DECIMAL(12,2) NOT NULL DEFAULT 0,
    detail LONGTEXT NULL,
    calculated_by VARCHAR(60) NULL,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_employee_performance_scores (employee_id, period, score_type),
    CONSTRAINT fk_employee_performance_scores_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_weight_profiles (
    id CHAR(36) NOT NULL PRIMARY KEY,
    profile_name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL DEFAULT '',
    position VARCHAR(255) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kpi_weight_profiles (profile_name, department, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_weight_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    kpi_id CHAR(36) NOT NULL,
    weight_pct DECIMAL(7,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kpi_weight_items (profile_id, kpi_id),
    CONSTRAINT fk_kpi_weight_items_profile FOREIGN KEY (profile_id) REFERENCES kpi_weight_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_kpi_weight_items_kpi FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS probation_reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    review_period_start DATE NULL,
    review_period_end DATE NULL,
    quantitative_score DECIMAL(7,2) NOT NULL DEFAULT 0,
    qualitative_score DECIMAL(7,2) NOT NULL DEFAULT 0,
    final_score DECIMAL(7,2) NOT NULL DEFAULT 0,
    decision VARCHAR(20) NOT NULL DEFAULT 'pending',
    manager_notes TEXT NULL,
    reviewed_by VARCHAR(60) NULL,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_probation_reviews_employee (employee_id),
    CONSTRAINT fk_probation_reviews_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS probation_qualitative_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    probation_review_id CHAR(36) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    score DECIMAL(7,2) NOT NULL DEFAULT 0,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_probation_qualitative_items (probation_review_id, item_name),
    CONSTRAINT fk_probation_qualitative_items_review FOREIGN KEY (probation_review_id) REFERENCES probation_reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS probation_monthly_scores (
    id CHAR(36) NOT NULL PRIMARY KEY,
    probation_review_id CHAR(36) NOT NULL,
    month_no INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    work_performance_score DECIMAL(7,2) NOT NULL DEFAULT 0,
    managing_task_score DECIMAL(7,2) NOT NULL DEFAULT 0,
    manager_qualitative_text TEXT NULL,
    manager_note TEXT NULL,
    attendance_deduction DECIMAL(7,2) NOT NULL DEFAULT 0,
    attitude_score DECIMAL(7,2) NOT NULL DEFAULT 20,
    monthly_total DECIMAL(7,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_probation_monthly_scores (probation_review_id, month_no),
    CONSTRAINT fk_probation_monthly_scores_review FOREIGN KEY (probation_review_id) REFERENCES probation_reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS probation_attendance_records (
    id CHAR(36) NOT NULL PRIMARY KEY,
    probation_review_id CHAR(36) NOT NULL,
    month_no INT NOT NULL,
    event_date DATE NULL,
    event_type VARCHAR(80) NOT NULL DEFAULT 'attendance',
    qty DECIMAL(7,2) NOT NULL DEFAULT 1,
    deduction_points DECIMAL(7,2) NOT NULL DEFAULT 0,
    note TEXT NULL,
    entered_by VARCHAR(60) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_probation_attendance_review_month (probation_review_id, month_no),
    CONSTRAINT fk_probation_attendance_records_review FOREIGN KEY (probation_review_id) REFERENCES probation_reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pip_plans (
    id CHAR(36) NOT NULL PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    trigger_reason TEXT NULL,
    trigger_period VARCHAR(7) NULL,
    start_date DATE NULL,
    target_end_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    owner_manager_id VARCHAR(60) NULL,
    summary TEXT NULL,
    closed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pip_plans_employee_status (employee_id, status),
    CONSTRAINT fk_pip_plans_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pip_actions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    pip_plan_id CHAR(36) NOT NULL,
    action_title VARCHAR(255) NOT NULL,
    action_detail TEXT NULL,
    due_date DATE NULL,
    progress_pct DECIMAL(7,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    checkpoint_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pip_actions_plan_status (pip_plan_id, status),
    CONSTRAINT fk_pip_actions_plan FOREIGN KEY (pip_plan_id) REFERENCES pip_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
