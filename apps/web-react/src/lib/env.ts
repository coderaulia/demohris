export type BackendTarget = 'auto' | 'legacy' | 'supabase';

function normalizeTarget(rawValue: string | undefined): BackendTarget {
    const value = String(rawValue || 'auto').trim().toLowerCase();
    if (value === 'legacy' || value === 'supabase' || value === 'auto') {
        return value;
    }
    return 'auto';
}

export const env = {
    apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL || '/api').trim() || '/api',
    backendTarget: normalizeTarget(import.meta.env.VITE_API_TARGET),
    supabaseUrl: String(import.meta.env.VITE_SUPABASE_URL || '').trim(),
    supabaseAnonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
    legacyAppUrl: String(import.meta.env.VITE_LEGACY_APP_URL || '/').trim() || '/',
} as const;
