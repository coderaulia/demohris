import { state, emit, subscribe } from './store.js';

export const MODULE_STATUS = Object.freeze({
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    COMING_SOON: 'coming_soon',
    DEPRECATED: 'deprecated',
});

export const MODULE_CATEGORIES = Object.freeze({
    CORE: 'core',
    PERFORMANCE: 'performance',
    TALENT: 'talent',
    OPERATIONS: 'operations',
    ANALYTICS: 'analytics',
});

export const DEFAULT_MODULES = Object.freeze({
    CORE: {
        id: 'CORE',
        name: 'Core HR',
        description: 'Employee management, competencies, and basic HR functions',
        category: MODULE_CATEGORIES.CORE,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: [],
        routes: ['/employees', '/settings'],
        navItems: ['nav-employees', 'nav-settings'],
        envKey: 'VITE_FEATURE_CORE',
        icon: 'bi-people',
    },
    ASSESSMENT: {
        id: 'ASSESSMENT',
        name: 'Performance Assessment',
        description: '360-degree feedback, competency-based assessments',
        category: MODULE_CATEGORIES.PERFORMANCE,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: ['CORE'],
        routes: ['/assessment'],
        navItems: ['nav-assessment'],
        envKey: 'VITE_FEATURE_ASSESSMENT',
        icon: 'bi-clipboard-check',
    },
    KPI: {
        id: 'KPI',
        name: 'KPI Management',
        description: 'Key Performance Indicators, targets, and tracking',
        category: MODULE_CATEGORIES.PERFORMANCE,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: ['CORE'],
        routes: ['/records'],
        navItems: [],
        envKey: 'VITE_FEATURE_KPI',
        icon: 'bi-graph-up',
    },
    PROBATION: {
        id: 'PROBATION',
        name: 'Probation Management',
        description: 'New hire probation tracking and evaluation',
        category: MODULE_CATEGORIES.PERFORMANCE,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: ['KPI'],
        routes: ['/records'],
        navItems: [],
        envKey: 'VITE_FEATURE_PROBATION',
        icon: 'bi-calendar-check',
    },
    PIP: {
        id: 'PIP',
        name: 'Performance Improvement Plan',
        description: 'PIP tracking and management',
        category: MODULE_CATEGORIES.PERFORMANCE,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: ['KPI'],
        routes: ['/records'],
        navItems: [],
        envKey: 'VITE_FEATURE_PIP',
        icon: 'bi-arrow-up-circle',
    },
    TNA: {
        id: 'TNA',
        name: 'Training Needs Analysis',
        description: 'Identify skill gaps and training requirements',
        category: MODULE_CATEGORIES.TALENT,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: ['CORE'],
        routes: ['/tna'],
        navItems: ['nav-tna'],
        envKey: 'VITE_FEATURE_TNA',
        icon: 'bi-bar-chart-steps',
    },
    LMS: {
        id: 'LMS',
        name: 'Learning Management System',
        description: 'Course management, enrollments, and learning paths',
        category: MODULE_CATEGORIES.TALENT,
        status: MODULE_STATUS.ACTIVE,
        version: '1.0.0',
        dependencies: ['TNA'],
        routes: ['/tna'],
        navItems: [],
        envKey: 'VITE_FEATURE_LMS',
        icon: 'bi-mortarboard',
    },
    RECRUITMENT: {
        id: 'RECRUITMENT',
        name: 'Recruitment & ATS',
        description: 'Job postings, applicant tracking, hiring pipeline',
        category: MODULE_CATEGORIES.TALENT,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['CORE'],
        routes: ['/recruitment'],
        navItems: ['nav-recruitment'],
        envKey: 'VITE_FEATURE_RECRUITMENT',
        icon: 'bi-person-plus',
    },
    ONBOARDING: {
        id: 'ONBOARDING',
        name: 'Employee Onboarding',
        description: 'New hire onboarding workflows and checklists',
        category: MODULE_CATEGORIES.TALENT,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['RECRUITMENT'],
        routes: ['/onboarding'],
        navItems: ['nav-onboarding'],
        envKey: 'VITE_FEATURE_ONBOARDING',
        icon: 'bi-box-seam',
    },
    LEAVE: {
        id: 'LEAVE',
        name: 'Leave Management',
        description: 'Time off requests, approvals, and calendar',
        category: MODULE_CATEGORIES.OPERATIONS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['CORE'],
        routes: ['/leave'],
        navItems: ['nav-leave'],
        envKey: 'VITE_FEATURE_LEAVE',
        icon: 'bi-calendar-event',
    },
    ATTENDANCE: {
        id: 'ATTENDANCE',
        name: 'Time & Attendance',
        description: 'Clock in/out, overtime tracking, biometrics',
        category: MODULE_CATEGORIES.OPERATIONS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['CORE', 'LEAVE'],
        routes: ['/attendance'],
        navItems: ['nav-attendance'],
        envKey: 'VITE_FEATURE_ATTENDANCE',
        icon: 'bi-clock',
    },
    PAYROLL: {
        id: 'PAYROLL',
        name: 'Payroll Management',
        description: 'Salary processing, tax calculations, payslips',
        category: MODULE_CATEGORIES.OPERATIONS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['ATTENDANCE', 'LEAVE'],
        routes: ['/payroll'],
        navItems: ['nav-payroll'],
        envKey: 'VITE_FEATURE_PAYROLL',
        icon: 'bi-cash-stack',
    },
    EXPENSES: {
        id: 'EXPENSES',
        name: 'Expense Management',
        description: 'Travel and expense reimbursement',
        category: MODULE_CATEGORIES.OPERATIONS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['PAYROLL'],
        routes: ['/expenses'],
        navItems: ['nav-expenses'],
        envKey: 'VITE_FEATURE_EXPENSES',
        icon: 'bi-receipt',
    },
    DOCUMENTS: {
        id: 'DOCUMENTS',
        name: 'Document Management',
        description: 'Digital document storage and e-signatures',
        category: MODULE_CATEGORIES.OPERATIONS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['CORE'],
        routes: ['/documents'],
        navItems: ['nav-documents'],
        envKey: 'VITE_FEATURE_DOCUMENTS',
        icon: 'bi-folder',
    },
    SUCCESSION: {
        id: 'SUCCESSION',
        name: 'Succession Planning',
        description: 'Career paths and talent pipeline',
        category: MODULE_CATEGORIES.TALENT,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['ASSESSMENT', 'TNA'],
        routes: ['/succession'],
        navItems: ['nav-succession'],
        envKey: 'VITE_FEATURE_SUCCESSION',
        icon: 'bi-ladder',
    },
    ANALYTICS: {
        id: 'ANALYTICS',
        name: 'HR Analytics',
        description: 'Dashboards, reports, and workforce insights',
        category: MODULE_CATEGORIES.ANALYTICS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['CORE'],
        routes: ['/analytics'],
        navItems: ['nav-analytics'],
        envKey: 'VITE_FEATURE_ANALYTICS',
        icon: 'bi-pie-chart',
    },
    WELLNESS: {
        id: 'WELLNESS',
        name: 'Employee Wellness',
        description: 'Wellness programs and engagement activities',
        category: MODULE_CATEGORIES.ANALYTICS,
        status: MODULE_STATUS.COMING_SOON,
        version: '2.0.0',
        dependencies: ['CORE'],
        routes: ['/wellness'],
        navItems: ['nav-wellness'],
        envKey: 'VITE_FEATURE_WELLNESS',
        icon: 'bi-heart-pulse',
    },
});

