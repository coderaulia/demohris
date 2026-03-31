// ==================================================
// LMS ENROLLMENT FLOW - Enrollment Confirmation and Management
// ==================================================

import { state } from '../lib/store.js';
import { escapeHTML, formatDate, formatDateTime } from '../lib/utils.js';
import * as notify from '../lib/notify.js';
import * as lmsData from '../data/lms.js';
import { openLessonViewer } from './lessonViewer.js';

// ==================================================
// ENROLLMENT CONFIRMATION DIALOG
// ==================================================

async function showEnrollmentConfirmation(course) {
    const result = await notify.confirm({
        title: `Enroll in "${course.title}"?`,
        html: generateEnrollmentDialogContent(course),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, enroll me!',
        cancelButtonText: 'Cancel',
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
        },
        preConfirm: async () => {
            const startImmediately = document.getElementById('enroll-start-immediately')?.checked;
            return { startImmediately };
        }
    });
    
    if (result.isConfirmed) {
        await handleEnrollment(course.id, result.value.startImmediately);
    }
}

function generateEnrollmentDialogContent(course) {
    const durationHours = Math.floor((course.estimated_duration_minutes || 0) / 60);
    const durationMins = (course.estimated_duration_minutes || 0) % 60;
    const durationText = durationHours > 0 
        ? `${durationHours}h ${durationMins > 0 ? durationMins + 'm' : ''}`
        : `${durationMins} minutes`;
    
    const prereqHtml = course.prerequisites && course.prerequisites.length > 0
        ? `<div class="alert alert-warning">
               <strong><i class="bi bi-exclamation-triangle me-2"></i>Prerequisites:</strong>
               <ul class="mb-0 mt-2">${course.prerequisites.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>
           </div>`
        : '';
    
    return `
        <div class="enrollment-confirmation">
            ${course.thumbnail_url 
                ? `<img src="${escapeHTML(course.thumbnail_url)}" class="img-fluid rounded mb-3" style="max-height: 150px; object-fit: cover;">`
                : '<div class="bg-light rounded d-flex align-items-center justify-content-center mb-3" style="height: 150px;"><i class="bi bi-book-half text-muted" style="font-size: 4rem;"></i></div>'
            }
            
            <h5 class="mb-3">${escapeHTML(course.title)}</h5>
            
            <div class="row mb-3">
                <div class="col-6">
                    <small class="text-muted d-block">Duration</small>
                    <strong>${durationText}</strong>
                </div>
                <div class="col-6">
                    <small class="text-muted d-block">Difficulty</small>
                    <strong class="text-capitalize">${course.difficulty_level || 'Beginner'}</strong>
                </div>
                <div class="col-6 mt-2">
                    <small class="text-muted d-block">Category</small>
                    <strong>${escapeHTML(course.category || 'General')}</strong>
                </div>
                <div class="col-6 mt-2">
                    <small class="text-muted d-block">Passing Score</small>
                    <strong>${course.passing_score || 70}%</strong>
                </div>
            </div>
            
            ${prereqHtml}
            
            ${course.is_mandatory 
                ? '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>This is a mandatory course for your role.</div>'
                : ''
            }
            
            ${course.certificate_enabled !== false 
                ? '<div class="text-success small mb-2"><i class="bi bi-award me-1"></i>Certificate provided upon completion</div>'
                : ''
            }
            
            <div class="form-check mt-3">
                <input class="form-check-input" type="checkbox" id="enroll-start-immediately" checked>
                <label class="form-check-label" for="enroll-start-immediately">
                    Start course immediately after enrollment
                </label>
            </div>
            
            <div class="mt-3 pt-3 border-top">
                <h6 class="text-muted">What you'll learn:</h6>
                <p class="small">${course.short_description || course.description?.substring(0, 200) || 'Master the skills and knowledge covered in this comprehensive course.'}</p>
            </div>
        </div>
    `;
}

async function handleEnrollment(courseId, startImmediately = false) {
    try {
        notify.info('Enrolling you in the course...');
        
        const result = await lmsData.enrollInCourse(courseId);
        
        if (!result || !result.enrollment_id) {
            throw new Error('Failed to enroll in course');
        }
        
        notify.success('Successfully enrolled! 🎉');
        
        if (startImmediately) {
            // Wait briefly for user to see the success message
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Close any open modals
            const modalEl = document.getElementById('lms-course-detail-modal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) {
                    modal.hide();
                }
            }
            
            // Small delay before opening lesson viewer
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Open lesson viewer
            await openLessonViewer(result.enrollment_id);
        } else {
            // Refresh course list
            if (typeof window.__app.loadMyCourses === 'function') {
                await window.__app.loadMyCourses();
            }
            if (typeof window.__app.loadMyLearning === 'function') {
                await window.__app.loadMyLearning();
            }
        }
        
    } catch (error) {
        console.error('Enrollment failed:', error);
        notify.error('Failed to enroll in course: ' + (error.message || 'Unknown error'));
    }
}

// ==================================================
// UNENROLL FROM COURSE
// ==================================================

async function confirmUnenrollment(enrollmentId, courseTitle) {
    const result = await notify.confirm({
        title: 'Unenroll from Course?',
        html: `
            <div class="unenrollment-confirmation">
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong>Warning:</strong> This action cannot be undone.
                </div>
                <p>You are about to unenroll from:</p>
                <h5>${escapeHTML(courseTitle)}</h5>
                <p class="text-muted small">All your progress will be lost and you will need to start from the beginning if you enroll again.</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, unenroll me',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545'
    });
    
    if (result.isConfirmed) {
        await unenrollFromCourse(enrollmentId);
    }
}

async function unenrollFromCourse(enrollmentId) {
    try {
        notify.info('Processing your request...');
        
        await lmsData.unenrollFromCourse(enrollmentId);
        
        notify.success('Successfully unenrolled from course');
        
        // Refresh enrollments
        if (typeof window.__app.loadMyCourses === 'function') {
            await window.__app.loadMyCourses();
        }
        if (typeof window.__app.loadMyLearning === 'function') {
            await window.__app.loadMyLearning();
        }
        
    } catch (error) {
        console.error('Unenrollment failed:', error);
        notify.error('Failed to unenroll from course');
    }
}

// ==================================================
// BULK ENROLLMENT
// ==================================================

async function showBulkEnrollmentDialog(courseId) {
    // TODO: Implement bulk enrollment with employee selector
    notify.info('Bulk enrollment coming soon!');
    
    // Future implementation:
    // - Select multiple employees from employee list
    // - Filter by department, role, etc.
    // - Set due date
    // - Assign to all at once
}

// ==================================================
// CHECK PREREQUISITES
// ==================================================

async function checkPrerequisites(course) {
    if (!course.prerequisites || course.prerequisites.length === 0) {
        return { met: true, missing: [] };
    }
    
    // TODO: Implement prerequisite checking
    // - Get user's completed courses
    // - Compare with prerequisites list
    // - Return missing prerequisites
    
    return { met: true, missing: [] };
}

// ==================================================
// EXPORTS
// ==================================================

export {
    showEnrollmentConfirmation,
    handleEnrollment,
    confirmUnenrollment,
    unenrollFromCourse,
    showBulkEnrollmentDialog,
    checkPrerequisites
};

// Window exports
window.__app.enrollInCourse = (course) => showEnrollmentConfirmation(course);
window.__app.unenrollFromCourse = (enrollmentId, courseTitle) => confirmUnenrollment(enrollmentId, courseTitle);