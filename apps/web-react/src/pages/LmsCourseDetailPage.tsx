import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, ListChecks } from 'lucide-react';

import { lmsAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[];
}

function progressText(value: unknown): string {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0%';
    return `${Math.round(parsed)}%`;
}

export function LmsCourseDetailPage() {
    const { courseId } = useParams();
    const decodedCourseId = useMemo(() => decodeURIComponent(String(courseId || '')), [courseId]);

    const courseQuery = useQuery({
        queryKey: ['lms', 'course-detail', decodedCourseId],
        queryFn: () => lmsAdapter.getCourse({ course_id: decodedCourseId }),
        enabled: Boolean(decodedCourseId),
        staleTime: 30_000,
    });

    const myCoursesQuery = useQuery({
        queryKey: ['lms', 'my-courses-for-detail'],
        queryFn: () => lmsAdapter.getMyCourses({ page: 1, limit: 200 }),
        staleTime: 30_000,
    });

    const course = toRecord(toRecord(courseQuery.data).course);
    const myEnrollmentFromCourse = toRecord(course.my_enrollment);
    const myEnrollments = toRecordArray(toRecord(myCoursesQuery.data).enrollments);
    const enrollmentFromList = myEnrollments.find(row => String(row.course_id || '') === decodedCourseId) || null;
    const enrollment = enrollmentFromList || (Object.keys(myEnrollmentFromCourse).length > 0 ? myEnrollmentFromCourse : null);
    const enrollmentId = String(enrollment?.id || '');

    const progressQuery = useQuery({
        queryKey: ['lms', 'progress-by-enrollment', enrollmentId],
        queryFn: () => lmsAdapter.getProgress({ enrollment_id: enrollmentId }),
        enabled: Boolean(enrollmentId),
        staleTime: 30_000,
    });

    const progress = toRecord(toRecord(progressQuery.data).progress);
    const progressLessons = toRecordArray(progress.lessons);
    const sections = toRecordArray(course.sections);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Link to="/lms">
                    <Button type="button" variant="outline">
                        <ArrowLeft className="size-4" />
                        Back To Catalog
                    </Button>
                </Link>
                <Link to="/lms/my-courses">
                    <Button type="button" variant="outline">My Courses</Button>
                </Link>
            </div>

            {courseQuery.isLoading ? (
                <Card>
                    <CardContent className="py-8 text-sm text-muted-foreground">Loading course detail...</CardContent>
                </Card>
            ) : null}
            {courseQuery.isError ? (
                <Card className="border-destructive/40">
                    <CardHeader>
                        <CardTitle className="text-destructive">Course Load Failed</CardTitle>
                        <CardDescription>{courseQuery.error instanceof Error ? courseQuery.error.message : 'Unknown error'}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {!courseQuery.isLoading && !courseQuery.isError ? (
                <>
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                        <CardHeader>
                            <CardTitle className="text-2xl">{String(course.title || 'Untitled Course')}</CardTitle>
                            <CardDescription>{String(course.description || 'No description available.')}</CardDescription>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">Category: {String(course.category || 'General')}</Badge>
                                <Badge variant="outline">Difficulty: {String(course.difficulty_level || '-')}</Badge>
                                <Badge variant="outline">Duration: {String(course.estimated_duration_minutes || 0)} min</Badge>
                                <Badge variant="outline">Enrollment: {String(enrollment?.status || 'Not Enrolled')}</Badge>
                                <Badge variant="outline">Progress: {progressText(progress.progress_percent ?? enrollment?.progress_percent)}</Badge>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sections & Lessons (Read-Only)</CardTitle>
                            <CardDescription>
                                Lessons are visible for workflow continuity. Completion/quiz/certificate actions remain disabled in this slice.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {sections.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    No sections available for this course.
                                </div>
                            ) : (
                                sections.map(section => {
                                    const lessons = toRecordArray(section.lessons);
                                    return (
                                        <div key={String(section.id || section.title || Math.random())} className="rounded-lg border p-4">
                                            <h4 className="font-semibold">{String(section.title || 'Untitled Section')}</h4>
                                            <p className="text-sm text-muted-foreground">{String(section.description || '')}</p>
                                            <div className="mt-3 space-y-2">
                                                {lessons.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">No lessons.</p>
                                                ) : (
                                                    lessons.map(lesson => {
                                                        const lessonId = String(lesson.id || '');
                                                        const progressRow = progressLessons.find(row => String(row.lesson_id || '') === lessonId);
                                                        const status = String(progressRow?.status || 'not_started').toLowerCase();
                                                        return (
                                                            <div key={lessonId || String(lesson.title)} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                                <div>
                                                                    <p className="font-medium">{String(lesson.title || 'Untitled Lesson')}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {String(lesson.content_type || 'content')} · {String(lesson.estimated_duration_minutes || 0)} min
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline">
                                                                        <ListChecks className="mr-1 size-3" />
                                                                        {status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started'}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Workflow Boundary</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                                <BookOpenCheck className="mr-1 size-3" />
                                Read-only catalog active
                            </Badge>
                            <Badge variant="outline">Quiz submission deferred</Badge>
                            <Badge variant="outline">Lesson completion mutation deferred</Badge>
                            <Badge variant="outline">Certificate flow deferred</Badge>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
