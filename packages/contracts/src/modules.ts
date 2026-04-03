import { z } from 'zod';

export const ModuleActionSchema = z.enum([
    'list',
    'get',
    'update',
    'toggle',
    'activity',
    'by-category',
    'active',
]);

export const ModuleListResponseSchema = z
    .object({
        success: z.boolean(),
        modules: z.array(z.unknown()),
    })
    .passthrough();

export const ModuleGetResponseSchema = z
    .object({
        success: z.boolean(),
        module: z.unknown(),
    })
    .passthrough();

export const ModuleUpdateResponseSchema = z
    .object({
        success: z.boolean(),
    })
    .passthrough();

export const ModuleToggleResponseSchema = z
    .object({
        success: z.boolean(),
        module: z.unknown(),
    })
    .passthrough();

export const ModuleActivityResponseSchema = z
    .object({
        success: z.boolean(),
        activity: z.array(z.unknown()),
    })
    .passthrough();

export const ModuleByCategoryResponseSchema = z
    .object({
        success: z.boolean(),
        modules: z.array(z.unknown()),
    })
    .passthrough();

export const ModuleActiveResponseSchema = z
    .object({
        success: z.boolean(),
        modules: z.array(z.unknown()),
    })
    .passthrough();

export type ModuleAction = z.infer<typeof ModuleActionSchema>;
