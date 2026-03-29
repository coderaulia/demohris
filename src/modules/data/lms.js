import { apiRequest } from '../../lib/supabase.js';

// =====================================================
// COURSES
// =====================================================

export async function listCourses(params = {}) {
    return await apiRequest('lms/courses/list', params);
}

export async function getCourse(courseId) {
    return await apiRequest('lms/courses/get', { course_id: courseId });
}

export async function createCourse(courseData) {
    return await apiRequest('lms/courses/create', courseData);
}

export async function updateCourse(courseId, updates) {
    return await apiRequest('lms/courses/update', { course_id: courseId, ...updates });
}

export async function deleteCourse(courseId) {
    return await apiRequest('lms/courses/delete', { course_id: courseId });
}

export async function publishCourse(courseId) {
    return await apiRequest('lms/courses/publish', { course_id: courseId });
}

// =====================================================
// SECTIONS
// =====================================================

export async function listSections(courseId) {
    return await apiRequest('lms/sections/list', { course_id: courseId });
}

export async function createSection(sectionData) {
    return await apiRequest('lms/sections/create', sectionData);
}

export async function updateSection(sectionId, updates) {
    return await apiRequest('lms/sections/update', { section_id: sectionId, ...updates });
}

export async function deleteSection(sectionId) {
    return await apiRequest('lms/sections/delete', { section_id: sectionId });
}

export async function reorderSections(courseId, sectionIds) {
    return await apiRequest('lms/sections/reorder', { course_id: courseId, section_ids: sectionIds });
}

// =====================================================
// LESSONS
// =====================================================

export async function listLessons(params) {
    return await apiRequest('lms/lessons/list', params);
}

export async function getLesson(lessonId) {
    return await apiRequest('lms/lessons/get', { lesson_id: lessonId });
}

export async function createLesson(lessonData) {
    return await apiRequest('lms/lessons/create', lessonData);
}

export async function updateLesson(lessonId, updates) {
    return await apiRequest('lms/lessons/update', { lesson_id: lessonId, ...updates });
}

export async function deleteLesson(lessonId) {
    return await apiRequest('lms/lessons/delete', { lesson_id: lessonId });
}

export async function reorderLessons(sectionId, lessonIds) {
    return await apiRequest('lms/lessons/reorder', { section_id: sectionId, lesson_ids: lessonIds });
}

// =====================================================
// QUIZ QUESTIONS
// =====================================================

export async function listQuestions(lessonId) {
    return await apiRequest('lms/questions/list', { lesson_id: lessonId });
}

export async function createQuestion(questionData) {
    return await apiRequest('lms/questions/create', questionData);
}

export async function updateQuestion(questionId, updates) {
    return await apiRequest('lms/questions/update', { question_id: questionId, ...updates });
}

export async function deleteQuestion(questionId) {
    return await apiRequest('lms/questions/delete', { question_id: questionId });
}

// =====================================================
// ENROLLMENTS
// =====================================================

export async function listEnrollments(params = {}) {
    return await apiRequest('lms/enrollments/list', params);
}

export async function enrollInCourse(courseId, employeeId = null, enrollmentType = 'self') {
    return await apiRequest('lms/enrollments/enroll', { 
        course_id: courseId, 
        employee_id: employeeId,
        enrollment_type: enrollmentType 
    });
}

export async function unenrollFromCourse(enrollmentId) {
    return await apiRequest('lms/enrollments/unenroll', { enrollment_id: enrollmentId });
}

export async function getMyEnrollments(params = {}) {
    return await apiRequest('lms/enrollments/my-courses', params);
}

export async function startCourse(courseId) {
    return await apiRequest('lms/enrollments/start', { course_id: courseId });
}

export async function completeCourse(enrollmentId) {
    return await apiRequest('lms/enrollments/complete', { enrollment_id: enrollmentId });
}

// =====================================================
// PROGRESS
// =====================================================

export async function updateLessonProgress(enrollmentId, lessonId, progressPercent, timeSpentSeconds = 0) {
    return await apiRequest('lms/progress/update', { 
        enrollment_id: enrollmentId,
        lesson_id: lessonId,
        progress_percent: progressPercent,
        time_spent_seconds: timeSpentSeconds
    });
}

export async function getLessonProgress(enrollmentId, lessonId) {
    return await apiRequest('lms/progress/get', { 
        enrollment_id: enrollmentId,
        lesson_id: lessonId
    });
}

export async function completeLesson(enrollmentId, lessonId) {
    return await apiRequest('lms/progress/complete-lesson', { 
        enrollment_id: enrollmentId,
        lesson_id: lessonId
    });
}

// =====================================================
// QUIZZES
// =====================================================

export async function submitQuiz(enrollmentId, lessonId, answers) {
    return await apiRequest('lms/quizzes/submit', { 
        enrollment_id: enrollmentId,
        lesson_id: lessonId,
        answers
    });
}

export async function getQuizAttempt(attemptId) {
    return await apiRequest('lms/quizzes/get-attempt', { attempt_id: attemptId });
}

// =====================================================
// REVIEWS
// =====================================================

export async function listReviews(courseId, page = 1, limit = 10) {
    return await apiRequest('lms/reviews/list', { course_id: courseId, page, limit });
}

export async function createReview(courseId, rating, reviewText = null) {
    return await apiRequest('lms/reviews/create', { 
        course_id: courseId,
        rating,
        review_text: reviewText
    });
}

export async function updateReview(reviewId, rating, reviewText) {
    return await apiRequest('lms/reviews/update', { 
        review_id: reviewId,
        rating,
        review_text: reviewText
    });
}

export async function deleteReview(reviewId) {
    return await apiRequest('lms/reviews/delete', { review_id: reviewId });
}

// =====================================================
// DASHBOARD
// =====================================================

export async function getDashboardStats() {
    return await apiRequest('lms/dashboard/stats', {});
}

export async function getRecommendations() {
    return await apiRequest('lms/dashboard/recommendations', {});
}

// =====================================================
// ASSIGNMENTS
// =====================================================

export async function createAssignment(courseId, employeeIds, dueDate = null, priority = 'medium', notes = null) {
    return await apiRequest('lms/assignments/create', { 
        course_id: courseId,
        employee_ids: employeeIds,
        due_date: dueDate,
        priority,
        notes
    });
}

export async function listAssignments(params = {}) {
    return await apiRequest('lms/assignments/list', params);
}

export async function completeAssignment(assignmentId) {
    return await apiRequest('lms/assignments/complete', { assignment_id: assignmentId });
}

// =====================================================
// CERTIFICATES
// =====================================================

export async function listCertificates() {
    return await apiRequest('lms/certificates/list', {});
}

export async function generateCertificate(enrollmentId) {
    return await apiRequest('lms/certificates/generate', { enrollment_id: enrollmentId });
}