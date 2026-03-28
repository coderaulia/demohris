import { isFeatureEnabled } from '../lib/features.js';

const registeredModules = new Map();
const moduleState = {
    initialized: false,
    activeModules: new Set(),
};

export function registerModule(moduleDef) {
    const { id, dependencies = [], init, sync, cleanup } = moduleDef;
    registeredModules.set(id, {
        id,
        dependencies,
        init: init || (() => Promise.resolve()),
        sync: sync || (() => Promise.resolve()),
        cleanup: cleanup || (() => Promise.resolve()),
        initialized: false,
    });
}

export async function initializeModules() {
    if (moduleState.initialized) return;

    const enabled = getEnabledModules();

    for (const moduleId of enabled) {
        const module = registeredModules.get(moduleId);
        if (!module) continue;

        for (const depId of module.dependencies) {
            if (!isFeatureEnabled(depId) && registeredModules.has(depId)) {
                console.warn(`Module ${moduleId} depends on ${depId} which is not enabled`);
            }
        }

        try {
            await module.init();
            module.initialized = true;
            moduleState.activeModules.add(moduleId);
        } catch (error) {
            console.error(`Failed to initialize module ${moduleId}:`, error);
        }
    }

    moduleState.initialized = true;
}

export async function syncModuleData(moduleId) {
    const module = registeredModules.get(moduleId);
    if (!module || !moduleState.activeModules.has(moduleId)) {
        return [];
    }

    try {
        return await module.sync();
    } catch (error) {
        console.error(`Failed to sync module ${moduleId}:`, error);
        return [];
    }
}

export async function syncAllModules() {
    const tasks = [];
    for (const moduleId of moduleState.activeModules) {
        tasks.push(syncModuleData(moduleId));
    }
    return Promise.all(tasks);
}

export function isModuleInitialized(moduleId) {
    return moduleState.activeModules.has(moduleId);
}

export function getActiveModules() {
    return [...moduleState.activeModules];
}

export function cleanupModules() {
    for (const moduleId of moduleState.activeModules) {
        const module = registeredModules.get(moduleId);
        if (module && typeof module.cleanup === 'function') {
            try {
                module.cleanup();
            } catch (error) {
                console.error(`Failed to cleanup module ${moduleId}:`, error);
            }
        }
    }
    moduleState.activeModules.clear();
    moduleState.initialized = false;
}

function getEnabledModules() {
    const enabled = [];
    if (isFeatureEnabled('KPI')) enabled.push('kpi');
    if (isFeatureEnabled('PROBATION')) enabled.push('probation');
    if (isFeatureEnabled('PIP')) enabled.push('pip');
    if (isFeatureEnabled('TNA')) enabled.push('tna');
    if (isFeatureEnabled('LMS')) enabled.push('lms');
    return enabled;
}
