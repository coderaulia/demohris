import { state, toNumber, isPeriodKey, sanitizeTargetMap } from './runtime.js';

function normalizeKpiTargetStore(rawTargets = {}) {
    const src = rawTargets && typeof rawTargets === 'object' && !Array.isArray(rawTargets)
        ? rawTargets
        : {};

    const hasNested = src.default || src.monthly;
    if (!hasNested) {
        return {
            defaultTargets: sanitizeTargetMap(src),
            monthlyTargets: {},
        };
    }

    const defaultTargets = sanitizeTargetMap(src.default || {});
    const monthlyTargets = {};
    Object.entries(src.monthly || {}).forEach(([period, targetObj]) => {
        if (!isPeriodKey(period)) return;
        const clean = sanitizeTargetMap(targetObj || {});
        if (Object.keys(clean).length > 0) {
            monthlyTargets[period] = clean;
        }
    });

    return { defaultTargets, monthlyTargets };
}

function buildKpiTargetStore(defaultTargets = {}, monthlyTargets = {}) {
    const cleanDefault = sanitizeTargetMap(defaultTargets);
    const cleanMonthly = {};
    Object.entries(monthlyTargets || {}).forEach(([period, targetObj]) => {
        if (!isPeriodKey(period)) return;
        const clean = sanitizeTargetMap(targetObj || {});
        if (Object.keys(clean).length > 0) {
            cleanMonthly[period] = clean;
        }
    });

    const hasMonthly = Object.keys(cleanMonthly).length > 0;
    if (!hasMonthly) return cleanDefault;

    return {
        default: cleanDefault,
        monthly: cleanMonthly,
    };
}

function getEmployeeKpiTarget(employee, kpiId, period = '') {
    const key = String(kpiId || '').trim();
    if (!employee || !key) return 0;

    const { defaultTargets, monthlyTargets } = normalizeKpiTargetStore(employee.kpi_targets || {});

    if (isPeriodKey(period) && monthlyTargets[period] && monthlyTargets[period][key] !== undefined) {
        return toNumber(monthlyTargets[period][key], 0);
    }
    if (defaultTargets[key] !== undefined) {
        return toNumber(defaultTargets[key], 0);
    }

    const kpiDef = state.kpiConfig.find(k => k.id === key);
    return toNumber(kpiDef?.target, 0);
}

export {
    normalizeKpiTargetStore,
    buildKpiTargetStore,
    getEmployeeKpiTarget,
};
