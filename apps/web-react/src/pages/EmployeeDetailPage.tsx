import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, GraduationCap, Target } from 'lucide-react';

import { employeesAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';
import type { EmployeeInsights } from '@demo-kpi/contracts';

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
    isLoading,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    cards: Array<{ label: string; value: string; hint: string; deferred?: boolean }>;
    isLoading?: boolean;
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
                {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-lg border p-3 animate-pulse">
                            <div className="h-3 w-20 rounded bg-muted mb-2" />
                            <div className="h-6 w-16 rounded bg-muted" />
                        </div>
                    ))
                    : cards.map(card => (
                        <div key={card.label} className="rounded-lg border p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                            <p className="text-2xl font-semibold">{card.value}</p>
                            <p className="text-xs text-muted-foreground">{card.hint}</p>
                            {card.deferred ? (
                                <Badge variant="outline" className="mt-2">Deferred</Badge>
                            ) : null}
                        </div>
                    ))
                }
            </CardContent>
        </Card>
    );
}

function trendLabel(trend: 'up' | 'down' | 'flat' | null): string {
    if (trend === 'up') return '↑ Up';
    if (trend === 'down') return '↓ Down';
    if (trend === 'flat') return '→ Stable';
    return 'No trend';
}

function gapLabel(gap: 'low' | 'medium' | 'high' | null): string {
    if (gap === 'low') return 'Low';
    if (gap === 'medium') return 'Medium';
    if (gap === 'high') return 'High';
    return 'No data';
}

function buildKpiCards(insights: EmployeeInsights | undefined, isLoading: boolean) {
    if (isLoading || !insights) return [];
    const { kpi } = insights.insights;
    return [
        {
            label: 'Latest KPI',
            value: kpi.latest_score !== null ? `${kpi.latest_score}` : 'No data',
            hint: kpi.latest_score !== null ? 'Most recent period score' : 'No KPI records available',
        },
        {
            label: 'KPI Trend',
            value: trendLabel(kpi.trend),
            hint: 'Recent periods vs prior periods',
        },
        {
            label: 'KPI Records',
            value: String(kpi.record_count),
            hint: 'Stored KPI records',
        },
    ];
}

function buildAssessmentCards(insights: EmployeeInsights | undefined, isLoading: boolean, lastAssessmentDate: string | null) {
    if (isLoading || !insights) return [];
    const { assessment } = insights.insights;
    return [
        {
            label: 'Gap Level',
            value: gapLabel(assessment.gap_level),
            hint: assessment.gap_level ? 'Derived from TNA need records' : 'No TNA records found',
        },
        {
            label: 'Last Assessed',
            value: assessment.last_assessed_at
                ? formatDate(assessment.last_assessed_at)
                : (lastAssessmentDate ? formatDate(lastAssessmentDate) : 'No data'),
            hint: 'Latest TNA or manager assessment date',
        },
        {
            label: 'TNA Records',
            value: String(assessment.history_count),
            hint: 'Identified training need records',
        },
    ];
}

function buildLmsCards(insights: EmployeeInsights | undefined, isLoading: boolean) {
    if (isLoading || !insights) return [];
    const { lms } = insights.insights;
    return [
        {
            label: 'Total Enrollments',
            value: String(lms.enrolled_count),
            hint: 'All LMS enrollments for employee',
        },
        {
            label: 'Completed',
            value: String(lms.completed_count),
            hint: `Completion status in LMS`,
        },
        {
            label: 'Completion %',
            value: lms.enrolled_count > 0 ? `${lms.completion_pct}%` : 'No data',
            hint: lms.enrolled_count > 0
                ? `${lms.enrolled_count - lms.completed_count} in progress or pending`
                : 'No LMS enrollments yet',
        },
    ];
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

    const insightsQuery = useQuery({
        queryKey: ['employees', 'insights', decodedEmployeeId],
        queryFn: () => employeesAdapter.fetchInsights(decodedEmployeeId),
        enabled: Boolean(decodedEmployeeId) && !detailQuery.isLoading && !detailQuery.isError && Boolean(detailQuery.data),
        staleTime: 60_000,
        retry: 1,
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

    const lastAssessmentDate = (() => {
        const direct = String((detailQuery.data?.employee as Record<string, unknown> | undefined)?.assessment_updated_at || '').trim();
        return direct || null;
    })();

    const insightsLoading = insightsQuery.isLoading || insightsQuery.isFetching;
    const kpiCards = buildKpiCards(insightsQuery.data, insightsLoading);
    const assessmentCards = buildAssessmentCards(insightsQuery.data, insightsLoading, lastAssessmentDate);
    const lmsCards = buildLmsCards(insightsQuery.data, insightsLoading);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Link to="/employees">
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
                        description="Gap level and last-assessment visibility from TNA need records."
                        cards={assessmentCards}
                        isLoading={insightsLoading}
                    />

                    <SummarySection
                        icon={<Target className="size-4 text-primary" />}
                        title="KPI Summary"
                        description="Latest KPI score, trend, and record count from the canonical insights endpoint."
                        cards={kpiCards}
                        isLoading={insightsLoading}
                    />

                    <SummarySection
                        icon={<GraduationCap className="size-4 text-primary" />}
                        title="LMS Summary"
                        description="Enrollment count and completion rate from the canonical insights endpoint."
                        cards={lmsCards}
                        isLoading={insightsLoading}
                    />

                    {insightsQuery.isError ? (
                        <Card className="border-amber-500/40">
                            <CardHeader>
                                <CardTitle className="text-sm text-amber-600">Insights Unavailable</CardTitle>
                                <CardDescription>
                                    KPI, Assessment, and LMS summary data could not be loaded.
                                    {insightsQuery.error instanceof Error ? ` ${insightsQuery.error.message}` : ''}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : null}

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
