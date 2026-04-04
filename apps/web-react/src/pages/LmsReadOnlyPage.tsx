import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock3, GraduationCap, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';

import { lmsAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TabMode = 'catalog' | 'my-courses';

interface LmsReadOnlyPageProps {
    mode: TabMode;
}

function toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function toArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[];
}

function statusFromEnrollment(enrollment: Record<string, unknown> | undefined): 'not-started' | 'in-progress' | 'completed' {
    const status = String(enrollment?.status || '').toLowerCase();
    if (status === 'completed') return 'completed';
    if (status === 'in_progress') return 'in-progress';
    return 'not-started';
}

function statusBadge(status: 'not-started' | 'in-progress' | 'completed') {
    if (status === 'completed') return <Badge variant="secondary">Completed</Badge>;
    if (status === 'in-progress') return <Badge variant="outline">In Progress</Badge>;
    return <Badge variant="outline">Not Started</Badge>;
}

function progressText(value: unknown): string {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0%';
    return `${Math.round(parsed)}%`;
}

export function LmsReadOnlyPage({ mode }: LmsReadOnlyPageProps) {
    const catalogQuery = useQuery({
        queryKey: ['lms', 'catalog-read-only'],
        queryFn: () => lmsAdapter.listCourses({ status: 'published', page: 1, limit: 200 }),
        staleTime: 30_000,
    });
    const myCoursesQuery = useQuery({
        queryKey: ['lms', 'my-courses-read-only'],
        queryFn: () => lmsAdapter.getMyCourses({ page: 1, limit: 200 }),
        staleTime: 30_000,
    });

    const catalog = toArray(toRecord(catalogQuery.data).courses);
    const myEnrollments = toArray(toRecord(myCoursesQuery.data).enrollments);

    const enrollmentByCourse = useMemo(() => {
        const map = new Map<string, Record<string, unknown>>();
        for (const enrollment of myEnrollments) {
            const courseId = String(enrollment.course_id || '').trim();
            if (!courseId) continue;
            map.set(courseId, enrollment);
        }
        return map;
    }, [myEnrollments]);

    const activeTab = mode === 'my-courses' ? 'my-courses' : 'catalog';

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardHeader>
                    <CardTitle className="text-2xl">Learning (Read-Only)</CardTitle>
                    <CardDescription>
                        Read-first LMS experience backed by migrated endpoints only. Mutation actions are intentionally hidden.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Published Courses</p>
                        <p className="text-2xl font-semibold">{catalog.length}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">My Enrollments</p>
                        <p className="text-2xl font-semibold">{myEnrollments.length}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Data Source</p>
                        <p className="text-sm font-medium">LMS read cutover endpoints</p>
                    </div>
                </CardContent>
            </Card>

            <Tabs value={activeTab}>
                <TabsList>
                    <TabsTrigger value="catalog" asChild>
                        <Link to="/lms">Training Catalog</Link>
                    </TabsTrigger>
                    <TabsTrigger value="my-courses" asChild>
                        <Link to="/lms/my-courses">My Courses</Link>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="catalog" className="space-y-4">
                    {catalogQuery.isLoading ? (
                        <Card>
                            <CardContent className="py-8 text-sm text-muted-foreground">Loading course catalog...</CardContent>
                        </Card>
                    ) : null}
                    {catalogQuery.isError ? (
                        <Card className="border-destructive/40">
                            <CardHeader>
                                <CardTitle className="text-destructive">Catalog Load Failed</CardTitle>
                                <CardDescription>
                                    {catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Unknown error'}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : null}
                    {!catalogQuery.isLoading && !catalogQuery.isError ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {catalog.map(course => {
                                const courseId = String(course.id || '');
                                const enrollment = enrollmentByCourse.get(courseId);
                                const status = statusFromEnrollment(enrollment);
                                return (
                                    <Card key={courseId}>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="line-clamp-2 text-base">{String(course.title || 'Untitled Course')}</CardTitle>
                                            <CardDescription>{String(course.category || 'General')}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Status</span>
                                                {statusBadge(status)}
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Progress</span>
                                                <span className="font-medium">{progressText(enrollment?.progress_percent)}</span>
                                            </div>
                                            <Link to={`/lms/${encodeURIComponent(courseId)}`}>
                                                <Button type="button" size="sm" variant="outline" className="w-full">
                                                    <BookOpen className="size-4" />
                                                    View Course
                                                </Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : null}
                </TabsContent>

                <TabsContent value="my-courses" className="space-y-4">
                    {myCoursesQuery.isLoading ? (
                        <Card>
                            <CardContent className="py-8 text-sm text-muted-foreground">Loading enrolled courses...</CardContent>
                        </Card>
                    ) : null}
                    {myCoursesQuery.isError ? (
                        <Card className="border-destructive/40">
                            <CardHeader>
                                <CardTitle className="text-destructive">My Courses Load Failed</CardTitle>
                                <CardDescription>
                                    {myCoursesQuery.error instanceof Error ? myCoursesQuery.error.message : 'Unknown error'}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : null}
                    {!myCoursesQuery.isLoading && !myCoursesQuery.isError ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {myEnrollments.length === 0 ? (
                                <Card className="md:col-span-2 xl:col-span-3">
                                    <CardContent className="py-8 text-sm text-muted-foreground">
                                        No enrolled courses yet.
                                    </CardContent>
                                </Card>
                            ) : null}
                            {myEnrollments.map(enrollment => {
                                const courseId = String(enrollment.course_id || '');
                                const status = statusFromEnrollment(enrollment);
                                return (
                                    <Card key={String(enrollment.id || courseId)}>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="line-clamp-2 text-base">
                                                {String(enrollment.title || enrollment.course_title || 'Untitled Course')}
                                            </CardTitle>
                                            <CardDescription>{String(enrollment.category || 'General')}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <GraduationCap className="size-4" />
                                                    Status
                                                </span>
                                                {statusBadge(status)}
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <ListChecks className="size-4" />
                                                    Progress
                                                </span>
                                                <span className="font-medium">{progressText(enrollment.progress_percent)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Clock3 className="size-4" />
                                                    Last Accessed
                                                </span>
                                                <span className="font-medium">
                                                    {enrollment.last_accessed_at
                                                        ? new Date(String(enrollment.last_accessed_at)).toLocaleDateString()
                                                        : '-'}
                                                </span>
                                            </div>
                                            <Link to={`/lms/${encodeURIComponent(courseId)}`}>
                                                <Button type="button" size="sm" variant="outline" className="w-full">
                                                    View Course
                                                </Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : null}
                </TabsContent>
            </Tabs>
        </div>
    );
}
