import { z } from 'zod';
import {
    AssessmentOverviewSchema,
    KpiOverviewSchema,
    type AssessmentOverview,
    type EmployeeRole,
    type KpiOverview,
} from '@demo-kpi/contracts';

import { env } from '@/lib/env';
import { getSupabaseSession, supabase } from '@/lib/supabaseClient';
import { employeesAdapter } from './employeesAdapter';
import { tnaAdapter } from './tnaAdapter';
import { transport } from './transport';

type ReadSource = 'legacy' | 'supabase';

interface ReportingFilters {
    department?: string;
    manager_id?: string;
    period?: string;
}

const DbQueryRowsSchema = z
    .object({
        data: z.array(z.unknown()).default([]),
    })
    .passthrough();

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown): string {
    return String(value ?? '').trim();
}

function resolveSource(): ReadSource {
    if (env.backendTarget === 'legacy') return 'legacy';
    if (env.backendTarget === 'supabase') return 'supabase';
    return supabase ? 'supabase' : 'legacy';
}

function currentPeriodKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getAccessToken(): Promise<string> {
    const session = await getSupabaseSession();
    return String(session?.access_token || '');
}

async function queryLegacyTable(
    table: string,
    payload: {
        filters?: Array<Record<string, unknown>>;
        orders?: Array<Record<string, unknown>>;
    } = {},
): Promise<Array<Record<string, unknown>>> {
    const accessToken = await getAccessToken();
    const response = await transport.execute<z.infer<typeof DbQueryRowsSchema>>({
        domain: 'db',
        action: 'db/query',
        payload: {
            action: 'select',
            table,
            filters: payload.filters || [],
            orders: payload.orders || [],
        },
        schema: DbQueryRowsSchema,
        accessToken: accessToken || undefined,
    });
    return (response.data || []) as Array<Record<string, unknown>>;
}

async function fetchKpiRecords(source: ReadSource, period: string): Promise<Array<Record<string, unknown>>> {
    if (source === 'supabase' && supabase) {
        const { data, error } = await supabase
            .from('kpi_records')
            .select('*')
            .eq('period', period);

        if (!error) return (data || []) as Array<Record<string, unknown>>;
        if (env.backendTarget === 'supabase') {
            throw new Error(error.message || 'Failed to read KPI records from Supabase.');
        }
    }

    const filters = period
        ? [{ op: 'eq', column: 'period', value: period }]
        : [];
    return queryLegacyTable('kpi_records', { filters });
}

