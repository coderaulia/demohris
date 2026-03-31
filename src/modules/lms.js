// ==================================================
// LMS MODULE - Learning Management System
// ==================================================

import { state, emit } from '../lib/store.js';
import { isFeatureEnabled } from '../lib/features.js';
import { escapeHTML, formatDate } from '../lib/utils.js';
import * as notify from '../lib/notify.js';
import * as lmsData from './data/lms.js';
import { 
    showCourseFormModal, 
    getCourseFormData, 
    validateCourseForm,
    initializeQuillEditor,
    loadCatalogWithFilters
} from './lms/courseManager.js';

let currentLmsView = 'my-learning';
const PAGE_SIZE = 20;

// ==================================================
// INITIALIZATION
// ==================================================

function initLms() {
    if (!isFeatureEnabled('LMS')) {
        console.warn('LMS module is not enabled');
        return;
    }
    setupEventListeners();
    updateRoleBasedUI();
    switchLmsView(getDefaultView());
}

function getDefaultView() {
    const role = state.currentUser?.role;
    if (!role || role === 'employee') {
        return 'my-learning';
    }
    return 'my-learning';
}

function updateRoleBasedUI() {
    const role = state.currentUser?.role;
    const isAdmin = ['superadmin', 'hr', 'manager'].includes(role);
    
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
}

// ==================================================
// EVENT LISTENERS
// ==================================================

function setupEventListeners() {
    // Navigation clicks
    document.addEventListener('click', async (e) => {
        const navLink = e.target.closest('[data-lms-view]');
        if (navLink) {
            e.preventDefault();
            switchLmsView(navLink.dataset.lmsView);
            return;
        }

        // Button clicks
        if (e.target.closest('#lms-btn-browse-catalog')) {
            switchLmsView('catalog');
            return;
        }

        if (e.target.closest('#lms-btn-create-course') || e.target.closest('#lms-btn-admin-new-course')) {
            await showCreateCourseModal();
            return;
        }

        if (e.target.closest('#lms-btn-enroll-course')) {
            await handleEnroll();
            return;
        }

        if (e.target.closest('#lms-btn-save-course')) {
            await handleSaveCourse();
            return;
        }
    });

    // Search and filters
    const catalogSearch = document.getElementById('lms-catalog-search');
    if (catalogSearch) {
        let searchTimeout = null;
        catalogSearch.addEventListener('input', () => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadCatalog(), 300);
        });
    }

    const catalogCategory = document.getElementById('lms-catalog-category');
    if (catalogCategory) {
        catalogCategory.addEventListener('change', () => loadCatalog());
    }

    const catalogDifficulty = document.getElementById('lms-catalog-difficulty');
    if (catalogDifficulty) {
        catalogDifficulty.addEventListener('change', () => loadCatalog());
    }

    const clearFilters = document.getElementById('lms-btn-clear-filters');
    if (clearFilters) {
        clearFilters.addEventListener('click', () => {
            if (catalogSearch) catalogSearch.value = '';
            if (catalogCategory) catalogCategory.value = '';
            if (catalogDifficulty) catalogDifficulty.value = '';
            loadCatalog();
        });
    }

    // Admin filters
    const adminSearch = document.getElementById('lms-admin-search');
    if (adminSearch) {
        let adminSearchTimeout = null;
        adminSearch.addEventListener('input', () => {
            if (adminSearchTimeout) clearTimeout(adminSearchTimeout);
            adminSearchTimeout = setTimeout(() => loadAdminCourses(), 300);
        });
    }

    const adminStatus = document.getElementById('lms-admin-status');
    if (adminStatus) {
        adminStatus.addEventListener('change', () => loadAdminCourses());
    }

    const adminCategory = document.getElementById('lms-admin-category');
    if (adminCategory) {
        adminCategory.addEventListener('change', () => loadAdminCourses());
    }
}

// ==================================================
// VIEW SWITCHING
// ==================================================

