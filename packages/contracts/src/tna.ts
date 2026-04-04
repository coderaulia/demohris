import { z } from 'zod';

export const TnaCalculateGapsActionSchema = z.literal('tna/calculate-gaps');
export const TnaSummaryActionSchema = z.literal('tna/summary');
export const TnaGapsReportActionSchema = z.literal('tna/gaps-report');
export const TnaLmsReportActionSchema = z.literal('tna/lms-report');

export const TnaCalculateGapsRequestSchema = z.object({
    employee_id: z.union([z.string(), z.number()]).transform((value: string | number) => String(value)),
    threshold: z.number().int().min(0).default(7),
});

export const TnaCalculateGapsResponseSchema = z
    .object({
        data: z
            .object({
                employee_id: z
                    .union([z.string(), z.number()])
                    .transform((value: string | number) => String(value)),
                position: z.string(),
                gaps: z.array(z.unknown()),
            })
            .passthrough(),
    })
    .passthrough();

export const TnaSummaryRequestSchema = z.object({
    period: z.string().trim().optional(),
});

export const TnaGapsReportRequestSchema = z.object({
    department: z.string().trim().optional(),
});

export const TnaLmsReportRequestSchema = z.object({
    department: z.string().trim().optional(),
});

export const TnaSummaryResponseSchema = z
    .object({
        data: z.object({
            total_needs_identified: z.number(),
            needs_completed: z.number(),
            active_plans: z.number(),
            total_enrollments: z.number(),
            enrollments_completed: z.number(),
            critical_gaps: z.number(),
            high_gaps: z.number(),
        }),
    })
    .passthrough();

export const TnaGapsReportResponseSchema = z
    .object({
        data: z.array(z.unknown()),
    })
    .passthrough();

export const TnaLmsReportResponseSchema = z
    .object({
        data: z
            .object({
                summary: z.unknown(),
                by_course: z.array(z.unknown()),
            })
            .passthrough(),
    })
    .passthrough();

export type TnaCalculateGapsRequest = z.infer<typeof TnaCalculateGapsRequestSchema>;
export type TnaCalculateGapsResponse = z.infer<typeof TnaCalculateGapsResponseSchema>;
export type TnaSummaryRequest = z.infer<typeof TnaSummaryRequestSchema>;
export type TnaSummaryResponse = z.infer<typeof TnaSummaryResponseSchema>;
export type TnaGapsReportRequest = z.infer<typeof TnaGapsReportRequestSchema>;
export type TnaGapsReportResponse = z.infer<typeof TnaGapsReportResponseSchema>;
export type TnaLmsReportRequest = z.infer<typeof TnaLmsReportRequestSchema>;
export type TnaLmsReportResponse = z.infer<typeof TnaLmsReportResponseSchema>;
