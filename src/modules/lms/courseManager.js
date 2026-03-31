// ==================================================
// LMS COURSE MANAGER - Course CRUD and Form Management
// ==================================================

import { state } from '../lib/store.js';
import { escapeHTML } from '../lib/utils.js';
import * as notify from '../lib/notify.js';
import * as lmsData from '../data/lms.js';

let quillEditor = null;
let currentCourseId = null;

// ==================================================
// COURSE FORM MODAL
// ==================================================

async function showCourseFormModal(courseId = null) {
    currentCourseId = courseId;
    const modal = new bootstrap.Modal(document.getElementById('lms-course-form-modal'));
    const title = document.getElementById('lms-form-modal-title');
    const body = document.getElementById('lms-form-modal-body');
    
    if (courseId) {
        title.textContent = 'Edit Course';
        try {
            const course = await lmsData.getCourse(courseId);
            body.innerHTML = generateCourseFormHTML(course);
            await initializeQuillEditor(course.description || '');
        } catch (error) {
            notify.error('Failed to load course details');
            return;
        }
    } else {
        title.textContent = 'Create New Course';
        body.innerHTML = generateCourseFormHTML({});
        await initializeQuillEditor('');
    }
    
    modal.show();
}

function generateCourseFormHTML(course = {}) {
    const categories = [
        'General', 'Technical Skills', 'Leadership', 'Communication',
        'Compliance', 'Safety', 'Sales', 'Customer Service',
        'IT & Software', 'Marketing', 'Finance', 'HR Management',
        'Project Management', 'Soft Skills'
    ];
    
    const difficultyLevels = [
        { value: 'beginner', label: 'Beginner' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'advanced', label: 'Advanced' },
        { value: 'expert', label: 'Expert' }
    ];
    
    return `
        <form id="lms-course-form" class="needs-validation" novalidate>
            <input type="hidden" id="course-id" value="${course.id || ''}">
            
            <!-- Basic Information -->
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Basic Information</h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8 mb-3">
                            <label for="course-title" class="form-label">Course Title *</label>
                            <input type="text" class="form-control" id="course-title" 
                                value="${escapeHTML(course.title || '')}" 
                                placeholder="e.g., Advanced Sales Techniques"
                                required>
                            <div class="invalid-feedback">Course title is required.</div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <label for="course-status" class="form-label">Status</label>
                            <select class="form-select" id="course-status">
                                <option value="draft" ${course.status === 'draft' ? 'selected' : ''}>Draft</option>
                                <option value="published" ${course.status === 'published' ? 'selected' : ''}>Published</option>
                                <option value="archived" ${course.status === 'archived' ? 'selected' : ''}>Archived</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label for="course-short-desc" class="form-label">Short Description</label>
                        <textarea class="form-control" id="course-short-desc" rows="2" 
                            maxlength="500" placeholder="Brief description for course cards (max 500 chars)">${escapeHTML(course.short_description || '')}</textarea>
                        <small class="text-muted"><span id="short-desc-count">0</span>/500 characters</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Full Description</label>
                        <div id="course-description-editor" style="min-height: 200px;">
                            ${course.description || ''}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Course Details -->
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Course Details</h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4 mb-3">
                            <label for="course-category" class="form-label">Category</label>
                            <select class="form-select" id="course-category">
                                ${categories.map(cat => 
                                    `<option value="${cat}" ${course.category === cat ? 'selected' : ''}>${cat}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-md-4 mb-3">
                            <label for="course-difficulty" class="form-label">Difficulty Level</label>
                            <select class="form-select" id="course-difficulty">
                                ${difficultyLevels.map(d => 
                                    `<option value="${d.value}" ${course.difficulty_level === d.value ? 'selected' : ''}>${d.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-md-4 mb-3">
                            <label for="course-duration" class="form-label">Duration (minutes)</label>
                            <input type="number" class="form-control" id="course-duration" 
                                value="${course.estimated_duration_minutes || 60}" min="0" max="6000" step="15">
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="course-passing-score" class="form-label">Passing Score (%)</label>
                            <input type="number" class="form-control" id="course-passing-score" 
                                value="${course.passing_score || 70}" min="0" max="100">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="course-max-attempts" class="form-label">Max Quiz Attempts</label>
                            <input type="number" class="form-control" id="course-max-attempts" 
                                value="${course.max_attempts || 0}" min="0" max="10">
                            <small class="text-muted">0 = Unlimited attempts</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Media & Content -->
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-image me-2"></i>Media & Content</h6>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <label for="course-thumbnail" class="form-label">Thumbnail Image URL</label>
                        <input type="url" class="form-control" id="course-thumbnail" 
                            value="${escapeHTML(course.thumbnail_url || '')}"
                            placeholder="https://example.com/images/course-thumbnail.jpg">
                        <small class="text-muted">Recommended size: 800x450 pixels (16:9 ratio)</small>
                    </div>
                    
                    <div class="mb-3">
                        <label for="course-video" class="form-label">Introduction Video URL (YouTube)</label>
                        <input type="url" class="form-control" id="course-video" 
                            value="${escapeHTML(course.video_url || '')}"
                            placeholder="https://www.youtube.com/watch?v=...">
                        <small class="text-muted">YouTube video for course introduction</small>
                    </div>
                </div>
            </div>
            
            <!-- Settings -->
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-sliders me-2"></i>Settings</h6>
                </div>
                <div class="card-body">
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="course-mandatory" 
                            ${course.is_mandatory ? 'checked' : ''}>
                        <label class="form-check-label" for="course-mandatory">
                            <strong>Mandatory Course</strong> - Employees must complete this course
                        </label>
                    </div>
                    
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="course-certificate" 
                            ${course.certificate_enabled !== false ? 'checked' : ''}>
                        <label class="form-check-label" for="course-certificate">
                            <strong>Issue Certificate</strong> - Generate certificate upon completion
                        </label>
                    </div>
                </div>
            </div>
            
            <input type="hidden" id="course-quill-content" value="">
        </form>
    `;
}

async function initializeQuillEditor(initialContent = '') {
    // Wait for Quill to be available
    let retries = 10;
    while (!window.Quill && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
    }
    
    if (!window.Quill) {
        console.warn('Quill editor not loaded, falling back to textarea');
        return;
    }
    
    // Destroy previous instance if exists
    if (quillEditor) {
        quillEditor = null;
    }
    
    const editorElement = document.getElementById('course-description-editor');
    if (!editorElement) return;
    
    quillEditor = new Quill(editorElement, {
        theme: 'snow',
        placeholder: 'Write course description here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'indent': '-1' }, { 'indent': '+1' }],
                [{ 'direction': 'rtl' }],
                [{ 'align': [] }],
                ['link', 'image', 'video'],
                ['clean']
            ]
        }
    });
    
    // Set initial content
    if (initialContent) {
        quillEditor.root.innerHTML = initialContent;
    }
    
    // Update hidden input before form submission
    quillEditor.on('text-change', () => {
        const contentInput = document.getElementById('course-quill-content');
        if (contentInput) {
            contentInput.value = quillEditor.root.innerHTML;
        }
    });
}

