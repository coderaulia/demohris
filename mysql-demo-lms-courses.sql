-- Demo Courses with Sections and Lessons
-- Run this after the main mysql-setup.sql and 005_create_lms_tables.sql

USE demo_kpi;

-- Clear existing demo courses (if re-running)
DELETE FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons WHERE section_id IN (SELECT id FROM course_sections WHERE course_id IN (SELECT id FROM courses WHERE author_employee_id IN ('admin.demo@xenos.local', 'manager.demo@xenos.local'))));
DELETE FROM lessons WHERE section_id IN (SELECT id FROM course_sections WHERE course_id IN (SELECT id FROM courses WHERE author_employee_id IN ('admin.demo@xenos.local', 'manager.demo@xenos.local')));
DELETE FROM course_sections WHERE course_id IN (SELECT id FROM courses WHERE author_employee_id IN ('admin.demo@xenos.local', 'manager.demo@xenos.local'));
DELETE FROM courses WHERE author_employee_id IN ('admin.demo@xenos.local', 'manager.demo@xenos.local');

-- Course 1: Sales Fundamentals (Beginner)
INSERT INTO courses (id, title, description, short_description, category, difficulty_level, estimated_duration_minutes, author_employee_id, status, is_mandatory, passing_score, created_at, published_at) VALUES
(UUID(), 'Sales Fundamentals', 
'<h2>Master the Art of Selling</h2><p>This comprehensive course covers everything you need to know to become a successful sales professional. From understanding customer psychology to closing deals like a pro.</p>
<h3>What You\'ll Learn:</h3>
<ul><li>Understanding buyer psychology</li><li>Building rapport with prospects</li><li>Effective communication techniques</li><li>Closing strategies that work</li></ul>',
'Master the fundamentals of sales and learn proven techniques to close more deals.',
'Sales', 'beginner', 90, 'admin.demo@xenos.local', 'published', 0, 70, NOW(), NOW());

SET @course1_id = LAST_INSERT_ID();

-- Sections for Course 1
INSERT INTO course_sections (id, course_id, title, description, ordinal, created_at) VALUES
(UUID(), @course1_id, 'Introduction to Sales', 'Understanding the sales profession and mindset', 1, NOW());
SET @s1_id = LAST_INSERT_ID();

INSERT INTO course_sections (id, course_id, title, description, ordinal, created_at) VALUES
(UUID(), @course1_id, 'Building Relationships', 'Techniques for building trust with prospects', 2, NOW());
SET @s2_id = LAST_INSERT_ID();

INSERT INTO course_sections (id, course_id, title, description, ordinal, created_at) VALUES
(UUID(), @course1_id, 'Closing Techniques', 'Proven methods for closing deals', 3, NOW());
SET @s3_id = LAST_INSERT_ID();

-- Lessons for Course 1
INSERT INTO lessons (id, section_id, course_id, title, description, content_type, content_text, estimated_duration_minutes, ordinal, created_at) VALUES
(UUID(), @s1_id, @course1_id, 'What is Sales?', 'Understanding the fundamentals of sales',
'text', '<h2>Welcome to Sales</h2><p>Sales is the art of persuading customers to purchase products or services that meet their needs. In this lesson, we\'ll explore:</p>
<ul><li>The definition of sales</li><li>Different types of sales</li><li>Why sales is important for businesses</li><li>The sales cycle overview</li></ul>
<p><strong>Key Takeaway:</strong> Sales is not about tricking people—it\'s about helping them solve problems.</p>', 15, 1, NOW());

SET @l1_id = LAST_INSERT_ID();

