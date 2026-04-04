import { z } from 'zod';

import {
    EmployeeDetailResponseSchema,
    EmployeeListResponseSchema,
    EmployeeRecordSchema,
    EmployeeStatusSchema,
    type EmployeeDetailResponse,
    type EmployeeRecord,
    type EmployeeRole,
    type EmployeeStatus,
} from '@demo-kpi/contracts';

import { env } from '@/lib/env';
import { getSupabaseSession, supabase } from '@/lib/supabaseClient';
import { lmsAdapter } from './lmsAdapter';
import { transport } from './transport';

type EmployeeReadSource = 'legacy' | 'supabase';

interface EmployeeListFilters {
    search?: string;
    department?: string;
    role?: string;
    manager_id?: string;
    status?: EmployeeStatus | '';
}

interface EmployeeListResult {
    source: EmployeeReadSource;
    deferred: string[];
    employees: EmployeeRecord[];
}

const DbQueryRowsSchema = z
    .object({
        data: z.array(z.unknown()).default([]),
    })
    .passthrough();

function toNullableString(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    return raw ? raw : null;
}

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function toObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return {};
        }
    }
    return {};
}

function toEmployeeRows(rows: unknown[]): EmployeeRecord[] {
    return rows
        .map(row => EmployeeRecordSchema.safeParse(row))
        .filter(result => result.success)
        .map(result => result.data)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function resolveReadSource(): EmployeeReadSource {
    if (env.backendTarget === 'legacy') return 'legacy';
    if (env.backendTarget === 'supabase') return 'supabase';
    return supabase ? 'supabase' : 'legacy';
}

async function getAuthAccessToken(): Promise<string> {
    const session = await getSupabaseSession();
    return String(session?.access_token || '');
}

async function queryLegacyTable(
    table: string,
    options: {
        filters?: Array<Record<string, unknown>>;
        orders?: Array<Record<string, unknown>>;
        limit?: number;
    } = {}
): Promise<unknown[]> {
    const accessToken = await getAuthAccessToken();
    const response = await transport.execute<z.infer<typeof DbQueryRowsSchema>>({
        domain: 'db',
        action: 'db/query',
        payload: {
            action: 'select',
            table,
            filters: options.filters || [],
            orders: options.orders || [],
            limit: options.limit || null,
        },
        schema: DbQueryRowsSchema,
        accessToken: accessToken || undefined,
    });
    return response.data || [];
}

async function fetchLegacyEmployees(): Promise<EmployeeRecord[]> {
    const rows = await queryLegacyTable('employees', {
        orders: [{ column: 'name', ascending: true }],
    });
    return toEmployeeRows(rows);
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

    return toEmployeeRows(data || []);
}

function applyListFilters(rows: EmployeeRecord[], filters: EmployeeListFilters): EmployeeRecord[] {
    const search = String(filters.search || '').trim().toLowerCase();
    const department = String(filters.department || '').trim().toLowerCase();
    const role = String(filters.role || '').trim().toLowerCase();
    const managerId = String(filters.manager_id || '').trim();
    const status = String(filters.status || '').trim().toLowerCase();

    return rows.filter(row => {
        const assessed = toNumber(row.percentage) > 0 || toNumber(row.self_percentage) > 0;
        const rowStatus: EmployeeStatus = assessed ? 'assessed' : 'pending';
        const rowDepartment = String(row.department || '').trim().toLowerCase();
        const rowRole = String(row.role || '').trim().toLowerCase();
        const rowManagerId = String(row.manager_id || '').trim();

        if (department && rowDepartment !== department) return false;
        if (role && rowRole !== role) return false;
        if (managerId && rowManagerId !== managerId) return false;
        if (status && status !== rowStatus) return false;
        if (!search) return true;

        const searchFields = [
            row.employee_id,
            row.name,
            row.auth_email,
            row.position,
            row.department,
        ]
            .map(value => String(value || '').toLowerCase());

        return searchFields.some(value => value.includes(search));
    });
}

function enforceClientScope(rows: EmployeeRecord[], context: { role: EmployeeRole | null; employeeId: string }): EmployeeRecord[] {
    const currentId = String(context.employeeId || '').trim();
    if (!currentId) return rows;

    if (context.role === 'employee') {
        return rows.filter(row => String(row.employee_id) === currentId);
    }

    if (context.role === 'manager') {
        return rows.filter(row => {
            const employeeId = String(row.employee_id || '');
            const managerId = String(row.manager_id || '');
            return employeeId === currentId || managerId === currentId;
        });
    }

    return rows;
}

async function fetchLmsSummary(
    source: EmployeeReadSource,
    employeeId: string,
    authEmployeeId: string
): Promise<Array<{ label: string; value: string; hint: string; deferred?: boolean }>> {
    if (source === 'supabase' && supabase) {
        const { data, error } = await supabase
            .from('course_enrollments')
            .select('status')
            .eq('employee_id', employeeId);

        if (!error) {
            const rows = data || [];
            const completed = rows.filter(row => String(row.status || '').toLowerCase() === 'completed').length;
            const inProgress = rows.filter(row => String(row.status || '').toLowerCase() === 'in_progress').length;
            const completionPct = rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0;
            return [
                { label: 'Total Enrollments', value: String(rows.length), hint: 'All LMS enrollments for employee' },
                { label: 'Completed', value: String(completed), hint: 'Completion status in LMS' },
                { label: 'Completion %', value: rows.length > 0 ? `${completionPct}%` : 'No data', hint: rows.length > 0 ? `In Progress: ${inProgress}` : 'No LMS enrollments yet' },
            ];
        }
    }

    if (authEmployeeId && authEmployeeId === employeeId) {
        try {
            const response = (await lmsAdapter.getMyCourses({ page: 1, limit: 200 })) as { enrollments?: unknown[] };
            const rows = Array.isArray(response.enrollments) ? response.enrollments : [];
            const completed = rows.filter((row: unknown) => String((row as Record<string, unknown>).status || '').toLowerCase() === 'completed').length;
            const inProgress = rows.filter((row: unknown) => String((row as Record<string, unknown>).status || '').toLowerCase() === 'in_progress').length;
            const completionPct = rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0;
            return [
                { label: 'Total Enrollments', value: String(rows.length), hint: 'Current user LMS enrollments' },
                { label: 'Completed', value: String(completed), hint: 'Completion status in LMS' },
                { label: 'Completion %', value: rows.length > 0 ? `${completionPct}%` : 'No data', hint: rows.length > 0 ? `In Progress: ${inProgress}` : 'No LMS enrollments yet' },
            ];
        } catch {
            // Fall through to deferred cards.
        }
    }

    return [
        { label: 'Total Enrollments', value: 'Deferred', hint: 'Requires employee-scoped LMS endpoint', deferred: true },
        { label: 'Completed', value: 'Deferred', hint: 'Not exposed for cross-employee read in legacy path', deferred: true },
        { label: 'Completion %', value: 'Deferred', hint: 'Not exposed for cross-employee read in legacy path', deferred: true },
    ];
}

async function fetchTnaSummary(
    source: EmployeeReadSource,
    employeeId: string
): Promise<Array<{ label: string; value: string; hint: string; deferred?: boolean }>> {
    if (source === 'supabase' && supabase) {
        const { data, error } = await supabase
            .from('training_need_records')
            .select('status,priority')
            .eq('employee_id', employeeId);

        if (!error) {
            const rows = data || [];
            const completed = rows.filter(row => ['completed', 'closed'].includes(String(row.status || '').toLowerCase())).length;
            const critical = rows.filter(row => String(row.priority || '').toLowerCase() === 'critical').length;
            const avgGap = (() => {
                const values = rows
                    .map(row => Number((row as Record<string, unknown>).gap_level))
                    .filter(value => Number.isFinite(value));
                if (values.length === 0) return null;
                return values.reduce((sum, value) => sum + value, 0) / values.length;
            })();
            const gapLevel = avgGap === null ? 'No data' : avgGap >= 3 ? 'High' : avgGap >= 1.5 ? 'Medium' : 'Low';
            return [
                { label: 'Gap Level', value: gapLevel, hint: avgGap === null ? 'No TNA records yet' : `Avg gap: ${avgGap.toFixed(2)}` },
                { label: 'Need Records', value: String(rows.length), hint: 'Total identified TNA needs' },
                { label: 'Critical Gaps', value: String(critical), hint: `Completed needs: ${completed}` },
            ];
        }
    }

    return [
        { label: 'Gap Level', value: 'Deferred', hint: 'Employee-scoped TNA read pending', deferred: true },
        { label: 'Need Records', value: 'Deferred', hint: 'Employee-scoped TNA read pending', deferred: true },
        { label: 'Critical Gaps', value: 'Deferred', hint: 'Employee-scoped TNA read pending', deferred: true },
    ];
}

async function fetchKpiRecordCount(source: EmployeeReadSource, employeeId: string): Promise<number | null> {
    try {
        if (source === 'supabase' && supabase) {
            const { count, error } = await supabase
                .from('kpi_records')
                .select('*', { count: 'exact', head: true })
                .eq('employee_id', employeeId);
            if (!error) return Number(count || 0);
            return null;
        }

        const rows = await queryLegacyTable('kpi_records', {
            filters: [{ op: 'eq', column: 'employee_id', value: employeeId }],
        });
        return rows.length;
    } catch {
        return null;
    }
}

function parsePeriodKey(value: unknown): number {
    const raw = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})$/.exec(raw);
    if (!match) return 0;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
    return year * 100 + month;
}