export const kpiAdapter = {
    async getOverview(
        filters: ReportingFilters = {},
        context: { role: EmployeeRole | null; employeeId: string },
    ): Promise<{ kpi: KpiOverview; assessment: AssessmentOverview }> {
        const source = resolveSource();
        const period = toStringValue(filters.period) || currentPeriodKey();
        const departmentFilter = toStringValue(filters.department);
        const managerFilter = toStringValue(filters.manager_id);
        const deferred: string[] = [];

        const employeesResult = await employeesAdapter.list(
            {
                department: departmentFilter,
                manager_id: managerFilter,
            },
            context,
        );

        const employees = employeesResult.employees.filter(row => toStringValue(row.role || 'employee') === 'employee');
        const employeeById = new Map(employees.map(row => [toStringValue(row.employee_id), row]));
        const groupsByDept = new Map<string, {
            department: string;
            manager: string | null;
            employeeIds: Set<string>;
        }>();

        for (const employee of employees) {
            const department = toStringValue(employee.department) || 'Unassigned';
            const employeeId = toStringValue(employee.employee_id);
            const managerId = toStringValue(employee.manager_id);
            const managerName = managerId ? toStringValue(employeeById.get(managerId)?.name) : '';
            if (!groupsByDept.has(department)) {
                groupsByDept.set(department, {
                    department,
                    manager: managerName || null,
                    employeeIds: new Set<string>(),
                });
            }
            groupsByDept.get(department)!.employeeIds.add(employeeId);
        }

        let kpiRecords: Array<Record<string, unknown>> = [];
        try {
            kpiRecords = await fetchKpiRecords(source, period);
        } catch {
            deferred.push('KPI records source unavailable for selected mode.');
        }

        const recordsByDept = new Map<string, {
            recordCount: number;
            achievementSamples: number[];
            employeesWithRecords: Set<string>;
        }>();

        for (const record of kpiRecords) {
            const employeeId = toStringValue(record.employee_id);
            const employee = employeeById.get(employeeId);
            if (!employee) continue;
            const department = toStringValue(employee.department) || 'Unassigned';

            if (!recordsByDept.has(department)) {
                recordsByDept.set(department, {
                    recordCount: 0,
                    achievementSamples: [],
                    employeesWithRecords: new Set<string>(),
                });
            }

            const bucket = recordsByDept.get(department)!;
            bucket.recordCount += 1;
            bucket.employeesWithRecords.add(employeeId);

            const value = toNumber((record as Record<string, unknown>).value);
            const target = toNumber((record as Record<string, unknown>).target_value ?? (record as Record<string, unknown>).target);
            if (target > 0) {
                bucket.achievementSamples.push((value / target) * 100);
            }
        }

        const kpiGroups = [...groupsByDept.values()]
            .map(group => {
                const recordInfo = recordsByDept.get(group.department);
                const recordCount = recordInfo?.recordCount || 0;
                const employeesWithRecords = recordInfo?.employeesWithRecords.size || 0;
                const avgAchievement = recordInfo && recordInfo.achievementSamples.length > 0
                    ? Math.round((recordInfo.achievementSamples.reduce((sum, n) => sum + n, 0) / recordInfo.achievementSamples.length) * 10) / 10
                    : null;

                return {
                    key: group.department,
                    department: group.department,
                    manager: group.manager,
                    employee_count: group.employeeIds.size,
                    record_count: recordCount,
                    missing_count: Math.max(0, group.employeeIds.size - employeesWithRecords),
                    avg_achievement: avgAchievement,
                };
            })
            .sort((a, b) => a.department.localeCompare(b.department));

        if (!kpiGroups.some(row => row.avg_achievement !== null)) {
            deferred.push('KPI achievement percentage deferred: target fields are not consistently available.');
        }

        const kpiCards = [
            { label: 'Employees In Scope', value: String(employees.length), hint: 'Employees after role and filter scope' },
            { label: 'KPI Records (Period)', value: String(kpiRecords.length), hint: `Period ${period}` },
            {
                label: 'Employees Missing KPI',
                value: String(kpiGroups.reduce((sum, row) => sum + row.missing_count, 0)),
                hint: 'Employees with no KPI records in selected period',
            },
            {
                label: 'Average Achievement',
                value: (() => {
                    const vals = kpiGroups.map(row => row.avg_achievement).filter((n): n is number => n !== null);
                    if (vals.length === 0) return 'Deferred';
                    return `${Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10}%`;
                })(),
                hint: 'Computed only when value/target are available',
                deferred: !kpiGroups.some(row => row.avg_achievement !== null),
            },
        ];

        const gapsResponse = (await tnaAdapter.gapsReport(
            departmentFilter ? { department: departmentFilter } : {},
        )) as { data?: unknown[] };
        const gapsRows = Array.isArray(gapsResponse.data) ? (gapsResponse.data as Array<Record<string, unknown>>) : [];
        const tnaSummaryResponse = (await tnaAdapter.summary(period ? { period } : {})) as { data?: Record<string, unknown> };
        const tnaSummary = (tnaSummaryResponse.data || {}) as Record<string, unknown>;

        const assessmentByDept = new Map<string, {
            recordCount: number;
            critical: number;
            high: number;
            employeesWithRecords: Set<string>;
        }>();

        for (const row of gapsRows) {
            const department = toStringValue((row as Record<string, unknown>).department) || 'Unassigned';
            const employeeId = toStringValue((row as Record<string, unknown>).employee_id);
            const priority = toStringValue((row as Record<string, unknown>).priority).toLowerCase();
            if (!assessmentByDept.has(department)) {
                assessmentByDept.set(department, {
                    recordCount: 0,
                    critical: 0,
                    high: 0,
                    employeesWithRecords: new Set<string>(),
                });
            }
            const bucket = assessmentByDept.get(department)!;
            bucket.recordCount += 1;
            bucket.employeesWithRecords.add(employeeId);
            if (priority === 'critical') bucket.critical += 1;
            if (priority === 'high') bucket.high += 1;
        }

        const assessmentGroups = [...groupsByDept.values()]
            .map(group => {
                const row = assessmentByDept.get(group.department);
                const recordCount = row?.recordCount || 0;
                const employeesWithRecords = row?.employeesWithRecords.size || 0;
                return {
                    key: group.department,
                    department: group.department,
                    manager: group.manager,
                    employee_count: group.employeeIds.size,
                    record_count: recordCount,
                    missing_count: Math.max(0, group.employeeIds.size - employeesWithRecords),
                    avg_achievement: null,
                    critical_count: row?.critical || 0,
                    high_count: row?.high || 0,
                };
            })
            .sort((a, b) => a.department.localeCompare(b.department));

        const assessmentCards = [
            { label: 'Needs Identified', value: String(toNumber(tnaSummary.total_needs_identified)), hint: 'From verified TNA summary endpoint' },
            { label: 'Needs Completed', value: String(toNumber(tnaSummary.needs_completed)), hint: 'Completed training needs' },
            { label: 'Critical Gaps', value: String(toNumber(tnaSummary.critical_gaps)), hint: 'Critical-priority needs' },
            {
                label: 'Employees Missing Assessment',
                value: String(assessmentGroups.reduce((sum, row) => sum + row.missing_count, 0)),
                hint: 'Employees without visible TNA gap records',
            },
        ];

        return {
            kpi: KpiOverviewSchema.parse({
                source: employeesResult.source,
                deferred: [...deferred, ...employeesResult.deferred],
                cards: kpiCards,
                groups: kpiGroups,
            }),
            assessment: AssessmentOverviewSchema.parse({
                source: employeesResult.source,
                deferred: employeesResult.deferred,
                cards: assessmentCards,
                groups: assessmentGroups,
            }),
        };
    },
};

export type { ReportingFilters };
