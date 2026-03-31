// ==================================================
// LMS PROGRESS WIDGETS - Visual Progress Components
// ==================================================

import { state } from '../../lib/store.js';
import { escapeHTML } from '../../lib/utils.js';

// ==================================================
// CIRCULAR PROGRESS INDICATOR
// ==================================================

function renderCircularProgress(percent, size = 120, strokeWidth = 8) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;
    
    const color = getColorByPercent(percent);
    
    return `
        <svg class="progress-circular" width="${size}" height="${size}">
            <circle
                class="progress-circular-bg"
                stroke="#e9ecef"
                stroke-width="${strokeWidth}"
                fill="transparent"
                r="${radius}"
                cx="${size / 2}"
                cy="${size / 2}"
            />
            <circle
                class="progress-circular-progress"
                stroke="${color}"
                stroke-width="${strokeWidth}"
                stroke-linecap="round"
                fill="transparent"
                r="${radius}"
                cx="${size / 2}"
                cy="${size / 2}"
                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; transition: stroke-dashoffset 0.35s;"
            />
            <text
                x="${size / 2}"
                y="${size / 2}"
                class="progress-circular-text"
                text-anchor="middle"
                dominant-baseline="middle"
                style="font-size: ${size / 5}px; font-weight: bold; fill: ${color};"
            >
                ${Math.round(percent)}%
            </text>
        </svg>
    `;
}

function getColorByPercent(percent) {
    if (percent >= 100) return '#198754'; // success
    if (percent >= 70) return '#ffc107'; // warning
    if (percent >= 50) return '#fd7e14'; // orange
    if (percent >= 25) return '#0d6efd'; // primary
    return '#6c757d'; // secondary
}

// ==================================================
// LINEAR PROGRESS BAR
// ==================================================

function renderLinearProgress(percent, showLabel = true, animated = true) {
    const colorClass = getColorClassByPercent(percent);
    const animatedClass = animated ? 'progress-bar-animated progress-bar-striped' : '';
    
    return `
        <div class="progress" style="height: ${showLabel ? '20px' : '6px'};">
            <div 
                class="progress-bar ${colorClass} ${animatedClass}" 
                role="progressbar" 
                style="width: ${percent}%;" 
                aria-valuenow="${Math.round(percent)}" 
                aria-valuemin="0" 
                aria-valuemax="100"
            >
                ${showLabel ? `${Math.round(percent)}%` : ''}
            </div>
        </div>
    `;
}

function getColorClassByPercent(percent) {
    if (percent >= 100) return 'bg-success';
    if (percent >= 75) return 'bg-info';
    if (percent >= 50) return 'bg-warning';
    if (percent >= 25) return 'bg-primary';
    return 'bg-secondary';
}

// ==================================================
// COURSE PROGRESS CARD
// ==================================================