async function fetchKpiTrendSummary(
    source: EmployeeReadSource,
    employeeId: string
): Promise<Array<{ label: string; value: string; hint: string; deferred?: boolean }>> {
    try {
        let rows: Array<Record<string, unknown>> = [];

        if (source === 'supabase' && supabase) {
            const { data, error } = await supabase
                .from('kpi_records')
                .select('period,value,target_value,created_at')
                .eq('employee_id', employeeId);
            if (!error) {
                rows = (data || []) as Array<Record<string, unknown>>;
            }
        } else {
            rows = (await queryLegacyTable('kpi_records', {
                filters: [{ op: 'eq', column: 'employee_id', value: employeeId }],
            })) as Array<Record<string, unknown>>;
        }

        const ranked = rows
            .slice()
            .sort((a, b) => {
                const periodDiff = parsePeriodKey(b.period) - parsePeriodKey(a.period);
                if (periodDiff !== 0) return periodDiff;
                return String(b.created_at || '').localeCompare(String(a.created_at || ''));
            });

        if (ranked.length === 0) {
            return [
                { label: 'Latest KPI', value: 'No data', hint: 'No KPI records available for this employee' },
                { label: 'KPI Trend', value: 'No trend', hint: 'Need at least two KPI periods' },
                { label: 'KPI Records', value: '0', hint: 'Stored KPI records' },
            ];
        }

        const latest = ranked[0];
        const latestValue = Number(latest.value);
        const latestTarget = Number(latest.target_value);
        const latestKpi = Number.isFinite(latestTarget) && latestTarget > 0 && Number.isFinite(latestValue)
            ? `${((latestValue / latestTarget) * 100).toFixed(1)}%`
            : Number.isFinite(latestValue)
                ? latestValue.toFixed(1)
                : 'No data';

        const scored = ranked
            .map(row => {
                const value = Number(row.value);
                const target = Number(row.target_value);
                if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return null;
                return (value / target) * 100;
            })
            .filter((value): value is number => value !== null);

        const trendValue = (() => {
            if (scored.length < 2) return 'No trend';
            const recent = scored.slice(0, Math.min(3, scored.length));
            const prior = scored.slice(Math.min(3, scored.length), Math.min(6, scored.length));
            if (prior.length === 0) return 'No trend';
            const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
            const priorAvg = prior.reduce((sum, value) => sum + value, 0) / prior.length;
            const diff = recentAvg - priorAvg;
            if (Math.abs(diff) < 0.5) return 'Stable';
            return diff > 0 ? 'Up' : 'Down';
        })();

        return [
            { label: 'Latest KPI', value: latestKpi, hint: `Period ${String(latest.period || '-')}` },
            { label: 'KPI Trend', value: trendValue, hint: 'Recent periods versus prior periods' },
            { label: 'KPI Records', value: String(ranked.length), hint: 'Stored KPI records' },
        ];
    } catch {
        return [
            { label: 'Latest KPI', value: 'Deferred', hint: 'KPI summary read is pending', deferred: true },
            { label: 'KPI Trend', value: 'Deferred', hint: 'KPI summary read is pending', deferred: true },
            { label: 'KPI Records', value: 'Deferred', hint: 'KPI summary read is pending', deferred: true },
        ];
    }
}

