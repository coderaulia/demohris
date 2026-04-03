import { z } from 'zod';

export const EmployeeRoleSchema = z.enum([
    'employee',
    'manager',
    'hr',
    'superadmin',
    'director',
]);

export const AuthProfileSchema = z
    .object({
        employee_id: z.union([z.string(), z.number()]).transform((value: string | number) => String(value)),
        role: EmployeeRoleSchema,
        auth_email: z.string().email().or(z.literal('')).optional().default(''),
    })
    .passthrough();

export const AuthLoginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const AuthLoginResponseSchema = z
    .object({
        profile: AuthProfileSchema,
    })
    .passthrough();

export const AuthSessionResponseSchema = z
    .object({
        profile: AuthProfileSchema.nullable(),
    })
    .passthrough();

export const AuthLogoutResponseSchema = z
    .object({
        ok: z.boolean(),
    })
    .passthrough();

export type EmployeeRole = z.infer<typeof EmployeeRoleSchema>;
export type AuthProfile = z.infer<typeof AuthProfileSchema>;
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type AuthLogoutResponse = z.infer<typeof AuthLogoutResponseSchema>;
