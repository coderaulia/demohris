import { pool } from './pool.js';

export const FEATURES = Object.freeze({
    KPI: String(process.env.ENABLE_KPI || 'true').toLowerCase() === 'true',
    PROBATION: String(process.env.ENABLE_PROBATION || 'true').toLowerCase() === 'true',
    PIP: String(process.env.ENABLE_PIP || 'true').toLowerCase() === 'true',
    TNA: String(process.env.ENABLE_TNA || 'true').toLowerCase() === 'true',
    LMS: String(process.env.ENABLE_LMS || 'true').toLowerCase() === 'true',
});

let _moduleCache = new Map();
let _moduleCacheTime = 0;
const MODULE_CACHE_TTL = 60000;

export async function isFeatureEnabled(feature) {
    try {
        const cached = _moduleCache.get(feature);
        if (cached !== undefined && Date.now() - _moduleCacheTime < MODULE_CACHE_TTL) {
            return cached;
        }

        try {
            const [rows] = await pool.query(
                'SELECT is_enabled FROM module_settings WHERE module_id = ?',
                [feature]
            );
            
            if (rows.length > 0) {
                const enabled = Boolean(rows[0].is_enabled);
                _moduleCache.set(feature, enabled);
                _moduleCacheTime = Date.now();
                return enabled;
            }
        } catch (dbError) {
            console.warn('Database not available for module check, falling back to env:', dbError.message);
        }

        return Boolean(FEATURES[feature] ?? false);
    } catch (error) {
        console.warn('Feature check error, falling back to env:', error.message);
        return Boolean(FEATURES[feature] ?? false);
    }
}

export function getEnabledModules() {
    return Object.entries(FEATURES)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
}

export function invalidateModuleCache() {
    _moduleCache.clear();
    _moduleCacheTime = 0;
}