class ModuleRegistry {
    constructor() {
        this._modules = new Map();
        this._moduleSettings = new Map();
        this._initialized = false;
        this._moduleLoaders = new Map();
        this._moduleInstances = new Map();
        
        this._initializeDefaults();
        this._setupEventListeners();
    }

    _initializeDefaults() {
        Object.values(DEFAULT_MODULES).forEach(moduleDef => {
            this._modules.set(moduleDef.id, {
                ...moduleDef,
                _enabled: this._getEnvEnabled(moduleDef.envKey),
                _customSettings: {},
            });
        });
    }

    _getEnvEnabled(envKey) {
        if (!envKey) return true;
        return String(import.meta.env[envKey] || 'true').toLowerCase() === 'true';
    }

    _setupEventListeners() {
        subscribe('module:changed', (moduleId) => {
            this._handleModuleChange(moduleId);
        });
    }

    async _handleModuleChange(moduleId) {
        const module = this._modules.get(moduleId);
        if (!module) return;

        const isEnabled = this.isModuleEnabled(moduleId);
        
        if (isEnabled && module._loader && !this._moduleInstances.has(moduleId)) {
            await this._loadModule(moduleId);
        } else if (!isEnabled && this._moduleInstances.has(moduleId)) {
            await this._unloadModule(moduleId);
        }

        emit('module:updated', { moduleId, isEnabled });
    }

