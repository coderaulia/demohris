export class HttpError extends Error {
    status: number;
    code: string;
    details: string;
    payload: unknown;

    constructor(message: string, status: number, code = '', details = '', payload: unknown = null) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.payload = payload;
    }
}

async function parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { message: text };
    }
}

export async function requestJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
    const response = await fetch(input, {
        credentials: 'include',
        ...init,
    });

    const payload = await parseJson(response);
    const maybeError = (payload as { error?: { message?: string; code?: string; details?: string }; message?: string }) || {};
    if (!response.ok || maybeError.error) {
        const message = maybeError.error?.message || maybeError.message || 'Request failed.';
        throw new HttpError(
            message,
            response.status,
            maybeError.error?.code || '',
            maybeError.error?.details || '',
            payload
        );
    }

    return payload as T;
}
