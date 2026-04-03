import {
    LmsEnrollmentGetResponseSchema,
    LmsEnrollmentListResponseSchema,
    LmsEnrollmentMutationResponseSchema,
    LmsProgressCompleteLessonResponseSchema,
    LmsProgressGetResponseSchema,
    LmsProgressUpdateResponseSchema,
} from '@demo-kpi/contracts';

import { transport } from './transport';

export interface LmsListEnrollmentsInput {
    course_id?: string;
    status?: string;
    page?: number;
    limit?: number;
}

export interface LmsGetEnrollmentInput {
    enrollment_id: string;
}

export interface LmsEnrollInput {
    course_id: string;
    employee_id?: string;
    enrollment_type?: 'self' | 'assigned';
}

export interface LmsProgressGetInput {
    enrollment_id: string;
    lesson_id?: string;
}

export interface LmsProgressUpdateInput {
    enrollment_id: string;
    lesson_id: string;
    progress_percent: number;
    time_spent_seconds?: number;
}

export interface LmsProgressCompleteLessonInput {
    enrollment_id: string;
    lesson_id: string;
}

export const lmsAdapter = {
    listEnrollments(input: LmsListEnrollmentsInput = {}) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/list',
            payload: input,
            schema: LmsEnrollmentListResponseSchema,
        });
    },

    getEnrollment(input: LmsGetEnrollmentInput) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/get',
            payload: input,
            schema: LmsEnrollmentGetResponseSchema,
        });
    },

    enroll(input: LmsEnrollInput) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/enroll',
            payload: input,
            schema: LmsEnrollmentGetResponseSchema,
        });
    },

    unenroll(enrollment_id: string) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/unenroll',
            payload: { enrollment_id },
            schema: LmsEnrollmentMutationResponseSchema,
        });
    },

    getMyCourses(input: LmsListEnrollmentsInput = {}) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/my-courses',
            payload: input,
            schema: LmsEnrollmentListResponseSchema,
        });
    },

    startCourse(course_id: string) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/start',
            payload: { course_id },
            schema: LmsEnrollmentGetResponseSchema,
        });
    },

    completeCourse(enrollment_id: string) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/enrollments/complete',
            payload: { enrollment_id },
            schema: LmsEnrollmentGetResponseSchema,
        });
    },

    getProgress(input: LmsProgressGetInput) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/progress/get',
            payload: input,
            schema: LmsProgressGetResponseSchema,
        });
    },

    updateProgress(input: LmsProgressUpdateInput) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/progress/update',
            payload: input,
            schema: LmsProgressUpdateResponseSchema,
        });
    },

    completeLesson(input: LmsProgressCompleteLessonInput) {
        return transport.execute({
            domain: 'lms',
            action: 'lms/progress/complete-lesson',
            payload: input,
            schema: LmsProgressCompleteLessonResponseSchema,
        });
    },
};
