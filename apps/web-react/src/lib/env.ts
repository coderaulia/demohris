export type BackendTarget = 'auto' | 'legacy' | 'supabase';

function normalizeBoolean(rawValue: string | undefined, fallback = false): boolean {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return fallback;
    }
    const value = String(rawValue).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value);
}

function normalizeTarget(rawValue: string | undefined): BackendTarget {
    const value = String(rawValue || 'supabase').trim().toLowerCase();
    if (value === 'legacy' || value === 'supabase' || value === 'auto') {
        return value;
    }
    return 'supabase';
}

export const env = {
    apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL || '/api').trim() || '/api',
    backendTarget: normalizeTarget(import.meta.env.VITE_API_TARGET),
    supabaseUrl: String(import.meta.env.VITE_SUPABASE_URL || '').trim(),
    supabaseAnonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
    legacyAppUrl: String(import.meta.env.VITE_LEGACY_APP_URL || '/').trim() || '/',
    enableEmployeesRoute: normalizeBoolean(import.meta.env.VITE_ENABLE_EMPLOYEES_ROUTE, true),
    enableKpiRoute: normalizeBoolean(import.meta.env.VITE_ENABLE_KPI_ROUTE, true),
    enableLmsRoute: normalizeBoolean(import.meta.env.VITE_ENABLE_LMS_ROUTE, true),
    enableTnaRoute: normalizeBoolean(import.meta.env.VITE_ENABLE_TNA_ROUTE, false),
    showLegacyAppLink: normalizeBoolean(import.meta.env.VITE_SHOW_LEGACY_APP_LINK, true),
} as const;
