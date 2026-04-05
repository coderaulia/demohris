import {
    EmployeeCreateSchema,
    EmployeeDirectoryStatusSchema,
    EmployeeListResponseSchema,
    EmployeeMutationResponseSchema,
    EmployeeRecordSchema,
    EmployeeInsightsSchema,
    type EmployeeCreateInput,
    type EmployeeDirectoryStatus,
    type EmployeeInsights,
    type EmployeeListResponse,
    type EmployeeMutationResponse,
    type EmployeeRecord,
    type EmployeeRole,
    type EmployeeUpdateInput,
} from '@demo-kpi/contracts';

import { env } from '@/lib/env';
import { getSupabaseSession, supabase } from '@/lib/supabaseClient';
import { transport } from './transport';

export interface EmployeeListFilters {
    search?: string;
    department?: string;
    role?: string;
    manager_id?: string;
    status?: EmployeeDirectoryStatus | '';
    page?: number;
    limit?: number;
}

function normalizeString(value: unknown): string {
    return String(value || '').trim();
}

function buildSearchIndex(row: EmployeeRecord) {
    return [row.employee_id, row.name, row.email, row.auth_email, row.department, row.position]
        .map(value => String(value || '').toLowerCase())
        .join(' ');
}

function enforceClientScope(rows: EmployeeRecord[], context: { role: EmployeeRole | null; employeeId: string }): EmployeeRecord[] {
    const currentId = normalizeString(context.employeeId);
    if (!currentId) return rows;

    if (context.role === 'employee') {
        return rows.filter(row => normalizeString(row.employee_id) === currentId);
    }

    if (context.role === 'manager') {
        return rows.filter(row => normalizeString(row.manager_id) === currentId);
    }

    return rows;
}

function applyListFilters(rows: EmployeeRecord[], filters: EmployeeListFilters): EmployeeRecord[] {
    const search = normalizeString(filters.search).toLowerCase();
    const department = normalizeString(filters.department).toLowerCase();
    const role = normalizeString(filters.role).toLowerCase();
    const managerId = normalizeString(filters.manager_id);
    const status = normalizeString(filters.status).toLowerCase();

    return rows.filter(row => {
        if (department && normalizeString(row.department).toLowerCase() !== department) return false;
        if (role && normalizeString(row.role).toLowerCase() !== role) return false;
        if (managerId && normalizeString(row.manager_id) !== managerId) return false;
        if (status && normalizeString(row.status || 'active').toLowerCase() !== status) return false;
        if (search && !buildSearchIndex(row).includes(search)) return false;
        return true;
    });
}

async function getAuthAccessToken(): Promise<string> {
    const session = await getSupabaseSession();
    return String(session?.access_token || '');
}

async function fetchSupabaseEmployees(): Promise<EmployeeRecord[]> {
    if (!supabase) {
        throw new Error('Supabase client is not configured for Employees reads.');
    }

    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        throw new Error(error.message || 'Failed to load employees from Supabase.');
    }

    return (data || [])
        .map(row => EmployeeRecordSchema.safeParse(row))
        .filter(result => result.success)
        .map(result => result.data);
}

