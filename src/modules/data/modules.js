import { apiRequest } from '../../lib/supabase.js';

export async function fetchAllModules() {
    return await apiRequest('modules/list');
}

export async function fetchModule(moduleId) {
    return await apiRequest('modules/get', { moduleId });
}

export async function updateModuleConfig(moduleId, settings) {
    return await apiRequest('modules/update', { moduleId, settings });
}

export async function toggleModule(moduleId, enable) {
    return await apiRequest('modules/toggle', { moduleId, enable });
}

export async function fetchModuleActivity(moduleId, limit = 50, offset = 0) {
    return await apiRequest('modules/activity', { moduleId, limit, offset });
}

export async function fetchModulesByCategory(category) {
    return await apiRequest('modules/by-category', { category });
}

export async function fetchActiveModules() {
    return await apiRequest('modules/active');
}
