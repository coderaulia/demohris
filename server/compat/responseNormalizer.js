export function normalizeAuthSessionResponse(profile = null) {
    return {
        profile: profile || null,
    };
}

export function normalizeErrorResponse(error) {
    return {
        error: {
            message: error?.message || 'Internal server error',
            code: error?.code || 'SERVER_ERROR',
            details: error?.details || '',
        },
    };
}