function getCourseFormData() {
    const form = document.getElementById('lms-course-form');
    if (!form) return null;
    
    // Get Quill content
    let description = '';
    if (quillEditor) {
        description = quillEditor.root.innerHTML;
    } else {
        const editorDiv = document.getElementById('course-description-editor');
        if (editorDiv) {
            description = editorDiv.innerHTML;
        }
    }
    
    return {
        id: document.getElementById('course-id')?.value || null,
        title: document.getElementById('course-title')?.value.trim() || '',
        status: document.getElementById('course-status')?.value || 'draft',
        short_description: document.getElementById('course-short-desc')?.value.trim() || '',
        description: description,
        category: document.getElementById('course-category')?.value || 'General',
        difficulty_level: document.getElementById('course-difficulty')?.value || 'beginner',
        estimated_duration_minutes: parseInt(document.getElementById('course-duration')?.value) || 60,
        passing_score: parseFloat(document.getElementById('course-passing-score')?.value) || 70,
        max_attempts: parseInt(document.getElementById('course-max-attempts')?.value) || 0,
        thumbnail_url: document.getElementById('course-thumbnail')?.value.trim() || '',
        video_url: document.getElementById('course-video')?.value.trim() || '',
        is_mandatory: document.getElementById('course-mandatory')?.checked || false,
        certificate_enabled: document.getElementById('course-certificate')?.checked !== false
    };
}

function validateCourseForm(courseData) {
    const errors = [];
    
    if (!courseData.title || courseData.title.length < 3) {
        errors.push('Course title must be at least 3 characters long.');
    }
    
    if (!courseData.title || courseData.title.length > 255) {
        errors.push('Course title must not exceed 255 characters.');
    }
    
    if (courseData.estimated_duration_minutes < 0 || courseData.estimated_duration_minutes > 6000) {
        errors.push('Duration must be between 0 and 6000 minutes.');
    }
    
    if (courseData.passing_score < 0 || courseData.passing_score > 100) {
        errors.push('Passing score must be between 0 and 100.');
    }
    
    if (courseData.max_attempts < 0 || courseData.max_attempts > 10) {
        errors.push('Max attempts must be between 0 and 10.');
    }
    
    if (courseData.thumbnail_url && !isValidURL(courseData.thumbnail_url)) {
        errors.push('Thumbnail URL must be a valid URL.');
    }
    
    if (courseData.video_url && !isValidURL(courseData.video_url)) {
        errors.push('Video URL must be a valid URL.');
    }
    
    return errors;
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// ==================================================
// COURSE CATALOG ENHANCEMENTS
// ==================================================

async function enhanceCourseSearch(filters = {}) {
    // Handle search with debounce
    const searchInput = document.getElementById('lms-catalog-search');
    if (searchInput) {
        let searchTimeout = null;
        searchInput.addEventListener('input', (e) => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filters.search = e.target.value;
                loadCatalogWithFilters(filters);
            }, 500);
        });
    }
}

