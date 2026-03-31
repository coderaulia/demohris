// ==================================================
// LMS LESSON VIEWER - Course Content Player
// ==================================================

import { state } from '../lib/store.js';
import { escapeHTML, formatDate, formatDateTime } from '../lib/utils.js';
import * as notify from '../lib/notify.js';
import * as lmsData from '../data/lms.js';

let currentEnrollment = null;
let currentSection = null;
let currentLesson = null;

// ==================================================
// LESSON VIEWER MODAL
// ==================================================

async function openLessonViewer(enrollmentId) {
    try {
        notify.info('Loading course...');
        
        // Get enrollment details
        const enrollment = await lmsData.getEnrollmentDetails(enrollmentId);
        
        currentEnrollment = enrollment;
        
        // Get course details with sections and lessons
        const course = await lmsData.getCourse(enrollment.course_id);
        if (!course || !course.sections || course.sections.length === 0) {
            notify.error('Course content not available');
            return;
        }
        
        // Create lesson viewer modal
        const modalHtml = generateLessonViewerHTML(course);
        showLessonViewerModal(modalHtml);
        
        // Find current progress
        const progress = await lmsData.getProgressData(enrollmentId);
        
        // Load first uncompleted lesson or continue from last lesson
        const startSection = findStartSection(course.sections, progress);
        const startLesson = findStartLesson(startSection, progress);
        
        // Load the lesson
        await loadLesson(startSection.id, startLesson.id);
        
        notify.close();
    } catch (error) {
        console.error('Failed to open lesson viewer:', error);
        notify.error('Failed to load course: ' + (error.message || 'Unknown error'));
    }
}

