import { pool } from '../app.js';
import {
    fetchLmsCourseByIdFromSupabase,
    fetchLmsCoursesFromSupabase,
    fetchLmsEnrollmentByIdFromSupabase,
    fetchLmsEnrollmentsFromSupabase,
    fetchLmsProgressFromSupabase,
    resolveLmsReadSource,
    toEnrollmentGetParityRow,
    toEnrollmentListParityRow,
    toMyCoursesParityRow,
} from '../compat/supabaseLmsRead.js';
import {
    resolveLmsMutationSource,
    startCourseEnrollmentInSupabase,
} from '../compat/supabaseLmsMutation.js';

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function parseJson(value) {
    if (!value || value === null) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function toJson(value) {
    if (!value || value === null) return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

function normalizeRow(row) {
    if (!row) return null;
    const normalized = { ...row };
    if ('tags' in normalized) normalized.tags = parseJson(normalized.tags) || [];
    if ('prerequisites' in normalized) normalized.prerequisites = parseJson(normalized.prerequisites) || [];
    if ('competencies_covered' in normalized) normalized.competencies_covered = parseJson(normalized.competencies_covered) || [];
    if ('options' in normalized) normalized.options = parseJson(normalized.options) || [];
    if ('correct_answer' in normalized) normalized.correct_answer = parseJson(normalized.correct_answer) || {};
    if ('answers' in normalized) normalized.answers = parseJson(normalized.answers) || {};
    if ('attachment_urls' in normalized) normalized.attachment_urls = parseJson(normalized.attachment_urls) || [];
    return normalized;
}

function isAdmin(user) {
    return ['superadmin', 'hr', 'manager'].includes(String(user?.role || '').toLowerCase());
}

function isSuperAdmin(user) {
    return String(user?.role || '').toLowerCase() === 'superadmin';
}

export async function handleLmsAction(req, res, action) {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        switch (action) {
            case 'lms/courses/list':
                return await listCourses(req, res, currentUser);
            case 'lms/courses/get':
                return await getCourse(req, res, currentUser);
            case 'lms/courses/create':
                return await createCourse(req, res, currentUser);
            case 'lms/courses/update':
                return await updateCourse(req, res, currentUser);
            case 'lms/courses/delete':
                return await deleteCourse(req, res, currentUser);
            case 'lms/courses/publish':
                return await publishCourse(req, res, currentUser);
            
            case 'lms/sections/list':
                return await listSections(req, res, currentUser);
            case 'lms/sections/create':
                return await createSection(req, res, currentUser);
            case 'lms/sections/update':
                return await updateSection(req, res, currentUser);
            case 'lms/sections/delete':
                return await deleteSection(req, res, currentUser);
            case 'lms/sections/reorder':
                return await reorderSections(req, res, currentUser);
            
            case 'lms/lessons/list':
                return await listLessons(req, res, currentUser);
            case 'lms/lessons/get':
                return await getLesson(req, res, currentUser);
            case 'lms/lessons/create':
                return await createLesson(req, res, currentUser);
            case 'lms/lessons/update':
                return await updateLesson(req, res, currentUser);
            case 'lms/lessons/delete':
                return await deleteLesson(req, res, currentUser);
            case 'lms/lessons/reorder':
                return await reorderLessons(req, res, currentUser);
            
            case 'lms/questions/list':
                return await listQuestions(req, res, currentUser);
            case 'lms/questions/create':
                return await createQuestion(req, res, currentUser);
            case 'lms/questions/update':
                return await updateQuestion(req, res, currentUser);
            case 'lms/questions/delete':
                return await deleteQuestion(req, res, currentUser);
            
            case 'lms/enrollments/list':
                return await listEnrollments(req, res, currentUser);
            case 'lms/enrollments/get':
                return await getEnrollment(req, res, currentUser);
            case 'lms/enrollments/enroll':
                return await enrollInCourse(req, res, currentUser);
            case 'lms/enrollments/unenroll':
                return await unenrollFromCourse(req, res, currentUser);
            case 'lms/enrollments/my-courses':
                return await getMyEnrollments(req, res, currentUser);
            case 'lms/enrollments/start':
                return await startCourse(req, res, currentUser);
            case 'lms/enrollments/complete':
                return await completeCourse(req, res, currentUser);
            
            case 'lms/progress/update':
                return await updateLessonProgress(req, res, currentUser);
            case 'lms/progress/get':
                return await getLessonProgress(req, res, currentUser);
            case 'lms/progress/complete-lesson':
                return await completeLesson(req, res, currentUser);
            
            case 'lms/quizzes/submit':
                return await submitQuiz(req, res, currentUser);
            case 'lms/quizzes/get-attempt':
                return await getQuizAttempt(req, res, currentUser);
            
            case 'lms/reviews/list':
                return await listReviews(req, res, currentUser);
            case 'lms/reviews/create':
                return await createReview(req, res, currentUser);
            case 'lms/reviews/update':
                return await updateReview(req, res, currentUser);
            case 'lms/reviews/delete':
                return await deleteReview(req, res, currentUser);
            
            case 'lms/dashboard/stats':
                return await getDashboardStats(req, res, currentUser);
            case 'lms/dashboard/recommendations':
                return await getRecommendations(req, res, currentUser);
            
            case 'lms/assignments/create':
                return await createAssignment(req, res, currentUser);
            case 'lms/assignments/list':
                return await listAssignments(req, res, currentUser);
            case 'lms/assignments/complete':
                return await completeAssignment(req, res, currentUser);
            
            case 'lms/certificates/list':
                return await listCertificates(req, res, currentUser);
            case 'lms/certificates/generate':
                return await generateCertificate(req, res, currentUser);
            
            default:
                return res.status(404).json({ error: 'Unknown LMS action' });
        }
    } catch (error) {
        console.error('LMS Action Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

async function listCourses(req, res, currentUser) {
    const { status, category, search, employee_id, page = 1, limit = 20 } = req.body;

    const sourceState = resolveLmsReadSource();
    if (sourceState.source === 'supabase') {
        const supabaseResponse = await fetchLmsCoursesFromSupabase({
            status: status || '',
            category: category || '',
            search: search || '',
            page,
            limit,
        });
        return res.json({
            success: true,
            courses: (supabaseResponse.courses || []).map(normalizeRow),
            total: Number(supabaseResponse.total || 0),
            page: supabaseResponse.page,
            limit: supabaseResponse.limit,
        });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const values = [];
    const conditions = [];
    
    if (status) {
        conditions.push('c.status = ?');
        values.push(status);
    }
    if (category) {
        conditions.push('c.category = ?');
        values.push(category);
    }
    if (search) {
        conditions.push('(c.title LIKE ? OR c.description LIKE ?)');
        values.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    let query = `
        SELECT c.*, 
               COUNT(DISTINCT e.id) as enrollment_count,
               AVG(r.rating) as avg_rating,
               COUNT(DISTINCT r.id) as review_count
        FROM courses c
        LEFT JOIN course_enrollments e ON c.id = e.course_id
        LEFT JOIN course_reviews r ON c.id = r.course_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    `;
    values.push(parseInt(limit), offset);
    
    const [courses] = await pool.query(query, values);
    
    const [countResult] = await pool.query(
        `SELECT COUNT(DISTINCT id) as total FROM courses c ${whereClause}`,
        values.slice(0, -2)
    );
    
    res.json({
        success: true,
        courses: courses.map(normalizeRow),
        total: countResult[0]?.total || 0,
        page: parseInt(page),
        limit: parseInt(limit)
    });
}

async function getCourse(req, res, currentUser) {
    const { course_id } = req.body;
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }

    const sourceState = resolveLmsReadSource();
    if (sourceState.source === 'supabase') {
        const course = await fetchLmsCourseByIdFromSupabase({
            courseId: course_id,
            employeeId: currentUser.employee_id || '',
        });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        return res.json({ success: true, course: normalizeRow(course) });
    }
    
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [course_id]);
    if (courses.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const [sections] = await pool.query(
        'SELECT * FROM course_sections WHERE course_id = ? ORDER BY ordinal',
        [course_id]
    );
    
    for (const section of sections) {
        const [lessons] = await pool.query(
            'SELECT id, section_id, course_id, title, description, content_type, estimated_duration_minutes, ordinal, is_preview FROM lessons WHERE section_id = ? ORDER BY ordinal',
            [section.id]
        );
        section.lessons = lessons;
    }
    
    const course = normalizeRow(courses[0]);
    course.sections = sections;
    
    if (currentUser.employee_id) {
        const [enrollments] = await pool.query(
            'SELECT * FROM course_enrollments WHERE course_id = ? AND employee_id = ?',
            [course_id, currentUser.employee_id]
        );
        course.my_enrollment = enrollments[0] || null;
    }
    
    res.json({ success: true, course });
}

async function createCourse(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, description, short_description, category, tags, difficulty_level, estimated_duration_minutes, is_mandatory, prerequisites, competencies_covered, passing_score } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'title is required' });
    }
    
    const id = generateId();
    
    await pool.query(
        `INSERT INTO courses (id, title, description, short_description, category, tags, difficulty_level, estimated_duration_minutes, author_employee_id, is_mandatory, prerequisites, competencies_covered, passing_score, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [id, title, description || null, short_description || null, category || 'General', toJson(tags || []), difficulty_level || 'beginner', estimated_duration_minutes || 0, currentUser.employee_id, is_mandatory ? 1 : 0, toJson(prerequisites || []), toJson(competencies_covered || []), passing_score || 70.00]
    );
    
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    
    res.json({ success: true, course: normalizeRow(courses[0]) });
}

async function updateCourse(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { course_id, ...updates } = req.body;
    
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    
    const allowedFields = ['title', 'description', 'short_description', 'thumbnail_url', 'category', 'tags', 'difficulty_level', 'estimated_duration_minutes', 'is_mandatory', 'prerequisites', 'competencies_covered', 'passing_score', 'max_attempts'];
    const setClauses = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            if (['tags', 'prerequisites', 'competencies_covered'].includes(key)) {
                setClauses.push(`${key} = ?`);
                values.push(toJson(value));
            } else if (key === 'is_mandatory') {
                setClauses.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            } else {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        }
    }
    
    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(course_id);
    await pool.query(`UPDATE courses SET ${setClauses.join(', ')} WHERE id = ?`, values);
    
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [course_id]);
    
    res.json({ success: true, course: normalizeRow(courses[0]) });
}

async function deleteCourse(req, res, currentUser) {
    if (!isSuperAdmin(currentUser)) {
        return res.status(403).json({ error: 'Superadmin access required' });
    }
    
    const { course_id } = req.body;
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    
    await pool.query('DELETE FROM courses WHERE id = ?', [course_id]);
    
    res.json({ success: true });
}

async function publishCourse(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { course_id } = req.body;
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    
    const [sections] = await pool.query('SELECT COUNT(*) as count FROM course_sections WHERE course_id = ?', [course_id]);
    if (sections[0].count === 0) {
        return res.status(400).json({ error: 'Course must have at least one section' });
    }
    
    const [lessons] = await pool.query('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?', [course_id]);
    if (lessons[0].count === 0) {
        return res.status(400).json({ error: 'Course must have at least one lesson' });
    }
    
    await pool.query(
        'UPDATE courses SET status = ?, published_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['published', course_id]
    );
    
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [course_id]);
    
    res.json({ success: true, course: normalizeRow(courses[0]) });
}

async function listSections(req, res, currentUser) {
    const { course_id } = req.body;
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    
    const [sections] = await pool.query(
        'SELECT * FROM course_sections WHERE course_id = ? ORDER BY ordinal',
        [course_id]
    );
    
    res.json({ success: true, sections });
}

async function createSection(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { course_id, title, description } = req.body;
    
    if (!course_id || !title) {
        return res.status(400).json({ error: 'course_id and title are required' });
    }
    
    const [maxOrdinal] = await pool.query(
        'SELECT COALESCE(MAX(ordinal), -1) as max_ordinal FROM course_sections WHERE course_id = ?',
        [course_id]
    );
    
    const id = generateId();
    const ordinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;
    
    await pool.query(
        'INSERT INTO course_sections (id, course_id, title, description, ordinal) VALUES (?, ?, ?, ?, ?)',
        [id, course_id, title, description || null, ordinal]
    );
    
    const [sections] = await pool.query('SELECT * FROM course_sections WHERE id = ?', [id]);
    
    res.json({ success: true, section: sections[0] });
}

async function updateSection(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { section_id, title, description } = req.body;
    if (!section_id) {
        return res.status(400).json({ error: 'section_id is required' });
    }
    
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
        updates.push('title = ?');
        values.push(title);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(section_id);
    await pool.query(`UPDATE course_sections SET ${updates.join(', ')} WHERE id = ?`, values);
    
    const [sections] = await pool.query('SELECT * FROM course_sections WHERE id = ?', [section_id]);
    
    res.json({ success: true, section: sections[0] });
}

async function deleteSection(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { section_id } = req.body;
    if (!section_id) {
        return res.status(400).json({ error: 'section_id is required' });
    }
    
    await pool.query('DELETE FROM course_sections WHERE id = ?', [section_id]);
    
    res.json({ success: true });
}

async function reorderSections(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { course_id, section_ids } = req.body;
    if (!course_id || !Array.isArray(section_ids)) {
        return res.status(400).json({ error: 'course_id and section_ids array are required' });
    }
    
    for (let i = 0; i < section_ids.length; i++) {
        await pool.query(
            'UPDATE course_sections SET ordinal = ? WHERE id = ? AND course_id = ?',
            [i, section_ids[i], course_id]
        );
    }
    
    res.json({ success: true });
}

async function listLessons(req, res, currentUser) {
    const { section_id, course_id } = req.body;
    
    if (!section_id && !course_id) {
        return res.status(400).json({ error: 'section_id or course_id is required' });
    }
    
    let query, values;
    if (section_id) {
        query = 'SELECT * FROM lessons WHERE section_id = ? ORDER BY ordinal';
        values = [section_id];
    } else {
        query = 'SELECT * FROM lessons WHERE course_id = ? ORDER BY ordinal';
        values = [course_id];
    }
    
    const [lessons] = await pool.query(query, values);
    
    res.json({ success: true, lessons: lessons.map(normalizeRow) });
}

async function getLesson(req, res, currentUser) {
    const { lesson_id } = req.body;
    if (!lesson_id) {
        return res.status(400).json({ error: 'lesson_id is required' });
    }
    
    const [lessons] = await pool.query('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
    if (lessons.length === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
    }
    
    const lesson = normalizeRow(lessons[0]);
    
    if (lesson.content_type === 'quiz') {
        const [questions] = await pool.query(
            'SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY ordinal',
            [lesson_id]
        );
        lesson.questions = questions.map(normalizeRow);
    }
    
    res.json({ success: true, lesson });
}

async function createLesson(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { section_id, course_id, title, description, content_type, content_url, content_text, video_duration_seconds, estimated_duration_minutes, is_preview, attachment_urls } = req.body;
    
    if (!section_id || !course_id || !title) {
        return res.status(400).json({ error: 'section_id, course_id, and title are required' });
    }
    
    const [maxOrdinal] = await pool.query(
        'SELECT COALESCE(MAX(ordinal), -1) as max_ordinal FROM lessons WHERE section_id = ?',
        [section_id]
    );
    
    const id = generateId();
    const ordinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;
    
    await pool.query(
        `INSERT INTO lessons (id, section_id, course_id, title, description, content_type, content_url, content_text, video_duration_seconds, ordinal, estimated_duration_minutes, is_preview, attachment_urls)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, section_id, course_id, title, description || null, content_type || 'text', content_url || null, content_text || null, video_duration_seconds || 0, ordinal, estimated_duration_minutes || 0, is_preview ? 1 : 0, toJson(attachment_urls || [])]
    );
    
    const [lessons] = await pool.query('SELECT * FROM lessons WHERE id = ?', [id]);
    
    res.json({ success: true, lesson: normalizeRow(lessons[0]) });
}

