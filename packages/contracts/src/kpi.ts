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