function switchLmsView(viewName) {
    currentLmsView = viewName;

    // Update nav active state
    document.querySelectorAll('[data-lms-view]').forEach(link => {
        link.classList.toggle('active', link.dataset.lmsView === viewName);
    });

    // Hide all views
    document.querySelectorAll('.lms-view').forEach(view => {
        view.classList.add('d-none');
    });

    // Show target view
    const targetView = document.getElementById(`lms-view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('d-none');
    }

    // Load view data
    switch (viewName) {
        case 'my-learning':
            loadMyLearning();
            break;
        case 'catalog':
            loadCatalog();
            break;
        case 'my-courses':
            loadMyCourses();
            break;
        case 'certificates':
            loadCertificates();
            break;
        case 'admin-courses':
            loadAdminCourses();
            break;
        case 'admin-enrollments':
            loadAdminEnrollments();
            break;
        case 'admin-reports':
            loadAdminReports();
            break;
    }
}

// ==================================================
// MY LEARNING DASHBOARD
// ==================================================

async function loadMyLearning() {
    try {
        const summary = await lmsData.getDashboardStats();
        
        document.getElementById('lms-enrolled-count').textContent = summary.total_enrolled || 0;
        document.getElementById('lms-in-progress-count').textContent = summary.in_progress || 0;
        document.getElementById('lms-completed-count').textContent = summary.completed || 0;
        document.getElementById('lms-certificates-count').textContent = summary.certificates || 0;
        
        await loadContinueLearning();
        await loadInProgressCourses();
        await loadRecommendations();
    } catch (error) {
        console.error('Failed to load My Learning:', error);
        notify.error('Failed to load learning dashboard');
    }
}

async function loadContinueLearning() {
    const container = document.getElementById('lms-continue-learning-body');
    if (!container) return;

    try {
        const result = await lmsData.getMyCourses({ 
            status: 'in_progress',
            limit: 3 
        });
        
        if (!result.courses || result.courses.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox me-2"></i>You have no active courses
                </div>
            `;
            return;
        }

        container.innerHTML = result.courses.map(course => `
            <div class="d-flex align-items-center border-bottom py-2 cursor-pointer" onclick="window.__app.openCourse('${course.id}')">
                <div class="flex-shrink-0 me-3">
                    <div class="bg-primary bg-opacity-10 rounded p-2">
                        <i class="bi bi-play-circle text-primary fs-3"></i>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-1">${escapeHTML(course.title)}</h6>
                    <div class="progress progress-thin mb-1">
                        <div class="progress-bar" style="width: ${course.progress_percent || 0}%"></div>
                    </div>
                    <small class="text-muted">${Math.round(course.progress_percent || 0)}% complete</small>
                </div>
                <div class="flex-shrink-0">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.__app.continueCourse('${course.id}')">
                        Continue
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load continue learning:', error);
        container.innerHTML = `<div class="text-center text-danger py-4">Failed to load</div>`;
    }
}

async function loadInProgressCourses() {
    const tbody = document.getElementById('lms-in-progress-body');
    if (!tbody) return;

    try {
        const result = await lmsData.getMyCourses({ status: 'in_progress' });
        
        if (!result.courses || result.courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-info-circle me-2"></i>No courses in progress
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = result.courses.map(course => `
            <tr>
                <td>
                    <strong>${escapeHTML(course.title)}</strong>
                    ${course.is_mandatory ? '<span class="badge bg-danger ms-2">Required</span>' : ''}
                </td>
                <td>${escapeHTML(course.category || 'General')}</td>
                <td>
                    <div class="progress progress-thin" style="width: 100px;">
                        <div class="progress-bar bg-success" style="width: ${course.progress_percent || 0}%"></div>
                    </div>
                    <small class="text-muted">${Math.round(course.progress_percent || 0)}%</small>
                </td>
                <td>${course.due_date ? formatDate(course.due_date) : '-'}</td>
                <td>${formatDate(course.last_accessed_at)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="window.__app.continueCourse('${course.id}')">
                        Continue
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load in-progress courses:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load</td></tr>`;
    }
}

async function loadRecommendations() {
    const container = document.getElementById('lms-recommended-cards');
    if (!container) return;

    try {
        const result = await lmsData.getRecommendations();
        
        if (!result.recommendations || result.recommendations.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-4">
                    <i class="bi bi-star me-2"></i>No recommendations available
                </div>
            `;
            return;
        }

        container.innerHTML = result.recommendations.slice(0, 4).map(course => `
            <div class="col-md-3 mb-3">
                <div class="card course-card h-100" onclick="window.__app.showCourseDetails('${course.id}')">
                    ${course.thumbnail_url 
                        ? `<img src="${escapeHTML(course.thumbnail_url)}" class="course-thumbnail card-img-top" alt="${escapeHTML(course.title)}">`
                        : `<div class="course-thumbnail card-img-top d-flex align-items-center justify-content-center bg-light"><i class="bi bi-book fs-1 text-secondary"></i></div>`
                    }
                    <div class="card-body">
                        <h6 class="card-title">${escapeHTML(course.title)}</h6>
                        <p class="card-text small text-muted">${escapeHTML(course.short_description || course.description?.substring(0, 100)) || ''}</p>
                    </div>
                    <div class="card-footer bg-white">
                        <small class="text-muted">
                            <i class="bi bi-clock me-1"></i>${course.estimated_duration_minutes || 0} min
                            <span class="ms-2"><i class="bi bi-bar-chart me-1"></i>${course.difficulty_level || 'Beginner'}</span>
                        </small>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load recommendations:', error);
        container.innerHTML = `<div class="col-12 text-center text-danger">Failed to load recommendations</div>`;
    }
}

// ==================================================
// COURSE CATALOG
// ==================================================

async function loadCatalog() {
    const container = document.getElementById('lms-catalog-cards');
    if (!container) return;

    const search = document.getElementById('lms-catalog-search')?.value || '';
    const category = document.getElementById('lms-catalog-category')?.value || '';
    const difficulty = document.getElementById('lms-catalog-difficulty')?.value || '';

    try {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                Loading courses...
            </div>
        `;

        const result = await lmsData.listCourses({
            status: 'published',
            search,
            category,
            difficulty_level: difficulty,
            page: 1,
            limit: 20
        });

        if (!result.courses || result.courses.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                    No courses found
                </div>
            `;
            return;
        }

        container.innerHTML = result.courses.map(course => `
            <div class="col-md-4 col-lg-3 mb-4">
                <div class="card course-card h-100" onclick="window.__app.showCourseDetails('${course.id}')">
                    ${course.thumbnail_url 
                        ? `<img src="${escapeHTML(course.thumbnail_url)}" class="course-thumbnail card-img-top" alt="${escapeHTML(course.title)}">`
                        : `<div class="course-thumbnail card-img-top d-flex align-items-center justify-content-center bg-light"><i class="bi bi-book fs-1 text-secondary"></i></div>`
                    }
                    <div class="card-body">
                        <h6 class="card-title">${escapeHTML(course.title)}</h6>
                        <p class="card-text small text-muted mb-2">${escapeHTML(course.short_description || course.description?.substring(0, 80)) || ''}</p>
                        <div class="d-flex flex-wrap gap-1">
                            <span class="badge bg-light text-dark">${escapeHTML(course.category || 'General')}</span>
                            <span class="badge bg-light text-dark">${course.difficulty_level || 'Beginner'}</span>
                        </div>
                    </div>
                    <div class="card-footer bg-white">
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">
                                <i class="bi bi-clock me-1"></i>${course.estimated_duration_minutes || 0} min
                            </small>
                            <small class="text-muted">
                                <i class="bi bi-people me-1"></i>${course.enrollment_count || 0}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Populate category filter if not done
        await populateCategoryFilter();

    } catch (error) {
        console.error('Failed to load catalog:', error);
        container.innerHTML = `
            <div class="col-12 text-center text-danger py-5">
                Failed to load courses: ${escapeHTML(error.message)}
            </div>
        `;
        notify.error('Failed to load course catalog');
    }
}

async function populateCategoryFilter() {
    const select = document.getElementById('lms-catalog-category');
    if (!select) return;
    
    // Check if already populated
    if (select.options.length > 1) return;

    select.innerHTML = '<option value="">All Categories</option>';
    
    // Assuming categories come from competency config or settings
    // For now, use common categories
    const categories = ['General', 'Technical Skills', 'Leadership', 'Communication', 'Compliance', 'Safety', 'Sales', 'Customer Service', 'IT & Software'];
    categories.forEach(cat => {
        select.innerHTML += `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    });
}

// ==================================================
// MY COURSES
// ==================================================

async function loadMyCourses() {
    const tbody = document.getElementById('lms-my-courses-body');
    if (!tbody) return;

    try {
        const result = await lmsData.getMyCourses({});
        
        if (!result.courses || result.courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>You are not enrolled in any courses
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = result.courses.map(course => {
            const statusBadge = {
                'enrolled': '<span class="badge bg-secondary">Enrolled</span>',
                'in_progress': '<span class="badge bg-primary">In Progress</span>',
                'completed': '<span class="badge bg-success">Completed</span>',
                'failed': '<span class="badge bg-danger">Failed</span>'
            }[course.status] || `<span class="badge bg-secondary">${course.status}</span>`;

            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(course.title)}</strong>
                        ${course.is_mandatory ? '<span class="badge bg-danger ms-2">Required</span>' : ''}
                    </td>
                    <td>${escapeHTML(course.category || 'General')}</td>
                    <td>${escapeHTML(course.author_name || 'N/A')}</td>
                    <td>
                        <div class="progress progress-thin" style="width: 100px;">
                            <div class="progress-bar bg-success" style="width: ${course.progress_percent || 0}%"></div>
                        </div>
                        <small class="text-muted">${Math.round(course.progress_percent || 0)}%</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${formatDate(course.enrolled_at)}</td>
                    <td>
                        ${course.status === 'completed' 
                            ? `<button class="btn btn-success btn-sm" onclick="window.__app.viewCertificate('${course.enrollment_id}')">Certificate</button>`
                            : `<button class="btn btn-primary btn-sm" onclick="window.__app.continueCourse('${course.id}')">Continue</button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load my courses:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load</td></tr>`;
        notify.error('Failed to load your courses');
    }
}

// ==================================================
// CERTIFICATES
// ==================================================

async function loadCertificates() {
    const container = document.getElementById('lms-certificates-cards');
    if (!container) return;

    try {
        const result = await lmsData.listCertificates();
        
        if (!result.certificates || result.certificates.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-award fs-1 d-block mb-3"></i>
                    You have no certificates yet
                </div>
            `;
            return;
        }

        container.innerHTML = result.certificates.map(cert => `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm">
                    <div class="card-body text-center">
                        <i class="bi bi-award text-warning fs-1 mb-3 d-block"></i>
                        <h5 class="card-title">${escapeHTML(cert.course_title)}</h5>
                        <p class="card-text text-muted">
                            Issued: ${formatDate(cert.issued_at)}<br>
                            Certificate #: ${escapeHTML(cert.certificate_number)}
                        </p>
                        <button class="btn btn-outline-primary btn-sm" onclick="window.__app.downloadCertificate('${cert.id}')">
                            <i class="bi bi-download me-1"></i>Download
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load certificates:', error);
        container.innerHTML = `<div class="col-12 text-center text-danger">Failed to load certificates</div>`;
    }
}

// ==================================================
// ADMIN: MANAGE COURSES
// ==================================================

async function loadAdminCourses() {
    const tbody = document.getElementById('lms-admin-courses-body');
    if (!tbody) return;

    const search = document.getElementById('lms-admin-search')?.value || '';
    const status = document.getElementById('lms-admin-status')?.value || '';
    const category = document.getElementById('lms-admin-category')?.value || '';

    try {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    <div class="spinner-border spinner-border-sm me-2"></div>
                    Loading...
                </td>
            </tr>
        `;

        const result = await lmsData.listCourses({
            status: status || undefined,
            category: category || undefined,
            search: search || undefined,
            page: 1,
            limit: 50
        });

        if (!result.courses || result.courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>No courses found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = result.courses.map(course => {
            const statusBadge = {
                'draft': '<span class="badge bg-secondary">Draft</span>',
                'published': '<span class="badge bg-success">Published</span>',
                'archived': '<span class="badge bg-dark">Archived</span>'
            }[course.status] || `<span class="badge bg-secondary">${course.status}</span>`;

            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(course.title)}</strong>
                        ${course.is_mandatory ? '<span class="badge bg-danger ms-2">Mandatory</span>' : ''}
                    </td>
                    <td>${escapeHTML(course.category || 'General')}</td>
                    <td>${statusBadge}</td>
                    <td>${course.enrollment_count || 0}</td>
                    <td>${course.completion_count || 0}</td>
                    <td>${course.avg_score ? Math.round(course.avg_score) + '%' : '-'}</td>
                    <td>${formatDate(course.created_at)}</td>
                    <td>
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="window.__app.editCourse('${course.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="window.__app.deleteCourse('${course.id}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Populate category filter
        await populateCategoryFilter();

    } catch (error) {
        console.error('Failed to load admin courses:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to load</td></tr>`;
        notify.error('Failed to load courses');
    }
}

// ==================================================
// ADMIN: ENROLLMENTS
// ==================================================

async function loadAdminEnrollments() {
    const tbody = document.getElementById('lms-admin-enrollments-body');
    if (!tbody) return;

    try {
        const result = await lmsData.listEnrollments({ page: 1, limit: 50 });
        
        if (!result.enrollments || result.enrollments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>No enrollments found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = result.enrollments.map(enrollment => {
            const statusBadge = {
                'enrolled': '<span class="badge bg-secondary">Enrolled</span>',
                'in_progress': '<span class="badge bg-primary">In Progress</span>',
                'completed': '<span class="badge bg-success">Completed</span>',
                'failed': '<span class="badge bg-danger">Failed</span>',
                'expired': '<span class="badge bg-dark">Expired</span>'
            }[enrollment.status] || `<span class="badge bg-secondary">${enrollment.status}</span>`;

            return `
                <tr>
                    <td>${escapeHTML(enrollment.employee_name)}</td>
                    <td>${escapeHTML(enrollment.course_title)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="progress progress-thin" style="width: 80px;">
                            <div class="progress-bar bg-success" style="width: ${enrollment.progress_percent || 0}%"></div>
                        </div>
                        <small class="text-muted">${Math.round(enrollment.progress_percent || 0)}%</small>
                    </td>
                    <td>${formatDate(enrollment.enrolled_at)}</td>
                    <td>${enrollment.due_date ? formatDate(enrollment.due_date) : '-'}</td>
                    <td>
                        <button class="btn btn-outline-primary btn-sm" onclick="window.__app.viewEnrollment('${enrollment.id}')">
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load admin enrollments:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load</td></tr>`;
    }
}

// ==================================================
// ADMIN: REPORTS
// ==================================================

async function loadAdminReports() {
    try {
        const stats = await lmsData.getDashboardStats();
        
        document.getElementById('lms-report-total-enrollments').textContent = stats.total_enrollments || 0;
        document.getElementById('lms-report-completions').textContent = stats.completed || 0;
        document.getElementById('lms-report-in-progress').textContent = stats.in_progress || 0;
        document.getElementById('lms-report-avg-score').textContent = stats.avg_score ? Math.round(stats.avg_score) + '%' : '-';
        
        // Load top courses
        await loadTopCourses();
        
        // TODO: Load department chart when chart library is integrated
        
    } catch (error) {
        console.error('Failed to load admin reports:', error);
        notify.error('Failed to load analytics');
    }
}

async function loadTopCourses() {
    const tbody = document.getElementById('lms-top-courses-body');
    if (!tbody) return;

    try {
        const result = await lmsData.listCourses({ status: 'published', limit: 10 });
        
        if (!result.courses || result.courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        No course data available
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = result.courses.slice(0, 5).map(course => `
            <tr>
                <td>${escapeHTML(course.title)}</td>
                <td>${course.enrollment_count || 0}</td>
                <td>${course.completion_count > 0 ? Math.round((course.completion_count / course.enrollment_count) * 100) + '%' : '0%'}</td>
                <td>${course.avg_score ? Math.round(course.avg_score) + '%' : '-'}</td>
                <td>${course.avg_rating ? course.avg_rating.toFixed(1) + '/5' : '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load top courses:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load</td></tr>`;
    }
}

// ==================================================
// COURSE MODALS
// ==================================================

async function showCreateCourseModal() {
    await showCourseFormModal(null);
}

async function showCourseDetails(courseId) {
    try {
        notify.info('Loading course details...');
        const course = await lmsData.getCourse(courseId);
        const modal = new bootstrap.Modal(document.getElementById('lms-course-detail-modal'));
        
        document.getElementById('lms-course-modal-title').textContent = course.title;
        
        const isEnrolled = course.enrollment_status === 'enrolled' || course.enrollment_status === 'in_progress';
        const isCompleted = course.enrollment_status === 'completed';
        
        document.getElementById('lms-course-modal-body').innerHTML = `
            <div class="row">
                <div class="col-md-8">
                    ${course.thumbnail_url 
                        ? `<img src="${escapeHTML(course.thumbnail_url)}" class="img-fluid rounded mb-3 w-100" alt="${escapeHTML(course.title)}" style="max-height: 300px; object-fit: cover;">`
                        : ''
                    }
                    <h6>Description</h6>
                    <div class="mb-3">${course.description || '<p class="text-muted">No description available</p>'}</div>
                    
                    <h6 class="mt-4">What You'll Learn</h6>
                    <p>${course.short_description || 'Contact instructor for more details'}</p>
                    
                    <h6 class="mt-4">Course Details</h6>
                    <div class="row">
                        <div class="col-6 mb-3">
                            <small class="text-muted d-block">Duration</small>
                            <strong>${course.estimated_duration_minutes || 0} minutes</strong>
                        </div>
                        <div class="col-6 mb-3">
                            <small class="text-muted d-block">Difficulty</small>
                            <strong class="text-capitalize">${course.difficulty_level || 'Beginner'}</strong>
                        </div>
                        <div class="col-6 mb-3">
                            <small class="text-muted d-block">Category</small>
                            <strong>${escapeHTML(course.category || 'General')}</strong>
                        </div>
                        <div class="col-6 mb-3">
                            <small class="text-muted d-block">Passing Score</small>
                            <strong>${course.passing_score || 70}%</strong>
                        </div>
                        <div class="col-6 mb-3">
                            <small class="text-muted d-block">Enrolled</small>
                            <strong>${course.enrollment_count || 0} students</strong>
                        </div>
                        <div class="col-6 mb-3">
                            <small class="text-muted d-block">Rating</small>
                            <strong>${course.avg_rating ? course.avg_rating.toFixed(1) + '/5' : 'N/A'}</strong>
                        </div>
                    </div>
                    
                    ${course.video_url ? `
                        <h6 class="mt-4">Preview</h6>
                        <div class="ratio ratio-16x9">
                            <iframe src="${escapeHTML(course.video_url.replace('watch?v=', 'embed/'))}" 
                                title="Course Preview" 
                                allowfullscreen>
                            </iframe>
                        </div>
                    ` : ''}
                </div>
                <div class="col-md-4">
                    <div class="card sticky-top" style="top: 20px;">
                        <div class="card-body">
                            <h6 class="card-title">Enrollment Stats</h6>
                            <ul class="list-unstyled mb-3">
                                <li class="mb-2 d-flex justify-content-between">
                                    <small class="text-muted">Status:</small>
                                    <span class="badge ${isCompleted ? 'bg-success' : isEnrolled ? 'bg-primary' : 'bg-secondary'}">${isCompleted ? 'Completed' : isEnrolled ? 'Enrolled' : 'Not Enrolled'}</span>
                                </li>
                                <li class="mb-2 d-flex justify-content-between">
                                    <small class="text-muted">Progress:</small>
                                    <span>${course.progress_percent ? Math.round(course.progress_percent) + '%' : '0%'}</span>
                                </li>
                            </ul>
                            
                            ${isCompleted ? `
                                <button class="btn btn-success w-100 mb-2" onclick="window.__app.viewCertificate('${course.enrollment_id}')">
                                    <i class="bi bi-award me-1"></i>View Certificate
                                </button>
                                <button class="btn btn-outline-primary w-100" onclick="window.__app.continueCourse('${course.id}')">
                                    <i class="bi bi-arrow-clockwise me-1"></i>Review Course
                                </button>
                            ` : isEnrolled ? `
                                <button class="btn btn-primary w-100" onclick="window.__app.continueCourse('${course.id}'); bootstrap.Modal.getInstance(document.getElementById('lms-course-detail-modal')).hide();">
                                    <i class="bi bi-play-circle me-1"></i>Continue Learning
                                </button>
                            ` : `
                                <button class="btn btn-primary w-100" id="lms-btn-enroll-course" data-course-id="${course.id}">
                                    <i class="bi bi-person-plus me-1"></i>Enroll Now
                                </button>
                            `}
                            
                            ${state.currentUser?.role && ['superadmin', 'hr', 'manager'].includes(state.currentUser.role) ? `
                                <hr class="my-3">
                                <button class="btn btn-outline-secondary btn-sm w-100" onclick="window.__app.editCourse('${course.id}'); bootstrap.Modal.getInstance(document.getElementById('lms-course-detail-modal')).hide();">
                                    <i class="bi bi-pencil me-1"></i>Edit Course
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Store course ID for enrollment button
        const enrollBtn = document.getElementById('lms-btn-enroll-course');
        if (enrollBtn) {
            enrollBtn.dataset.courseId = course.id;
        }
        
        modal.show();
        notify.close();
    } catch (error) {
        console.error('Failed to load course details:', error);
        notify.error('Failed to load course details');
    }
}
                    <h6>Description</h6>
                    <p>${course.description || 'No description available'}</p>
                    
                    <h6>What You'll Learn</h6>
                    <p>${course.short_description || ''}</p>
                    
                    <h6 class="mt-4">Course Details</h6>
                    <div class="row">
                        <div class="col-6 mb-2">
                            <small class="text-muted">Duration</small>
                            <div>${course.estimated_duration_minutes || 0} minutes</div>
                        </div>
                        <div class="col-6 mb-2">
                            <small class="text-muted">Difficulty</small>
                            <div>${course.difficulty_level || 'Beginner'}</div>
                        </div>
                        <div class="col-6 mb-2">
                            <small class="text-muted">Category</small>
                            <div>${course.category || 'General'}</div>
                        </div>
                        <div class="col-6 mb-2">
                            <small class="text-muted">Passing Score</small>
                            <div>${course.passing_score || 70}%</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">Enrollment Stats</h6>
                            <ul class="list-unstyled">
                                <li class="mb-2">
                                    <small class="text-muted">Enrolled:</small>
                                    <span class="float-end">${course.enrollment_count || 0}</span>
                                </li>
                                <li class="mb-2">
                                    <small class="text-muted">Completed:</small>
                                    <span class="float-end">${course.completion_count || 0}</span>
                                </li>
                                <li class="mb-2">
                                    <small class="text-muted">Avg Rating:</small>
                                    <span class="float-end">${course.avg_rating ? course.avg_rating.toFixed(1) : '-'}</span>
                                </li>
                            </ul>
                            <button class="btn btn-primary w-100" onclick="window.__app.enrollInCourse('${course.id}')">
                                <i class="bi bi-person-plus me-1"></i>Enroll Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.show();
    } catch (error) {
        console.error('Failed to load course details:', error);
        notify.error('Failed to load course details');
    }
}

function generateCourseForm(course = {}) {
    return `
        <form id="lms-course-form">
            <div class="row">
                <div class="col-md-8 mb-3">
                    <label class="form-label">Course Title *</label>
                    <input type="text" class="form-control" id="course-title" value="${escapeHTML(course.title || '')}" required>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Category</label>
                    <select class="form-select" id="course-category">
                        <option value="General" ${course.category === 'General' ? 'selected' : ''}>General</option>
                        <option value="Technical Skills" ${course.category === 'Technical Skills' ? 'selected' : ''}>Technical Skills</option>
                        <option value="Leadership" ${course.category === 'Leadership' ? 'selected' : ''}>Leadership</option>
                        <option value="Communication" ${course.category === 'Communication' ? 'selected' : ''}>Communication</option>
                        <option value="Compliance" ${course.category === 'Compliance' ? 'selected' : ''}>Compliance</option>
                        <option value="Safety" ${course.category === 'Safety' ? 'selected' : ''}>Safety</option>
                    </select>
                </div>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Short Description (max 500 chars)</label>
                <textarea class="form-control" id="course-short-desc" rows="2" maxlength="500">${escapeHTML(course.short_description || '')}</textarea>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Full Description</label>
                <div id="course-description-editor" style="min-height: 200px;">
                    ${course.description || ''}
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label">Difficulty Level</label>
                    <select class="form-select" id="course-difficulty">
                        <option value="beginner" ${course.difficulty_level === 'beginner' ? 'selected' : ''}>Beginner</option>
                        <option value="intermediate" ${course.difficulty_level === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                        <option value="advanced" ${course.difficulty_level === 'advanced' ? 'selected' : ''}>Advanced</option>
                        <option value="expert" ${course.difficulty_level === 'expert' ? 'selected' : ''}>Expert</option>
                    </select>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Duration (minutes)</label>
                    <input type="number" class="form-control" id="course-duration" value="${course.estimated_duration_minutes || 0}" min="0">
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Passing Score (%)</label>
                    <input type="number" class="form-control" id="course-passing-score" value="${course.passing_score || 70}" min="0" max="100">
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Thumbnail URL</label>
                    <input type="url" class="form-control" id="course-thumbnail" value="${escapeHTML(course.thumbnail_url || '')}" placeholder="https://example.com/image.jpg">
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Video URL (YouTube)</label>
                    <input type="url" class="form-control" id="course-video" value="${escapeHTML(course.content_url || '')}" placeholder="https://youtube.com/watch?v=...">
                </div>
            </div>
            
            <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="course-mandatory" ${course.is_mandatory ? 'checked' : ''}>
                <label class="form-check-label" for="course-mandatory">
                    Mandatory Course
                </label>
            </div>
            
            <input type="hidden" id="course-id" value="${course.id || ''}">
        </form>
    `;
}

async function handleSaveCourse() {
    // Get form data
    const courseData = getCourseFormData();
    if (!courseData) {
        notify.error('Failed to read form data');
        return;
    }
    
    // Validate
    const errors = validateCourseForm(courseData);
    if (errors.length > 0) {
        notify.error(errors.join('<br>'));
        return;
    }
    
    // Show loading
    const saveBtn = document.getElementById('lms-btn-save-course');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    
    try {
        const result = courseData.id 
            ? await lmsData.updateCourse(courseData.id, courseData)
            : await lmsData.createCourse(courseData);
        
        notify.success(courseData.id ? 'Course updated successfully!' : 'Course created successfully!');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('lms-course-form-modal'));
        if (modal) {
            modal.hide();
        }
        
        // Refresh appropriate view
        if (currentLmsView === 'admin-courses') {
            await loadAdminCourses();
        } else if (currentLmsView === 'catalog') {
            await loadCatalog();
        }
        
    } catch (error) {
        console.error('Failed to save course:', error);
        notify.error('Failed to save course: ' + (error.message || 'Unknown error'));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function handleEnroll() {
    const courseId = document.getElementById('lms-course-detail-modal').dataset.courseId;
    if (!courseId) return;

    try {
        await lmsData.enrollInCourse(courseId);
        notify.success('Successfully enrolled in course');
        bootstrap.Modal.getInstance(document.getElementById('lms-course-detail-modal')).hide();
        switchLmsView('my-courses');
    } catch (error) {
        console.error('Failed to enroll:', error);
        notify.error('Failed to enroll in course');
    }
}

// ==================================================
// EXPORTS
// ==================================================

export {
    initLms,
    switchLmsView,
    loadMyLearning,
    loadCatalog,
    loadMyCourses,
    loadCertificates,
    loadAdminCourses,
    loadAdminEnrollments,
    loadAdminReports,
    showCourseDetails,
    showCreateCourseModal
};

// Window exports for onclick handlers
window.__app = window.__app || {};
window.__app.showCourseDetails = showCourseDetails;
window.__app.enrollInCourse = handleEnroll;
window.__app.editCourse = async (courseId) => {
    const course = await lmsData.getCourse(courseId);
    document.getElementById('lms-form-modal-title').textContent = 'Edit Course';
    document.getElementById('lms-form-modal-body').innerHTML = generateCourseForm(course);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('lms-course-form-modal')).show();
};
window.__app.deleteCourse = async (courseId) => {
    const confirm = await notify.confirm('Are you sure you want to delete this course? This action cannot be undone.', 'Delete Course');
    if (confirm.isConfirmed) {
        try {
            await lmsData.deleteCourse(courseId);
            notify.success('Course deleted');
            loadAdminCourses();
        } catch (error) {
            notify.error('Failed to delete course');
        }
    }
};
window.__app.continueCourse = (courseId) => {
    notify.info('Lesson viewer coming in Sprint 2');
    // TODO: Implement lesson viewer
};
window.__app.viewCertificate = (enrollmentId) => {
    notify.info('Certificate download coming in Sprint 4');
    // TODO: Implement certificate download
};
window.__app.clearCatalogFilters = () => {
    const searchInput = document.getElementById('lms-catalog-search');
    const categorySelect = document.getElementById('lms-catalog-category');
    const difficultySelect = document.getElementById('lms-catalog-difficulty');
    
    if (searchInput) searchInput.value = '';
    if (categorySelect) categorySelect.value = '';
    if (difficultySelect) difficultySelect.value = '';
    
    loadCatalog();
};
window.__app.goToPage = (page) => {
    const search = document.getElementById('lms-catalog-search')?.value || '';
    const category = document.getElementById('lms-catalog-category')?.value || '';
    const difficulty = document.getElementById('lms-catalog-difficulty')?.value || '';
    
    loadCatalogWithFilters({ search, category, difficulty_level: difficulty, page });
};