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

import { getSupabaseSession } from '@/lib/supabaseClient';
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

async function getAuthAccessToken(): Promise<string> {
    const session = await getSupabaseSession();
    return String(session?.access_token || '');
}

export const employeesAdapter = {
    async list(
        filters: EmployeeListFilters = {},
        _context?: { role: EmployeeRole | null; employeeId: string },
    ): Promise<EmployeeListResponse> {
        const accessToken = await getAuthAccessToken();
        return transport.execute<EmployeeListResponse>({
            domain: 'employees',
            action: 'employees/list',
            payload: filters,
            schema: EmployeeListResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async getEmployee(employeeId: string): Promise<EmployeeRecord | null> {
        const accessToken = await getAuthAccessToken();
        const response = await transport.execute<EmployeeMutationResponse>({
            domain: 'employees',
            action: 'employees/get',
            payload: { employee_id: employeeId },
            schema: EmployeeMutationResponseSchema,
            accessToken: accessToken || undefined,
        });
        return EmployeeRecordSchema.parse(response.employee);
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
            const department = String(employee.department || '').trim();
            const managerId = String(employee.manager_id || '').trim();
            const role = String(employee.role || '').trim();
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
