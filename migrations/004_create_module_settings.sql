-- Migration: Create module_settings table for dynamic module management
-- Description: Stores per-client/per-instance module configuration
-- Date: 2026-03-28

-- Module Settings Table
CREATE TABLE IF NOT EXISTS module_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id VARCHAR(50) NOT NULL UNIQUE,
    module_name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('core', 'performance', 'talent', 'operations', 'analytics') DEFAULT 'core',
    status ENUM('active', 'inactive', 'coming_soon', 'deprecated') DEFAULT 'inactive',
    is_enabled BOOLEAN DEFAULT FALSE,
    settings JSON DEFAULT '{}',
    version VARCHAR(20) DEFAULT '1.0.0',
    dependencies JSON DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    INDEX idx_module_id (module_id),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_is_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module Activity Log (audit trail)
CREATE TABLE IF NOT EXISTS module_activity_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    module_id VARCHAR(50) NOT NULL,
    action ENUM('enabled', 'disabled', 'configured', 'viewed') NOT NULL,
    actor_employee_id VARCHAR(50),
    actor_role VARCHAR(20),
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_module_id (module_id),
    INDEX idx_actor (actor_employee_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default module configurations
INSERT INTO module_settings (module_id, module_name, description, category, status, is_enabled, dependencies) VALUES
    ('CORE', 'Core HR', 'Employee management, competencies, and basic HR functions', 'core', 'active', TRUE, '[]'),
    ('ASSESSMENT', 'Performance Assessment', '360-degree feedback, competency-based assessments', 'performance', 'active', TRUE, '["CORE"]'),
    ('KPI', 'KPI Management', 'Key Performance Indicators, targets, and tracking', 'performance', 'active', TRUE, '["CORE"]'),
    ('PROBATION', 'Probation Management', 'New hire probation tracking and evaluation', 'performance', 'active', TRUE, '["KPI"]'),
    ('PIP', 'Performance Improvement Plan', 'PIP tracking and management', 'performance', 'active', TRUE, '["KPI"]'),
    ('TNA', 'Training Needs Analysis', 'Identify skill gaps and training requirements', 'talent', 'active', TRUE, '["CORE"]'),
    ('LMS', 'Learning Management System', 'Course management, enrollments, and learning paths', 'talent', 'active', TRUE, '["TNA"]'),
    ('RECRUITMENT', 'Recruitment & ATS', 'Job postings, applicant tracking, hiring pipeline', 'talent', 'coming_soon', FALSE, '["CORE"]'),
    ('ONBOARDING', 'Employee Onboarding', 'New hire onboarding workflows and checklists', 'talent', 'coming_soon', FALSE, '["RECRUITMENT"]'),
    ('LEAVE', 'Leave Management', 'Time off requests, approvals, and calendar', 'operations', 'coming_soon', FALSE, '["CORE"]'),
    ('ATTENDANCE', 'Time & Attendance', 'Clock in/out, overtime tracking, biometrics', 'operations', 'coming_soon', FALSE, '["CORE", "LEAVE"]'),
    ('PAYROLL', 'Payroll Management', 'Salary processing, tax calculations, payslips', 'operations', 'coming_soon', FALSE, '["ATTENDANCE", "LEAVE"]'),
    ('EXPENSES', 'Expense Management', 'Travel and expense reimbursement', 'operations', 'coming_soon', FALSE, '["PAYROLL"]'),
    ('DOCUMENTS', 'Document Management', 'Digital document storage and e-signatures', 'operations', 'coming_soon', FALSE, '["CORE"]'),
    ('SUCCESSION', 'Succession Planning', 'Career paths and talent pipeline', 'talent', 'coming_soon', FALSE, '["ASSESSMENT", "TNA"]'),
    ('ANALYTICS', 'HR Analytics', 'Dashboards, reports, and workforce insights', 'analytics', 'coming_soon', FALSE, '["CORE"]'),
    ('WELLNESS', 'Employee Wellness', 'Wellness programs and engagement activities', 'analytics', 'coming_soon', FALSE, '["CORE"]')
ON DUPLICATE KEY UPDATE
    module_name = VALUES(module_name),
    description = VALUES(description),
    category = VALUES(category),
    status = VALUES(status),
    dependencies = VALUES(dependencies);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS migration_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO migration_history (migration_name) VALUES ('004_create_module_settings');
