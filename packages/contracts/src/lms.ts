import { z } from 'zod';

export const LmsEnrollmentActionSchema = z.enum([
    'lms/enrollments/list',
    'lms/enrollments/get',
    'lms/enrollments/enroll',
    'lms/enrollments/unenroll',
    'lms/enrollments/my-courses',
    'lms/enrollments/start',
    'lms/enrollments/complete',
]);

export const LmsProgressActionSchema = z.enum([
    'lms/progress/get',
    'lms/progress/update',
    'lms/progress/complete-lesson',
]);

export const LmsEnrollmentListResponseSchema = z
    .object({
        success: z.boolean(),
        enrollments: z.array(z.unknown()),
    })
    .passthrough();

export const LmsEnrollmentGetResponseSchema = z
    .object({
        success: z.boolean(),
        enrollment: z.unknown().nullable(),
    })
    .passthrough();

export const LmsEnrollmentMutationResponseSchema = z
    .object({
        success: z.boolean(),
    })
    .passthrough();

export const LmsProgressGetResponseSchema = z
    .object({
        success: z.boolean(),
        progress: z.unknown(),
    })
    .passthrough();

export const LmsProgressUpdateResponseSchema = z
    .object({
        success: z.boolean(),
    })
    .passthrough();

export const LmsProgressCompleteLessonResponseSchema = z
    .object({
        success: z.boolean(),
        enrollment: z.unknown(),
    })
    .passthrough();

export type LmsEnrollmentAction = z.infer<typeof LmsEnrollmentActionSchema>;
export type LmsProgressAction = z.infer<typeof LmsProgressActionSchema>;
export type LmsEnrollmentListResponse = z.infer<typeof LmsEnrollmentListResponseSchema>;
export type LmsEnrollmentGetResponse = z.infer<typeof LmsEnrollmentGetResponseSchema>;
export type LmsEnrollmentMutationResponse = z.infer<typeof LmsEnrollmentMutationResponseSchema>;
export type LmsProgressGetResponse = z.infer<typeof LmsProgressGetResponseSchema>;
export type LmsProgressUpdateResponse = z.infer<typeof LmsProgressUpdateResponseSchema>;
export type LmsProgressCompleteLessonResponse = z.infer<typeof LmsProgressCompleteLessonResponseSchema>;
