import {
    AuthLoginRequestSchema,
    AuthLoginResponseSchema,
    AuthLogoutResponseSchema,
    AuthSessionResponseSchema,
    type AuthProfile,
    type AuthSessionResponse,
} from '@demo-kpi/contracts';

import { getSupabaseSession } from '@/lib/supabaseClient';

import { transport } from './transport';

export type AuthSource = 'jwt' | 'session' | 'none';

export interface AuthContextResult {
    user: AuthProfile | null;
    role: AuthProfile['role'] | null;
    source: AuthSource;
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

export const authAdapter = {
    async login(input: unknown) {
        const request = AuthLoginRequestSchema.parse(input);
        return transport.execute({
            domain: 'auth',
            action: 'auth/login',
            payload: request,
            method: 'POST',
            schema: AuthLoginResponseSchema,
        });
    },

    async logout() {
        return transport.execute({
            domain: 'auth',
            action: 'auth/logout',
            payload: {},
            method: 'POST',
            schema: AuthLogoutResponseSchema,
        });
    },

    async getAuthContext(): Promise<AuthContextResult> {
        const supabaseSession = await getSupabaseSession();
        if (supabaseSession?.access_token) {
            const jwtSession = await getLegacySession(supabaseSession.access_token);
            if (jwtSession.profile) {
                return {
                    user: jwtSession.profile,
                    role: jwtSession.profile.role,
                    source: 'jwt',
                };
            }
        }

        const legacySession = await getLegacySession();
        if (legacySession.profile) {
            return {
                user: legacySession.profile,
                role: legacySession.profile.role,
                source: 'session',
            };
        }

        return {
            user: null,
            role: null,
            source: 'none',
        };
    },
};