function renderCourseProgressCard(enrollment, course) {
    const percent = enrollment.progress_percent || 0;
    const statusBadge = getStatusBadge(enrollment.status);
    const timeRemaining = calculateTimeRemaining(course, enrollment);
    
    return `
        <div class="card course-progress-card mb-3 border-0 shadow-sm">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-auto">
                        ${renderCircularProgress(percent, 80, 6)}
                    </div>
                    <div class="col">
                        <h6 class="mb-1">${escapeHTML(course.title)}</h6>
                        <p class="text-muted small mb-2">${escapeHTML(course.category || 'General')}</p>
                        <div class="d-flex align-items-center gap-2 mb-2">
                            ${statusBadge}
                            <span class="text-muted small">
                                <i class="bi bi-clock me-1"></i>${timeRemaining}
                            </span>
                        </div>
                        ${renderLinearProgress(percent, false)}
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-primary btn-sm" onclick="window.__app.continueCourse('${enrollment.id}')">
                            <i class="bi bi-play-circle me-1"></i>Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getStatusBadge(status) {
    const badges = {
        'enrolled': '<span class="badge bg-secondary">Enrolled</span>',
        'in_progress': '<span class="badge bg-primary">In Progress</span>',
        'completed': '<span class="badge bg-success">Completed</span>',
        'failed': '<span class="badge bg-danger">Failed</span>',
        'cancelled': '<span class="badge bg-dark">Cancelled</span>'
    };
    return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
}

function calculateTimeRemaining(course, enrollment) {
    const totalMinutes = course.estimated_duration_minutes || 0;
    const timeSpent = enrollment.time_spent_seconds ? enrollment.time_spent_seconds / 60 : 0;
    const remaining = Math.max(0, totalMinutes - timeSpent);
    
    if (remaining < 60) {
        return `${Math.round(remaining)} min left`;
    } else {
        const hours = Math.floor(remaining / 60);
        const mins = Math.round(remaining % 60);
        return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
    }
}

// ==================================================
// SECTION PROGRESS INDICATOR
// ==================================================

function renderSectionProgress(section, lessons, progressData) {
    const totalLessons = lessons?.length || 0;
    let completedLessons = 0;
    
    if (progressData && progressData.lessons) {
        completedLessons = progressData.lessons.filter(
            l => l.status === 'completed'
        ).length;
    }
    
    const percent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    const allComplete = completedLessons === totalLessons && totalLessons > 0;
    
    return `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="flex-grow-1 mr-2">
                <small class="d-block text-truncate">${escapeHTML(section.title)}</small>
                ${renderLinearProgress(percent, false, false)}
            </div>
            <span class="badge ${allComplete ? 'bg-success' : 'bg-light text-dark'}">
                ${completedLessons}/${totalLessons}
            </span>
        </div>
    `;
}

// ==================================================
// STREAK & ACHIEVEMENT BADGES
// ==================================================

function renderStreakBadge(streakDays) {
    if (streakDays === 0) return '';
    
    const icon = streakDays >= 7 ? '🏆' : streakDays >= 3 ? '🔥' : '⭐';
    
    return `
        <div class="streak-badge badge bg-warning text-dark">
            ${icon} ${streakDays} day streak
        </div>
    `;
}

function renderAchievementBadge(achievement) {
    const icons = {
        'first_course': '🎓',
        'five_courses': '📚',
        'ten_courses': '🏅',
        'perfect_score': '💯',
        'fast_learner': '⚡',
        'dedicated': '💪',
        'champion': '🏆'
    };
    
    return `
        <div class="achievement-badge text-center">
            <div class="badge-icon fs-1">${icons[achievement.type] || '🎖️'}</div>
            <div class="badge-title small font-weight-bold">${escapeHTML(achievement.title)}</div>
            <div class="badge-description text-muted small">${escapeHTML(achievement.description)}</div>
        </div>
    `;
}

// ==================================================
// COURSE STAT CARDS
// ==================================================

function renderCourseStatCard(title, value, icon, color = 'primary') {
    return `
        <div class="card border-0 shadow-sm">
            <div class="card-body text-center">
                <div class="text-${color} mb-2">
                    <i class="${icon} fs-1"></i>
                </div>
                <div class="fs-3 fw-bold">${value}</div>
                <div class="text-muted small">${title}</div>
            </div>
        </div>
    `;
}

function renderCourseStats(stats) {
    return `
        <div class="row g-3 mb-4">
            <div class="col-6">
                ${renderCourseStatCard('Enrolled Courses', stats.enrolled || 0, 'bi bi-book', 'primary')}
            </div>
            <div class="col-6">
                ${renderCourseStatCard('Completed', stats.completed || 0, 'bi bi-check-circle', 'success')}
            </div>
            <div class="col-6">
                ${renderCourseStatCard('In Progress', stats.inProgress || 0, 'bi bi-clock', 'warning')}
            </div>
            <div class="col-6">
                ${renderCourseStatCard('Certificates', stats.certificates || 0, 'bi bi-award', 'info')}
            </div>
        </div>
    `;
}

// ==================================================
// EXPORTS
// ==================================================

export {
    renderCircularProgress,
    renderLinearProgress,
    renderCourseProgressCard,
    renderSectionProgress,
    renderStreakBadge,
    renderAchievementBadge,
    renderCourseStats,
    getColorByPercent,
    getColorClassByPercent
};