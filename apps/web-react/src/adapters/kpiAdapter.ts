import { z } from 'zod';
import {
    AssessmentOverviewSchema,
    KpiRecordCreateSchema,
    KpiRecordMutationResponseSchema,
    KpiRecordUpdateSchema,
    KpiOverviewSchema,
    type AssessmentOverview,
    type EmployeeRole,
    type KpiRecordCreateInput,
    type KpiRecordMutationResponse,
    type KpiOverview,
    type KpiRecordUpdateInput,
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

const KpiReportingSummaryResponseSchema = z
    .object({
        source: z.enum(['legacy', 'supabase']),
        period: z.string().nullable().optional(),
        department: z.string().nullable().optional(),
        rows: z.array(z.object({
            department: z.string(),
            manager: z.string().nullable().optional(),
            employee_count: z.number().int().nonnegative(),
            record_count: z.number().int().nonnegative(),
            met_count: z.number().int().nonnegative().optional(),
            not_met_count: z.number().int().nonnegative().optional(),
            avg_score: z.number().nullable().optional(),
            missing_count: z.number().int().nonnegative(),
        }).passthrough()),
    })
    .passthrough();

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown): string {
    return String(value ?? '').trim();
}

function makeCard(label: string, value: string, hint: string) {
    return {
        label,
        value,
        hint,
        deferred: false,
    };
}

