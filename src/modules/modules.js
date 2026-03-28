import { state, emit } from '../lib/store.js';
import { escapeHTML } from '../lib/utils.js';
import * as notify from '../lib/notify.js';
import * as moduleData from './data/modules.js';

let modules = [];
let filteredModules = [];
let currentFilters = {
    category: '',
    status: '',
    search: ''
};

function initModuleManager() {
    setupEventListeners();
    loadModules();
}

function setupEventListeners() {
    subscribe('nav:switchTab', (tabId) => {
        if (tabId === 'tab-modules') {
            loadModules();
        }
    });

    document.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('[data-module-toggle]');
        if (toggleBtn) {
            e.preventDefault();
            e.stopPropagation();
            const moduleId = toggleBtn.dataset.moduleToggle;
            const isEnabled = toggleBtn.dataset.moduleEnabled === 'true';
            await toggleModuleStatus(moduleId, !isEnabled);
            return;
        }

        const settingsBtn = e.target.closest('[data-module-settings]');
        if (settingsBtn) {
            e.preventDefault();
            const moduleId = settingsBtn.dataset.moduleSettings;
            await showModuleSettingsModal(moduleId);
            return;
        }
    });
}

async function loadModules() {
    try {
        await notify.withLoading(async () => {
            const response = await moduleData.fetchAllModules();
            if (response.success) {
                modules = response.modules || [];
                applyFilters();
                updateCounts();
            }
        }, 'Loading Modules', 'Please wait...');
    } catch (error) {
        console.error('Failed to load modules:', error);
        await notify.error('Failed to load modules: ' + error.message);
    }
}

function applyFilters() {
    filteredModules = modules.filter(mod => {
        if (currentFilters.category && mod.category !== currentFilters.category) {
            return false;
        }

        if (currentFilters.status) {
            if (currentFilters.status === 'active' && !mod.is_enabled) return false;
            if (currentFilters.status === 'inactive' && mod.is_enabled) return false;
            if (currentFilters.status === 'coming_soon' && mod.status !== 'coming_soon') return false;
        }

        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            const matchesName = mod.module_name?.toLowerCase().includes(searchLower);
            const matchesDesc = mod.description?.toLowerCase().includes(searchLower);
            const matchesId = mod.module_id?.toLowerCase().includes(searchLower);
            if (!matchesName && !matchesDesc && !matchesId) return false;
        }

        return true;
    });

    renderModuleCards();
}

function updateCounts() {
    const active = modules.filter(m => m.is_enabled && m.status !== 'coming_soon').length;
    const inactive = modules.filter(m => !m.is_enabled && m.status !== 'coming_soon').length;
    const comingSoon = modules.filter(m => m.status === 'coming_soon').length;

    document.getElementById('modules-active-count').textContent = active;
    document.getElementById('modules-inactive-count').textContent = inactive;
    document.getElementById('modules-coming-count').textContent = comingSoon;
}

