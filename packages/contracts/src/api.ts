import { z } from 'zod';

export const ApiErrorSchema = z
    .object({
        error: z
            .object({
                message: z.string(),
                code: z.string().optional(),
                details: z.string().optional(),
            })
            .passthrough(),
    })
    .passthrough();

export const ApiSuccessSchema = z.object({}).passthrough();

export type ApiErrorPayload = z.infer<typeof ApiErrorSchema>;