    async initialize(settings = {}) {
        if (this._initialized) return;

        if (settings.modules) {
            Object.entries(settings.modules).forEach(([moduleId, moduleSettings]) => {
                const module = this._modules.get(moduleId);
                if (module) {
                    module._customSettings = moduleSettings;
                }
            });
        }

        this._initialized = true;
        emit('modules:initialized', this.getAllModules());
    }

    async _loadModule(moduleId) {
        const module = this._modules.get(moduleId);
        if (!module || !module._loader) return null;

        try {
            const instance = await module._loader();
            this._moduleInstances.set(moduleId, instance);
            
            if (instance.init) {
                await instance.init();
            }

            emit('module:loaded', { moduleId, instance });
            return instance;
        } catch (error) {
            console.error(`Failed to load module ${moduleId}:`, error);
            emit('module:error', { moduleId, error });
            return null;
        }
    }

    async _unloadModule(moduleId) {
        const instance = this._moduleInstances.get(moduleId);
        if (!instance) return;

        try {
            if (instance.destroy) {
                await instance.destroy();
            }
            this._moduleInstances.delete(moduleId);
            emit('module:unloaded', { moduleId });
        } catch (error) {
            console.error(`Failed to unload module ${moduleId}:`, error);
        }
    }

    registerModule(moduleId, moduleDef, loader = null) {
        const existing = this._modules.get(moduleId);
        const merged = {
            ...DEFAULT_MODULES[moduleId],
            ...existing,
            ...moduleDef,
            _enabled: moduleDef.enabled ?? existing?._enabled ?? true,
        };

        this._modules.set(moduleId, merged);

        if (loader && typeof loader === 'function') {
            this._moduleLoaders.set(moduleId, loader);
            merged._loader = loader;
        }
    }

    registerLoader(moduleId, loader) {
        const module = this._modules.get(moduleId);
        if (module) {
            module._loader = loader;
            this._moduleLoaders.set(moduleId, loader);
        }
    }

    getModule(moduleId) {
        return this._modules.get(moduleId) || null;
    }

    getAllModules() {
        return Array.from(this._modules.values()).map(m => ({
            ...m,
            _loader: undefined,
            _moduleInstances: undefined,
        }));
    }

    getModulesByCategory(category) {
        return this.getAllModules().filter(m => m.category === category);
    }

    getActiveModules() {
        return this.getAllModules().filter(m => this.isModuleEnabled(m.id));
    }

    isModuleEnabled(moduleId) {
        const module = this._modules.get(moduleId);
        if (!module) return false;

        if (module.status === MODULE_STATUS.COMING_SOON || 
            module.status === MODULE_STATUS.DEPRECATED) {
            return false;
        }

        const customEnabled = module._customSettings?.enabled;
        if (customEnabled !== undefined) {
            return Boolean(customEnabled);
        }

        return Boolean(module._enabled);
    }

