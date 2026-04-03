import {
    AuthLoginRequestSchema,
    AuthLoginResponseSchema,
    AuthLogoutResponseSchema,
    AuthProfileSchema,
    AuthSessionResponseSchema,
    type AuthProfile,
    type AuthSessionResponse,
} from '@demo-kpi/contracts';

import { env } from '@/lib/env';
import { getSupabaseSession, supabase } from '@/lib/supabaseClient';

import { transport } from './transport';

export type AuthSource = 'jwt' | 'session' | 'none';

export interface AuthContextResult {
    user: AuthProfile | null;
    role: AuthProfile['role'] | null;
    source: AuthSource;
}

interface SupabaseProfileRow {
    email?: string | null;
    role?: string | null;
    metadata?: Record<string, unknown> | null;
}

const VALID_ROLES = new Set<AuthProfile['role']>([
    'employee',
    'manager',
    'hr',
    'superadmin',
    'director',
]);

function pickFirstString(...values: unknown[]): string {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) return trimmed;
    }
    return '';
}

function normalizeRole(value: unknown): AuthProfile['role'] {
    const role = String(value || '').trim().toLowerCase() as AuthProfile['role'];
    if (VALID_ROLES.has(role)) return role;
    return 'employee';
}

function toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

async function getLegacySession(accessToken = ''): Promise<AuthSessionResponse> {
    return transport.execute<AuthSessionResponse>({
        domain: 'auth',
        action: 'auth/session',
        method: 'GET',
        payload: {},
        schema: AuthSessionResponseSchema,
        accessToken,
    });
}

async function resolveSupabaseProfile(): Promise<AuthProfile | null> {
    if (!supabase) return null;
    const session = await getSupabaseSession();
    if (!session?.user) return null;

    let profileRow: SupabaseProfileRow | null = null;
    const { data, error } = await supabase
        .from('profiles')
        .select('email, role, metadata')
        .eq('id', session.user.id)
        .maybeSingle();

    if (!error && data) {
        profileRow = data as SupabaseProfileRow;
    }

    const profileMetadata = toRecord(profileRow?.metadata);
    const appMetadata = toRecord(session.user.app_metadata);
    const userMetadata = toRecord(session.user.user_metadata);

    const employeeId = pickFirstString(
        profileMetadata.employee_id,
        userMetadata.employee_id,
        appMetadata.employee_id,
        session.user.id
    );
    const role = normalizeRole(profileRow?.role || profileMetadata.role || appMetadata.role || userMetadata.role);
    const authEmail = pickFirstString(profileRow?.email, session.user.email, profileMetadata.email);

    return AuthProfileSchema.parse({
        employee_id: employeeId || session.user.id,
        role,
        auth_email: authEmail || '',
    });
}

async function loginWithSupabase(input: unknown) {
    if (!supabase) {
        throw new Error('Supabase client is not configured.');
    }

    const request = AuthLoginRequestSchema.parse(input);
    const { error } = await supabase.auth.signInWithPassword({
        email: request.email,
        password: request.password,
    });
    if (error) {
        throw new Error(error.message || 'Supabase login failed.');
    }

    const profile = await resolveSupabaseProfile();
    if (!profile) {
        throw new Error('Authenticated, but no profile mapping is available yet.');
    }

    return AuthLoginResponseSchema.parse({ profile });
}

async function logoutWithSupabase() {
    if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw new Error(error.message || 'Supabase logout failed.');
        }
    }
    return AuthLogoutResponseSchema.parse({ ok: true });
}

async function loginWithLegacy(input: unknown) {
    const request = AuthLoginRequestSchema.parse(input);
    return transport.execute({
        domain: 'auth',
        action: 'auth/login',
        payload: request,
        method: 'POST',
        schema: AuthLoginResponseSchema,
    });
}

async function logoutWithLegacy() {
    return transport.execute({
        domain: 'auth',
        action: 'auth/logout',
        payload: {},
        method: 'POST',
        schema: AuthLogoutResponseSchema,
    });
}

function asAuthContext(user: AuthProfile | null, source: AuthSource): AuthContextResult {
    return {
        user,
        role: user?.role || null,
        source,
    };
}

export const authAdapter = {
    async login(input: unknown) {
        const supabaseCapable = Boolean(supabase);

        if (env.backendTarget === 'legacy') {
            return loginWithLegacy(input);
        }

        if (env.backendTarget === 'supabase' && !supabaseCapable) {
            throw new Error('Supabase mode is enabled, but Supabase client variables are missing.');
        }

        if (supabaseCapable) {
            try {
                return await loginWithSupabase(input);
            } catch (error) {
                if (env.backendTarget === 'supabase') {
                    throw error;
                }
            }
        }

        return loginWithLegacy(input);
    },

    async logout() {
        if (env.backendTarget === 'supabase') {
            return logoutWithSupabase();
        }

        if (env.backendTarget === 'legacy') {
            return logoutWithLegacy();
        }

        if (supabase) {
            try {
                await logoutWithSupabase();
            } catch {
                // Keep auto mode resilient; legacy logout still clears cookie sessions.
            }
        }

        try {
            return await logoutWithLegacy();
        } catch {
            return AuthLogoutResponseSchema.parse({ ok: true });
        }
    },

    async getAuthContext(): Promise<AuthContextResult> {
        const supabaseCapable = Boolean(supabase);

        if (supabaseCapable && env.backendTarget !== 'legacy') {
            const profile = await resolveSupabaseProfile();
            if (profile) {
                return asAuthContext(profile, 'jwt');
            }
            if (env.backendTarget === 'supabase') {
                return asAuthContext(null, 'none');
            }
        }

        if (env.backendTarget !== 'supabase') {
            const supabaseSession = await getSupabaseSession();
            if (supabaseSession?.access_token) {
                const jwtSession = await getLegacySession(supabaseSession.access_token);
                if (jwtSession.profile) {
                    return asAuthContext(jwtSession.profile, 'jwt');
                }
            }

            const legacySession = await getLegacySession();
            if (legacySession.profile) {
                return asAuthContext(legacySession.profile, 'session');
            }
        }

        return asAuthContext(null, 'none');
    },
};
