import type { ZodTypeAny } from 'zod';

import { env, type BackendTarget } from '@/lib/env';
import { HttpError, requestJson } from '@/lib/httpClient';

type Domain = 'auth' | 'lms' | 'tna';
type RequestMethod = 'GET' | 'POST';
type TransportSource = 'legacy' | 'supabase';

export interface AdapterRequest {
    domain: Domain;
    action: string;
    payload?: unknown;
    method?: RequestMethod;
    schema: ZodTypeAny;
    accessToken?: string;
}

const SUPABASE_ACTIONS = new Set<string>([
    // Intentionally empty in this slice.
    // Supabase live auth is handled directly in authAdapter.
]);

function buildLegacyActionUrl(action: string): string {
    const base = env.apiBaseUrl;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}action=${encodeURIComponent(action)}`;
}

function resolveSource(action: string, target: BackendTarget): TransportSource {
    if (target === 'legacy') return 'legacy';
    if (target === 'supabase') {
        if (!SUPABASE_ACTIONS.has(action)) {
            throw new HttpError(
                `Action "${action}" is not enabled in Supabase live mode.`,
                501,
                'ACTION_NOT_LIVE',
                'This action is still on legacy backend and must be feature-flagged off in production.'
            );
        }
        return 'supabase';
    }
    return SUPABASE_ACTIONS.has(action) ? 'supabase' : 'legacy';
}

async function requestLegacy<TSchema>(
    action: string,
    payload: unknown,
    method: RequestMethod,
    schema: ZodTypeAny,
    accessToken?: string
): Promise<TSchema> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const parsed = await requestJson<unknown>(buildLegacyActionUrl(action), {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
    });
    return schema.parse(parsed) as TSchema;
}

// Supabase mode must not silently call legacy endpoints.
async function requestSupabase<TSchema>(
    action: string,
    _payload: unknown,
    _method: RequestMethod,
    _schema: ZodTypeAny,
    _accessToken?: string
): Promise<TSchema> {
    throw new HttpError(
        `Action "${action}" is not implemented in the Supabase transport adapter.`,
        501,
        'SUPABASE_ADAPTER_MISSING'
    );
}

export const transport = {
    async execute<TSchema>(request: AdapterRequest): Promise<TSchema> {
        const source = resolveSource(request.action, env.backendTarget);
        const method = request.method || 'POST';
        if (source === 'supabase') {
            return requestSupabase(request.action, request.payload, method, request.schema, request.accessToken);
        }
        return requestLegacy(request.action, request.payload, method, request.schema, request.accessToken);
    },
};