    enableModule(moduleId) {
        const module = this._modules.get(moduleId);
        if (!module) return false;

        if (!this._checkDependencies(moduleId)) {
            const deps = this._getMissingDependencies(moduleId);
            console.warn(`Cannot enable ${moduleId}: missing dependencies:`, deps);
            return false;
        }

        module._customSettings.enabled = true;
        this._moduleSettings.set(moduleId, { ...module._customSettings });
        emit('module:changed', moduleId);
        return true;
    }

    disableModule(moduleId) {
        const dependents = this._getDependentModules(moduleId);
        if (dependents.length > 0 && this.isModuleEnabled(moduleId)) {
            console.warn(`Cannot disable ${moduleId}: active dependents:`, dependents);
            return { success: false, dependents };
        }

        const module = this._modules.get(moduleId);
        if (module) {
            module._customSettings.enabled = false;
            this._moduleSettings.set(moduleId, { ...module._customSettings });
            emit('module:changed', moduleId);
        }
        return { success: true };
    }

    _checkDependencies(moduleId) {
        const module = this._modules.get(moduleId);
        if (!module || !module.dependencies) return true;

        return module.dependencies.every(depId => {
            const dep = this._modules.get(depId);
            if (!dep) return false;
            
            if (dep.status === MODULE_STATUS.DEPRECATED) return false;
            
            const customEnabled = dep._customSettings?.enabled;
            if (customEnabled !== undefined) {
                return Boolean(customEnabled);
            }
            
            return Boolean(dep._enabled);
        });
    }

    _getMissingDependencies(moduleId) {
        const module = this._modules.get(moduleId);
        if (!module || !module.dependencies) return [];

        return module.dependencies.filter(depId => !this.isModuleEnabled(depId));
    }

    _getDependentModules(moduleId) {
        const dependents = [];
        
        this._modules.forEach((module, id) => {
            if (module.dependencies && module.dependencies.includes(moduleId)) {
                if (this.isModuleEnabled(id)) {
                    dependents.push(id);
                }
            }
        });
        
        return dependents;
    }

    getModuleInstance(moduleId) {
        return this._moduleInstances.get(moduleId) || null;
    }

    getNavItemsForRole(role) {
        const navItems = [];
        
        this.getActiveModules().forEach(module => {
            module.navItems?.forEach(item => {
                navItems.push({
                    id: item,
                    moduleId: module.id,
                    moduleName: module.name,
                    icon: module.icon,
                });
            });
        });
        
        return navItems;
    }

    getRoutesForModule(moduleId) {
        const module = this._modules.get(moduleId);
        return module?.routes || [];
    }

    getAllRoutes() {
        const routes = new Map();
        
        this.getActiveModules().forEach(module => {
            module.routes?.forEach(route => {
                routes.set(route, module.id);
            });
        });
        
        return routes;
    }

    async saveSettings() {
        const settings = {};
        this._moduleSettings.forEach((value, key) => {
            settings[key] = value;
        });
        return settings;
    }

    getSettings() {
        const settings = {};
        this._modules.forEach((module, id) => {
            settings[id] = module._customSettings;
        });
        return settings;
    }
}

export const moduleRegistry = new ModuleRegistry();

export function isModuleEnabled(moduleId) {
    return moduleRegistry.isModuleEnabled(moduleId);
}

export function getModule(moduleId) {
    return moduleRegistry.getModule(moduleId);
}

export function getActiveModules() {
    return moduleRegistry.getActiveModules();
}

export function enableModule(moduleId) {
    return moduleRegistry.enableModule(moduleId);
}

export function disableModule(moduleId) {
    return moduleRegistry.disableModule(moduleId);
}

export function registerModuleLoader(moduleId, loader) {
    moduleRegistry.registerLoader(moduleId, loader);
}
