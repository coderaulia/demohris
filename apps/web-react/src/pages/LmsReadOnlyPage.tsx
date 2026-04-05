import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Clock3, Filter, GraduationCap, ListChecks, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { lmsAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

 type TabMode = 'catalog' | 'my-courses';
 type CourseStatus = 'not-enrolled' | 'enrolled' | 'in-progress' | 'completed';

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

 function toNumber(value: unknown, fallback = 0): number {
     const parsed = Number(value);
     return Number.isFinite(parsed) ? parsed : fallback;
 }

 function formatDate(value: unknown): string {
     const raw = String(value || '').trim();
     if (!raw) return '-';
     const parsed = new Date(raw);
     if (Number.isNaN(parsed.getTime())) return raw;
     return parsed.toLocaleDateString();
 }

 function progressText(value: unknown): string {
     return `${Math.round(toNumber(value, 0))}%`;
 }

 function getCourseStatus(enrollment?: Record<string, unknown>): CourseStatus {
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

 function buttonLabel(status: CourseStatus) {
     if (status === 'completed') return 'Review Course';
     if (status === 'in-progress' || status === 'enrolled') return 'Continue';
     return 'Enroll';
 }

 function ProgressBar({ value }: { value: number }) {
     const safeValue = Math.max(0, Math.min(100, Math.round(value)));
     return (
         <div className="space-y-2">
             <div className="h-2 overflow-hidden rounded-full bg-muted">
                 <div
                     className="h-full rounded-full bg-primary transition-all"
                     style={{ width: `${safeValue}%` }}
                 />
             </div>
             <p className="text-xs font-medium text-muted-foreground">{safeValue}% complete</p>
         </div>
     );
 }

 export function LmsReadOnlyPage({ mode }: LmsReadOnlyPageProps) {
     const navigate = useNavigate();
     const queryClient = useQueryClient();
     const [categoryFilter, setCategoryFilter] = useState('all');
     const [statusFilter, setStatusFilter] = useState('all');
     const [searchTerm, setSearchTerm] = useState('');

     const catalogQuery = useQuery({
         queryKey: ['lms', 'catalog'],
         queryFn: () => lmsAdapter.listCourses({ status: 'published', page: 1, limit: 200 }),
         staleTime: 30_000,
     });
     const myCoursesQuery = useQuery({
         queryKey: ['lms', 'my-courses'],
         queryFn: () => lmsAdapter.myCourses({ page: 1, limit: 200 }),
         staleTime: 30_000,
     });

     const enrollMutation = useMutation({
         mutationFn: async (courseId: string) => {
             await lmsAdapter.enroll({ course_id: courseId });
             return lmsAdapter.startCourse(courseId);
         },
         onSuccess: async (_data, courseId) => {
             await queryClient.invalidateQueries({ queryKey: ['lms'] });
             navigate(`/lms/${encodeURIComponent(courseId)}`);
         },
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

     const categoryOptions = useMemo(() => {
         const values = Array.from(
             new Set(
                 catalog
                     .map(course => String(course.category || '').trim())
                     .filter(Boolean),
             ),
         ).sort((left, right) => left.localeCompare(right));

         return [
             { value: 'all', label: 'All categories' },
             ...values.map(value => ({ value, label: value })),
         ];
     }, [catalog]);

     const filteredCatalog = useMemo(() => {
         const normalizedSearch = searchTerm.trim().toLowerCase();
         return catalog.filter(course => {
             const category = String(course.category || '').trim();
             const title = String(course.title || '').toLowerCase();
             const description = String(course.description || '').toLowerCase();
             const courseId = String(course.id || '').trim();
             const status = getCourseStatus(enrollmentByCourse.get(courseId));
             const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
             const matchesStatus = statusFilter === 'all'
                 || (statusFilter === 'enrolled' && status !== 'not-enrolled')
                 || (statusFilter === 'not-enrolled' && status === 'not-enrolled');
             const matchesSearch = !normalizedSearch
                 || title.includes(normalizedSearch)
                 || description.includes(normalizedSearch);
             return matchesCategory && matchesStatus && matchesSearch;
         });
     }, [catalog, categoryFilter, enrollmentByCourse, searchTerm, statusFilter]);

     const completedCount = myEnrollments.filter(row => getCourseStatus(row) === 'completed').length;
     const activeTab = mode === 'my-courses' ? 'my-courses' : 'catalog';

     return (
         <div className="space-y-6">
             <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                 <CardHeader>
                     <CardTitle className="text-2xl">Learning Center</CardTitle>
                     <CardDescription>
                         Browse published training, enroll from the catalog, and pick up your assigned or self-started courses.
                     </CardDescription>
                 </CardHeader>
                 <CardContent className="grid gap-3 md:grid-cols-3">
                     <div className="rounded-lg border bg-card p-3">
                         <p className="text-xs uppercase tracking-wide text-muted-foreground">Published Courses</p>
                         <p className="text-2xl font-semibold">{catalog.length}</p>
                     </div>
                     <div className="rounded-lg border bg-card p-3">
                         <p className="text-xs uppercase tracking-wide text-muted-foreground">My Courses</p>
                         <p className="text-2xl font-semibold">{myEnrollments.length}</p>
                     </div>
                     <div className="rounded-lg border bg-card p-3">
                         <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
                         <p className="text-2xl font-semibold">{completedCount}</p>
                     </div>
                 </CardContent>
             </Card>

             {enrollMutation.isError ? (
                 <Card className="border-destructive/40">
                     <CardHeader>
                         <CardTitle className="text-destructive">Enrollment Failed</CardTitle>
                         <CardDescription>
                             {enrollMutation.error instanceof Error ? enrollMutation.error.message : 'Unable to enroll in this course right now.'}
                         </CardDescription>
                     </CardHeader>
                 </Card>
             ) : null}

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
                     <Card>
                         <CardHeader>
                             <CardTitle className="flex items-center gap-2 text-lg">
                                 <Filter className="size-4" />
                                 Catalog Filters
                             </CardTitle>
                             <CardDescription>Filter the catalog by category, enrollment status, or course title.</CardDescription>
                         </CardHeader>
                         <CardContent className="grid gap-3 md:grid-cols-3">
                             <div className="space-y-2">
                                 <p className="text-sm font-medium">Category</p>
                                 <SelectField
                                     value={categoryFilter}
                                     onChange={event => setCategoryFilter(event.target.value)}
                                     options={categoryOptions}
                                 />
                             </div>
                             <div className="space-y-2">
                                 <p className="text-sm font-medium">Status</p>
                                 <SelectField
                                     value={statusFilter}
                                     onChange={event => setStatusFilter(event.target.value)}
                                     options={[
                                         { value: 'all', label: 'All statuses' },
                                         { value: 'enrolled', label: 'Enrolled' },
                                         { value: 'not-enrolled', label: 'Not enrolled' },
                                     ]}
                                 />
                             </div>
                             <div className="space-y-2">
                                 <p className="text-sm font-medium">Search</p>
                                 <Input
                                     value={searchTerm}
                                     onChange={event => setSearchTerm(event.target.value)}
                                     placeholder="Search by course title"
                                 />
                             </div>
                         </CardContent>
                     </Card>

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
                             {filteredCatalog.length === 0 ? (
                                 <Card className="md:col-span-2 xl:col-span-3">
                                     <CardContent className="py-8 text-sm text-muted-foreground">
                                         No courses match the current filters.
                                     </CardContent>
                                 </Card>
                             ) : null}
                             {filteredCatalog.map(course => {
                                 const courseId = String(course.id || '').trim();
                                 const enrollment = enrollmentByCourse.get(courseId);
                                 const status = getCourseStatus(enrollment);
                                 const isPending = enrollMutation.isPending && enrollMutation.variables === courseId;

                                 return (
                                     <Card key={courseId}>
                                         <CardHeader className="space-y-3 pb-3">
                                             <div className="flex items-start justify-between gap-3">
                                                 <div>
                                                     <CardTitle className="line-clamp-2 text-base">{String(course.title || 'Untitled Course')}</CardTitle>
                                                     <CardDescription>{String(course.description || 'No description available.')}</CardDescription>
                                                 </div>
                                                 {statusBadge(status)}
                                             </div>
                                             <div className="flex flex-wrap gap-2 text-xs">
                                                 <Badge variant="outline">{String(course.category || 'General')}</Badge>
                                                 <Badge variant="outline">{toNumber(course.estimated_duration_minutes, 0)} min</Badge>
                                             </div>
                                         </CardHeader>
                                         <CardContent className="space-y-4">
                                             <div className="grid gap-2 text-sm text-muted-foreground">
                                                 <div className="flex items-center justify-between gap-3">
                                                     <span className="inline-flex items-center gap-1">
                                                         <Users className="size-4" />
                                                         Enrolled learners
                                                     </span>
                                                     <span className="font-medium text-foreground">{toNumber(course.enrollment_count, 0)}</span>
                                                 </div>
                                                 <div className="flex items-center justify-between gap-3">
                                                     <span className="inline-flex items-center gap-1">
                                                         <ListChecks className="size-4" />
                                                         My progress
                                                     </span>
                                                     <span className="font-medium text-foreground">{progressText(enrollment?.progress_percent)}</span>
                                                 </div>
                                             </div>

                                             {status === 'not-enrolled' ? (
                                                 <Button
                                                     type="button"
                                                     className="w-full"
                                                     disabled={isPending}
                                                     onClick={() => enrollMutation.mutate(courseId)}
                                                 >
                                                     <GraduationCap className="size-4" />
                                                     {isPending ? 'Enrolling...' : buttonLabel(status)}
                                                 </Button>
                                             ) : (
                                                 <Link to={`/lms/${encodeURIComponent(courseId)}`}>
                                                     <Button type="button" variant={status === 'completed' ? 'outline' : 'default'} className="w-full">
                                                         <BookOpen className="size-4" />
                                                         {buttonLabel(status)}
                                                     </Button>
                                                 </Link>
                                             )}
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
                                         You have not enrolled in any courses yet. Start with the catalog to build your learning queue.
                                     </CardContent>
                                 </Card>
                             ) : null}
                             {myEnrollments.map(enrollment => {
                                 const courseId = String(enrollment.course_id || '').trim();
                                 const status = getCourseStatus(enrollment);
                                 return (
                                     <Card key={String(enrollment.id || courseId)}>
                                         <CardHeader className="space-y-3 pb-3">
                                             <div className="flex items-start justify-between gap-3">
                                                 <div>
                                                     <CardTitle className="line-clamp-2 text-base">
                                                         {String(enrollment.title || enrollment.course_title || 'Untitled Course')}
                                                     </CardTitle>
                                                     <CardDescription>{String(enrollment.category || 'General')}</CardDescription>
                                                 </div>
                                                 {statusBadge(status)}
                                             </div>
                                         </CardHeader>
                                         <CardContent className="space-y-4">
                                             <ProgressBar value={toNumber(enrollment.progress_percent, 0)} />

                                             <div className="grid gap-2 text-sm text-muted-foreground">
                                                 <div className="flex items-center justify-between gap-3">
                                                     <span className="inline-flex items-center gap-1">
                                                         <Clock3 className="size-4" />
                                                         Last accessed
                                                     </span>
                                                     <span className="font-medium text-foreground">{formatDate(enrollment.last_accessed_at)}</span>
                                                 </div>
                                                 <div className="flex items-center justify-between gap-3">
                                                     <span className="inline-flex items-center gap-1">
                                                         <BookOpen className="size-4" />
                                                         Duration
                                                     </span>
                                                     <span className="font-medium text-foreground">{toNumber(enrollment.estimated_duration_minutes, 0)} min</span>
                                                 </div>
                                             </div>

                                             <Link to={`/lms/${encodeURIComponent(courseId)}`}>
                                                 <Button type="button" className="w-full">
                                                     <BookOpen className="size-4" />
                                                     Continue
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
