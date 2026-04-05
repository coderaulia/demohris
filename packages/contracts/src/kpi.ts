import { z } from 'zod';

export const KpiSummaryCardSchema = z
    .object({
        label: z.string(),
        value: z.string(),
        hint: z.string(),
        deferred: z.boolean().default(false),
    })
    .passthrough();

export const KpiGroupRowSchema = z
    .object({
        key: z.string(),
        department: z.string(),
        manager: z.string().nullable(),
        employee_count: z.number().int().nonnegative(),
        record_count: z.number().int().nonnegative(),
        missing_count: z.number().int().nonnegative(),
        avg_achievement: z.number().nullable(),
        critical_count: z.number().int().nonnegative().optional(),
        high_count: z.number().int().nonnegative().optional(),
    })
    .passthrough();

export const KpiReportingSummaryRowSchema = z
    .object({
        department: z.string(),
        manager: z.string().nullable(),
        employee_count: z.number().int().nonnegative(),
        record_count: z.number().int().nonnegative(),
        met_count: z.number().int().nonnegative(),
        not_met_count: z.number().int().nonnegative(),
        avg_score: z.number().nullable(),
        missing_count: z.number().int().nonnegative(),
    })
    .passthrough();

export const KpiReportingSummaryResponseSchema = z
    .object({
        success: z.literal(true),
        source: z.enum(['legacy', 'supabase']),
        period: z.string().nullable(),
        department: z.string().nullable(),
        rows: z.array(KpiReportingSummaryRowSchema),
    })
    .passthrough();

export const KpiRecordSchema = z
    .object({
        id: z.string(),
        employee_id: z.string(),
        kpi_id: z.string(),
        period: z.string(),
        value: z.number().or(z.string()).transform(value => Number(value)),
        notes: z.string().nullable().optional(),
        target_snapshot: z.unknown().optional().nullable(),
        submitted_by: z.string().nullable().optional(),
        submitted_at: z.string().nullable().optional(),
        updated_by: z.string().nullable().optional(),
    })
    .passthrough();

export const KpiRecordCreateSchema = z.object({
    employee_id: z.string().trim().min(1),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/),
    score: z.number().optional(),
    actual_value: z.number().optional(),
    target_value: z.number().optional(),
    notes: z.string().trim().optional(),
    kpi_id: z.string().trim().optional(),
});

export const KpiRecordUpdateSchema = z.object({
    record_id: z.string().trim().min(1),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
    score: z.number().optional(),
    actual_value: z.number().optional(),
    target_value: z.number().optional(),
    notes: z.string().trim().optional(),
    kpi_id: z.string().trim().optional(),
});

export const KpiRecordMutationResponseSchema = z
    .object({
        success: z.literal(true),
        record: KpiRecordSchema,
    })
    .passthrough();

export const KpiOverviewSchema = z
    .object({
        source: z.enum(['legacy', 'supabase']),
        deferred: z.array(z.string()),
        cards: z.array(KpiSummaryCardSchema),
        groups: z.array(KpiGroupRowSchema),
    })
    .passthrough();

export const AssessmentOverviewSchema = z
    .object({
        source: z.enum(['legacy', 'supabase']),
        deferred: z.array(z.string()),
        cards: z.array(KpiSummaryCardSchema),
        groups: z.array(KpiGroupRowSchema),
    })
    .passthrough();

export type KpiSummaryCard = z.infer<typeof KpiSummaryCardSchema>;
export type KpiGroupRow = z.infer<typeof KpiGroupRowSchema>;
export type KpiReportingSummaryRow = z.infer<typeof KpiReportingSummaryRowSchema>;
export type KpiReportingSummaryResponse = z.infer<typeof KpiReportingSummaryResponseSchema>;
export type KpiRecord = z.infer<typeof KpiRecordSchema>;
export type KpiRecordCreateInput = z.infer<typeof KpiRecordCreateSchema>;
export type KpiRecordUpdateInput = z.infer<typeof KpiRecordUpdateSchema>;
export type KpiRecordMutationResponse = z.infer<typeof KpiRecordMutationResponseSchema>;
export type KpiOverview = z.infer<typeof KpiOverviewSchema>;
export type AssessmentOverview = z.infer<typeof AssessmentOverviewSchema>;

// ==================================================
// KPI DEFINITIONS
// ==================================================

export const KpiDefinitionSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    formula: z.string().nullable().optional(),
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
    updated_at: z.string().nullable().optional(),
}).passthrough();

export const KpiDefinitionCreateSchema = z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    formula: z.string().trim().optional(),
    unit: z.string().trim().default('%'),
    kpi_type: z.enum(['direct', 'ratio']).default('direct'),
    applies_to_position: z.string().trim().optional(),
    target_value: z.number().optional(),
    effective_date: z.string().trim().min(1),
    change_note: z.string().trim().optional(),
});

export const KpiDefinitionUpdateSchema = z.object({
    definition_id: z.string().trim().min(1),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    formula: z.string().trim().optional(),
    unit: z.string().trim().optional(),
    kpi_type: z.enum(['direct', 'ratio']).optional(),
    applies_to_position: z.string().trim().optional(),
    target_value: z.number().optional(),
    effective_date: z.string().trim().optional(),
    change_note: z.string().trim().optional(),
    status: z.enum(['approved', 'pending', 'rejected', 'archived']).optional(),
});

