import { state, emit } from '../lib/store.js';
import { isFeatureEnabled } from '../lib/features.js';
import { escapeHTML, formatDate } from '../lib/utils.js';
import * as notify from '../lib/notify.js';
import * as tnaData from './data/tna.js';

let currentView = 'gaps';
let gapsCache = [];

function initTna() {
    if (!isFeatureEnabled('TNA')) {
        console.warn('TNA module is not enabled');
        return;
    }
    setupEventListeners();
    loadEmployeeSelector();
    loadTnaSummary();
}

function setupEventListeners() {
    document.addEventListener('click', async (e) => {
        const navLink = e.target.closest('[data-tna-view]');
        if (navLink) {
            e.preventDefault();
            switchView(navLink.dataset.tnaView);
            return;
        }

        if (e.target.closest('#tna-btn-run-analysis')) {
            await runGapAnalysis();
            return;
        }

        if (e.target.closest('#tna-btn-new-plan')) {
            showNewPlanModal();
            return;
        }

        if (e.target.closest('#tna-btn-export-report')) {
            exportReport();
            return;
        }

        if (e.target.closest('#tna-btn-create-all-needs')) {
            await createAllNeedsFromGaps();
            return;
        }

        if (e.target.closest('#tna-btn-create-course')) {
            await showCreateCourseModal();
            return;
        }

        if (e.target.closest('#tna-btn-new-enrollment')) {
            await showNewEnrollmentModal();
            return;
        }
    });

    document.getElementById('tna-employee-select')?.addEventListener('change', async (e) => {
        const employeeId = e.target.value;
        if (currentView === 'gaps') {
            await loadGapsForEmployee(employeeId);
        } else if (currentView === 'plans') {
            await loadPlans(employeeId);
        } else if (currentView === 'enrollments') {
            await loadEnrollmentsWithFilter();
        }
    });

    document.getElementById('tna-report-department')?.addEventListener('change', async (e) => {
        await loadGapsReport(e.target.value);
    });

    document.getElementById('tna-enrollment-filter')?.addEventListener('change', async () => {
        await loadEnrollmentsWithFilter();
    });

    document.getElementById('tna-course-filter')?.addEventListener('change', async () => {
        await loadCourses();
    });

    document.getElementById('tna-course-search')?.addEventListener('input', async () => {
        await loadCourses();
    });
}

