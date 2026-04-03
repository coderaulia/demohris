function resolveApiBaseUrl() {
    const raw = String(import.meta.env.VITE_API_BASE_URL || '/api').trim();
    return raw || '/api';
}

function buildModulesUrl(action) {
    const base = resolveApiBaseUrl().replace(/\/$/, '');
    return `${base}/modules?action=${encodeURIComponent(action)}`;
}

async function moduleRequest(action, payload = {}) {
    const response = await fetch(buildModulesUrl(action), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
    });

    const parsed = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(parsed?.error || parsed?.message || 'Module request failed.');
    }
    return parsed;
}

export async function fetchAllModules() {
    return await moduleRequest('list');
}

export async function fetchModule(moduleId) {
    return await moduleRequest('get', { moduleId });
}

export async function updateModuleConfig(moduleId, settings) {
    return await moduleRequest('update', { moduleId, settings });
}

export async function toggleModule(moduleId, enable) {
    return await moduleRequest('toggle', { moduleId, enable });
}

export async function fetchModuleActivity(moduleId, limit = 50, offset = 0) {
    return await moduleRequest('activity', { moduleId, limit, offset });
}

export async function fetchModulesByCategory(category) {
    return await moduleRequest('by-category', { category });
}

export async function fetchActiveModules() {
    return await moduleRequest('active');
}
