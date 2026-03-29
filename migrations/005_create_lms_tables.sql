-- Migration: Create LMS (Learning Management System) tables
-- Description: Full LMS implementation with courses, lessons, enrollments, progress tracking
-- Date: 2026-03-29

-- =====================================================
-- COURSES
-- =====================================================
CREATE TABLE IF NOT EXISTS courses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    thumbnail_url VARCHAR(500),
    category VARCHAR(100) DEFAULT 'General',
    tags JSON DEFAULT '[]',
    difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'beginner',
    estimated_duration_minutes INT DEFAULT 0,
    author_employee_id VARCHAR(50),
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    is_mandatory TINYINT(1) DEFAULT 0,
    prerequisites JSON DEFAULT '[]',
    competencies_covered JSON DEFAULT '[]',
    passing_score DECIMAL(5,2) DEFAULT 70.00,
    max_attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,
    INDEX idx_courses_status (status),
    INDEX idx_courses_category (category),
    INDEX idx_courses_author (author_employee_id),
    INDEX idx_courses_mandatory (is_mandatory),
    FOREIGN KEY (author_employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COURSE SECTIONS (Modules/Chapters)
-- =====================================================
CREATE TABLE IF NOT EXISTS course_sections (
    id CHAR(36) NOT NULL PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ordinal INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sections_course (course_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LESSONS
-- =====================================================
CREATE TABLE IF NOT EXISTS lessons (
    id CHAR(36) NOT NULL PRIMARY KEY,
    section_id CHAR(36) NOT NULL,
    course_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type ENUM('video', 'document', 'quiz', 'scorm', 'text', 'external', 'practice') DEFAULT 'text',
    content_url VARCHAR(500),
    content_text LONGTEXT,
    video_duration_seconds INT DEFAULT 0,
    ordinal INT DEFAULT 0,
    is_preview TINYINT(1) DEFAULT 0,
    estimated_duration_minutes INT DEFAULT 0,
    attachment_urls JSON DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lessons_section (section_id),
    INDEX idx_lessons_course (course_id),
    INDEX idx_lessons_type (content_type),
    FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- QUIZ QUESTIONS (for quiz lessons)
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    lesson_id CHAR(36) NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('multiple_choice', 'true_false', 'multiple_select', 'short_answer', 'matching') DEFAULT 'multiple_choice',
    options JSON DEFAULT '[]',
    correct_answer JSON NOT NULL,
    points DECIMAL(5,2) DEFAULT 1.00,
    explanation TEXT,
    ordinal INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_quiz_lesson (lesson_id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COURSE ENROLLMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS course_enrollments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    enrolled_by VARCHAR(50),
    enrollment_type ENUM('self', 'assigned', 'required') DEFAULT 'self',
    status ENUM('enrolled', 'in_progress', 'completed', 'failed', 'expired') DEFAULT 'enrolled',
    progress_percent DECIMAL(5,2) DEFAULT 0.00,
    score DECIMAL(5,2) DEFAULT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    due_date DATE NULL,
    certificate_issued TINYINT(1) DEFAULT 0,
    certificate_url VARCHAR(500),
    time_spent_seconds INT DEFAULT 0,
    attempts_count INT DEFAULT 0,
    last_accessed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_enrollment (course_id, employee_id),
    INDEX idx_enrollments_employee (employee_id),
    INDEX idx_enrollments_status (status),
    INDEX idx_enrollments_due_date (due_date),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (enrolled_by) REFERENCES employees(employee_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LESSON PROGRESS (Track progress on each lesson)
-- =====================================================
CREATE TABLE IF NOT EXISTS lesson_progress (
    id CHAR(36) NOT NULL PRIMARY KEY,
    enrollment_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    status ENUM('not_started', 'in_progress', 'completed', 'failed') DEFAULT 'not_started',
    progress_percent DECIMAL(5,2) DEFAULT 0.00,
    score DECIMAL(5,2) DEFAULT NULL,
    time_spent_seconds INT DEFAULT 0,
    first_accessed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    last_accessed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lesson_progress (enrollment_id, lesson_id),
    INDEX idx_lesson_progress_status (status),
    FOREIGN KEY (enrollment_id) REFERENCES course_enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- QUIZ ATTEMPTS
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    enrollment_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    attempt_number INT NOT NULL,
    answers JSON NOT NULL,
    score DECIMAL(5,2) DEFAULT NULL,
    passed TINYINT(1) DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    time_spent_seconds INT DEFAULT 0,
    INDEX idx_quiz_attempts_enrollment (enrollment_id),
    INDEX idx_quiz_attempts_lesson (lesson_id),
    FOREIGN KEY (enrollment_id) REFERENCES course_enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COURSE REVIEWS
-- =====================================================
CREATE TABLE IF NOT EXISTS course_reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_course_review (course_id, employee_id),
    INDEX idx_reviews_course (course_id),
    INDEX idx_reviews_rating (rating),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LEARNING PATHS (Group courses into paths)
-- =====================================================
CREATE TABLE IF NOT EXISTS learning_paths (
    id CHAR(36) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    category VARCHAR(100) DEFAULT 'General',
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_learning_paths_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LEARNING PATH COURSES (Junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS learning_path_courses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    learning_path_id CHAR(36) NOT NULL,
    course_id CHAR(36) NOT NULL,
    ordinal INT DEFAULT 0,
    is_required TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_path_course (learning_path_id, course_id),
    INDEX idx_path_courses_path (learning_path_id),
    INDEX idx_path_courses_course (course_id),
    FOREIGN KEY (learning_path_id) REFERENCES learning_paths(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COURSE ASSIGNMENTS (Admin assigns courses to employees)
-- =====================================================
CREATE TABLE IF NOT EXISTS course_assignments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    assigned_by VARCHAR(50) NOT NULL,
    due_date DATE NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    notes TEXT,
    status ENUM('pending', 'notified', 'acknowledged') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_assignments_employee (employee_id),
    INDEX idx_assignments_course (course_id),
    INDEX idx_assignments_due (due_date),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES employees(employee_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CERTIFICATES
-- =====================================================
CREATE TABLE IF NOT EXISTS course_certificates (
    id CHAR(36) NOT NULL PRIMARY KEY,
    enrollment_id CHAR(36) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    course_id CHAR(36) NOT NULL,
    certificate_number VARCHAR(100) NOT NULL UNIQUE,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until DATE NULL,
    certificate_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_certificates_employee (employee_id),
    INDEX idx_certificates_course (course_id),
    INDEX idx_certificates_number (certificate_number),
    FOREIGN KEY (enrollment_id) REFERENCES course_enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COURSE ANALYTICS (Aggregated stats)
-- =====================================================
CREATE TABLE IF NOT EXISTS course_analytics (
    id CHAR(36) NOT NULL PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    total_enrollments INT DEFAULT 0,
    active_learners INT DEFAULT 0,
    completions INT DEFAULT 0,
    avg_score DECIMAL(5,2) DEFAULT NULL,
    avg_completion_time_seconds INT DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT NULL,
    total_reviews INT DEFAULT 0,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_course_analytics (course_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Insert default courses from existing training_courses table (if exists)
-- =====================================================
INSERT INTO courses (id, title, description, category, difficulty_level, status, created_at)
SELECT 
    id,
    title,
    description,
    IFNULL(category, 'General'),
    'beginner',
    'published',
    created_at
FROM training_courses
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'training_courses')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- =====================================================
-- Migration tracking
-- =====================================================
INSERT IGNORE INTO migration_history (migration_name) VALUES ('005_create_lms_tables');