INSERT INTO lessons (id, section_id, course_id, title, description, content_type, content_url, estimated_duration_minutes, ordinal, created_at) VALUES
(UUID(), @s1_id, @course1_id, 'The Sales Mindset', 'Developing a success-oriented mindset',
'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 20, 2, NOW());

SET @l2_id = LAST_INSERT_ID();

INSERT INTO lessons (id, section_id, course_id, title, description, content_type, content_text, ordinal, created_at) VALUES
(UUID(), @s1_id, @course1_id, 'Understanding Buyer Psychology', 'What makes people buy',
'text', '<h2>Buyer Psychology</h2><p>Understanding why people buy is crucial for sales success. Key factors include:</p>
<ol><li><strong>Need:</strong> Does the customer have a genuine need?</li>
<li><strong>Want:</strong> Do they desire the product?</li>
<li><strong>Trust:</strong> Do they trust you and your company?</li>
<li><strong>Value:</strong> Perceived value vs. price</li>
<li><strong>Urgency:</strong> Time sensitivity of the need</li></ol>', 10, 3, NOW());

-- More lessons, sections... abbreviating for space
INSERT INTO course_analytics (id, course_id, total_enrollments, active_learners, completions, avg_score, last_calculated_at) VALUES
(UUID(), @course1_id, 5, 3, 2, 85.5, NOW());

-- Course 2: Leadership Essentials (Intermediate)
INSERT INTO courses (id, title, description, short_description, category, difficulty_level, estimated_duration_minutes, author_employee_id, status, is_mandatory, passing_score, created_at, published_at) VALUES
(UUID(), 'Leadership Essentials', 
'<h2>Become an Effective Leader</h2><p>Learn core leadership skills to inspire and motivate your team to achieve their best performance.</p>',
'Develop essential leadership skills to manage and inspire your team.',
'Leadership', 'intermediate', 120, 'manager.demo@xenos.local', 'published', 0, 75, NOW(), NOW());

SET @course2_id = LAST_INSERT_ID();

-- Create sample sections and lessons for Course 2 (abbreviated)
INSERT INTO course_sections (id, course_id, title, description, ordinal, created_at) VALUES
(UUID(), @course2_id, 'Leadership Fundamentals', 'Core leadership principles', 1, NOW());

SET @c2s1_id = LAST_INSERT_ID();

INSERT INTO lessons (id, section_id, course_id, title, description, content_type, content_text, estimated_duration_minutes, ordinal, created_at) VALUES
(UUID(), @c2s1_id, @course2_id, 'What Makes a Great Leader', 'Understanding leadership traits',
'text', '<h2>Great Leadership Traits</h2><p>Great leaders share common traits: vision, integrity, empathy, and the ability to inspire others. In this lesson, we explore each trait in detail.</p>', 30, 1, NOW());

-- Course 3: Customer Service Excellence (Beginner)
INSERT INTO courses (id, title, description, short_description, category, difficulty_level, estimated_duration_minutes, author_employee_id, status, is_mandatory, passing_score, created_at, published_at) VALUES
(UUID(), 'Customer Service Excellence', 
'<h2>Deliver Outstanding Customer Service</h2><p>Learn how to exceed customer expectations and create memorable experiences that build loyalty.</p>',
'Learn techniques to provide exceptional customer service and handle difficult situations.',
'Customer Service', 'beginner', 60, 'admin.demo@xenos.local', 'published', 1, 70, NOW(), NOW());

SET @course3_id = LAST_INSERT_ID();

INSERT INTO course_sections (id, course_id, title, description, ordinal, created_at) VALUES
(UUID(), @course3_id, 'Customer Service Basics', 'Foundation principles', 1, NOW());

SET @c3s1_id = LAST_INSERT_ID();

INSERT INTO lessons (id, section_id, course_id, title, description, content_type, content_text, estimated_duration_minutes, ordinal, created_at) VALUES
(UUID(), @c3s1_id, @course3_id, 'The Importance of Customer Service', 'Why customer service matters',
'text', '<h2>Why Customer Service Matters</h2><p>Customer service is the frontline of your business. Great service leads to:</p>
<ul><li>Increased customer satisfaction</li><li>Higher retention rates</li><li>Positive word-of-mouth</li><li>Revenue growth</li></ul>', 20, 1, NOW());

-- Enroll sample employees in courses
INSERT INTO course_enrollments (id, course_id, employee_id, enrollment_type, status, progress_percent, enrolled_by, created_at) VALUES
(UUID(), @course1_id, 'farhan.demo@xenos.local', 'assigned', 'in_progress', 65.0, 'manager.demo@xenos.local', NOW()),
(UUID(), @course1_id, 'nadia.demo@xenos.local', 'assigned', 'completed', 100.0, 'manager.demo@xenos.local', NOW()),
(UUID(), @course2_id, 'manager.demo@xenos.local', 'self', 'in_progress', 30.0, NULL, NOW()),
(UUID(), @course3_id, 'farhan.demo@xenos.local', 'assigned', 'enrolled', 0.0, 'admin.demo@xenos.local', NOW());

-- Add sample lessons progress
INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, last_accessed_at, created_at) VALUES
(UUID(), (SELECT id FROM course_enrollments WHERE course_id = @course1_id AND employee_id = 'farhan.demo@xenos.local'), @l1_id, 'completed', 100.0, 900, NOW(), NOW(), NOW()),
(UUID(), (SELECT id FROM course_enrollments WHERE course_id = @course1_id AND employee_id = 'farhan.demo@xenos.local'), @l2_id, 'in_progress', 50.0, 600, NOW(), NOW(), NOW());

-- Sample reviews
INSERT INTO course_reviews (id, course_id, employee_id, rating, review_text, created_at) VALUES
(UUID(), @course1_id, 'nadia.demo@xenos.local', 5, 'Excellent course! Very practical and easy to follow.', NOW()),
(UUID(), @course3_id, 'farhan.demo@xenos.local', 4, 'Great content, would recommend to all customer-facing staff.', NOW());

-- Certificates for completed courses
INSERT INTO course_certificates (id, enrollment_id, employee_id, course_id, certificate_number, issued_at, certificate_url) VALUES
(UUID(), (SELECT id FROM course_enrollments WHERE course_id = @course1_id AND employee_id = 'nadia.demo@xenos.local'), 'nadia.demo@xenos.local', @course1_id, CONCAT('CERT-', YEAR(NOW()), '-', LPAD(FLOOR(RAND() * 10000), 5, '0')), NOW(), NULL);

SELECT 'Demo LMS data inserted successfully' AS Result;