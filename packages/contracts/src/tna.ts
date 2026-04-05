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

export const TnaNeedCreateSchema = z.object({
    employee_id: z.string().trim().min(1),
    competency_name: z.string().trim().min(1),
    required_level: z.number(),
    current_level: z.number(),
    priority: z.string().trim().optional(),
    notes: z.string().trim().optional(),
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

export const TnaNeedMutationResponseSchema = z
    .object({
        success: z.literal(true),
        need: z.unknown(),
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
export type TnaNeedCreateInput = z.infer<typeof TnaNeedCreateSchema>;
export type TnaNeedMutationResponse = z.infer<typeof TnaNeedMutationResponseSchema>;

export const TnaCompetenciesListRequestSchema = z.object({
    position_name: z.string().trim().min(1),
});
export const TnaCompetenciesListResponseSchema = z.object({
    success: z.literal(true),
    competencies: z.array(z.unknown()),
});

export const TnaAssessmentCreateRequestSchema = z.object({
    employee_id: z.string().trim().min(1),
    period: z.string().trim().min(1),
    assessments: z.array(z.object({
        competency_name: z.string().trim().min(1),
        manager_score: z.number().min(0).max(5),
        required_level: z.number().min(0).max(5).optional(),
        notes: z.string().trim().optional(),
    })),
});
export const TnaAssessmentCreateResponseSchema = z.object({
    success: z.literal(true),
    needs: z.array(z.unknown()),
});

export const TnaAssessmentSelfSubmitRequestSchema = z.object({
    employee_id: z.string().trim().min(1),
    period: z.string().trim().min(1),
    self_assessments: z.array(z.object({
        need_id: z.string().trim().min(1),
        self_assessment_score: z.number().min(0).max(5),
        self_assessment_notes: z.string().trim().optional(),
    })),
});

export const TnaAssessmentGetRequestSchema = z.object({
    employee_id: z.string().trim().min(1),
    period: z.string().trim().min(1),
});
export const TnaAssessmentGetResponseSchema = z.object({
    success: z.literal(true),
    assessment: z.object({
        employee: z.unknown(),
        period: z.string(),
        competencies: z.array(z.unknown()),
    }),
});

export const TnaAssessmentListRequestSchema = z.object({
    department: z.string().trim().optional(),
    employee_id: z.string().trim().optional(),
    period: z.string().trim().optional(),
    status: z.string().trim().optional(),
});
export const TnaAssessmentListResponseSchema = z.object({
    success: z.literal(true),
    assessments: z.array(z.object({
        employee_id: z.string(),
        employee_name: z.string(),
        period: z.string().nullable(),
        competency_count: z.number(),
        total_gap: z.number(),
        avg_gap: z.number(),
        status: z.string(),
        assessed_at: z.string().nullable(),
    })),
});

export type TnaCompetenciesListRequest = z.infer<typeof TnaCompetenciesListRequestSchema>;
export type TnaCompetenciesListResponse = z.infer<typeof TnaCompetenciesListResponseSchema>;
export type TnaAssessmentCreateRequest = z.infer<typeof TnaAssessmentCreateRequestSchema>;
export type TnaAssessmentCreateResponse = z.infer<typeof TnaAssessmentCreateResponseSchema>;
export type TnaAssessmentSelfSubmitRequest = z.infer<typeof TnaAssessmentSelfSubmitRequestSchema>;
export type TnaAssessmentGetRequest = z.infer<typeof TnaAssessmentGetRequestSchema>;
export type TnaAssessmentGetResponse = z.infer<typeof TnaAssessmentGetResponseSchema>;
export type TnaAssessmentListRequest = z.infer<typeof TnaAssessmentListRequestSchema>;
export type TnaAssessmentListResponse = z.infer<typeof TnaAssessmentListResponseSchema>;