async function updateLesson(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { lesson_id, ...updates } = req.body;
    
    if (!lesson_id) {
        return res.status(400).json({ error: 'lesson_id is required' });
    }
    
    const allowedFields = ['title', 'description', 'content_type', 'content_url', 'content_text', 'video_duration_seconds', 'estimated_duration_minutes', 'is_preview', 'attachment_urls'];
    const setClauses = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            if (key === 'attachment_urls') {
                setClauses.push(`${key} = ?`);
                values.push(toJson(value));
            } else if (key === 'is_preview') {
                setClauses.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            } else {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        }
    }
    
    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(lesson_id);
    await pool.query(`UPDATE lessons SET ${setClauses.join(', ')} WHERE id = ?`, values);
    
    const [lessons] = await pool.query('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
    
    res.json({ success: true, lesson: normalizeRow(lessons[0]) });
}

async function deleteLesson(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { lesson_id } = req.body;
    if (!lesson_id) {
        return res.status(400).json({ error: 'lesson_id is required' });
    }
    
    await pool.query('DELETE FROM lessons WHERE id = ?', [lesson_id]);
    
    res.json({ success: true });
}

async function reorderLessons(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { section_id, lesson_ids } = req.body;
    if (!section_id || !Array.isArray(lesson_ids)) {
        return res.status(400).json({ error: 'section_id and lesson_ids array are required' });
    }
    
    for (let i = 0; i < lesson_ids.length; i++) {
        await pool.query(
            'UPDATE lessons SET ordinal = ? WHERE id = ? AND section_id = ?',
            [i, lesson_ids[i], section_id]
        );
    }
    
    res.json({ success: true });
}

