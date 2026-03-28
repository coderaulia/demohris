-- Migration: TNA (Training Needs Analysis) Tables
-- Purpose: Training needs configuration and tracking per position/employee

USE demo_kpi;

-- Training Needs Configuration (per position)
CREATE TABLE IF NOT EXISTS training_needs (
    id CHAR(36) PRIMARY KEY,
    position_name VARCHAR(255) NOT NULL,
    competency_name VARCHAR(255) NOT NULL,
    required_level INT DEFAULT 3 COMMENT 'Required competency level (1-5)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_training_needs (position_name, competency_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Need Records (per employee gap analysis)
CREATE TABLE IF NOT EXISTS training_need_records (
    id CHAR(36) PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    training_need_id CHAR(36) NOT NULL,
    current_level INT NOT NULL COMMENT 'Current competency level (1-5)',
    gap_level INT NOT NULL COMMENT 'Gap = required_level - current_level',
    priority VARCHAR(20) DEFAULT 'medium' COMMENT 'low, medium, high, critical',
    status VARCHAR(30) DEFAULT 'identified' COMMENT 'identified, planned, in_progress, completed, cancelled',
    identified_by VARCHAR(60) NULL,
    identified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    planned_training_id CHAR(36) NULL,
    completed_at DATETIME NULL,
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (training_need_id) REFERENCES training_needs(id) ON DELETE CASCADE,
    FOREIGN KEY (planned_training_id) REFERENCES training_courses(id) ON DELETE SET NULL,
    UNIQUE KEY uq_need_record (employee_id, training_need_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Plans (organized training per employee per period)
CREATE TABLE IF NOT EXISTS training_plans (
    id CHAR(36) PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    period VARCHAR(7) NOT NULL COMMENT 'YYYY-MM format',
    status VARCHAR(20) DEFAULT 'draft' COMMENT 'draft, approved, in_progress, completed, cancelled',
    total_cost DECIMAL(12,2) DEFAULT 0,
    approved_by VARCHAR(60) NULL,
    approved_at DATETIME NULL,
    created_by VARCHAR(60) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    UNIQUE KEY uq_employee_period_plan (employee_id, period, plan_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Plan Items (individual training items within a plan)
CREATE TABLE IF NOT EXISTS training_plan_items (
    id CHAR(36) PRIMARY KEY,
    plan_id CHAR(36) NOT NULL,
    training_need_record_id CHAR(36) NULL,
    training_course VARCHAR(255) NOT NULL,
    training_provider VARCHAR(255) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    cost DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'planned' COMMENT 'planned, in_progress, completed, cancelled',
    completion_evidence TEXT NULL,
    completion_date DATE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (training_need_record_id) REFERENCES training_need_records(id) ON DELETE SET NULL,
    UNIQUE KEY uq_plan_course (plan_id, training_course)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Courses (course catalog for LMS)
CREATE TABLE IF NOT EXISTS training_courses (
    id CHAR(36) PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    provider VARCHAR(255) NULL,
    duration_hours INT DEFAULT 0,
    cost DECIMAL(12,2) DEFAULT 0,
    competencies_covered JSON NULL COMMENT '[{"competency": "X", "level_gain": 2}]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Enrollments (employee enrollment tracking)
CREATE TABLE IF NOT EXISTS training_enrollments (
    id CHAR(36) PRIMARY KEY,
    employee_id VARCHAR(60) NOT NULL,
    course_id CHAR(36) NOT NULL,
    enrollment_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'enrolled' COMMENT 'enrolled, in_progress, completed, cancelled',
    completion_date DATE NULL,
    score DECIMAL(5,2) NULL COMMENT 'Assessment score if applicable',
    certificate_url VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES training_courses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_employee_course (employee_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing training_history data to training_need_records if applicable
-- This is a one-time migration from the old embedded training_history

-- Insert sample training courses
INSERT INTO training_courses (id, course_name, description, provider, duration_hours, cost, is_active) VALUES
    (UUID(), 'Advanced Negotiation Lab', 'Master complex negotiation scenarios and objection handling', 'Mercury Academy', 16, 2500000, TRUE),
    (UUID(), 'Sales Cadence Bootcamp', 'Structured approach to sales activity management', 'Internal Enablement', 8, 0, TRUE),
    (UUID(), 'CRM Hygiene Workshop', 'Best practices for maintaining clean CRM data', 'Internal Enablement', 4, 0, TRUE),
    (UUID(), 'GA4 Essentials', 'Google Analytics 4 fundamentals and reporting', 'Analytics Guild', 8, 1500000, TRUE),
    (UUID(), 'Business Storytelling', 'Communicate impact through data-driven narratives', 'Internal Enablement', 6, 0, TRUE),
    (UUID(), 'Integrated Campaign Design', 'End-to-end campaign planning and execution', 'Marketing Guild', 12, 2000000, TRUE),
    (UUID(), 'Manager Coaching Sprint', 'Running effective 1:1s and coaching sessions', 'HR Academy', 8, 1800000, TRUE),
    (UUID(), 'Forecasting Masterclass', 'Revenue and pipeline forecasting techniques', 'Sales Enablement', 6, 1200000, TRUE),
    (UUID(), 'Leadership Alignment Lab', 'Cross-functional leadership and stakeholder management', 'Executive Education', 8, 2200000, TRUE)
ON DUPLICATE KEY UPDATE course_name = VALUES(course_name);