export const employeesAdapter = {
    async list(
        filters: EmployeeListFilters = {},
        context: { role: EmployeeRole | null; employeeId: string } = { role: null, employeeId: '' }
    ): Promise<EmployeeListResult> {
        const preferredSource = resolveReadSource();

        let source = preferredSource;
        let rows: EmployeeRecord[] = [];
        const deferred: string[] = [];

        if (preferredSource === 'supabase') {
            try {
                rows = await fetchSupabaseEmployees();
            } catch (error) {
                if (env.backendTarget === 'supabase') {
                    throw error;
                }
                rows = await fetchLegacyEmployees();
                source = 'legacy';
                deferred.push('Supabase employee read fallback to legacy db/query.');
            }
        } else {
            rows = await fetchLegacyEmployees();
        }

        const scoped = enforceClientScope(rows, context);
        const filtered = applyListFilters(scoped, filters);
        const parsed = EmployeeListResponseSchema.parse({ employees: filtered });

        return {
            source,
            deferred,
            employees: parsed.employees,
        };
    },

    async getDetail(
        employeeId: string,
        context: { role: EmployeeRole | null; employeeId: string } = { role: null, employeeId: '' }
    ): Promise<EmployeeDetailResponse | null> {
        const directory = await this.list({}, context);
        const employee = directory.employees.find(row => String(row.employee_id) === String(employeeId));
        if (!employee) return null;

        const manager = directory.employees.find(row => String(row.employee_id) === String(employee.manager_id || '')) || null;
        const directReports = directory.employees.filter(row => String(row.manager_id || '') === String(employee.employee_id)).length;

        const historyEntries = toArray((employee as Record<string, unknown>).history).length;
        const kpiTargetCount = Object.keys(toObject((employee as Record<string, unknown>).kpi_targets)).length;
        const kpiRecordCount = await fetchKpiRecordCount(directory.source, String(employee.employee_id));
        const kpiTrendCards = await fetchKpiTrendSummary(directory.source, String(employee.employee_id));
        const lastAssessmentDate = (() => {
            const direct = String((employee as Record<string, unknown>).assessment_updated_at || '').trim();
            if (direct) return direct;
            return null;
        })();

        const [lmsCards, tnaCards] = await Promise.all([
            fetchLmsSummary(directory.source, String(employee.employee_id), context.employeeId),
            fetchTnaSummary(directory.source, String(employee.employee_id)),
        ]);

        return EmployeeDetailResponseSchema.parse({
            employee,
            manager,
            direct_reports: directReports,
            summary: {
                assessment: [
                    ...tnaCards,
                    {
                        label: 'Last Assessment',
                        value: lastAssessmentDate ? new Date(lastAssessmentDate).toLocaleDateString() : 'No data',
                        hint: lastAssessmentDate ? 'Latest manager assessment timestamp' : 'No assessment timestamp recorded',
                    },
                    { label: 'History Entries', value: String(historyEntries), hint: 'Assessment history snapshots' },
                ],
                kpi: [
                    ...kpiTrendCards,
                    { label: 'KPI Targets', value: String(kpiTargetCount), hint: 'Configured KPI targets' },
                    {
                        label: 'KPI Record Count',
                        value: kpiRecordCount === null ? 'Deferred' : String(kpiRecordCount),
                        hint: kpiRecordCount === null ? 'KPI records endpoint still being cut over' : 'Stored KPI records',
                        deferred: kpiRecordCount === null,
                    },
                ],
                lms: lmsCards,
                tna: tnaCards,
            },
        });
    },

    getFilterOptions(employees: EmployeeRecord[]) {
        const departments = new Set<string>();
        const managerIds = new Set<string>();
        const roles = new Set<string>();

        for (const employee of employees) {
            const department = toNullableString(employee.department);
            const managerId = toNullableString(employee.manager_id);
            const role = toNullableString(employee.role);
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
            status: EmployeeStatusSchema.options,
        };
    },
};

export type { EmployeeListFilters, EmployeeListResult };