async function listQuestions(req, res, currentUser) {
    const { lesson_id } = req.body;
    if (!lesson_id) {
        return res.status(400).json({ error: 'lesson_id is required' });
    }
    
    const [questions] = await pool.query(
        'SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY ordinal',
        [lesson_id]
    );
    
    res.json({ success: true, questions: questions.map(normalizeRow) });
}

async function createQuestion(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { lesson_id, question_text, question_type, options, correct_answer, points, explanation } = req.body;
    
    if (!lesson_id || !question_text || !correct_answer) {
        return res.status(400).json({ error: 'lesson_id, question_text, and correct_answer are required' });
    }
    
    const [maxOrdinal] = await pool.query(
        'SELECT COALESCE(MAX(ordinal), -1) as max_ordinal FROM quiz_questions WHERE lesson_id = ?',
        [lesson_id]
    );
    
    const id = generateId();
    const ordinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;
    
    await pool.query(
        `INSERT INTO quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, points, explanation, ordinal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, lesson_id, question_text, question_type || 'multiple_choice', toJson(options || []), toJson(correct_answer), points || 1, explanation || null, ordinal]
    );
    
    const [questions] = await pool.query('SELECT * FROM quiz_questions WHERE id = ?', [id]);
    
    res.json({ success: true, question: normalizeRow(questions[0]) });
}

async function updateQuestion(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { question_id, ...updates } = req.body;
    
    if (!question_id) {
        return res.status(400).json({ error: 'question_id is required' });
    }
    
    const allowedFields = ['question_text', 'question_type', 'options', 'correct_answer', 'points', 'explanation', 'ordinal'];
    const setClauses = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            if (['options', 'correct_answer'].includes(key)) {
                setClauses.push(`${key} = ?`);
                values.push(toJson(value));
            } else {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        }
    }
    
    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(question_id);
    await pool.query(`UPDATE quiz_questions SET ${setClauses.join(', ')} WHERE id = ?`, values);
    
    const [questions] = await pool.query('SELECT * FROM quiz_questions WHERE id = ?', [question_id]);
    
    res.json({ success: true, question: normalizeRow(questions[0]) });
}

async function deleteQuestion(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { question_id } = req.body;
    if (!question_id) {
        return res.status(400).json({ error: 'question_id is required' });
    }
    
    await pool.query('DELETE FROM quiz_questions WHERE id = ?', [question_id]);
    
    res.json({ success: true });
}

async function listEnrollments(req, res, currentUser) {
    const { course_id, status, page = 1, limit = 20 } = req.body;
    
    if (!isAdmin(currentUser) && !course_id) {
        return res.status(400).json({ error: 'course_id is required for non-admin users' });
    }

    const sourceState = resolveLmsReadSource();
    if (sourceState.source === 'supabase') {
        const supabaseResponse = await fetchLmsEnrollmentsFromSupabase({
            courseId: course_id || '',
            status: status || '',
            page,
            limit,
            orderBy: 'created_at.desc',
        });
        return res.json({
            success: true,
            enrollments: (supabaseResponse.enrollments || []).map(toEnrollmentListParityRow),
            page: supabaseResponse.page,
            limit: supabaseResponse.limit,
        });
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const values = [];
    
    if (course_id) {
        conditions.push('e.course_id = ?');
        values.push(course_id);
    }
    if (status) {
        conditions.push('e.status = ?');
        values.push(status);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    const [enrollments] = await pool.query(
        `SELECT e.*, emp.name as employee_name, emp.department, emp.position, c.title as course_title
         FROM course_enrollments e
         JOIN employees emp ON e.employee_id = emp.employee_id
         JOIN courses c ON e.course_id = c.id
         ${whereClause}
         ORDER BY e.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, parseInt(limit), offset]
    );
    
    res.json({ success: true, enrollments, page: parseInt(page), limit: parseInt(limit) });
}

