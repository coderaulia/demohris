function resolveApiBaseUrl() {
    const raw = String(import.meta.env.VITE_API_BASE_URL || '/api').trim();
    return raw || '/api';
}

function buildActionUrl(action) {
    const base = resolveApiBaseUrl();
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}action=${encodeURIComponent(action)}`;
}

function createApiError(payload, status = 500) {
    const message = payload?.error?.message || payload?.message || 'Request failed.';
    const error = new Error(message);
    error.status = status;
    error.code = payload?.error?.code || '';
    error.details = payload?.error?.details || payload?.details || '';
    return error;
}

async function parseResponse(response) {
    const text = await response.text();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        if (response.ok) return { data: text };
        throw createApiError({ error: { message: text || 'Request failed.' } }, response.status);
    }
}

async function apiRequest(action, payload = {}, options = {}) {
    const method = String(options.method || 'POST').toUpperCase();
    const response = await fetch(buildActionUrl(action), {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
    });

    const parsed = await parseResponse(response);
    if (!response.ok || parsed?.error) {
        throw createApiError(parsed, response.status);
    }

    return parsed;
}

class QueryBuilder {
    constructor(table) {
        this.table = table;
        this.state = {
            action: 'select',
            columns: '*',
            filters: [],
            orders: [],
            limit: null,
            data: null,
            onConflict: '',
            returning: false,
            single: false,
            maybeSingle: false,
        };
    }

    select(columns = '*') {
        this.state.columns = columns;
        if (this.state.action !== 'select') {
            this.state.returning = true;
        }
        return this;
    }

    order(column, { ascending = false } = {}) {
        this.state.orders.push({
            column,
            ascending: Boolean(ascending),
        });
        return this;
    }

    limit(value) {
        const parsed = Number(value);
        this.state.limit = Number.isFinite(parsed) ? parsed : null;
        return this;
    }

    eq(column, value) {
        this.state.filters.push({ op: 'eq', column, value });
        return this;
    }

    in(column, values = []) {
        this.state.filters.push({ op: 'in', column, values: Array.isArray(values) ? values : [] });
        return this;
    }

    insert(data) {
        this.state.action = 'insert';
        this.state.data = data;
        return this;
    }

    upsert(data, { onConflict = '' } = {}) {
        this.state.action = 'upsert';
        this.state.data = data;
        this.state.onConflict = onConflict;
        return this;
    }

    update(data) {
        this.state.action = 'update';
        this.state.data = data;
        return this;
    }

    delete() {
        this.state.action = 'delete';
        this.state.data = null;
        return this;
    }

    single() {
        this.state.single = true;
        this.state.maybeSingle = false;
        return this;
    }

    maybeSingle() {
        this.state.single = true;
        this.state.maybeSingle = true;
        return this;
    }

    async execute() {
        const payload = {
            table: this.table,
            action: this.state.action,
            columns: this.state.columns,
            filters: this.state.filters,
            orders: this.state.orders,
            limit: this.state.limit,
            data: this.state.data,
            onConflict: this.state.onConflict,
            returning: this.state.returning,
        };

        const response = await apiRequest('db/query', payload);
        let data = response?.data ?? null;

        if (this.state.single) {
            const rows = Array.isArray(data) ? data : (data == null ? [] : [data]);
            if (rows.length === 0) {
                if (this.state.maybeSingle) {
                    data = null;
                } else {
                    throw createApiError({ error: { message: 'Expected a single row, but no rows were returned.', code: 'PGRST116' } }, 406);
                }
            } else if (rows.length > 1) {
                throw createApiError({ error: { message: 'Expected a single row, but multiple rows were returned.', code: 'PGRST116' } }, 406);
            } else {
                data = rows[0];
            }
        }

        return { data, error: null };
    }

    then(resolve, reject) {
        return this.execute().then(resolve, reject);
    }
}

export const supabase = {
    from(table) {
        return new QueryBuilder(table);
    },
};

export {
    apiRequest,
};