function switchView(viewName) {
    currentView = viewName;

    document.querySelectorAll('[data-tna-view]').forEach(link => {
        link.classList.toggle('active', link.dataset.tnaView === viewName);
    });

    document.querySelectorAll('.tna-view').forEach(view => {
        view.classList.add('d-none');
    });

    const targetView = document.getElementById(`tna-view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('d-none');
    }

    switch (viewName) {
        case 'gaps':
            loadGaps();
            break;
        case 'plans':
            loadPlans();
            break;
        case 'courses':
            loadCourses();
            break;
        case 'enrollments':
            loadEnrollments();
            break;
        case 'report':
            loadDepartments();
            loadGapsReport();
            break;
    }
}

async function loadEmployeeSelector() {
    const select = document.getElementById('tna-employee-select');
    if (!select) return;

    const db = state.db || {};
    const sortedIds = Object.keys(db).sort((a, b) => (db[a]?.name || '').localeCompare(db[b]?.name || ''));

    select.innerHTML = '<option value="">-- All Employees --</option>';
    sortedIds.forEach(id => {
        const emp = db[id];
        if (!emp) return;
        select.innerHTML += `<option value="${escapeHTML(id)}">${escapeHTML(emp.name)}</option>`;
    });
}

async function loadTnaSummary() {
    try {
        const summary = await tnaData.fetchTnaSummary();
        
        document.getElementById('tna-critical-gaps').textContent = summary.critical_gaps || 0;
        document.getElementById('tna-high-gaps').textContent = summary.high_gaps || 0;
        document.getElementById('tna-active-plans').textContent = summary.active_plans || 0;
        document.getElementById('tna-completed').textContent = summary.needs_completed || 0;
    } catch (error) {
        console.error('Failed to load TNA summary:', error);
    }
}

async function runGapAnalysis() {
    const select = document.getElementById('tna-employee-select');
    const employeeId = select?.value || '';
    await loadGapsForEmployee(employeeId);
}

async function loadGapsForEmployee(employeeId) {
    const tbody = document.getElementById('tna-gaps-table-body');
    if (!tbody) return;

    if (!employeeId) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted py-4">
                    <i class="bi bi-arrow-left me-2"></i>Select an employee to run gap analysis
                </td>
            </tr>`;
        return;
    }

    try {
        await notify.withLoading(async () => {
            const employee = state.db[employeeId];
            if (!employee) return;

            const result = await tnaData.calculateGaps(employeeId);
            if (!result || !result.gaps || result.gaps.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center text-success py-4">
                            <i class="bi bi-check-circle me-2"></i>No competency gaps found for ${escapeHTML(employee.name)}
                        </td>
                    </tr>`;
                updateGapsSummary(result?.gaps || []);
                return;
            }

            gapsCache = result.gaps;
            renderGapsTable(result.gaps);
            updateGapsSummary(result.gaps);
        }, 'Analyzing Gaps', `Analyzing competency gaps for ${state.db[employeeId]?.name || 'employee'}...`);
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
}

function loadGaps() {
    const employeeId = document.getElementById('tna-employee-select')?.value || '';
    if (employeeId) {
        loadGapsForEmployee(employeeId);
    }
}

function renderGapsTable(gaps) {
    const tbody = document.getElementById('tna-gaps-table-body');
    if (!tbody || !gaps.length) return;

    const employeeId = document.getElementById('tna-employee-select')?.value || '';
    const employee = state.db[employeeId];

    tbody.innerHTML = gaps.map((gap, idx) => {
        const priorityClass = getPriorityClass(gap.priority);
        const priorityBadge = `<span class="badge ${priorityClass}">${escapeHTML(gap.priority)}</span>`;
        const belowThreshold = gap.score_below_threshold ? '<span class="badge bg-warning text-dark ms-1">Below Threshold</span>' : '';
        const hasConfig = gap.has_training_need_config ? '<span class="badge bg-success ms-1">Configured</span>' : '';

        return `
            <tr data-gap-idx="${idx}">
                <td>${escapeHTML(employee?.name || '-')}</td>
                <td>${escapeHTML(employee?.position || '-')}</td>
                <td>
                    <strong>${escapeHTML(gap.competency_name)}</strong>
                    ${belowThreshold}
                    ${hasConfig}
                </td>
                <td class="text-center">${gap.current_score}/10</td>
                <td class="text-center">${gap.required_level}/5</td>
                <td class="text-center"><span class="badge bg-danger">${gap.gap}</span></td>
                <td class="text-center">${priorityBadge}</td>
                <td>${escapeHTML(gap.recommended_training || '-')}</td>
                <td class="text-center"><span class="badge bg-secondary">Identified</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="window.__app.createTrainingNeedFromGap('${escapeHTML(employeeId)}', ${idx})">
                        <i class="bi bi-plus"></i> Create Need
                    </button>
                </td>
            </tr>`;
    }).join('');
}

function updateGapsSummary(gaps) {
    const total = gaps.length;
    const critical = gaps.filter(g => g.priority === 'critical').length;
    const high = gaps.filter(g => g.priority === 'high').length;
    const mediumLow = total - critical - high;

    document.getElementById('tna-total-gaps').textContent = total;
    document.getElementById('tna-critical-count').textContent = critical;
    document.getElementById('tna-high-count').textContent = high;
    document.getElementById('tna-medium-low-count').textContent = mediumLow;
}

function getPriorityClass(priority) {
    switch (priority?.toLowerCase()) {
        case 'critical': return 'bg-danger';
        case 'high': return 'bg-warning text-dark';
        case 'medium': return 'bg-info';
        case 'low': return 'bg-secondary';
        default: return 'bg-secondary';
    }
}

async function loadPlans(employeeId = '') {
    const tbody = document.getElementById('tna-plans-table-body');
    if (!tbody) return;

    try {
        const plans = await tnaData.fetchTrainingPlans(employeeId);
        if (!plans.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>No training plans yet
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = plans.map(plan => {
            const statusBadge = getStatusBadge(plan.status);
            return `
                <tr>
                    <td>${escapeHTML(state.db[plan.employee_id]?.name || plan.employee_id)}</td>
                    <td><strong>${escapeHTML(plan.plan_name)}</strong></td>
                    <td>${escapeHTML(plan.period)}</td>
                    <td class="text-end">${formatCurrency(plan.total_cost)}</td>
                    <td class="text-center">-</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="window.__app.viewPlanDetails('${plan.id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
}

async function loadCourses() {
    const container = document.getElementById('tna-courses-container');
    if (!container) return;

    try {
        const filter = document.getElementById('tna-course-filter')?.value || '';
        const search = (document.getElementById('tna-course-search')?.value || '').toLowerCase();
        
        let courses = await tnaData.fetchTrainingCourses(filter !== 'inactive');
        
        if (search) {
            courses = courses.filter(c => 
                c.course_name?.toLowerCase().includes(search) ||
                c.description?.toLowerCase().includes(search) ||
                c.provider?.toLowerCase().includes(search)
            );
        }
        
        if (filter === 'inactive') {
            courses = courses.filter(c => !c.is_active);
        }

        if (!courses.length) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-book me-2"></i>No courses found
                </div>`;
            return;
        }

        container.innerHTML = courses.map(course => {
            const isActive = course.is_active !== 0 && course.is_active !== false;
            return `
            <div class="col-md-4 col-lg-3 mb-3">
                <div class="card h-100 shadow-sm ${!isActive ? 'opacity-50' : ''}">
                    <div class="card-header bg-transparent py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">${isActive ? 'Active' : 'Inactive'}</span>
                            <button class="btn btn-sm btn-link text-primary p-0" onclick="window.__app.editCourse('${course.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <h6 class="card-title">${escapeHTML(course.course_name)}</h6>
                        <p class="card-text small text-muted">${escapeHTML(course.description || 'No description')}</p>
                        <div class="d-flex justify-content-between align-items-center small">
                            <span class="text-muted">${escapeHTML(course.provider || 'Internal')}</span>
                            <span class="badge bg-info">${course.duration_hours || 0}h</span>
                        </div>
                        ${course.cost > 0 ? `<div class="mt-2 text-primary fw-bold">${formatCurrency(course.cost)}</div>` : ''}
                    </div>
                    <div class="card-footer bg-transparent">
                        <button class="btn btn-sm btn-outline-primary w-100" onclick="window.__app.enrollInCourse('${course.id}', '${escapeInlineArg(course.course_name)}')">
                            <i class="bi bi-person-plus me-1"></i>Enroll
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = `
            <div class="col-12 text-center text-danger py-5">
                <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
            </div>`;
    }
}

async function loadEnrollmentsWithFilter() {
    const employeeId = document.getElementById('tna-employee-select')?.value || '';
    const statusFilter = document.getElementById('tna-enrollment-filter')?.value || '';
    
    const tbody = document.getElementById('tna-enrollments-table-body');
    if (!tbody) return;

    try {
        const enrollments = await tnaData.fetchEnrollmentsWithDetails(employeeId);
        
        const filtered = statusFilter 
            ? enrollments.filter(e => e.status === statusFilter)
            : enrollments;

        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>No enrollments found
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(enrollment => {
            const statusBadge = getStatusBadge(enrollment.status);
            return `
                <tr>
                    <td>${escapeHTML(enrollment.employee_name || enrollment.employee_id)}</td>
                    <td>${escapeHTML(enrollment.course_name || enrollment.course_id)}</td>
                    <td>${escapeHTML(enrollment.provider || '-')}</td>
                    <td>${enrollment.duration_hours || 0}h</td>
                    <td>${formatDate(enrollment.enrollment_date)}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td>${enrollment.completion_date ? formatDate(enrollment.completion_date) : '-'}</td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item" href="#" onclick="window.__app.updateEnrollmentStatus('${enrollment.id}', 'enrolled')">Mark Enrolled</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.__app.updateEnrollmentStatus('${enrollment.id}', 'in_progress')">Mark In Progress</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.__app.updateEnrollmentStatus('${enrollment.id}', 'completed')">Mark Completed</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="window.__app.updateEnrollmentStatus('${enrollment.id}', 'cancelled')">Cancel</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
}

async function loadEnrollments(employeeId = '') {
    await loadEnrollmentsWithFilter();
}

function loadDepartments() {
    const select = document.getElementById('tna-report-department');
    if (!select) return;

    const departments = new Set();
    Object.values(state.db || {}).forEach(emp => {
        if (emp.department) departments.add(emp.department);
    });

    const currentValue = select.value;
    select.innerHTML = '<option value="">All Departments</option>';
    [...departments].sort().forEach(dept => {
        select.innerHTML += `<option value="${escapeHTML(dept)}">${escapeHTML(dept)}</option>`;
    });
    select.value = currentValue;
}

async function loadGapsReport(department = '') {
    const tbody = document.getElementById('tna-report-table-body');
    if (!tbody) return;

    try {
        const gaps = await tnaData.fetchGapsReport(department);
        if (!gaps.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        <i class="bi bi-check-circle me-2"></i>No open gaps found
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = gaps.map(gap => {
            const priorityClass = getPriorityClass(gap.priority);
            const priorityBadge = `<span class="badge ${priorityClass}">${escapeHTML(gap.priority)}</span>`;
            const statusBadge = getStatusBadge(gap.status);

            return `
                <tr>
                    <td>${escapeHTML(gap.employee_name || gap.employee_id)}</td>
                    <td>${escapeHTML(gap.position || '-')}</td>
                    <td>${escapeHTML(gap.department || '-')}</td>
                    <td><strong>${escapeHTML(gap.competency_name)}</strong></td>
                    <td class="text-center">${gap.required_level}</td>
                    <td class="text-center">${gap.current_level}</td>
                    <td class="text-center"><span class="badge bg-danger">${gap.gap_level}</span></td>
                    <td class="text-center">${priorityBadge}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
}

function getStatusBadge(status) {
    const classes = {
        draft: 'bg-secondary',
        identified: 'bg-secondary',
        planned: 'bg-info',
        approved: 'bg-primary',
        in_progress: 'bg-warning text-dark',
        completed: 'bg-success',
        cancelled: 'bg-danger',
        enrolled: 'bg-info',
    };
    const cls = classes[status?.toLowerCase()] || 'bg-secondary';
    return `<span class="badge ${cls}">${escapeHTML(status || '-')}</span>`;
}

function formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

async function showNewPlanModal() {
    const employeeId = document.getElementById('tna-employee-select')?.value;
    if (!employeeId) {
        await notify.warn('Please select an employee first');
        return;
    }

    const employee = state.db[employeeId];
    const period = await notify.input({
        title: 'New Training Plan',
        input: 'text',
        inputLabel: 'Period (YYYY-MM)',
        inputValue: new Date().toISOString().slice(0, 7),
        confirmButtonText: 'Create',
    });

    if (!period) return;

    const planName = await notify.input({
        title: 'Plan Name',
        input: 'text',
        inputLabel: 'Training Plan Name',
        inputPlaceholder: 'e.g., Q2 2026 Training Plan',
        confirmButtonText: 'Create',
    });

    if (!planName) return;

    try {
        await notify.withLoading(async () => {
            await tnaData.createTrainingPlan({
                employee_id: employeeId,
                plan_name: planName,
                period: period,
            });
        }, 'Creating Plan', 'Creating training plan...');

        await notify.success('Training plan created');
        await loadPlans(employeeId);
        await loadTnaSummary();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

async function createTrainingNeedFromGap(employeeId, gapIndex) {
    try {
        const gap = gapsCache[gapIndex];
        if (!gap) {
            await notify.error('Gap data not found. Please re-run the analysis.');
            return;
        }

        const position = state.db[employeeId]?.position || '';
        const needs = await tnaData.fetchTrainingNeedsConfig(position);
        let need = needs.find(n => n.competency_name === gap.competency_name);

        if (!need) {
            const importResult = await tnaData.importCompetenciesFromConfig(position, 3);
            if (importResult?.competencies_imported > 0) {
                const updatedNeeds = await tnaData.fetchTrainingNeedsConfig(position);
                need = updatedNeeds.find(n => n.competency_name === gap.competency_name);
            }
        }

        if (!need) {
            await notify.error('Training need not configured for this competency. Please add it in Settings.');
            return;
        }

        await notify.withLoading(async () => {
            await tnaData.createTrainingNeed({
                employee_id: employeeId,
                training_need_id: need.id,
                current_level: gap.current_score || 0,
                priority: gap.priority || 'medium',
                notes: `Gap analysis: ${gap.gap} points below required level`,
            });
        }, 'Creating Training Need', 'Creating training need record...');

        await notify.success(`Training need created for ${gap.competency_name}`);
        await loadTnaSummary();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

async function createAllNeedsFromGaps() {
    const employeeId = document.getElementById('tna-employee-select')?.value;
    if (!employeeId) {
        await notify.warn('Please select an employee first');
        return;
    }

    if (!gapsCache || gapsCache.length === 0) {
        await notify.warn('No gaps to create. Run gap analysis first.');
        return;
    }

    const position = state.db[employeeId]?.position || '';

    await notify.withLoading(async () => {
        let needs = await tnaData.fetchTrainingNeedsConfig(position);

        const needsWithoutConfig = gapsCache.filter(gap => {
            return !needs.find(n => n.competency_name === gap.competency_name);
        });

        if (needsWithoutConfig.length > 0) {
            await tnaData.importCompetenciesFromConfig(position, 3);
            needs = await tnaData.fetchTrainingNeedsConfig(position);
        }

        const gapsWithNeeds = gapsCache.map(gap => {
            const need = needs.find(n => n.competency_name === gap.competency_name);
            return {
                ...gap,
                training_need_id: need?.id,
            };
        }).filter(gap => gap.training_need_id);

        if (gapsWithNeeds.length === 0) {
            throw new Error('No training needs configured for these gaps');
        }

        await tnaData.bulkCreateNeedRecords(employeeId, gapsWithNeeds);
    }, 'Creating Training Needs', `Creating ${gapsCache.length} training need records...`);

    await notify.success(`${gapsCache.length} training needs created for ${state.db[employeeId]?.name}`);
    gapsCache = [];
    await loadTnaSummary();
    await loadGapsForEmployee(employeeId);
}

async function viewPlanDetails(planId) {
    try {
        const plan = await tnaData.fetchTrainingPlan(planId);
        if (!plan) {
            await notify.error('Plan not found');
            return;
        }

        let itemsHtml = '';
        if (plan.items && plan.items.length) {
            itemsHtml = plan.items.map(item => `
                <tr>
                    <td>${escapeHTML(item.training_course)}</td>
                    <td>${escapeHTML(item.training_provider || '-')}</td>
                    <td>${item.start_date || '-'}</td>
                    <td>${item.end_date || '-'}</td>
                    <td class="text-end">${formatCurrency(item.cost)}</td>
                    <td>${getStatusBadge(item.status)}</td>
                </tr>
            `).join('');
        } else {
            itemsHtml = '<tr><td colspan="6" class="text-center text-muted">No items yet</td></tr>';
        }

        await notify.confirm('', {
            title: `Training Plan: ${escapeHTML(plan.plan_name)}`,
            html: `
                <div class="text-start">
                    <p><strong>Employee:</strong> ${escapeHTML(state.db[plan.employee_id]?.name || plan.employee_id)}</p>
                    <p><strong>Period:</strong> ${escapeHTML(plan.period)}</p>
                    <p><strong>Status:</strong> ${getStatusBadge(plan.status)}</p>
                    <p><strong>Est. Cost:</strong> ${formatCurrency(plan.total_cost)}</p>
                    <hr>
                    <p class="mb-2"><strong>Training Items:</strong></p>
                    <table class="table table-sm">
                        <thead><tr><th>Course</th><th>Provider</th><th>Start</th><th>End</th><th>Cost</th><th>Status</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>
            `,
            confirmButtonText: 'Close',
            showCancelButton: false,
        });
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

function exportReport() {
    const tbody = document.getElementById('tna-report-table-body');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    if (rows.length <= 1) {
        notify.warn('No data to export');
        return;
    }

    let csv = 'Employee,Position,Department,Competency,Required,Current,Gap,Priority,Status\n';
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 9) {
            csv += [...cells].map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`).join(',') + '\n';
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tna-gaps-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

async function showCreateCourseModal() {
    const result = await notify.prompt({
        title: 'Create New Course',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Course Name *</label>
                    <input type="text" class="form-control" id="course-name-input" placeholder="e.g., Advanced Sales Techniques">
                </div>
                <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" id="course-desc-input" rows="2" placeholder="Course description..."></textarea>
                </div>
                <div class="row mb-3">
                    <div class="col-6">
                        <label class="form-label">Provider</label>
                        <input type="text" class="form-control" id="course-provider-input" placeholder="e.g., Internal, Udemy">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Duration (hours)</label>
                        <input type="number" class="form-control" id="course-duration-input" value="8" min="1">
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Cost (IDR)</label>
                    <input type="number" class="form-control" id="course-cost-input" value="0" min="0">
                </div>
            </div>
        `,
        confirmButtonText: 'Create Course',
        showCancelButton: true,
        preConfirm: () => {
            const name = document.getElementById('course-name-input')?.value?.trim();
            if (!name) {
                notify.showValidationMessage('Course name is required');
                return false;
            }
            return {
                course_name: name,
                description: document.getElementById('course-desc-input')?.value?.trim() || '',
                provider: document.getElementById('course-provider-input')?.value?.trim() || '',
                duration_hours: parseInt(document.getElementById('course-duration-input')?.value || '8', 10),
                cost: parseFloat(document.getElementById('course-cost-input')?.value || '0'),
            };
        },
    });

    if (!result) return;

    try {
        await notify.withLoading(async () => {
            await tnaData.createCourse(result);
        }, 'Creating Course', 'Creating new course...');
        await notify.success('Course created successfully');
        await loadCourses();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

async function showNewEnrollmentModal() {
    const db = state.db || {};
    const employeeOptions = Object.keys(db)
        .sort((a, b) => (db[a]?.name || '').localeCompare(db[b]?.name || ''))
        .map(id => `<option value="${escapeHTML(id)}">${escapeHTML(db[id]?.name || id)}</option>`)
        .join('');

    const courses = await tnaData.fetchTrainingCourses();
    const courseOptions = courses
        .map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.course_name)} (${c.duration_hours}h)</option>`)
        .join('');

    if (!courseOptions) {
        await notify.warn('No courses available. Create a course first.');
        return;
    }

    const result = await notify.prompt({
        title: 'New Enrollment',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Employee *</label>
                    <select class="form-select" id="enroll-employee-input">
                        <option value="">-- Select Employee --</option>
                        ${employeeOptions}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Course *</label>
                    <select class="form-select" id="enroll-course-input">
                        <option value="">-- Select Course --</option>
                        ${courseOptions}
                    </select>
                </div>
            </div>
        `,
        confirmButtonText: 'Enroll',
        showCancelButton: true,
        preConfirm: () => {
            const employeeId = document.getElementById('enroll-employee-input')?.value?.trim();
            const courseId = document.getElementById('enroll-course-input')?.value?.trim();
            if (!employeeId || !courseId) {
                notify.showValidationMessage('Please select both employee and course');
                return false;
            }
            return { employee_id: employeeId, course_id: courseId };
        },
    });

    if (!result) return;

    try {
        await notify.withLoading(async () => {
            await tnaData.enrollEmployee(result.employee_id, result.courseId);
        }, 'Creating Enrollment', 'Enrolling employee...');
        await notify.success('Enrollment created successfully');
        await loadEnrollmentsWithFilter();
        await loadTnaSummary();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

async function enrollInCourse(courseId, courseName) {
    const db = state.db || {};
    const employeeOptions = Object.keys(db)
        .sort((a, b) => (db[a]?.name || '').localeCompare(db[b]?.name || ''))
        .map(id => `<option value="${escapeHTML(id)}">${escapeHTML(db[id]?.name || id)}</option>`)
        .join('');

    const result = await notify.prompt({
        title: `Enroll in ${courseName}`,
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Select Employee *</label>
                    <select class="form-select" id="enroll-employee-input">
                        <option value="">-- Select Employee --</option>
                        ${employeeOptions}
                    </select>
                </div>
            </div>
        `,
        confirmButtonText: 'Enroll',
        showCancelButton: true,
        preConfirm: () => {
            const employeeId = document.getElementById('enroll-employee-input')?.value?.trim();
            if (!employeeId) {
                notify.showValidationMessage('Please select an employee');
                return false;
            }
            return { employee_id: employeeId };
        },
    });

    if (!result) return;

    try {
        await notify.withLoading(async () => {
            await tnaData.enrollEmployee(result.employee_id, courseId);
        }, 'Enrolling', `Enrolling employee in ${courseName}...`);
        await notify.success('Enrollment created successfully');
        await loadTnaSummary();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

async function editCourse(courseId) {
    const courses = await tnaData.fetchTrainingCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) {
        await notify.error('Course not found');
        return;
    }

    const result = await notify.prompt({
        title: 'Edit Course',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Course Name *</label>
                    <input type="text" class="form-control" id="course-name-input" value="${escapeHTML(course.course_name || '')}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" id="course-desc-input" rows="2">${escapeHTML(course.description || '')}</textarea>
                </div>
                <div class="row mb-3">
                    <div class="col-6">
                        <label class="form-label">Provider</label>
                        <input type="text" class="form-control" id="course-provider-input" value="${escapeHTML(course.provider || '')}">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Duration (hours)</label>
                        <input type="number" class="form-control" id="course-duration-input" value="${course.duration_hours || 8}" min="1">
                    </div>
                </div>
                <div class="row mb-3">
                    <div class="col-6">
                        <label class="form-label">Cost (IDR)</label>
                        <input type="number" class="form-control" id="course-cost-input" value="${course.cost || 0}" min="0">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Status</label>
                        <select class="form-select" id="course-active-input">
                            <option value="1" ${course.is_active ? 'selected' : ''}>Active</option>
                            <option value="0" ${!course.is_active ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        confirmButtonText: 'Update Course',
        showCancelButton: true,
        preConfirm: () => {
            const name = document.getElementById('course-name-input')?.value?.trim();
            if (!name) {
                notify.showValidationMessage('Course name is required');
                return false;
            }
            return {
                id: courseId,
                course_name: name,
                description: document.getElementById('course-desc-input')?.value?.trim() || '',
                provider: document.getElementById('course-provider-input')?.value?.trim() || '',
                duration_hours: parseInt(document.getElementById('course-duration-input')?.value || '8', 10),
                cost: parseFloat(document.getElementById('course-cost-input')?.value || '0'),
                is_active: document.getElementById('course-active-input')?.value === '1',
            };
        },
    });

    if (!result) return;

    try {
        await notify.withLoading(async () => {
            await tnaData.updateCourse(result);
        }, 'Updating Course', 'Updating course...');
        await notify.success('Course updated successfully');
        await loadCourses();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

async function updateEnrollmentStatus(enrollmentId, status) {
    try {
        await notify.withLoading(async () => {
            await tnaData.updateEnrollmentStatus(enrollmentId, status);
        }, 'Updating Status', 'Updating enrollment status...');
        await notify.success('Enrollment status updated');
        await loadEnrollmentsWithFilter();
        await loadTnaSummary();
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
}

window.__app = window.__app || {};
window.__app.initTna = initTna;
window.__app.createTrainingNeedFromGap = createTrainingNeedFromGap;
window.__app.viewPlanDetails = viewPlanDetails;
window.__app.showCreateCourseModal = showCreateCourseModal;
window.__app.showNewEnrollmentModal = showNewEnrollmentModal;
window.__app.enrollInCourse = enrollInCourse;
window.__app.editCourse = editCourse;
window.__app.updateEnrollmentStatus = updateEnrollmentStatus;

export { initTna };