async function getEnrollment(req, res, currentUser) {
    const { enrollment_id } = req.body;
    if (!enrollment_id) {
        return res.status(400).json({ error: 'enrollment_id is required' });
    }

    const sourceState = resolveLmsReadSource();
    if (sourceState.source === 'supabase') {
        const enrollment = await fetchLmsEnrollmentByIdFromSupabase(enrollment_id);
        if (!enrollment) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }
        if (!isAdmin(currentUser) && enrollment.employee_id !== currentUser.employee_id) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        return res.json({ success: true, enrollment: normalizeRow(toEnrollmentGetParityRow(enrollment)) });
    }

    const [rows] = await pool.query(
        `SELECT e.*, c.title as course_title
         FROM course_enrollments e
         LEFT JOIN courses c ON e.course_id = c.id
         WHERE e.id = ?
         LIMIT 1`,
        [enrollment_id]
    );

    if (rows.length === 0) {
        return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enrollment = rows[0];
    if (!isAdmin(currentUser) && enrollment.employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ success: true, enrollment: normalizeRow(enrollment) });
}

async function enrollInCourse(req, res, currentUser) {
    const { course_id, employee_id, enrollment_type } = req.body;
    
    const targetEmployeeId = employee_id || currentUser.employee_id;
    const enrollType = employee_id ? (enrollment_type || 'assigned') : 'self';
    
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ? AND status = ?', [course_id, 'published']);
    if (courses.length === 0) {
        return res.status(404).json({ error: 'Course not found or not published' });
    }
    
    const [existing] = await pool.query(
        'SELECT * FROM course_enrollments WHERE course_id = ? AND employee_id = ?',
        [course_id, targetEmployeeId]
    );
    
    if (existing.length > 0) {
        return res.status(400).json({ error: 'Already enrolled in this course' });
    }
    
    const id = generateId();
    
    await pool.query(
        `INSERT INTO course_enrollments (id, course_id, employee_id, enrolled_by, enrollment_type, status)
         VALUES (?, ?, ?, ?, ?, 'enrolled')`,
        [id, course_id, targetEmployeeId, currentUser.employee_id, enrollType]
    );
    
    const [enrollments] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [id]);
    
    res.json({ success: true, enrollment: enrollments[0] });
}