function generateLessonViewerHTML(course) {
    return `
        <div class="modal fade" id="lesson-viewer-modal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-xl modal-fullscreen-lg-down">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-mortarboard me-2"></i>
                            ${escapeHTML(course.title)}
                        </h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-light text-dark" id="lesson-progress-badge">0%</span>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body p-0">
                        <div class="row g-0">
                            <!-- Sidebar: Course Outline -->
                            <div class="col-md-4 border-end" id="lesson-sidebar">
                                <div class="p-3 bg-light border-bottom">
                                    <h6 class="mb-0">
                                        <i class="bi bi-list-ul me-2"></i>Course Outline
                                    </h6>
                                </div>
                                <div class="accordion" id="course-outline-accordion">
                                    ${course.sections.map((section, sIndex) => `
                                        <div class="accordion-item">
                                            <h2 class="accordion-header">
                                                <button class="accordion-button ${sIndex > 0 ? 'collapsed' : ''}" 
                                                    type="button" 
                                                    data-bs-toggle="collapse" 
                                                    data-bs-target="#section-${section.id}">
                                                    <span class="me-2">${escapeHTML(section.title)}</span>
                                                    <span class="badge bg-secondary ms-auto" id="section-progress-${section.id}">0/${section.lessons?.length || 0}</span>
                                                </button>
                                            </h2>
                                            <div id="section-${section.id}" 
                                                class="accordion-collapse collapse ${sIndex === 0 ? 'show' : ''}" 
                                                data-bs-parent="#course-outline-accordion">
                                                <div class="accordion-body p-0">
                                                    <div class="list-group list-group-flush">
                                                        ${(section.lessons || []).map(lesson => `
                                                            <button type="button" 
                                                                class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                                                                id="lesson-btn-${lesson.id}"
                                                                onclick="window.__app.loadLesson('${section.id}', '${lesson.id}')">
                                                                <div>
                                                                    <i class="bi ${getLessonIcon(lesson.content_type)} me-2"></i>
                                                                    <small>${escapeHTML(lesson.title)}</small>
                                                                </div>
                                                                <i class="bi bi-check-circle-fill text-success d-none" id="lesson-check-${lesson.id}"></i>
                                                            </button>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <!-- Main: Lesson Content -->
                            <div class="col-md-8" id="lesson-content-area">
                                <div id="lesson-content-loader" class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-3 text-muted">Loading lesson...</p>
                                </div>
                                
                                <div id="lesson-content-wrapper" style="display: none;">
                                    <!-- Lesson title -->
                                    <div class="border-bottom p-3 bg-light">
                                        <h5 id="lesson-title" class="mb-1">Lesson Title</h5>
                                        <div class="d-flex gap-3 text-muted small">
                                            <span><i class="bi bi-clock me-1"></i><span id="lesson-duration">0</span> min</span>
                                            <span><i class="bi bi-bar-chart me-1"></i><span id="lesson-type">Text</span></span>
                                        </div>
                                    </div>
                                    
                                    <!-- Lesson content -->
                                    <div class="p-4" id="lesson-content">
                                        <!-- Content will be loaded here -->
                                    </div>
                                    
                                    <!-- Navigation buttons -->
                                    <div class="border-top p-3 bg-light d-flex justify-content-between">
                                        <button class="btn btn-outline-secondary" id="btn-prev-lesson" onclick="window.__app.prevLesson()">
                                            <i class="bi bi-arrow-left me-1"></i>Previous
                                        </button>
                                        <button class="btn btn-primary" id="btn-complete-lesson" onclick="window.__app.completeLesson()">
                                            <i class="bi bi-check-circle me-1"></i>Mark Complete
                                        </button>
                                        <button class="btn btn-primary" id="btn-next-lesson" onclick="window.__app.nextLesson()">
                                            Next<i class="bi bi-arrow-right ms-1"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <small class="text-muted me-auto" id="lesson-last-accessed">
                            Last accessed: Never
                        </small>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showLessonViewerModal(modalHtml) {
    // Remove existing modal if any
    const existing = document.getElementById('lesson-viewer-modal');
    if (existing) {
        existing.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('lesson-viewer-modal'));
    modal.show();
    
    // Clean up on close
    document.getElementById('lesson-viewer-modal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('lesson-viewer-modal').remove();
        currentEnrollment = null;
        currentSection = null;
        currentLesson = null;
    });
}

function getLessonIcon(contentType) {
    const icons = {
        'video': 'bi-play-circle',
        'document': 'bi-file-text',
        'quiz': 'bi-question-circle',
        'scorm': 'bi-box',
        'text': 'bi-card-text',
        'external': 'bi-link-45deg',
        'practice': 'bi-tools'
    };
    return icons[contentType] || 'bi-file-earmark';
}

// ==================================================
// LOAD LESSON
// ==================================================

async function loadLesson(sectionId, lessonId) {
    if (!currentEnrollment) {
        notify.error('No active enrollment');
        return;
    }
    
    try {
        const lesson = await lmsData.getLesson(lessonId);
        if (!lesson) {
            notify.error('Lesson not found');
            return;
        }
        
        currentSection = sectionId;
        currentLesson = lessonId;
        
        // Update UI
        document.getElementById('lesson-title').textContent = lesson.title;
        document.getElementById('lesson-duration').textContent = lesson.estimated_duration_minutes || 0;
        document.getElementById('lesson-type').textContent = lesson.content_type || 'Text';
        document.getElementById('lesson-content').innerHTML = renderLessonContent(lesson);
        
        // Update last accessed
        const lastAccessed = lesson.last_accessed_at || new Date().toISOString();
        document.getElementById('lesson-last-accessed').textContent = 
            `Last accessed: ${formatDateTime(lastAccessed)}`;
        
        // Highlight active lesson in sidebar
        document.querySelectorAll('[id^="lesson-btn-"]').forEach(btn => {
            btn.classList.remove('active', 'bg-light');
        });
        const activeBtn = document.getElementById(`lesson-btn-${lessonId}`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-light');
        }
        
        // Show content, hide loader
        document.getElementById('lesson-content-loader').style.display = 'none';
        document.getElementById('lesson-content-wrapper').style.display = 'block';
        
        // Update progress in backend
        await lmsData.updateProgress({
            enrollment_id: currentEnrollment.id,
            lesson_id: lessonId,
            status: 'in_progress'
        });
        
    } catch (error) {
        console.error('Failed to load lesson:', error);
        notify.error('Failed to load lesson');
    }
}

function renderLessonContent(lesson) {
    switch (lesson.content_type) {
        case 'video':
            return renderVideoLesson(lesson);
        case 'document':
            return renderDocumentLesson(lesson);
        case 'quiz':
            return renderQuizLesson(lesson);
        case 'text':
            return renderTextLesson(lesson);
        case 'external':
            return renderExternalLesson(lesson);
        default:
            return renderTextLesson(lesson);
    }
}

function renderVideoLesson(lesson) {
    const videoUrl = lesson.content_url || '';
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    const isVimeo = videoUrl.includes('vimeo.com');
    
    if (isYouTube) {
        const videoId = extractYouTubeId(videoUrl);
        return `
            <div class="ratio ratio-16x9">
                <iframe src="https://www.youtube.com/embed/${videoId}" 
                    title="${escapeHTML(lesson.title)}"
                    allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>
            </div>
            ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
        `;
    }
    
    if (isVimeo) {
        const videoId = extractVimeoId(videoUrl);
        return `
            <div class="ratio ratio-16x9">
                <iframe src="https://player.vimeo.com/video/${videoId}" 
                    title="${escapeHTML(lesson.title)}"
                    allowfullscreen>
                </iframe>
            </div>
            ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
        `;
    }
    
    // Direct video URL
    return `
        <div class="ratio ratio-16x9">
            <video controls>
                <source src="${escapeHTML(videoUrl)}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
    `;
}

function renderDocumentLesson(lesson) {
    const docUrl = lesson.content_url || '';
    const isPDF = docUrl.endsWith('.pdf');
    
    if (isPDF) {
        return `
            <div class="ratio ratio-16x9">
                <iframe src="${escapeHTML(docUrl)}" title="${escapeHTML(lesson.title)}"></iframe>
            </div>
            <div class="mt-3">
                <a href="${escapeHTML(docUrl)}" target="_blank" class="btn btn-outline-primary">
                    <i class="bi bi-download me-1"></i> Download PDF
                </a>
            </div>
            ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
        `;
    }
    
    // Generic document
    return `
        <div class="text-center py-5">
            <i class="bi bi-file-earmark-text display-1 text-muted"></i>
            <p class="mt-3">${escapeHTML(lesson.title)}</p>
            <a href="${escapeHTML(docUrl)}" target="_blank" class="btn btn-primary">
                <i class="bi bi-download me-1"></i> Download Document
            </a>
        </div>
        ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
    `;
}

function renderTextLesson(lesson) {
    return `
        <div class="lesson-text-content">
            ${lesson.content_text || lesson.description || '<p class="text-muted">No content available</p>'}
        </div>
    `;
}

function renderQuizLesson(lesson) {
    return `
        <div class="text-center py-5">
            <i class="bi bi-question-circle display-1 text-muted"></i>
            <p class="mt-3">Quiz: ${escapeHTML(lesson.title)}</p>
            <button class="btn btn-primary" onclick="window.__app.startQuiz('${lesson.id}')">
                <i class="bi bi-play-circle me-1"></i> Start Quiz
            </button>
        </div>
        ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
    `;
}

function renderExternalLesson(lesson) {
    return `
        <div class="text-center py-5">
            <i class="bi bi-link-45deg display-1 text-muted"></i>
            <p class="mt-3">${escapeHTML(lesson.title)}</p>
            <a href="${escapeHTML(lesson.content_url)}" target="_blank" class="btn btn-primary">
                <i class="bi bi-box-arrow-up-right me-1"></i> Open External Link
            </a>
        </div>
        ${lesson.description ? `<div class="mt-3">${lesson.description}</div>` : ''}
    `;
}

function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
}

function extractVimeoId(url) {
    const regex = /vimeo\.com\/(\d+)/;
    const match = url.match(regex);
    return match ? match[1] : '';
}

// ==================================================
// LESSON NAVIGATION
// ==================================================

async function nextLesson() {
    if (!currentEnrollment || !currentSection || !currentLesson) {
        notify.error('No active lesson');
        return;
    }
    
    try {
        const course = await lmsData.getCourse(currentEnrollment.course_id);
        const sections = course.sections || [];
        
        // Find current section and lesson
        let currentSectionIndex = sections.findIndex(s => s.id === currentSection);
        let currentLessonIndex = -1;
        
        if (currentSectionIndex >= 0) {
            const section = sections[currentSectionIndex];
            const lessons = section.lessons || [];
            currentLessonIndex = lessons.findIndex(l => l.id === currentLesson);
            
            // Check if there's a next lesson in current section
            if (currentLessonIndex < lessons.length - 1) {
                const nextLesson = lessons[currentLessonIndex + 1];
                await loadLesson(currentSection, nextLesson.id);
                return;
            }
        }
        
        // Check if there's a next section
        if (currentSectionIndex < sections.length - 1) {
            const nextSection = sections[currentSectionIndex + 1];
            const nextLessons = nextSection.lessons || [];
            if (nextLessons.length > 0) {
                await loadLesson(nextSection.id, nextLessons[0].id);
                return;
            }
        }
        
        // No more lessons
        notify.info('This is the last lesson in the course');
        
    } catch (error) {
        console.error('Failed to navigate to next lesson:', error);
        notify.error('Failed to load next lesson');
    }
}

async function prevLesson() {
    if (!currentEnrollment || !currentSection || !currentLesson) {
        notify.error('No active lesson');
        return;
    }
    
    try {
        const course = await lmsData.getCourse(currentEnrollment.course_id);
        const sections = course.sections || [];
        
        // Find current section and lesson
        let currentSectionIndex = sections.findIndex(s => s.id === currentSection);
        let currentLessonIndex = -1;
        
        if (currentSectionIndex >= 0) {
            const section = sections[currentSectionIndex];
            const lessons = section.lessons || [];
            currentLessonIndex = lessons.findIndex(l => l.id === currentLesson);
            
            // Check if there's a previous lesson in current section
            if (currentLessonIndex > 0) {
                const prevLesson = lessons[currentLessonIndex - 1];
                await loadLesson(currentSection, prevLesson.id);
                return;
            }
        }
        
        // Check if there's a previous section
        if (currentSectionIndex > 0) {
            const prevSection = sections[currentSectionIndex - 1];
            const prevLessons = prevSection.lessons || [];
            if (prevLessons.length > 0) {
                const lastLesson = prevLessons[prevLessons.length - 1];
                await loadLesson(prevSection.id, lastLesson.id);
                return;
            }
        }
        
        // No previous lesson
        notify.info('This is the first lesson in the course');
        
    } catch (error) {
        console.error('Failed to navigate to previous lesson:', error);
        notify.error('Failed to load previous lesson');
    }
}

async function completeLesson() {
    if (!currentEnrollment || !currentLesson) {
        notify.error('No active lesson');
        return;
    }
    
    try {
        // Update progress
        await lmsData.completeLesson({
            enrollment_id: currentEnrollment.id,
            lesson_id: currentLesson
        });
        
        // Mark lesson as complete in UI
        const checkIcon = document.getElementById(`lesson-check-${currentLesson}`);
        if (checkIcon) {
            checkIcon.classList.remove('d-none');
        }
        
        notify.success('Lesson marked as complete!');
        
        // Update overall progress
        await updateProgressBadge();
        
        // Auto-navigate to next lesson
        setTimeout(() => {
            nextLesson();
        }, 500);
        
    } catch (error) {
        console.error('Failed to complete lesson:', error);
        notify.error('Failed to mark lesson as complete');
    }
}

async function updateProgressBadge() {
    if (!currentEnrollment) return;
    
    try {
        const progress = await lmsData.getProgressData(currentEnrollment.id);
        const percent = Math.round(progress.progress_percent || 0);
        
        const badge = document.getElementById('lesson-progress-badge');
        if (badge) {
            badge.textContent = `${percent}%`;
            
            // Update color based on progress
            if (percent === 100) {
                badge.classList.remove('bg-light', 'bg-warning');
                badge.classList.add('bg-success');
            } else if (percent > 0) {
                badge.classList.remove('bg-light', 'bg-success');
                badge.classList.add('bg-warning');
            }
        }
        
        // Update section progress
        // TODO: Implement section-level progress
        
    } catch (error) {
        console.error('Failed to update progress badge:', error);
    }
}

// ==================================================
// HELPER FUNCTIONS
// ==================================================

function findStartSection(sections, progress) {
    // Find first section with incomplete lessons
    for (const section of sections) {
        if (!section.lessons || section.lessons.length === 0) continue;
        
        for (const lesson of section.lessons) {
            const lessonProgress = progress?.lessons?.find(l => l.lesson_id === lesson.id);
            if (!lessonProgress || lessonProgress.status !== 'completed') {
                return section;
            }
        }
    }
    
    // All sections complete, return first section
    return sections[0];
}

function findStartLesson(section, progress) {
    if (!section.lessons || section.lessons.length === 0) {
        return null;
    }
    
    // Find first incomplete lesson
    for (const lesson of section.lessons) {
        const lessonProgress = progress?.lessons?.find(l => l.lesson_id === lesson.id);
        if (!lessonProgress || lessonProgress.status !== 'completed') {
            return lesson;
        }
    }
    
    // All lessons complete, return first lesson
    return section.lessons[0];
}

// ==================================================
// QUIZ HANDLER (PLACEHOLDER)
// ==================================================

async function startQuiz(lessonId) {
    notify.info('Quiz functionality coming in Sprint 3');
    // TODO: Implement quiz modal in Sprint 3
}

// ==================================================
// EXPORTS
// ==================================================

export {
    openLessonViewer,
    loadLesson,
    nextLesson,
    prevLesson,
    completeLesson,
    startQuiz
};

// Window exports for onclick handlers
window.__app.openLessonViewer = openLessonViewer;
window.__app.loadLesson = loadLesson;
window.__app.nextLesson = nextLesson;
window.__app.prevLesson = prevLesson;
window.__app.completeLesson = completeLesson;
window.__app.startQuiz = startQuiz;