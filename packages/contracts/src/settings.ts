import { z } from 'zod';

const NullableStringSchema = z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
        if (value === null || value === undefined) return null;
        const trimmed = String(value).trim();
        return trimmed ? trimmed : null;
    });

export const DepartmentSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1),
}).passthrough();

export const PositionLiteSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1),
    department_id: NullableStringSchema,
}).passthrough();

export const CompetencyRowSchema = z.object({
    name: z.string().trim().min(1),
    level: z.coerce.number().min(1).max(5),
}).passthrough();

export const PositionMatrixSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1),
    department_id: NullableStringSchema,
    department_name: NullableStringSchema.optional(),
    competencies: z.array(CompetencyRowSchema).default([]),
}).passthrough();

export const OrgDepartmentSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1),
    positions: z.array(PositionLiteSchema).default([]),
}).passthrough();

export const OrgSettingsResponseSchema = z.object({
    success: z.literal(true),
    org_settings: z.object({
        seniority_levels: z.array(z.string()).default([]),
    }),
    departments: z.array(OrgDepartmentSchema).default([]),
}).passthrough();

export const OrgSettingsSaveSchema = z.object({
    seniority_levels: z.array(z.string().trim().min(1)).default([]),
    departments: z.array(z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1),
        positions: z.array(z.object({
            id: z.string().optional(),
            name: z.string().trim().min(1),
        })).default([]),
    })).default([]),
});

export const PositionListResponseSchema = z.object({
    success: z.literal(true),
    positions: z.array(PositionLiteSchema).default([]),
}).passthrough();

export const PositionCreateSchema = z.object({
    name: z.string().trim().min(1),
    department_id: NullableStringSchema.optional(),
});

export const PositionUpdateSchema = z.object({
    position_id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    department_id: NullableStringSchema.optional(),
});

export const PositionMutationResponseSchema = z.object({
    success: z.literal(true),
    position: PositionLiteSchema,
}).passthrough();

export const CompetenciesListResponseSchema = z.object({
    success: z.literal(true),
    positions: z.array(PositionMatrixSchema).default([]),
}).passthrough();

export const CompetencyMatrixCreateSchema = z.object({
    name: z.string().trim().min(1),
    department_id: NullableStringSchema.optional(),
    competencies: z.array(CompetencyRowSchema).default([]),
});

export const CompetencyMatrixUpdateSchema = z.object({
    position_id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    department_id: NullableStringSchema.optional(),
    competencies: z.array(CompetencyRowSchema).default([]),
});

export const CompetencyMatrixMutationResponseSchema = z.object({
    success: z.literal(true),
    position: PositionMatrixSchema,
}).passthrough();

export type Department = z.infer<typeof DepartmentSchema>;
export type PositionLite = z.infer<typeof PositionLiteSchema>;
export type CompetencyRow = z.infer<typeof CompetencyRowSchema>;
export type PositionMatrix = z.infer<typeof PositionMatrixSchema>;
export type OrgDepartment = z.infer<typeof OrgDepartmentSchema>;
export type OrgSettingsResponse = z.infer<typeof OrgSettingsResponseSchema>;
export type OrgSettingsSaveInput = z.infer<typeof OrgSettingsSaveSchema>;
export type PositionListResponse = z.infer<typeof PositionListResponseSchema>;
export type PositionCreateInput = z.infer<typeof PositionCreateSchema>;
export type PositionUpdateInput = z.infer<typeof PositionUpdateSchema>;
export type PositionMutationResponse = z.infer<typeof PositionMutationResponseSchema>;
export type CompetenciesListResponse = z.infer<typeof CompetenciesListResponseSchema>;
export type CompetencyMatrixCreateInput = z.infer<typeof CompetencyMatrixCreateSchema>;
export type CompetencyMatrixUpdateInput = z.infer<typeof CompetencyMatrixUpdateSchema>;
export type CompetencyMatrixMutationResponse = z.infer<typeof CompetencyMatrixMutationResponseSchema>;
