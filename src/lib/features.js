export const FEATURES = Object.freeze({
    KPI: String(import.meta.env.VITE_FEATURE_KPI || 'true').toLowerCase() === 'true',
    PROBATION: String(import.meta.env.VITE_FEATURE_PROBATION || 'true').toLowerCase() === 'true',
    PIP: String(import.meta.env.VITE_FEATURE_PIP || 'true').toLowerCase() === 'true',
    TNA: String(import.meta.env.VITE_FEATURE_TNA || 'true').toLowerCase() === 'true',
    LMS: String(import.meta.env.VITE_FEATURE_LMS || 'true').toLowerCase() === 'true',
});

export function isFeatureEnabled(feature) {
    return Boolean(FEATURES[feature] ?? false);
}

export function getEnabledFeatures() {
    return Object.entries(FEATURES)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
}

export function isModuleActive(moduleName) {
    return isFeatureEnabled(moduleName.toUpperCase());
}
