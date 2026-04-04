import type { ZodTypeAny } from 'zod';

import { env, type BackendTarget } from '@/lib/env';
import { HttpError, requestJson } from '@/lib/httpClient';

type Domain = 'auth' | 'employees' | 'lms' | 'tna' | 'modules' | 'db';
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
    // Modules read cutover.
    'list',
    'get',
    'by-category',
    'active',
    // LMS read cutovers.
    'lms/enrollments/list',
    'lms/enrollments/get',
    'lms/enrollments/my-courses',
    'lms/progress/get',
    'lms/courses/list',
    'lms/courses/get',
    // TNA read cutovers.
    'tna/summary',
    'tna/gaps-report',
    'tna/lms-report',
]);

function buildActionUrl(action: string, domain: Domain): string {
    if (domain === 'modules') {
        const base = env.apiBaseUrl.endsWith('/api') ? `${env.apiBaseUrl}/modules` : '/api/modules';
        const separator = base.includes('?') ? '&' : '?';
        return `${base}${separator}action=${encodeURIComponent(action)}`;
    }
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
    domain: Domain,
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

    const parsed = await requestJson<unknown>(buildActionUrl(action, domain), {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
    });
    return schema.parse(parsed) as TSchema;
}

// Supabase mode is still served through the backend API layer for migrated endpoints.
async function requestSupabase<TSchema>(
    domain: Domain,
    action: string,
    payload: unknown,
    method: RequestMethod,
    schema: ZodTypeAny,
    accessToken?: string
): Promise<TSchema> {
    return requestLegacy(domain, action, payload, method, schema, accessToken);
}

export const transport = {
    async execute<TSchema>(request: AdapterRequest): Promise<TSchema> {
        const source = resolveSource(request.action, env.backendTarget);
        const method = request.method || 'POST';
        if (source === 'supabase') {
            return requestSupabase(request.domain, request.action, request.payload, method, request.schema, request.accessToken);
        }
        return requestLegacy(request.domain, request.action, request.payload, method, request.schema, request.accessToken);
    },
};