export const KpiDefinitionsListResponseSchema = z.object({
    success: z.literal(true),
    definitions: z.record(z.string(), z.array(KpiDefinitionSchema)),
});

// ==================================================
// KPI TARGETS
// ==================================================

export const KpiTargetSchema = z.object({
    kpi_definition_id: z.string(),
    kpi_name: z.string(),
    unit: z.string(),
    target_value: z.number(),
    source: z.enum(['personal', 'default']),
});

export const KpiTargetGetSchema = z.object({
    employee_id: z.string().trim().min(1),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/),
});

export const KpiTargetSetSchema = z.object({
    employee_id: z.string().trim().min(1),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/),
    targets: z.array(z.object({
        kpi_definition_id: z.string().trim().min(1),
        target_value: z.number(),
    })).min(1),
});

export const KpiTargetsResponseSchema = z.object({
    success: z.literal(true),
    targets: z.array(KpiTargetSchema),
});

// ==================================================
// KPI GOVERNANCE
// ==================================================

export const KpiGovernanceSchema = z.object({
    require_hr_approval: z.boolean(),
});

// ==================================================
// KPI RECORDS (ENHANCED)
// ==================================================

export const KpiRecordEnrichedSchema = z.object({
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
}).passthrough();

export const KpiRecordCreateInputSchema = z.object({
    employee_id: z.string().trim().min(1),
    kpi_definition_id: z.string().trim().min(1),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/),
    numerator: z.number().optional(),
    denominator: z.number().optional(),
    actual_value: z.number().optional(),
    score: z.number().optional(),
    notes: z.string().trim().optional(),
});

export const KpiRecordsListResponseSchema = z.object({
    success: z.literal(true),
    records: z.array(KpiRecordEnrichedSchema),
});

// ==================================================
// KPI DEPARTMENT SUMMARY
// ==================================================

export const KpiEmployeeKpiSchema = z.object({
    kpi_name: z.string(),
    target: z.number().nullable(),
    actual: z.number(),
    achievement_pct: z.number().nullable(),
    status: z.enum(['on_track', 'at_risk', 'below_target']),
    unit: z.string(),
});

export const KpiDepartmentEmployeeSchema = z.object({
    employee_id: z.string(),
    name: z.string(),
    position: z.string(),
    kpi_group: z.string(),
    has_record: z.boolean(),
    avg_achievement: z.number().nullable(),
    kpis: z.array(KpiEmployeeKpiSchema),
});

export const KpiSixMonthTrendSchema = z.object({
    month: z.string(),
    avg_achievement: z.number(),
});

export const KpiDepartmentSummarySchema = z.object({
    success: z.literal(true),
    department: z.string(),
    period: z.string().nullable(),
    total_employees: z.number().int().nonnegative(),
    employees_with_records: z.number().int().nonnegative(),
    employees_without_records: z.number().int().nonnegative(),
    active_kpis: z.number().int().nonnegative(),
    overall_achievement_pct: z.number(),
    six_month_trend: z.array(KpiSixMonthTrendSchema),
    employees: z.array(KpiDepartmentEmployeeSchema),
});

// ==================================================
// KPI VERSION HISTORY
// ==================================================

export const KpiVersionHistoryItemSchema = z.object({
    type: z.enum(['created', 'updated', 'deleted']),
    scope: z.string(),
    effective: z.string(),
    version: z.number().int().positive(),
    status: z.string(),
    value: z.number().nullable(),
    change_note: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
});

export const KpiVersionHistoryResponseSchema = z.object({
    success: z.literal(true),
    history: z.array(KpiVersionHistoryItemSchema),
});

// ==================================================
// TYPE EXPORTS
// ==================================================

export type KpiDefinition = z.infer<typeof KpiDefinitionSchema>;
export type KpiDefinitionCreateInput = z.infer<typeof KpiDefinitionCreateSchema>;
export type KpiDefinitionUpdateInput = z.infer<typeof KpiDefinitionUpdateSchema>;
export type KpiDefinitionsListResponse = z.infer<typeof KpiDefinitionsListResponseSchema>;
export type KpiTarget = z.infer<typeof KpiTargetSchema>;
export type KpiTargetGetInput = z.infer<typeof KpiTargetGetSchema>;
export type KpiTargetSetInput = z.infer<typeof KpiTargetSetSchema>;
export type KpiTargetsResponse = z.infer<typeof KpiTargetsResponseSchema>;
export type KpiGovernance = z.infer<typeof KpiGovernanceSchema>;
export type KpiRecordEnriched = z.infer<typeof KpiRecordEnrichedSchema>;
export type KpiRecordCreateInput = z.infer<typeof KpiRecordCreateInputSchema>;
export type KpiRecordsListResponse = z.infer<typeof KpiRecordsListResponseSchema>;
export type KpiEmployeeKpi = z.infer<typeof KpiEmployeeKpiSchema>;
export type KpiDepartmentEmployee = z.infer<typeof KpiDepartmentEmployeeSchema>;
export type KpiSixMonthTrend = z.infer<typeof KpiSixMonthTrendSchema>;
export type KpiDepartmentSummary = z.infer<typeof KpiDepartmentSummarySchema>;
export type KpiVersionHistoryItem = z.infer<typeof KpiVersionHistoryItemSchema>;
export type KpiVersionHistoryResponse = z.infer<typeof KpiVersionHistoryResponseSchema>;
