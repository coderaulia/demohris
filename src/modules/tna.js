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
    });

    document.getElementById('tna-employee-select')?.addEventListener('change', async (e) => {
        const employeeId = e.target.value;
        if (currentView === 'gaps') {
            await loadGapsForEmployee(employeeId);
        } else if (currentView === 'plans') {
            await loadPlans(employeeId);
        } else if (currentView === 'enrollments') {
            await loadEnrollments(employeeId);
        }
    });

    document.getElementById('tna-report-department')?.addEventListener('change', async (e) => {
        await loadGapsReport(e.target.value);
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

    tbody.innerHTML = gaps.map(gap => {
        const priorityClass = getPriorityClass(gap.priority);
        const priorityBadge = `<span class="badge ${priorityClass}">${escapeHTML(gap.priority)}</span>`;

        return `
            <tr>
                <td>${escapeHTML(employee?.name || '-')}</td>
                <td>${escapeHTML(employee?.position || '-')}</td>
                <td><strong>${escapeHTML(gap.competency_name)}</strong></td>
                <td class="text-center">${gap.current_level}</td>
                <td class="text-center">${gap.required_level}</td>
                <td class="text-center"><span class="badge bg-danger">${gap.gap}</span></td>
                <td class="text-center">${priorityBadge}</td>
                <td>${escapeHTML(gap.recommended_training || '-')}</td>
                <td class="text-center"><span class="badge bg-secondary">Identified</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-success" onclick="window.__app.createTrainingNeedFromGap('${escapeHTML(employeeId)}', '${escapeHTML(gap.competency_name)}')">
                        <i class="bi bi-plus"></i> Plan
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
        const courses = await tnaData.fetchTrainingCourses();
        if (!courses.length) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-book me-2"></i>No courses available
                </div>`;
            return;
        }

        container.innerHTML = courses.map(course => `
            <div class="col-md-4 col-lg-3 mb-3">
                <div class="card h-100 shadow-sm">
                    <div class="card-body">
                        <h6 class="card-title">${escapeHTML(course.course_name)}</h6>
                        <p class="card-text small text-muted">${escapeHTML(course.description || 'No description')}</p>
                        <div class="d-flex justify-content-between align-items-center small">
                            <span class="text-muted">${course.provider || 'Internal'}</span>
                            <span class="badge bg-secondary">${course.duration_hours}h</span>
                        </div>
                        ${course.cost > 0 ? `<div class="mt-2 text-primary fw-bold">${formatCurrency(course.cost)}</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `
            <div class="col-12 text-center text-danger py-5">
                <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
            </div>`;
    }
}

async function loadEnrollments(employeeId = '') {
    const tbody = document.getElementById('tna-enrollments-table-body');
    if (!tbody) return;

    try {
        const enrollments = await tnaData.fetchEnrollments(employeeId);
        if (!enrollments.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>No enrollments yet
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = enrollments.map(enrollment => {
            const statusBadge = getStatusBadge(enrollment.status);
            return `
                <tr>
                    <td>${escapeHTML(state.db[enrollment.employee_id]?.name || enrollment.employee_id)}</td>
                    <td>${escapeHTML(enrollment.course_id || '-')}</td>
                    <td>${formatDate(enrollment.enrollment_date)}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td>${enrollment.completion_date ? formatDate(enrollment.completion_date) : '-'}</td>
                    <td></td>
                </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
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

async function createTrainingNeedFromGap(employeeId, competencyName) {
    try {
        const needs = await tnaData.fetchTrainingNeedsConfig(state.db[employeeId]?.position || '');
        const need = needs.find(n => n.competency_name === competencyName);
        
        if (!need) {
            await notify.error('Training need not found in configuration');
            return;
        }

        await notify.withLoading(async () => {
            await tnaData.createTrainingNeed({
                employee_id: employeeId,
                training_need_id: need.id,
                current_level: 0,
                priority: 'medium',
            });
        }, 'Creating Training Need', 'Creating training need record...');

        await notify.success('Training need created');
    } catch (error) {
        await notify.error('Error: ' + error.message);
    }
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

window.__app = window.__app || {};
window.__app.initTna = initTna;
window.__app.createTrainingNeedFromGap = createTrainingNeedFromGap;
window.__app.viewPlanDetails = viewPlanDetails;

export { initTna };