async function loadCatalogWithFilters(filters = {}) {
    const container = document.getElementById('lms-catalog-cards');
    if (!container) return;
    
    // Show loading
    container.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Loading courses...
        </div>
    `;
    
    try {
        const result = await lmsData.listCourses({
            status: 'published',
            ...filters
        });
        
        if (!result.courses || result.courses.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                    No courses found matching your criteria
                    <br>
                    <button class="btn btn-link" onclick="window.__app.clearCatalogFilters()">
                        Clear filters
                    </button>
                </div>
            `;
            return;
        }
        
        renderCourseCards(container, result.courses);
        renderPagination(result);
        
    } catch (error) {
        console.error('Failed to load catalog:', error);
        container.innerHTML = `
            <div class="col-12 text-center text-danger py-5">
                <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                Failed to load courses
                <br>
                <button class="btn btn-outline-danger mt-2" onclick="window.__app.loadCatalog()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Retry
                </button>
            </div>
        `;
        notify.error('Failed to load course catalog');
    }
}

function renderCourseCards(container, courses) {
    container.innerHTML = courses.map(course => `
        <div class="col-md-4 col-lg-3 mb-4">
            <div class="card course-card h-100" onclick="window.__app.showCourseDetails('${course.id}')">
                ${course.thumbnail_url 
                    ? `<img src="${escapeHTML(course.thumbnail_url)}" class="course-thumbnail card-img-top" alt="${escapeHTML(course.title)}" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect fill=%22%23e9ecef%22 width=%22200%22 height=%22150%22/><text fill=%22%23666%22 x=%2250%%22 y=%2250%%22 font-size=%2216%22>No Image</text></svg>'">`
                    : `<div class="course-thumbnail card-img-top d-flex align-items-center justify-content-center bg-light"><i class="bi bi-book fs-1 text-secondary"></i></div>`
                }
                <div class="card-body">
                    <h6 class="card-title">${escapeHTML(course.title)}</h6>
                    <p class="card-text small text-muted mb-2">${escapeHTML(course.short_description || (course.description && course.description.substring(0, 80))) || ''}</p>
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
}

function renderPagination(result) {
    const pagination = document.getElementById('lms-catalog-pagination');
    if (!pagination) return;
    
    const { page, limit, total } = result;
    const totalPages = Math.ceil(total / limit);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '<ul class="pagination justify-content-center">';
    
    // Previous button
    html += `
        <li class="page-item ${page <= 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="window.__app.goToPage(${page - 1}); return false;">
                <i class="bi bi-chevron-left"></i>
            </a>
        </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="window.__app.goToPage(${i}); return false;">${i}</a>
            </li>
        `;
    }
    
    // Next button
    html += `
        <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="window.__app.goToPage(${page + 1}); return false;">
                <i class="bi bi-chevron-right"></i>
            </a>
        </li>
    `;
    
    html += '</ul>';
    pagination.innerHTML = html;
}

// ==================================================
// COURSE ENROLLMENT
// ==================================================

async function showEnrollmentConfirmation(course) {
    const result = await notify.confirm({
        title: 'Enroll in Course?',
        text: `You are about to enroll in "${course.title}". Duration: ${course.estimated_duration_minutes || 0} minutes.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, enroll me!',
        cancelButtonText: 'Cancel'
    });
    
    if (result.isConfirmed) {
        try {
            await lmsData.enrollInCourse(course.id);
            notify.success('Successfully enrolled in course!');
            
            // Refresh my courses
            if (typeof window.__app.loadMyCourses === 'function') {
                window.__app.loadMyCourses();
            }
        } catch (error) {
            console.error('Enrollment failed:', error);
            notify.error('Failed to enroll in course: ' + (error.message || 'Unknown error'));
        }
    }
}

// ==================================================
// EXPORTS
// ==================================================

export {
    showCourseFormModal,
    generateCourseFormHTML,
    initializeQuillEditor,
    getCourseFormData,
    validateCourseForm,
    enhanceCourseSearch,
    loadCatalogWithFilters,
    renderCourseCards,
    renderPagination,
    showEnrollmentConfirmation
};