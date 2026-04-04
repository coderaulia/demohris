import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, ClipboardList, GraduationCap, Target } from 'lucide-react';

import { employeesAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';

function formatDate(value: string | null) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
}

function SummarySection({
    icon,
    title,
    description,
    cards,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    cards: Array<{ label: string; value: string; hint: string; deferred?: boolean }>;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    {icon}
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map(card => (
                    <div key={card.label} className="rounded-lg border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-semibold">{card.value}</p>
                        <p className="text-xs text-muted-foreground">{card.hint}</p>
                        {card.deferred ? (
                            <Badge variant="outline" className="mt-2">Deferred</Badge>
                        ) : null}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export function EmployeeDetailPage() {
    const { employeeId } = useParams();
    const auth = useAuth();
    const decodedEmployeeId = useMemo(() => decodeURIComponent(String(employeeId || '')), [employeeId]);
    const legacyEmployeesHref = `${env.legacyAppUrl.replace(/\/$/, '')}#employees`;

    const detailQuery = useQuery({
        queryKey: ['employees', 'detail', decodedEmployeeId, auth.user?.employee_id, auth.role],
        queryFn: () =>
            employeesAdapter.getDetail(decodedEmployeeId, {
                employeeId: String(auth.user?.employee_id || ''),
                role: auth.role || null,
            }),
        enabled: Boolean(decodedEmployeeId),
        staleTime: 30_000,
    });

    if (!decodedEmployeeId) {
        return (
            <Card className="border-destructive/40">
                <CardHeader>
                    <CardTitle className="text-destructive">Invalid Employee ID</CardTitle>
                    <CardDescription>The employee route is missing a valid employee identifier.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Link to="/workforce/directory">
                    <Button type="button" variant="outline">
                        <ArrowLeft className="size-4" />
                        Back To Employees
                    </Button>
                </Link>
                {auth.role === 'superadmin' ? (
                    <a href={legacyEmployeesHref}>
                        <Button type="button" variant="outline">Open Legacy CRUD</Button>
                    </a>
                ) : null}
            </div>

            {detailQuery.isLoading ? (
                <Card>
                    <CardContent className="py-10 text-sm text-muted-foreground">Loading employee detail...</CardContent>
                </Card>
            ) : null}

            {detailQuery.isError ? (
                <Card className="border-destructive/40">
                    <CardHeader>
                        <CardTitle className="text-destructive">Failed To Load Employee</CardTitle>
                        <CardDescription>
                            {detailQuery.error instanceof Error ? detailQuery.error.message : 'Unknown detail-loading error.'}
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {!detailQuery.isLoading && !detailQuery.isError && !detailQuery.data ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Employee Not Available</CardTitle>
                        <CardDescription>
                            This employee could not be found in your current visibility scope. If you expected access, verify role mapping and RLS.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {!detailQuery.isLoading && !detailQuery.isError && detailQuery.data ? (
                <>
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                        <CardHeader className="space-y-3">
                            <CardTitle className="text-2xl">{detailQuery.data.employee.name || detailQuery.data.employee.employee_id}</CardTitle>
                            <CardDescription>{detailQuery.data.employee.position || 'Position not set'}</CardDescription>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">ID: {detailQuery.data.employee.employee_id}</Badge>
                                <Badge variant="outline">Role: {detailQuery.data.employee.role}</Badge>
                                <Badge variant="outline">Department: {detailQuery.data.employee.department || '-'}</Badge>
                                <Badge variant="outline">Manager: {detailQuery.data.manager?.name || '-'}</Badge>
                                <Badge variant="outline">Direct Reports: {detailQuery.data.direct_reports}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Auth Email</p>
                                <p className="font-medium">{detailQuery.data.employee.auth_email || '-'}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Join Date</p>
                                <p className="font-medium">{formatDate(detailQuery.data.employee.join_date)}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Seniority</p>
                                <p className="font-medium">{detailQuery.data.employee.seniority || '-'}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Password Reset Required</p>
                                <p className="font-medium">{detailQuery.data.employee.must_change_password ? 'Yes' : 'No'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <SummarySection
                        icon={<ClipboardList className="size-4 text-primary" />}
                        title="Assessment Summary"
                        description="Manager and self-assessment visibility aligned with current readable records."
                        cards={detailQuery.data.summary.assessment}
                    />

                    <SummarySection
                        icon={<Target className="size-4 text-primary" />}
                        title="KPI Summary"
                        description="Read-first KPI snapshot from available profile and records."
                        cards={detailQuery.data.summary.kpi}
                    />

                    <SummarySection
                        icon={<GraduationCap className="size-4 text-primary" />}
                        title="LMS Summary"
                        description="Enrollment counts shown when employee-scoped LMS reads are available."
                        cards={detailQuery.data.summary.lms}
                    />

                    <SummarySection
                        icon={<BriefcaseBusiness className="size-4 text-primary" />}
                        title="TNA Summary"
                        description="TNA employee-level snapshot shown when current read paths support it."
                        cards={detailQuery.data.summary.tna}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Linked Records</CardTitle>
                            <CardDescription>
                                Drill-down targets are prepared for read-first parity expansion. Mutation-heavy actions stay out of scope for this slice.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            <Link to="/dashboard">
                                <Button type="button" variant="outline">Open Dashboard</Button>
                            </Link>
                            {env.enableLmsRoute ? (
                                <Link to="/lms">
                                    <Button type="button" variant="outline">Open LMS Module</Button>
                                </Link>
                            ) : (
                                <Button type="button" variant="outline" disabled>LMS Route Feature-Flagged</Button>
                            )}
                            {env.enableTnaRoute ? (
                                <Link to="/tna">
                                    <Button type="button" variant="outline">Open TNA Module</Button>
                                </Link>
                            ) : (
                                <Button type="button" variant="outline" disabled>TNA Route Feature-Flagged</Button>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