function resolveSource(): ReadSource {
    if (env.backendTarget === 'legacy') return 'legacy';
    if (env.backendTarget === 'supabase') return 'supabase';
    return supabase ? 'supabase' : 'legacy';
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

async function fetchKpiReportingSummary(filters: ReportingFilters = {}) {
    const accessToken = await getAccessToken();
    return transport.execute<z.infer<typeof KpiReportingSummaryResponseSchema>>({
        domain: 'kpi',
        action: 'kpi/reporting-summary',
        payload: filters,
        method: 'POST',
        schema: KpiReportingSummaryResponseSchema,
        accessToken: accessToken || undefined,
    });
}

export const kpiAdapter = {
    async createRecord(input: KpiRecordCreateInput): Promise<KpiRecordMutationResponse> {
        const accessToken = await getAccessToken();
        return transport.execute<KpiRecordMutationResponse>({
            domain: 'kpi',
            action: 'kpi/record/create',
            payload: KpiRecordCreateSchema.parse(input),
            schema: KpiRecordMutationResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async updateRecord(input: KpiRecordUpdateInput): Promise<KpiRecordMutationResponse> {
        const accessToken = await getAccessToken();
        return transport.execute<KpiRecordMutationResponse>({
            domain: 'kpi',
            action: 'kpi/record/update',
            payload: KpiRecordUpdateSchema.parse(input),
            schema: KpiRecordMutationResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async listRecords(filters: { employee_id?: string; period?: string; kpi_definition_id?: string } = {}) {
        const accessToken = await getAccessToken();
        const KpiRecordsListResponseSchema = z.object({
            success: z.literal(true),
            records: z.array(z.object({
                id: z.string(),
                employee_id: z.string(),
                employee_name: z.string(),
                department: z.string(),
                position: z.string(),
                kpi_id: z.string(),
                kpi_name: z.string(),
                period: z.string(),
                value: z.number(),
                actual_value: z.number(),
                target_value: z.number().nullable(),
                achievement_pct: z.number().nullable(),
                unit: z.string(),
                notes: z.string().nullable().optional(),
                updated_by: z.string().nullable().optional(),
                updated_by_name: z.string().nullable().optional(),
                updated_at: z.string().nullable().optional(),
                submitted_by: z.string().nullable().optional(),
                submitted_at: z.string().nullable().optional(),
            }).passthrough()),
        });
        return transport.execute<z.infer<typeof KpiRecordsListResponseSchema>>({
            domain: 'kpi',
            action: 'kpi/records/list',
            payload: filters,
            method: 'POST',
            schema: KpiRecordsListResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async deleteRecord(recordId: string) {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/record/delete',
            payload: { record_id: recordId },
            method: 'POST',
            schema: z.object({ success: z.literal(true) }),
            accessToken: accessToken || undefined,
        });
    },

    async getDepartmentSummary(department: string, period?: string) {
        const accessToken = await getAccessToken();
        const KpiDepartmentSummarySchema = z.object({
            success: z.literal(true),
            department: z.string(),
            period: z.string().nullable(),
            total_employees: z.number().int().nonnegative(),
            employees_with_records: z.number().int().nonnegative(),
            employees_without_records: z.number().int().nonnegative(),
            active_kpis: z.number().int().nonnegative(),
            overall_achievement_pct: z.number(),
            six_month_trend: z.array(z.object({
                month: z.string(),
                avg_achievement: z.number(),
            })),
            employees: z.array(z.object({
                employee_id: z.string(),
                name: z.string(),
                position: z.string(),
                kpi_group: z.string(),
                has_record: z.boolean(),
                avg_achievement: z.number().nullable(),
                kpis: z.array(z.object({
                    kpi_name: z.string(),
                    target: z.number().nullable(),
                    actual: z.number(),
                    achievement_pct: z.number().nullable(),
                    status: z.enum(['on_track', 'at_risk', 'below_target']),
                    unit: z.string(),
                })),
            })),
        });
        return transport.execute<z.infer<typeof KpiDepartmentSummarySchema>>({
            domain: 'kpi',
            action: 'kpi/department-summary',
            payload: { department, period: period || undefined },
            method: 'POST',
            schema: KpiDepartmentSummarySchema,
            accessToken: accessToken || undefined,
        });
    },

    async getDefinitions(filters: { applies_to_position?: string } = {}) {
        const accessToken = await getAccessToken();
        const KpiDefinitionsListResponseSchema = z.object({
            success: z.literal(true),
            definitions: z.record(z.string(), z.array(z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().nullable().optional(),
                unit: z.string().default('%'),
                kpi_type: z.enum(['direct', 'ratio']).default('direct'),
                applies_to_position: z.string().nullable().optional(),
                target_value: z.number().nullable().optional(),
                effective_date: z.string(),
                version: z.number().int().positive().default(1),
                status: z.enum(['approved', 'pending', 'rejected', 'archived']).default('approved'),
                created_by: z.string().nullable().optional(),
                change_note: z.string().nullable().optional(),
                created_at: z.string().nullable().optional(),
            }).passthrough())),
        });
        return transport.execute<z.infer<typeof KpiDefinitionsListResponseSchema>>({
            domain: 'kpi',
            action: 'kpi/definitions/list',
            payload: filters,
            method: 'POST',
            schema: KpiDefinitionsListResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async createDefinition(input: { name: string; description?: string; unit?: string; kpi_type?: string; applies_to_position?: string; target_value?: number; effective_date: string; change_note?: string }) {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/definitions/create',
            payload: input,
            method: 'POST',
            schema: z.object({ success: z.literal(true), definition: z.unknown() }),
            accessToken: accessToken || undefined,
        });
    },

    async getTargets(employeeId: string, period: string) {
        const accessToken = await getAccessToken();
        const KpiTargetsResponseSchema = z.object({
            success: z.literal(true),
            targets: z.array(z.object({
                kpi_definition_id: z.string(),
                kpi_name: z.string(),
                unit: z.string(),
                target_value: z.number(),
                source: z.enum(['personal', 'default']),
            })),
        });
        return transport.execute<z.infer<typeof KpiTargetsResponseSchema>>({
            domain: 'kpi',
            action: 'kpi/targets/get',
            payload: { employee_id: employeeId, period },
            method: 'POST',
            schema: KpiTargetsResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async getGovernance() {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/governance/get',
            payload: {},
            method: 'POST',
            schema: z.object({ success: z.literal(true), require_hr_approval: z.boolean() }),
            accessToken: accessToken || undefined,
        });
    },

    async setGovernance(requireHrApproval: boolean) {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/governance/set',
            payload: { require_hr_approval: requireHrApproval },
            method: 'POST',
            schema: z.object({ success: z.literal(true), require_hr_approval: z.boolean() }),
            accessToken: accessToken || undefined,
        });
    },

    async getVersionHistory(kpiDefinitionId?: string, limit = 50) {
        const accessToken = await getAccessToken();
        const KpiVersionHistoryResponseSchema = z.object({
            success: z.literal(true),
            history: z.array(z.object({
                type: z.enum(['created', 'updated', 'deleted']),
                scope: z.string(),
                effective: z.string(),
                version: z.number().int().positive(),
                status: z.string(),
                value: z.number().nullable(),
                change_note: z.string().nullable().optional(),
                created_by: z.string().nullable().optional(),
                created_at: z.string().nullable().optional(),
            })),
        });
        return transport.execute<z.infer<typeof KpiVersionHistoryResponseSchema>>({
            domain: 'kpi',
            action: 'kpi/version-history',
            payload: { kpi_definition_id: kpiDefinitionId || undefined, limit },
            method: 'POST',
            schema: KpiVersionHistoryResponseSchema,
            accessToken: accessToken || undefined,
        });
    },

    async setTargets(employeeId: string, period: string, targets: Array<{ kpi_definition_id: string; target_value: number }>) {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/targets/set',
            payload: { employee_id: employeeId, period, targets },
            method: 'POST',
            schema: z.object({ success: z.literal(true), targets: z.array(z.unknown()) }),
            accessToken: accessToken || undefined,
        });
    },

    async getPendingApprovals() {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/approvals/list',
            payload: {},
            method: 'POST',
            schema: z.object({ success: z.literal(true), pending: z.array(z.unknown()) }),
            accessToken: accessToken || undefined,
        });
    },

    async approveDefinition(definitionId: string) {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/approvals/approve',
            payload: { definition_id: definitionId },
            method: 'POST',
            schema: z.object({ success: z.literal(true) }),
            accessToken: accessToken || undefined,
        });
    },

    async rejectDefinition(definitionId: string) {
        const accessToken = await getAccessToken();
        return transport.execute({
            domain: 'kpi',
            action: 'kpi/approvals/reject',
            payload: { definition_id: definitionId },
            method: 'POST',
            schema: z.object({ success: z.literal(true) }),
            accessToken: accessToken || undefined,
        });
    },

    async getOverview(
        filters: ReportingFilters = {},
        context: { role: EmployeeRole | null; employeeId: string },
    ): Promise<{ kpi: KpiOverview; assessment: AssessmentOverview }> {
        const source = resolveSource();
        const period = toStringValue(filters.period);
        let departmentFilter = toStringValue(filters.department);
        const managerFilter = toStringValue(filters.manager_id);

        const employeesResult = await employeesAdapter.list(
            {
                department: departmentFilter,
                manager_id: managerFilter,
            },
            context,
        );

        const selfEmployee = employeesResult.employees.find(
            row => toStringValue(row.employee_id) === toStringValue(context.employeeId),
        );
        const managerDepartment = context.role === 'manager'
            ? toStringValue(selfEmployee?.department)
            : '';

        if (context.role === 'manager' && !departmentFilter && managerDepartment) {
            departmentFilter = managerDepartment;
        }

        const employees = employeesResult.employees.filter(row => {
            if (toStringValue(row.role || 'employee') !== 'employee') return false;
            if (departmentFilter && toStringValue(row.department) !== departmentFilter) return false;
            return true;
        });
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

        let kpiSource = employeesResult.source;
        let kpiDeferred = [...employeesResult.deferred];
        let kpiGroups: Array<z.infer<typeof KpiOverviewSchema>['groups'][number]> = [];
        let kpiCards: Array<z.infer<typeof KpiOverviewSchema>['cards'][number]> = [];

        try {
            const summary = await fetchKpiReportingSummary({
                department: departmentFilter,
                manager_id: managerFilter,
                period,
            });

            kpiSource = summary.source;
            kpiGroups = summary.rows
                .map(row => ({
                    key: row.department,
                    department: row.department,
                    manager: row.manager ?? null,
                    employee_count: row.employee_count,
                    record_count: row.record_count,
                    missing_count: row.missing_count,
                    avg_achievement: row.avg_score ?? null,
                }))
                .sort((a, b) => a.department.localeCompare(b.department));

            const avgScores = kpiGroups
                .map(row => row.avg_achievement)
                .filter((value): value is number => value !== null);

            kpiCards = [
                makeCard('Employees In Scope', String(kpiGroups.reduce((sum, row) => sum + row.employee_count, 0)), 'Employees after role and filter scope'),
                makeCard('KPI Records (Period)', String(kpiGroups.reduce((sum, row) => sum + row.record_count, 0)), period ? `Period ${period}` : 'All available periods'),
                makeCard(
                    'Employees Missing KPI',
                    String(kpiGroups.reduce((sum, row) => sum + row.missing_count, 0)),
                    'Employees with no KPI records in selected period',
                ),
                makeCard(
                    'Average Achievement',
                    avgScores.length > 0
                        ? `${Math.round((avgScores.reduce((sum, value) => sum + value, 0) / avgScores.length) * 10) / 10}%`
                        : 'No data',
                    avgScores.length > 0 ? 'Computed from kpi/reporting-summary' : 'No scored KPI records for selected scope',
                ),
            ];
        } catch {
            let kpiRecords: Array<Record<string, unknown>> = [];
            try {
                kpiRecords = await fetchKpiRecords(source, period);
            } catch {
                kpiDeferred.push('KPI records source unavailable for selected mode.');
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

            kpiGroups = [...groupsByDept.values()]
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
                kpiDeferred.push('KPI achievement percentage deferred: target fields are not consistently available.');
            }

            kpiCards = [
                makeCard('Employees In Scope', String(employees.length), 'Employees after role and filter scope'),
                makeCard('KPI Records (Period)', String(kpiRecords.length), period ? `Period ${period}` : 'All available periods'),
                makeCard(
                    'Employees Missing KPI',
                    String(kpiGroups.reduce((sum, row) => sum + row.missing_count, 0)),
                    'Employees with no KPI records in selected period',
                ),
                makeCard(
                    'Average Achievement',
                    (() => {
                        const vals = kpiGroups.map(row => row.avg_achievement).filter((n): n is number => n !== null);
                        if (vals.length === 0) return 'No data';
                        return `${Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10}%`;
                    })(),
                    kpiGroups.some(row => row.avg_achievement !== null)
                        ? 'Computed only when value/target are available'
                        : 'No KPI achievement values are available for this scope',
                ),
            ];
        }

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
            makeCard('Needs Identified', String(toNumber(tnaSummary.total_needs_identified)), 'From verified TNA summary endpoint'),
            makeCard('Needs Completed', String(toNumber(tnaSummary.needs_completed)), 'Completed training needs'),
            makeCard('Critical Gaps', String(toNumber(tnaSummary.critical_gaps)), 'Critical-priority needs'),
            makeCard(
                'Employees Missing Assessment',
                String(assessmentGroups.reduce((sum, row) => sum + row.missing_count, 0)),
                'Employees without visible TNA gap records',
            ),
        ];

        return {
            kpi: KpiOverviewSchema.parse({
                source: kpiSource,
                deferred: kpiDeferred,
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
