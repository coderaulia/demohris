import { z } from 'zod';

export const TnaCalculateGapsActionSchema = z.literal('tna/calculate-gaps');

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

export type TnaCalculateGapsRequest = z.infer<typeof TnaCalculateGapsRequestSchema>;
export type TnaCalculateGapsResponse = z.infer<typeof TnaCalculateGapsResponseSchema>;