export const employeesAdapter = {
    async list(
        filters: EmployeeListFilters = {},
        context: { role: EmployeeRole | null; employeeId: string } = { role: null, employeeId: '' },
    ): Promise<EmployeeListResponse> {
        const accessToken = await getAuthAccessToken();

        try {
            const response = await transport.execute<EmployeeListResponse>({
                domain: 'employees',
                action: 'employees/list',
                payload: filters,
                schema: EmployeeListResponseSchema,
                accessToken: accessToken || undefined,
            });
            return EmployeeListResponseSchema.parse(response);
        } catch (error) {
            if (env.backendTarget === 'legacy') {
                throw error;
            }

            const rows = await fetchSupabaseEmployees();
            const scoped = enforceClientScope(rows, context);
            const filtered = applyListFilters(scoped, filters);
            const page = Math.max(1, Number(filters.page || 1));
            const limit = Math.max(1, Number(filters.limit || filtered.length || 100));
            const start = (page - 1) * limit;

            return EmployeeListResponseSchema.parse({
                success: true,
                source: 'supabase',
                deferred: ['Backend employees/list unavailable; fell back to direct Supabase read.'],
                employees: filtered.slice(start, start + limit),
                total: filtered.length,
                page,
            });
        }
    },

    async getEmployee(
        employeeId: string,
        context: { role: EmployeeRole | null; employeeId: string } = { role: null, employeeId: '' },
    ): Promise<EmployeeRecord | null> {
        const accessToken = await getAuthAccessToken();
        try {
            const response = await transport.execute<EmployeeMutationResponse>({
                domain: 'employees',
                action: 'employees/get',
                payload: { employee_id: employeeId },
                schema: EmployeeMutationResponseSchema,
                accessToken: accessToken || undefined,
            });
            return EmployeeRecordSchema.parse(response.employee);
        } catch (error) {
            if (env.backendTarget === 'legacy') {
                throw error;
            }
            const rows = await fetchSupabaseEmployees();
            const scoped = enforceClientScope(rows, context);
            return scoped.find(row => normalizeString(row.employee_id) === normalizeString(employeeId)) || null;
        }
    },

    async create(input: EmployeeCreateInput): Promise<EmployeeMutationResponse> {
        const accessToken = await getAuthAccessToken();
        return transport.execute<EmployeeMutationResponse>({
            domain: 'employees',
            action: 'employees/create',
            payload: EmployeeCreateSchema.parse(input),
            schema: EmployeeMutationResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async update(input: EmployeeUpdateInput): Promise<EmployeeMutationResponse> {
        const accessToken = await getAuthAccessToken();
        return transport.execute<EmployeeMutationResponse>({
            domain: 'employees',
            action: 'employees/update',
            payload: input,
            schema: EmployeeMutationResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async toggleStatus(employeeId: string, status: EmployeeDirectoryStatus): Promise<EmployeeMutationResponse> {
        const accessToken = await getAuthAccessToken();
        return transport.execute<EmployeeMutationResponse>({
            domain: 'employees',
            action: 'employees/toggle-status',
            payload: { employee_id: employeeId, status: EmployeeDirectoryStatusSchema.parse(status) },
            schema: EmployeeMutationResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async fetchInsights(employeeId: string): Promise<EmployeeInsights> {
        const accessToken = await getAuthAccessToken();
        return transport.execute<EmployeeInsights>({
            domain: 'employees',
            action: 'employees/insights',
            payload: { employee_id: employeeId },
            schema: EmployeeInsightsSchema,
            accessToken: accessToken || undefined,
        });
    },

    getFilterOptions(employees: EmployeeRecord[]) {
        const departments = new Set<string>();
        const managerIds = new Set<string>();
        const roles = new Set<string>();

        for (const employee of employees) {
            const department = normalizeString(employee.department);
            const managerId = normalizeString(employee.manager_id);
            const role = normalizeString(employee.role);
            if (department) departments.add(department);
            if (managerId) managerIds.add(managerId);
            if (role) roles.add(role);
        }

        const managerOptions = [...managerIds]
            .map(managerId => {
                const manager = employees.find(row => String(row.employee_id) === managerId);
                return {
                    value: managerId,
                    label: manager ? `${manager.name} (${manager.employee_id})` : managerId,
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        return {
            departments: [...departments].sort((a, b) => a.localeCompare(b)),
            roles: [...roles].sort((a, b) => a.localeCompare(b)),
            managers: managerOptions,
            status: EmployeeDirectoryStatusSchema.options,
        };
    },
};

export type { EmployeeCreateInput, EmployeeDirectoryStatus, EmployeeListResponse, EmployeeRecord, EmployeeRole, EmployeeUpdateInput };