function renderModuleCards() {
    const container = document.getElementById('modules-container');
    if (!container) return;

    if (filteredModules.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-puzzle display-4 mb-3"></i>
                    <p class="mb-0">No modules found matching your filters.</p>
                </div>
            </div>
        `;
        return;
    }

    const cardTemplate = document.getElementById('module-card-template');
    container.innerHTML = '';

    filteredModules.forEach(mod => {
        const card = cardTemplate.content.cloneNode(true);
        const cardEl = card.querySelector('.module-card');
        cardEl.dataset.moduleId = mod.module_id;

        const iconEl = card.querySelector('.module-icon-wrapper i');
        iconEl.className = 'bi ' + getModuleIcon(mod.module_id);

        card.querySelector('.module-name').textContent = mod.module_name;
        card.querySelector('.module-category').textContent = mod.category.charAt(0).toUpperCase() + mod.category.slice(1);
        card.querySelector('.module-description').textContent = mod.description || '';
        card.querySelector('.module-version').textContent = 'v' + (mod.version || '1.0.0');

        const statusBadge = card.querySelector('.module-status-badge');
        statusBadge.innerHTML = getStatusBadge(mod);

        const toggleContainer = card.querySelector('.module-toggle');
        toggleContainer.innerHTML = getToggleSwitch(mod);

        if (mod.dependencies && mod.dependencies.length > 0) {
            const depsContainer = card.querySelector('.module-dependencies');
            depsContainer.classList.remove('d-none');
            const depsList = card.querySelector('.module-deps-list');
            depsList.innerHTML = mod.dependencies.map(depId => {
                const dep = modules.find(m => m.module_id === depId);
                const isEnabled = dep?.is_enabled;
                return `<span class="badge ${isEnabled ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} me-1">${dep?.module_name || depId}</span>`;
            }).join('');
        }

        container.appendChild(card);
    });
}

function getModuleIcon(moduleId) {
    const icons = {
        CORE: 'bi-people',
        ASSESSMENT: 'bi-clipboard-check',
        KPI: 'bi-graph-up',
        PROBATION: 'bi-calendar-check',
        PIP: 'bi-arrow-up-circle',
        TNA: 'bi-bar-chart-steps',
        LMS: 'bi-mortarboard',
        RECRUITMENT: 'bi-person-plus',
        ONBOARDING: 'bi-box-seam',
        LEAVE: 'bi-calendar-event',
        ATTENDANCE: 'bi-clock',
        PAYROLL: 'bi-cash-stack',
        EXPENSES: 'bi-receipt',
        DOCUMENTS: 'bi-folder',
        SUCCESSION: 'bi-ladder',
        ANALYTICS: 'bi-pie-chart',
        WELLNESS: 'bi-heart-pulse'
    };
    return icons[moduleId] || 'bi-puzzle';
}

function getStatusBadge(mod) {
    if (mod.status === 'coming_soon') {
        return '<span class="badge bg-warning"><i class="bi bi-tools me-1"></i>Coming Soon</span>';
    }
    if (mod.is_enabled) {
        return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Active</span>';
    }
    return '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Inactive</span>';
}

function getToggleSwitch(mod) {
    if (mod.status === 'coming_soon') {
        return `<button class="btn btn-sm btn-outline-secondary" disabled>
            <i class="bi bi-lock me-1"></i>Locked
        </button>`;
    }

    const checked = mod.is_enabled ? 'checked' : '';
    const disabled = mod.status === 'coming_soon' ? 'disabled' : '';
    
    return `
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" 
                   data-module-toggle="${mod.module_id}"
                   data-module-enabled="${mod.is_enabled}"
                   ${checked} ${disabled}
                   onchange="event.stopPropagation()">
        </div>
    `;
}

async function toggleModuleStatus(moduleId, enable) {
    try {
        const response = await notify.withLoading(async () => {
            return await moduleData.toggleModule(moduleId, enable);
        }, enable ? 'Enabling Module' : 'Disabling Module', 'Please wait...');

        if (response.success) {
            const mod = modules.find(m => m.module_id === moduleId);
            if (mod) {
                mod.is_enabled = response.module.is_enabled;
            }
            
            await notify.success(`Module ${enable ? 'enabled' : 'disabled'} successfully`);
            applyFilters();
            updateCounts();
            emit('module:changed', moduleId);
        } else {
            let errorMsg = response.error || 'Failed to toggle module';
            if (response.missing_dependencies) {
                errorMsg += '\nMissing dependencies: ' + response.missing_dependencies.join(', ');
            }
            if (response.active_dependents) {
                errorMsg += '\nActive dependents: ' + response.active_dependents.join(', ');
            }
            await notify.error(errorMsg);
        }
    } catch (error) {
        console.error('Failed to toggle module:', error);
        await notify.error('Failed to toggle module: ' + error.message);
    }
}

async function showModuleSettingsModal(moduleId) {
    const mod = modules.find(m => m.module_id === moduleId);
    if (!mod) return;

    const modalHtml = `
        <div class="modal fade" id="moduleSettingsModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi ${getModuleIcon(moduleId)} me-2"></i>
                            ${escapeHTML(mod.module_name)} Settings
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <small>
                                <strong>Module ID:</strong> ${escapeHTML(mod.module_id)}<br>
                                <strong>Category:</strong> ${escapeHTML(mod.category)}<br>
                                <strong>Status:</strong> ${escapeHTML(mod.status)}<br>
                                <strong>Version:</strong> ${escapeHTML(mod.version || '1.0.0')}
                            </small>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Description</label>
                            <p class="text-muted">${escapeHTML(mod.description || 'No description available')}</p>
                        </div>
                        ${mod.dependencies?.length ? `
                        <div class="mb-3">
                            <label class="form-label">Dependencies</label>
                            <div>${mod.dependencies.map(depId => {
                                const dep = modules.find(m => m.module_id === depId);
                                return `<span class="badge ${dep?.is_enabled ? 'bg-success' : 'bg-secondary'} me-1">${escapeHTML(dep?.module_name || depId)}</span>`;
                            }).join('')}</div>
                        </div>
                        ` : ''}
                        <hr>
                        <h6>Activity Log</h6>
                        <div id="module-activity-log" class="small">
                            <div class="text-center py-3">
                                <span class="spinner-border spinner-border-sm me-2"></span>
                                Loading...
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('moduleSettingsModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalEl = document.getElementById('moduleSettingsModal');
    const bsModal = new bootstrap.Modal(modalEl);
    
    modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
    });

    bsModal.show();

    loadModuleActivityLog(moduleId);
}

async function loadModuleActivityLog(moduleId) {
    const container = document.getElementById('module-activity-log');
    if (!container) return;

    try {
        const response = await moduleData.fetchModuleActivity(moduleId);
        
        if (response.logs && response.logs.length > 0) {
            container.innerHTML = response.logs.map(log => `
                <div class="d-flex justify-content-between py-1 border-bottom">
                    <div>
                        <span class="badge ${log.action === 'enabled' ? 'bg-success' : log.action === 'disabled' ? 'bg-danger' : 'bg-info'} me-1">
                            ${escapeHTML(log.action)}
                        </span>
                        by <strong>${escapeHTML(log.actor_name || log.actor_employee_id || 'System')}</strong>
                    </div>
                    <small class="text-muted">${formatDate(log.created_at)}</small>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="text-muted text-center py-2 mb-0">No activity recorded yet.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p class="text-danger text-center py-2 mb-0">Failed to load activity log.</p>';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
}

function filterByCategory(category) {
    currentFilters.category = category;
    applyFilters();
}

function filterByStatus(status) {
    currentFilters.status = status;
    applyFilters();
}

function searchModules(search) {
    currentFilters.search = search;
    applyFilters();
}

async function refreshModules() {
    await loadModules();
    await notify.success('Modules refreshed');
}

async function exportConfig() {
    const config = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        modules: modules.map(m => ({
            id: m.module_id,
            is_enabled: m.is_enabled,
            settings: m.settings
        }))
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `module-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await notify.success('Module configuration exported');
}

function subscribe(event, callback) {
    window.addEventListener(event, (e) => callback(e.detail));
}

export {
    initModuleManager,
    loadModules,
    toggleModuleStatus,
    filterByCategory,
    filterByStatus,
    searchModules,
    refreshModules,
    exportConfig
};
