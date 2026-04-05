import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, CheckCircle2, GraduationCap, ListChecks } from 'lucide-react';

import { lmsAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

 type CourseStatus = 'not-enrolled' | 'enrolled' | 'in-progress' | 'completed';

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

 function toNumber(value: unknown, fallback = 0): number {
     const parsed = Number(value);
     return Number.isFinite(parsed) ? parsed : fallback;
 }

 function progressText(value: unknown): string {
     return `${Math.round(toNumber(value, 0))}%`;
 }

 function getCourseStatus(enrollment?: Record<string, unknown> | null): CourseStatus {
     if (!enrollment) return 'not-enrolled';
     const status = String(enrollment.status || '').toLowerCase();
     if (status === 'completed') return 'completed';
     if (status === 'in_progress') return 'in-progress';
     return 'enrolled';
 }

 function statusBadge(status: CourseStatus) {
     if (status === 'completed') return <Badge variant="secondary">Completed</Badge>;
     if (status === 'in-progress') return <Badge variant="default">In Progress</Badge>;
     if (status === 'enrolled') return <Badge variant="outline">Enrolled</Badge>;
     return <Badge variant="outline">Not Enrolled</Badge>;
 }

 function lessonStatus(
     lessonId: string,
     progressLessons: Record<string, unknown>[],
     overallStatus: CourseStatus,
 ): 'completed' | 'in-progress' | 'not-started' {
     const progressRow = progressLessons.find(row => String(row.lesson_id || '') === lessonId);
     const status = String(progressRow?.status || '').toLowerCase();
     if (status === 'completed') return 'completed';
     if (status === 'in_progress') return 'in-progress';
     if (!progressRow && overallStatus === 'completed') return 'completed';
     return 'not-started';
 }

 export function LmsCourseDetailPage() {
     const { courseId } = useParams();
     const queryClient = useQueryClient();
     const decodedCourseId = useMemo(() => decodeURIComponent(String(courseId || '')), [courseId]);

     const courseQuery = useQuery({
         queryKey: ['lms', 'course-detail', decodedCourseId],
         queryFn: () => lmsAdapter.getCourse({ course_id: decodedCourseId }),
         enabled: Boolean(decodedCourseId),
         staleTime: 30_000,
     });

     const myCoursesQuery = useQuery({
         queryKey: ['lms', 'my-courses'],
         queryFn: () => lmsAdapter.myCourses({ page: 1, limit: 200 }),
         staleTime: 30_000,
     });

     const course = toRecord(toRecord(courseQuery.data).course);
     const myEnrollmentFromCourse = toRecord(course.my_enrollment);
     const myEnrollments = toRecordArray(toRecord(myCoursesQuery.data).enrollments);
     const enrollmentFromList = myEnrollments.find(row => String(row.course_id || '') === decodedCourseId) || null;
     const enrollment = enrollmentFromList || (Object.keys(myEnrollmentFromCourse).length > 0 ? myEnrollmentFromCourse : null);
     const enrollmentId = String(enrollment?.id || '');
     const overallStatus = getCourseStatus(enrollment);

     const progressQuery = useQuery({
         queryKey: ['lms', 'progress-by-enrollment', enrollmentId],
         queryFn: () => lmsAdapter.getProgress({ enrollment_id: enrollmentId }),
         enabled: Boolean(enrollmentId),
         staleTime: 30_000,
     });

     const enrollMutation = useMutation({
         mutationFn: async () => {
             await lmsAdapter.enroll({ course_id: decodedCourseId });
             return lmsAdapter.startCourse(decodedCourseId);
         },
         onSuccess: async () => {
             await queryClient.invalidateQueries({ queryKey: ['lms'] });
         },
     });

     const completeMutation = useMutation({
         mutationFn: async () => lmsAdapter.completeCourse(enrollmentId),
         onSuccess: async () => {
             await queryClient.invalidateQueries({ queryKey: ['lms'] });
         },
     });

     const progress = toRecord(toRecord(progressQuery.data).progress);
     const progressLessons = toRecordArray(progress.lessons);
     const sections = toRecordArray(course.sections);
     const overallProgress = toNumber(progress.progress_percent ?? enrollment?.progress_percent, 0);

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

             {enrollMutation.isError ? (
                 <Card className="border-destructive/40">
                     <CardHeader>
                         <CardTitle className="text-destructive">Unable To Start Course</CardTitle>
                         <CardDescription>{enrollMutation.error instanceof Error ? enrollMutation.error.message : 'Course enrollment could not be completed.'}</CardDescription>
                     </CardHeader>
                 </Card>
             ) : null}
             {completeMutation.isError ? (
                 <Card className="border-destructive/40">
                     <CardHeader>
                         <CardTitle className="text-destructive">Unable To Mark Complete</CardTitle>
                         <CardDescription>{completeMutation.error instanceof Error ? completeMutation.error.message : 'Course completion could not be saved.'}</CardDescription>
                     </CardHeader>
                 </Card>
             ) : null}

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
                         <CardHeader className="space-y-4">
                             <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                 <div className="space-y-3">
                                     <CardTitle className="text-2xl">{String(course.title || 'Untitled Course')}</CardTitle>
                                     <CardDescription>{String(course.description || 'No description available.')}</CardDescription>
                                     <div className="flex flex-wrap gap-2 text-xs">
                                         <Badge variant="outline">Category: {String(course.category || 'General')}</Badge>
                                         <Badge variant="outline">Difficulty: {String(course.difficulty_level || '-')}</Badge>
                                         <Badge variant="outline">Duration: {toNumber(course.estimated_duration_minutes, 0)} min</Badge>
                                         {statusBadge(overallStatus)}
                                         <Badge variant="outline">Progress: {progressText(overallProgress)}</Badge>
                                     </div>
                                 </div>

                                 <div className="flex w-full flex-col gap-2 lg:w-56">
                                     {overallStatus === 'not-enrolled' ? (
                                         <Button
                                             type="button"
                                             disabled={enrollMutation.isPending || !decodedCourseId}
                                             onClick={() => enrollMutation.mutate()}
                                         >
                                             <GraduationCap className="size-4" />
                                             {enrollMutation.isPending ? 'Enrolling...' : 'Enroll & Start'}
                                         </Button>
                                     ) : null}
                                     {overallStatus === 'enrolled' || overallStatus === 'in-progress' ? (
                                         <Button
                                             type="button"
                                             disabled={completeMutation.isPending || !enrollmentId}
                                             onClick={() => completeMutation.mutate()}
                                         >
                                             <CheckCircle2 className="size-4" />
                                             {completeMutation.isPending ? 'Saving...' : 'Mark Complete'}
                                         </Button>
                                     ) : null}
                                     {overallStatus === 'completed' ? (
                                         <Button type="button" variant="outline" disabled>
                                             <BookOpenCheck className="size-4" />
                                             Completed
                                         </Button>
                                     ) : null}
                                 </div>
                             </div>
                         </CardHeader>
                     </Card>

                     <Card>
                         <CardHeader>
                             <CardTitle className="text-lg">Course Progress</CardTitle>
                             <CardDescription>
                                 Track section progress here. Enroll first to start recording lesson activity for this course.
                             </CardDescription>
                         </CardHeader>
                         <CardContent className="grid gap-3 md:grid-cols-3">
                             <div className="rounded-lg border p-4">
                                 <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall Progress</p>
                                 <p className="mt-2 text-2xl font-semibold">{progressText(overallProgress)}</p>
                             </div>
                             <div className="rounded-lg border p-4">
                                 <p className="text-xs uppercase tracking-wide text-muted-foreground">Lessons Tracked</p>
                                 <p className="mt-2 text-2xl font-semibold">{progressLessons.length}</p>
                             </div>
                             <div className="rounded-lg border p-4">
                                 <p className="text-xs uppercase tracking-wide text-muted-foreground">Enrollment Status</p>
                                 <div className="mt-2">{statusBadge(overallStatus)}</div>
                             </div>
                         </CardContent>
                     </Card>

                     {progressQuery.isError ? (
                         <Card className="border-amber-500/40">
                             <CardHeader>
                                 <CardTitle className="text-amber-700">Progress Detail Unavailable</CardTitle>
                                 <CardDescription>
                                     {progressQuery.error instanceof Error ? progressQuery.error.message : 'Progress rows could not be loaded.'}
                                 </CardDescription>
                             </CardHeader>
                         </Card>
                     ) : null}

                     <Card>
                         <CardHeader>
                             <CardTitle className="text-lg">Sections & Lessons</CardTitle>
                             <CardDescription>
                                 Each lesson shows the latest tracked progress for this enrollment.
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
                                             <div className="mt-3 space-y-3">
                                                 {lessons.length === 0 ? (
                                                     <p className="text-sm text-muted-foreground">No lessons.</p>
                                                 ) : (
                                                     lessons.map(lesson => {
                                                         const lessonId = String(lesson.id || '');
                                                         const lessonProgress = progressLessons.find(row => String(row.lesson_id || '') === lessonId);
                                                         const status = lessonStatus(lessonId, progressLessons, overallStatus);
                                                         const lessonProgressPercent = lessonProgress?.progress_percent;

                                                         return (
                                                             <div key={lessonId || String(lesson.title)} className="rounded-md border p-3">
                                                                 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                                     <div>
                                                                         <p className="font-medium">{String(lesson.title || 'Untitled Lesson')}</p>
                                                                         <p className="text-xs text-muted-foreground">
                                                                             {String(lesson.content_type || 'content')} · {toNumber(lesson.estimated_duration_minutes, 0)} min
                                                                         </p>
                                                                     </div>
                                                                     <div className="flex flex-wrap items-center gap-2">
                                                                         <Badge variant="outline">
                                                                             <ListChecks className="mr-1 size-3" />
                                                                             {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In Progress' : 'Not Started'}
                                                                         </Badge>
                                                                         <Badge variant="outline">{progressText(lessonProgressPercent)}</Badge>
                                                                     </div>
                                                                 </div>
                                                                 {String(lesson.content_type || '').toLowerCase() === 'quiz' ? (
                                                                     <p className="mt-2 text-xs text-muted-foreground">Quiz submission coming soon</p>
                                                                 ) : null}
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

                     <div className="grid gap-4 lg:grid-cols-2">
                         <Card>
                             <CardHeader>
                                 <CardTitle className="text-lg">Quiz</CardTitle>
                                 <CardDescription>Quiz attempts will appear here once interactive lesson submission is enabled.</CardDescription>
                             </CardHeader>
                             <CardContent>
                                 <p className="text-sm text-muted-foreground">Quiz submission coming soon</p>
                             </CardContent>
                         </Card>

                         <Card>
                             <CardHeader>
                                 <CardTitle className="text-lg">Certificate</CardTitle>
                                 <CardDescription>Completion is stored today, and certificate release remains a follow-up verification step.</CardDescription>
                             </CardHeader>
                             <CardContent>
                                 <p className="text-sm text-muted-foreground">Available after completion is verified</p>
                             </CardContent>
                         </Card>
                     </div>
                 </>
             ) : null}
         </div>
     );
 }
