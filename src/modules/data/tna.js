import { apiRequest } from '../../lib/supabase.js';
import { state, emit } from './runtime.js';

export async function calculateGaps(employeeId, threshold = 7) {
    const result = await apiRequest('tna/calculate-gaps', {
        employee_id: employeeId,
        threshold,
    });
    return result?.data || null;
}

export async function fetchTrainingNeeds(employeeId = '', status = '') {
    const params = {};
    if (employeeId) params.employee_id = employeeId;
    if (status) params.status = status;

    const result = await apiRequest('tna/needs', params);
    return result?.data || [];
}

export async function createTrainingNeed(payload) {
    const result = await apiRequest('tna/needs/create', payload);
    emit('data:tnaNeeds');
    return result?.data || null;
}

export async function updateTrainingNeedStatus(id, status) {
    const result = await apiRequest('tna/needs/update-status', { id, status });
    emit('data:tnaNeeds');
    return result?.data || null;
}

export async function fetchTrainingPlans(employeeId = '', status = '') {
    const params = {};
    if (employeeId) params.employee_id = employeeId;
    if (status) params.status = status;

    const result = await apiRequest('tna/plans', params);
    return result?.data || [];
}

export async function fetchTrainingPlan(planId) {
    const result = await apiRequest('tna/plan/get', { id: planId });
    return result?.data || null;
}

export async function createTrainingPlan(payload) {
    const result = await apiRequest('tna/plan/create', payload);
    emit('data:tnaPlans');
    return result?.data || null;
}

export async function addPlanItem(payload) {
    const result = await apiRequest('tna/plan/add-item', payload);
    emit('data:tnaPlanItems');
    return result?.data || null;
}

export async function updatePlanItem(payload) {
    const result = await apiRequest('tna/plan/update-item', payload);
    emit('data:tnaPlanItems');
    return result?.data || null;
}

export async function approveTrainingPlan(planId) {
    const result = await apiRequest('tna/plan/approve', { id: planId });
    emit('data:tnaPlans');
    return result?.data || null;
}

export async function deleteTrainingPlan(planId) {
    const result = await apiRequest('tna/plan/delete', { id: planId });
    emit('data:tnaPlans');
    return result?.data || null;
}

export async function fetchTrainingNeedsConfig(positionName = '') {
    const params = {};
    if (positionName) params.position = positionName;

    const result = await apiRequest('tna/needs-config', params);
    return result?.data || [];
}

export async function createTrainingNeedsConfig(payload) {
    const result = await apiRequest('tna/needs-config/create', payload);
    emit('data:tnaNeedsConfig');
    return result?.data || null;
}

export async function fetchTrainingCourses(activeOnly = true) {
    const result = await apiRequest('tna/courses', { active: activeOnly ? 'true' : 'false' });
    return result?.data || [];
}

export async function fetchEnrollments(employeeId = '', status = '') {
    const params = {};
    if (employeeId) params.employee_id = employeeId;
    if (status) params.status = status;

    const result = await apiRequest('tna/enrollments', params);
    return result?.data || [];
}

export async function enrollEmployee(employeeId, courseId) {
    const result = await apiRequest('tna/enroll', { employee_id: employeeId, course_id: courseId });
    emit('data:tnaEnrollments');
    return result?.data || null;
}

export async function updateEnrollmentStatus(id, status) {
    const result = await apiRequest('tna/enrollment-update-status', { id, status });
    emit('data:tnaEnrollments');
    return result?.data || null;
}

export async function fetchTnaSummary() {
    const result = await apiRequest('tna/summary');
    return result?.data || {
        total_needs_identified: 0,
        needs_completed: 0,
        active_plans: 0,
        total_enrollments: 0,
        enrollments_completed: 0,
        critical_gaps: 0,
        high_gaps: 0,
    };
}

export async function fetchGapsReport(department = '') {
    const params = {};
    if (department) params.department = department;

    const result = await apiRequest('tna/gaps-report', params);
    return result?.data || [];
}

export async function importCompetenciesFromConfig(positionName, defaultRequiredLevel = 3) {
    const result = await apiRequest('tna/import-competencies', {
        position_name: positionName,
        default_required_level: defaultRequiredLevel,
    });
    return result?.data || null;
}

export async function bulkCreateNeedRecords(employeeId, gaps) {
    const result = await apiRequest('tna/bulk-create-need-records', {
        employee_id: employeeId,
        gaps: gaps,
    });
    return result?.data || null;
}

export async function createCourse(payload) {
    const result = await apiRequest('tna/course-create', payload);
    emit('data:tnaCourses');
    return result?.data || null;
}

export async function updateCourse(payload) {
    const result = await apiRequest('tna/course-update', payload);
    emit('data:tnaCourses');
    return result?.data || null;
}

export async function fetchEnrollmentsWithDetails(employeeId = '') {
    const params = {};
    if (employeeId) params.employee_id = employeeId;

    const result = await apiRequest('tna/enrollments-with-details', params);
    return result?.data || [];
}

export async function fetchLmsReport(department = '') {
    const params = {};
    if (department) params.department = department;

    const result = await apiRequest('tna/lms-report', params);
    return result?.data || { summary: {}, by_course: [] };
}

export async function migrateTrainingHistory() {
    const result = await apiRequest('tna/migrate-training-history', {});
    return result?.data || null;
}

export async function fetchTrainingHistoryStats() {
    const result = await apiRequest('tna/training-history-stats', {});
    return result?.data || null;
}
