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
export type KpiOverview = z.infer<typeof KpiOverviewSchema>;
export type AssessmentOverview = z.infer<typeof AssessmentOverviewSchema>;