async function unenrollFromCourse(req, res, currentUser) {
    const { enrollment_id } = req.body;
    
    if (!enrollment_id) {
        return res.status(400).json({ error: 'enrollment_id is required' });
    }
    
    const [enrollments] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment_id]);
    
    if (enrollments.length === 0) {
        return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    const enrollment = enrollments[0];
    
    if (!isAdmin(currentUser) && enrollment.employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized to unenroll' });
    }
    
    await pool.query('DELETE FROM course_enrollments WHERE id = ?', [enrollment_id]);
    
    res.json({ success: true });
}

async function getMyEnrollments(req, res, currentUser) {
    const { status, page = 1, limit = 20 } = req.body;

    const sourceState = resolveLmsReadSource();
    if (sourceState.source === 'supabase') {
        const supabaseResponse = await fetchLmsEnrollmentsFromSupabase({
            status: status || '',
            employeeId: currentUser.employee_id,
            page,
            limit,
            orderBy: 'last_accessed_at.desc.nullslast,created_at.desc',
        });
        return res.json({
            success: true,
            enrollments: (supabaseResponse.enrollments || []).map(toMyCoursesParityRow),
            page: supabaseResponse.page,
            limit: supabaseResponse.limit,
        });
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['e.employee_id = ?'];
    const values = [currentUser.employee_id];
    
    if (status) {
        conditions.push('e.status = ?');
        values.push(status);
    }
    
    const [enrollments] = await pool.query(
        `SELECT e.*, c.title, c.description, c.category, c.thumbnail_url, c.estimated_duration_minutes, c.difficulty_level
         FROM course_enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY e.last_accessed_at DESC NULLS LAST, e.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, parseInt(limit), offset]
    );
    
    res.json({ success: true, enrollments, page: parseInt(page), limit: parseInt(limit) });
}

async function startCourse(req, res, currentUser) {
    const { course_id } = req.body;
    
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }

    const mutationSource = resolveLmsMutationSource();
    if (mutationSource.source === 'supabase') {
        const result = await startCourseEnrollmentInSupabase({
            courseId: course_id,
            employeeId: currentUser.employee_id,
            idFactory: generateId,
        });
        if (result?.error) {
            return res.status(result.error.status).json({ error: result.error.message });
        }
        return res.json({ success: true, enrollment: normalizeRow(result.enrollment) });
    }
    
    const [enrollments] = await pool.query(
        'SELECT * FROM course_enrollments WHERE course_id = ? AND employee_id = ?',
        [course_id, currentUser.employee_id]
    );
    
    if (enrollments.length === 0) {
        return res.status(404).json({ error: 'Not enrolled in this course' });
    }
    
    const enrollment = enrollments[0];
    
    if (enrollment.status === 'completed') {
        return res.status(400).json({ error: 'Course already completed' });
    }
    
    await pool.query(
        `UPDATE course_enrollments SET status = 'in_progress', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), last_accessed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [enrollment.id]
    );
    
    const [firstLesson] = await pool.query(
        `SELECT l.id FROM lessons l
         JOIN course_sections cs ON l.section_id = cs.id
         WHERE cs.course_id = ?
         ORDER BY cs.ordinal, l.ordinal
         LIMIT 1`,
        [course_id]
    );
    
    if (firstLesson.length > 0) {
        const [existingProgress] = await pool.query(
            'SELECT * FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ?',
            [enrollment.id, firstLesson[0].id]
        );
        
        if (existingProgress.length === 0) {
            const progressId = generateId();
            await pool.query(
                `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, first_accessed_at, last_accessed_at)
                 VALUES (?, ?, ?, 'not_started', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [progressId, enrollment.id, firstLesson[0].id]
            );
        }
    }
    
    const [updated] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment.id]);
    
    res.json({ success: true, enrollment: updated[0] });
}

async function getLessonProgress(req, res, currentUser) {
    const { enrollment_id, lesson_id } = req.body;

    if (!enrollment_id) {
        return res.status(400).json({ error: 'enrollment_id is required' });
    }

    const sourceState = resolveLmsReadSource();
    if (sourceState.source === 'supabase') {
        const enrollment = await fetchLmsEnrollmentByIdFromSupabase(enrollment_id);
        if (!enrollment) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }
        if (!isAdmin(currentUser) && enrollment.employee_id !== currentUser.employee_id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const lessons = await fetchLmsProgressFromSupabase({
            enrollmentId: enrollment_id,
            lessonId: lesson_id || '',
        });
        const payload = {
            enrollment_id,
            progress_percent: Number(enrollment.progress_percent || 0),
            status: enrollment.status || 'enrolled',
            lessons: lessons.map(normalizeRow),
        };
        if (lesson_id) {
            payload.lesson = payload.lessons[0] || null;
        }
        return res.json({ success: true, progress: payload });
    }

    const [enrollments] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment_id]);
    if (enrollments.length === 0) {
        return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enrollment = enrollments[0];
    if (!isAdmin(currentUser) && enrollment.employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    const progressParams = [enrollment_id];
    let progressSql = 'SELECT * FROM lesson_progress WHERE enrollment_id = ?';
    if (lesson_id) {
        progressSql += ' AND lesson_id = ?';
        progressParams.push(lesson_id);
    }
    progressSql += ' ORDER BY last_accessed_at DESC';

    const [progressRows] = await pool.query(progressSql, progressParams);
    const lessons = progressRows.map(normalizeRow);

    const payload = {
        enrollment_id,
        progress_percent: Number(enrollment.progress_percent || 0),
        status: enrollment.status || 'enrolled',
        lessons,
    };

    if (lesson_id) {
        payload.lesson = lessons[0] || null;
    }

    res.json({ success: true, progress: payload });
}

async function updateLessonProgress(req, res, currentUser) {
    const { enrollment_id, lesson_id, progress_percent, time_spent_seconds } = req.body;
    
    if (!enrollment_id || !lesson_id) {
        return res.status(400).json({ error: 'enrollment_id and lesson_id are required' });
    }
    
    const [enrollments] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment_id]);
    
    if (enrollments.length === 0 || enrollments[0].employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
        `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, last_accessed_at)
         VALUES (?, ?, ?, 'in_progress', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
         progress_percent = VALUES(progress_percent),
         time_spent_seconds = time_spent_seconds + VALUES(time_spent_seconds),
         last_accessed_at = CURRENT_TIMESTAMP,
         status = IF(progress_percent >= 100, 'completed', 'in_progress')`,
        [generateId(), enrollment_id, lesson_id, progress_percent || 0, time_spent_seconds || 0]
    );
    
    await updateEnrollmentProgress(enrollment_id);
    
    res.json({ success: true });
}

async function completeLesson(req, res, currentUser) {
    const { enrollment_id, lesson_id } = req.body;
    
    if (!enrollment_id || !lesson_id) {
        return res.status(400).json({ error: 'enrollment_id and lesson_id are required' });
    }
    
    const [enrollments] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment_id]);
    
    if (enrollments.length === 0 || enrollments[0].employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
        `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, progress_percent, completed_at, first_accessed_at, last_accessed_at)
         VALUES (?, ?, ?, 'completed', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
         status = 'completed',
         progress_percent = 100,
         completed_at = CURRENT_TIMESTAMP`,
        [generateId(), enrollment_id, lesson_id]
    );
    
    await updateEnrollmentProgress(enrollment_id);
    
    const [updated] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment_id]);
    
    res.json({ success: true, enrollment: updated[0] });
}

async function updateEnrollmentProgress(enrollmentId) {
    const [lessons] = await pool.query(
        `SELECT l.id, lp.status, lp.progress_percent
         FROM lessons l
         JOIN course_sections cs ON l.section_id = cs.id
         JOIN course_enrollments e ON e.course_id = cs.course_id
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
         WHERE e.id = ?`,
        [enrollmentId]
    );
    
    const totalLessons = lessons.length;
    const completedLessons = lessons.filter(l => l.status === 'completed').length;
    const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    
    const status = progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : 'enrolled';
    
    await pool.query(
        `UPDATE course_enrollments SET
         progress_percent = ?,
         status = ?,
         completed_at = IF(? = 'completed' AND completed_at IS NULL, CURRENT_TIMESTAMP, completed_at),
         last_accessed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [progressPercent, status, status, enrollmentId]
    );
}

async function submitQuiz(req, res, currentUser) {
    const { enrollment_id, lesson_id, answers } = req.body;
    
    if (!enrollment_id || !lesson_id || !answers) {
        return res.status(400).json({ error: 'enrollment_id, lesson_id, and answers are required' });
    }
    
    const [enrollments] = await pool.query('SELECT * FROM course_enrollments WHERE id = ?', [enrollment_id]);
    
    if (enrollments.length === 0 || enrollments[0].employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    const [questions] = await pool.query(
        'SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY ordinal',
        [lesson_id]
    );
    
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    
    for (const question of questions) {
        const userAnswer = answers[question.id];
        const correctAnswer = parseJson(question.correct_answer);
        totalPoints += parseFloat(question.points) || 1;
        
        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
            if (userAnswer === correctAnswer) {
                correctCount++;
                earnedPoints += parseFloat(question.points) || 1;
            }
        } else if (question.question_type === 'multiple_select') {
            const userArr = Array.isArray(userAnswer) ? userAnswer.sort() : [];
            const correctArr = Array.isArray(correctAnswer) ? correctAnswer.sort() : [];
            if (JSON.stringify(userArr) === JSON.stringify(correctArr)) {
                correctCount++;
                earnedPoints += parseFloat(question.points) || 1;
            }
        }
    }
    
    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = score >= 70;
    
    const attemptId = generateId();
    const [attempts] = await pool.query(
        'SELECT COALESCE(MAX(attempt_number), 0) as max_attempt FROM quiz_attempts WHERE enrollment_id = ? AND lesson_id = ?',
        [enrollment_id, lesson_id]
    );
    const attemptNumber = (attempts[0]?.max_attempt || 0) + 1;
    
    await pool.query(
        `INSERT INTO quiz_attempts (id, enrollment_id, lesson_id, attempt_number, answers, score, passed, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [attemptId, enrollment_id, lesson_id, attemptNumber, toJson(answers), score, passed ? 1 : 0]
    );
    
    if (passed) {
        await pool.query(
            `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, progress_percent, completed_at, first_accessed_at, last_accessed_at)
             VALUES (?, ?, ?, 'completed', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
             status = 'completed',
             progress_percent = 100,
             completed_at = CURRENT_TIMESTAMP`,
            [generateId(), enrollment_id, lesson_id]
        );
        
        await updateEnrollmentProgress(enrollment_id);
    }
    
    res.json({
        success: true,
        attempt: {
            id: attemptId,
            attempt_number: attemptNumber,
            score,
            passed,
            correct_count: correctCount,
            total_questions: questions.length
        }
    });
}

async function getQuizAttempt(req, res, currentUser) {
    const { attempt_id } = req.body;
    
    if (!attempt_id) {
        return res.status(400).json({ error: 'attempt_id is required' });
    }
    
    const [attempts] = await pool.query(
        `SELECT qa.*, e.employee_id
         FROM quiz_attempts qa
         JOIN course_enrollments e ON qa.enrollment_id = e.id
         WHERE qa.id = ?`,
        [attempt_id]
    );
    
    if (attempts.length === 0) {
        return res.status(404).json({ error: 'Attempt not found' });
    }
    
    if (attempts[0].employee_id !== currentUser.employee_id && !isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    res.json({ success: true, attempt: normalizeRow(attempts[0]) });
}

async function getDashboardStats(req, res, currentUser) {
    const adminAccess = isAdmin(currentUser);
    const employeeId = currentUser.employee_id;
    
    let stats = {
        courses_total: 0,
        courses_in_progress: 0,
        courses_completed: 0,
        total_time_spent: 0,
        certificates_earned: 0
    };
    
    if (adminAccess) {
        const [courseCount] = await pool.query('SELECT COUNT(*) as count FROM courses WHERE status = "published"');
        stats.courses_total = courseCount[0]?.count || 0;
        
        const [enrollmentCount] = await pool.query('SELECT COUNT(*) as count FROM course_enrollments WHERE status = "in_progress"');
        stats.courses_in_progress = enrollmentCount[0]?.count || 0;
        
        const [completionCount] = await pool.query('SELECT COUNT(*) as count FROM course_enrollments WHERE status = "completed"');
        stats.courses_completed = completionCount[0]?.count || 0;
        
        const [certCount] = await pool.query('SELECT COUNT(*) as count FROM course_certificates');
        stats.certificates_earned = certCount[0]?.count || 0;
    } else {
        const [result] = await pool.query(
            `SELECT 
                COUNT(CASE WHEN e.status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed,
                SUM(e.time_spent_seconds) as total_time,
                COUNT(CASE WHEN e.certificate_issued = 1 THEN 1 END) as certificates
             FROM course_enrollments e
             WHERE e.employee_id = ?`,
            [employeeId]
        );
        
        stats.courses_in_progress = result[0]?.in_progress || 0;
        stats.courses_completed = result[0]?.completed || 0;
        stats.total_time_spent = result[0]?.total_time || 0;
        stats.certificates_earned = result[0]?.certificates || 0;
        
        const [courseCount] = await pool.query('SELECT COUNT(*) as count FROM courses WHERE status = "published"');
        stats.courses_total = courseCount[0]?.count || 0;
    }
    
    res.json({ success: true, stats });
}

async function listCertificates(req, res, currentUser) {
    const employeeId = currentUser.employee_id;
    
    const [certificates] = await pool.query(
        `SELECT cert.*, c.title, c.category
         FROM course_certificates cert
         JOIN courses c ON cert.course_id = c.id
         WHERE cert.employee_id = ?
         ORDER BY cert.issued_at DESC`,
        [employeeId]
    );
    
    res.json({ success: true, certificates });
}

async function generateCertificate(req, res, currentUser) {
    const { enrollment_id } = req.body;
    
    if (!enrollment_id) {
        return res.status(400).json({ error: 'enrollment_id is required' });
    }
    
    const [enrollments] = await pool.query(
        'SELECT * FROM course_enrollments WHERE id = ? AND employee_id = ? AND status = "completed"',
        [enrollment_id, currentUser.employee_id]
    );
    
    if (enrollments.length === 0) {
        return res.status(404).json({ error: 'Completed enrollment not found' });
    }
    
    const enrollment = enrollments[0];
    
    if (enrollment.certificate_issued) {
        const [existing] = await pool.query(
            'SELECT * FROM course_certificates WHERE enrollment_id = ?',
            [enrollment_id]
        );
        return res.json({ success: true, certificate: existing[0] });
    }
    
    const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const certId = generateId();
    
    await pool.query(
        `INSERT INTO course_certificates (id, enrollment_id, employee_id, course_id, certificate_number)
         VALUES (?, ?, ?, ?, ?)`,
        [certId, enrollment_id, currentUser.employee_id, enrollment.course_id, certNumber]
    );
    
    await pool.query(
        'UPDATE course_enrollments SET certificate_issued = 1 WHERE id = ?',
        [enrollment_id]
    );
    
    const [certificates] = await pool.query('SELECT * FROM course_certificates WHERE id = ?', [certId]);
    
    res.json({ success: true, certificate: certificates[0] });
}

async function listReviews(req, res, currentUser) {
    const { course_id, page = 1, limit = 10 } = req.body;
    
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [reviews] = await pool.query(
        `SELECT r.*, e.name as employee_name
         FROM course_reviews r
         JOIN employees e ON r.employee_id = e.employee_id
         WHERE r.course_id = ?
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [course_id, parseInt(limit), offset]
    );
    
    res.json({ success: true, reviews, page: parseInt(page), limit: parseInt(limit) });
}

async function createReview(req, res, currentUser) {
    const { course_id, rating, review_text } = req.body;
    
    if (!course_id || !rating) {
        return res.status(400).json({ error: 'course_id and rating are required' });
    }
    
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const [existing] = await pool.query(
        'SELECT * FROM course_reviews WHERE course_id = ? AND employee_id = ?',
        [course_id, currentUser.employee_id]
    );
    
    if (existing.length > 0) {
        return res.status(400).json({ error: 'Already reviewed this course' });
    }
    
    const id = generateId();
    
    await pool.query(
        'INSERT INTO course_reviews (id, course_id, employee_id, rating, review_text) VALUES (?, ?, ?, ?, ?)',
        [id, course_id, currentUser.employee_id, rating, review_text || null]
    );
    
    const [reviews] = await pool.query('SELECT * FROM course_reviews WHERE id = ?', [id]);
    
    res.json({ success: true, review: reviews[0] });
}

async function updateReview(req, res, currentUser) {
    const { review_id, rating, review_text } = req.body;
    
    if (!review_id) {
        return res.status(400).json({ error: 'review_id is required' });
    }
    
    const [reviews] = await pool.query('SELECT * FROM course_reviews WHERE id = ?', [review_id]);
    
    if (reviews.length === 0 || reviews[0].employee_id !== currentUser.employee_id) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const updates = [];
    const values = [];
    
    if (rating !== undefined) {
        updates.push('rating = ?');
        values.push(rating);
    }
    if (review_text !== undefined) {
        updates.push('review_text = ?');
        values.push(review_text);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(review_id);
    await pool.query(`UPDATE course_reviews SET ${updates.join(', ')} WHERE id = ?`, values);
    
    const [updated] = await pool.query('SELECT * FROM course_reviews WHERE id = ?', [review_id]);
    
    res.json({ success: true, review: updated[0] });
}

async function deleteReview(req, res, currentUser) {
    const { review_id } = req.body;
    
    if (!review_id) {
        return res.status(400).json({ error: 'review_id is required' });
    }
    
    const [reviews] = await pool.query('SELECT * FROM course_reviews WHERE id = ?', [review_id]);
    
    if (reviews.length === 0 || (reviews[0].employee_id !== currentUser.employee_id && !isAdmin(currentUser))) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query('DELETE FROM course_reviews WHERE id = ?', [review_id]);
    
    res.json({ success: true });
}

async function getRecommendations(req, res, currentUser) {
    const employeeId = currentUser.employee_id;
    
    const [competencyGaps] = await pool.query(
        `SELECT tnr.competency, tnr.gap_score
         FROM training_need_records tnr
         WHERE tnr.employee_id = ? AND tnr.gap_score > 0
         ORDER BY tnr.gap_score DESC
         LIMIT 5`,
        [employeeId]
    );
    
    const competencies = competencyGaps.map(g => g.competency);
    
    if (competencies.length === 0) {
        const [courses] = await pool.query(
            `SELECT c.* FROM courses c
             WHERE c.status = 'published'
             AND c.id NOT IN (SELECT ce.course_id FROM course_enrollments ce WHERE ce.employee_id = ?)
             ORDER BY c.created_at DESC
             LIMIT 5`,
            [employeeId]
        );
        
        return res.json({ success: true, recommendations: courses.map(normalizeRow), type: 'recent' });
    }
    
    const [recommended] = await pool.query(
        `SELECT DISTINCT c.* FROM courses c
         WHERE c.status = 'published'
         AND c.id NOT IN (SELECT ce.course_id FROM course_enrollments ce WHERE ce.employee_id = ?)
         AND (
             JSON_OVERLAPS(c.competencies_covered, ?)
             OR c.category IN (SELECT category FROM courses WHERE id IN (SELECT course_id FROM course_enrollments WHERE employee_id = ?))
         )
         ORDER BY c.created_at DESC
         LIMIT 10`,
        [employeeId, JSON.stringify(competencies), employeeId]
    );
    
    res.json({ success: true, recommendations: recommended.map(normalizeRow), type: 'competency_based', gaps: competencyGaps });
}

async function createAssignment(req, res, currentUser) {
    if (!isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { course_id, employee_ids, due_date, priority, notes } = req.body;
    
    if (!course_id || !Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ error: 'course_id and employee_ids array are required' });
    }
    
    const assignments = [];
    
    for (const employeeId of employee_ids) {
        const [existing] = await pool.query(
            'SELECT * FROM course_enrollments WHERE course_id = ? AND employee_id = ?',
            [course_id, employeeId]
        );
        
        if (existing.length > 0) {
            continue;
        }
        
        const id = generateId();
        
        await pool.query(
            `INSERT INTO course_assignments (id, course_id, employee_id, assigned_by, due_date, priority, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, course_id, employeeId, currentUser.employee_id, due_date || null, priority || 'medium', notes || null]
        );
        
        const enrollmentId = generateId();
        await pool.query(
            `INSERT INTO course_enrollments (id, course_id, employee_id, enrolled_by, enrollment_type, due_date, status)
             VALUES (?, ?, ?, ?, 'required', ?, 'enrolled')`,
            [enrollmentId, course_id, employeeId, currentUser.employee_id, due_date || null]
        );
        
        assignments.push({ assignment_id: id, enrollment_id: enrollmentId, employee_id: employeeId });
    }
    
    res.json({ success: true, assignments });
}

async function listAssignments(req, res, currentUser) {
    const { course_id, employee_id, status, page = 1, limit = 20 } = req.body;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const values = [];
    
    if (course_id) {
        conditions.push('ca.course_id = ?');
        values.push(course_id);
    }
    if (employee_id) {
        conditions.push('ca.employee_id = ?');
        values.push(employee_id);
    }
    if (status) {
        conditions.push('ca.status = ?');
        values.push(status);
    }
    
    if (!isAdmin(currentUser)) {
        conditions.push('ca.employee_id = ?');
        values.push(currentUser.employee_id);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    const [assignments] = await pool.query(
        `SELECT ca.*, e.name as employee_name, c.title as course_title, assigner.name as assigner_name
         FROM course_assignments ca
         JOIN employees e ON ca.employee_id = e.employee_id
         JOIN courses c ON ca.course_id = c.id
         JOIN employees assigner ON ca.assigned_by = assigner.employee_id
         ${whereClause}
         ORDER BY ca.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, parseInt(limit), offset]
    );
    
    res.json({ success: true, assignments, page: parseInt(page), limit: parseInt(limit) });
}

async function completeAssignment(req, res, currentUser) {
    const { assignment_id } = req.body;
    
    if (!assignment_id) {
        return res.status(400).json({ error: 'assignment_id is required' });
    }
    
    const [assignments] = await pool.query('SELECT * FROM course_assignments WHERE id = ?', [assignment_id]);
    
    if (assignments.length === 0) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    
    if (assignments[0].employee_id !== currentUser.employee_id && !isAdmin(currentUser)) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    await pool.query(
        "UPDATE course_assignments SET status = 'acknowledged' WHERE id = ?",
        [assignment_id]
    );
    
    res.json({ success: true });
}
