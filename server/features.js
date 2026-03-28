export const FEATURES = Object.freeze({
    KPI: String(process.env.ENABLE_KPI || 'true').toLowerCase() === 'true',
    PROBATION: String(process.env.ENABLE_PROBATION || 'true').toLowerCase() === 'true',
    PIP: String(process.env.ENABLE_PIP || 'true').toLowerCase() === 'true',
    TNA: String(process.env.ENABLE_TNA || 'true').toLowerCase() === 'true',
    LMS: String(process.env.ENABLE_LMS || 'true').toLowerCase() === 'true',
});

export function isFeatureEnabled(feature) {
    return Boolean(FEATURES[feature] ?? false);
}

export function getEnabledModules() {
    return Object.entries(FEATURES)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
}
