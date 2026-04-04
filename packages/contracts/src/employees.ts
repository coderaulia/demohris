import { z } from 'zod';

import { EmployeeRoleSchema } from './auth';

const NullableStringSchema = z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value: string | number | null | undefined) => {
        if (value === null || value === undefined) return null;
        const trimmed = String(value).trim();
        return trimmed ? trimmed : null;
    });

const NullableNumberSchema = z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value: number | string | null | undefined) => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    });

const BooleanLikeSchema = z
    .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
    .transform((value: boolean | number | string | null | undefined) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        const normalized = String(value || '').trim().toLowerCase();
        return ['1', 'true', 'yes', 'on'].includes(normalized);
    });

export const EmployeeStatusSchema = z.enum(['assessed', 'pending']);

export const EmployeeRecordSchema = z
    .object({
        employee_id: z.union([z.string(), z.number()]).transform((value: string | number) => String(value)),
        name: z.string().trim().default(''),
        position: NullableStringSchema,
        seniority: NullableStringSchema,
        join_date: NullableStringSchema,
        department: NullableStringSchema,
        manager_id: NullableStringSchema,
        auth_email: NullableStringSchema,
        role: EmployeeRoleSchema.catch('employee'),
        percentage: NullableNumberSchema,
        self_percentage: NullableNumberSchema,
        must_change_password: BooleanLikeSchema.default(false),
    })
    .passthrough();

export const EmployeeListResponseSchema = z
    .object({
        employees: z.array(EmployeeRecordSchema),
    })
    .passthrough();

export const EmployeeSummaryCardSchema = z
    .object({
        label: z.string(),
        value: z.string(),
        hint: z.string(),
        deferred: z.boolean().default(false),
    })
    .passthrough();

export const EmployeeDetailSummarySchema = z
    .object({
        assessment: z.array(EmployeeSummaryCardSchema),
        kpi: z.array(EmployeeSummaryCardSchema),
        lms: z.array(EmployeeSummaryCardSchema),
        tna: z.array(EmployeeSummaryCardSchema),
    })
    .passthrough();

export const EmployeeDetailResponseSchema = z
    .object({
        employee: EmployeeRecordSchema,
        manager: EmployeeRecordSchema.nullable(),
        direct_reports: z.number().int().nonnegative(),
        summary: EmployeeDetailSummarySchema,
    })
    .passthrough();

export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;
export type EmployeeListResponse = z.infer<typeof EmployeeListResponseSchema>;
export type EmployeeSummaryCard = z.infer<typeof EmployeeSummaryCardSchema>;
export type EmployeeDetailSummary = z.infer<typeof EmployeeDetailSummarySchema>;
export type EmployeeDetailResponse = z.infer<typeof EmployeeDetailResponseSchema>;

// ─── Employee Insights ───────────────────────────────────────────────────────

export const EmployeeKpiInsightsSchema = z.object({
    latest_score: z.number().nullable(),
    trend: z.enum(['up', 'down', 'flat']).nullable(),
    record_count: z.number().int().nonnegative(),
});

export const EmployeeAssessmentInsightsSchema = z.object({
    gap_level: z.enum(['low', 'medium', 'high']).nullable(),
    last_assessed_at: z.string().nullable(),
    history_count: z.number().int().nonnegative(),
});

export const EmployeeLmsInsightsSchema = z.object({
    enrolled_count: z.number().int().nonnegative(),
    completed_count: z.number().int().nonnegative(),
    completion_pct: z.number().min(0).max(100),
});

export const EmployeeInsightsSchema = z.object({
    success: z.boolean(),
    source: z.enum(['supabase', 'legacy']).optional(),
    insights: z.object({
        kpi: EmployeeKpiInsightsSchema,
        assessment: EmployeeAssessmentInsightsSchema,
        lms: EmployeeLmsInsightsSchema,
    }),
});

export type EmployeeKpiInsights = z.infer<typeof EmployeeKpiInsightsSchema>;
export type EmployeeAssessmentInsights = z.infer<typeof EmployeeAssessmentInsightsSchema>;
export type EmployeeLmsInsights = z.infer<typeof EmployeeLmsInsightsSchema>;
export type EmployeeInsights = z.infer<typeof EmployeeInsightsSchema>;
