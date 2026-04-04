import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, ClipboardList, Filter, Target } from 'lucide-react';

import { kpiAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/providers/AuthProvider';

type Mode = 'kpi' | 'assessment';

interface Filters {
    department: string;
    manager_id: string;
    period: string;
}

function monthNow(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function CardGrid({
    title,
    description,
    cards,
}: {
    title: string;
    description: string;
    cards: Array<{ label: string; value: string; hint: string; deferred?: boolean }>;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {cards.map(card => (
                    <div key={card.label} className="rounded-lg border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-semibold">{card.value}</p>
                        <p className="text-xs text-muted-foreground">{card.hint}</p>
                        {card.deferred ? <Badge variant="outline" className="mt-2">Deferred</Badge> : null}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export function KpiReportingPage() {
    const auth = useAuth();
    const [mode, setMode] = useState<Mode>('kpi');
    const [draftFilters, setDraftFilters] = useState<Filters>({
        department: '',
        manager_id: '',
        period: monthNow(),
    });
    const [filters, setFilters] = useState<Filters>({
        department: '',
        manager_id: '',
        period: monthNow(),
    });

    const overviewQuery = useQuery({
        queryKey: ['kpi-reporting', filters, auth.user?.employee_id, auth.role],
        queryFn: () =>
            kpiAdapter.getOverview(filters, {
                employeeId: String(auth.user?.employee_id || ''),
                role: auth.role || null,
            }),
        staleTime: 30_000,
    });

    const activeOverview = mode === 'kpi' ? overviewQuery.data?.kpi : overviewQuery.data?.assessment;
    const groups = activeOverview?.groups || [];
    const deferred = activeOverview?.deferred || [];
    const managers = useMemo(() => {
        const map = new Map<string, string>();
        const source = overviewQuery.data?.kpi.groups || [];
        for (const row of source) {
            if (!row.manager) continue;
            const key = row.manager;
            map.set(key, key);
        }
        return [...map.keys()].sort((a, b) => a.localeCompare(b));
    }, [overviewQuery.data?.kpi.groups]);
    const departments = useMemo(() => {
        const set = new Set<string>();
        const source = overviewQuery.data?.kpi.groups || [];
        for (const row of source) set.add(row.department);
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [overviewQuery.data?.kpi.groups]);

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardHeader>
                    <CardTitle className="text-2xl">Assessment & KPI Reporting</CardTitle>
                    <CardDescription>
                        Management reporting workflow parity for KPI and TNA assessment summaries with grouped breakdowns and drill-down-ready actions.
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">Source: {activeOverview?.source || 'loading'}</Badge>
                        <Badge variant="outline">Role: {auth.role || '-'}</Badge>
                        <Badge variant="outline">Period: {filters.period || '-'}</Badge>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filters</CardTitle>
                    <CardDescription>Filter-first reporting by department, manager, and period.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</label>
                        <SelectField
                            value={draftFilters.department}
                            options={[{ value: '', label: 'All departments' }, ...departments.map(value => ({ value, label: value }))]}
                            onChange={event => setDraftFilters(prev => ({ ...prev, department: event.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</label>
                        <SelectField
                            value={draftFilters.manager_id}
                            options={[{ value: '', label: 'All managers' }, ...managers.map(value => ({ value, label: value }))]}
                            onChange={event => setDraftFilters(prev => ({ ...prev, manager_id: event.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Period</label>
                        <Input
                            type="month"
                            value={draftFilters.period}
                            onChange={event => setDraftFilters(prev => ({ ...prev, period: event.target.value }))}
                        />
                    </div>
                    <div className="xl:col-span-2 flex items-end gap-2">
                        <Button type="button" onClick={() => setFilters(draftFilters)} disabled={overviewQuery.isFetching}>
                            <Filter className="size-4" />
                            Apply
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                const reset = { department: '', manager_id: '', period: monthNow() };
                                setDraftFilters(reset);
                                setFilters(reset);
                            }}
                        >
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {overviewQuery.isLoading ? (
                <Card>
                    <CardContent className="py-10 text-sm text-muted-foreground">Loading KPI/Assessment summaries...</CardContent>
                </Card>
            ) : null}

            {overviewQuery.isError ? (
                <Card className="border-destructive/40">
                    <CardHeader>
                        <CardTitle className="text-destructive">Reporting Load Failed</CardTitle>
                        <CardDescription>{overviewQuery.error instanceof Error ? overviewQuery.error.message : 'Unknown reporting error.'}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {!overviewQuery.isLoading && !overviewQuery.isError ? (
                <Tabs value={mode} onValueChange={value => setMode(value as Mode)}>
                    <TabsList>
                        <TabsTrigger value="kpi">KPI Summary</TabsTrigger>
                        <TabsTrigger value="assessment">Assessment For TNA Summary</TabsTrigger>
                    </TabsList>

                    <TabsContent value="kpi" className="space-y-4">
                        <CardGrid
                            title="KPI Summary"
                            description="Record-oriented KPI visibility for leadership reporting."
                            cards={overviewQuery.data?.kpi.cards || []}
                        />
                    </TabsContent>

                    <TabsContent value="assessment" className="space-y-4">
                        <CardGrid
                            title="Assessment For TNA Summary"
                            description="Department/team assessment coverage and need severity visibility."
                            cards={overviewQuery.data?.assessment.cards || []}
                        />
                    </TabsContent>
                </Tabs>
            ) : null}

            {!overviewQuery.isLoading && !overviewQuery.isError ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Grouped Breakdown</CardTitle>
                        <CardDescription>
                            Shows who has records, who is missing records, and which departments need attention.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {groups.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                No grouped rows for the current filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                            <th className="px-4 py-3 font-medium">Department</th>
                                            <th className="px-4 py-3 font-medium">Manager</th>
                                            <th className="px-4 py-3 font-medium">Employees</th>
                                            <th className="px-4 py-3 font-medium">Records</th>
                                            <th className="px-4 py-3 font-medium">Missing</th>
                                            <th className="px-4 py-3 font-medium">Metric</th>
                                            <th className="px-4 py-3 font-medium text-right">Next</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groups.map(row => (
                                            <tr key={`${mode}-${row.key}`} className="border-t">
                                                <td className="px-4 py-3 font-medium">{row.department}</td>
                                                <td className="px-4 py-3">{row.manager || '-'}</td>
                                                <td className="px-4 py-3">{row.employee_count}</td>
                                                <td className="px-4 py-3">{row.record_count}</td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={row.missing_count > 0 ? 'outline' : 'secondary'}>
                                                        {row.missing_count}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {mode === 'kpi'
                                                        ? (row.avg_achievement === null ? (
                                                            <Badge variant="outline">Deferred</Badge>
                                                        ) : (
                                                            <span>{row.avg_achievement}% avg</span>
                                                        ))
                                                        : (
                                                            <span>C/H: {row.critical_count || 0}/{row.high_count || 0}</span>
                                                        )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link to={`/kpi/drilldown/${mode}/${encodeURIComponent(row.department)}`}>
                                                        <Button type="button" size="sm" variant="outline">
                                                            Open
                                                            <ArrowUpRight className="size-4" />
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : null}

            {!overviewQuery.isLoading && !overviewQuery.isError ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Deferred Metrics</CardTitle>
                        <CardDescription>
                            Explicitly tracks backend-cutover gaps. No unavailable totals are fabricated.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        {deferred.length === 0 ? (
                            <Badge variant="secondary">No deferred metrics in current view</Badge>
                        ) : (
                            deferred.map(item => (
                                <Badge key={item} variant="outline">{item}</Badge>
                            ))
                        )}
                    </CardContent>
                </Card>
            ) : null}

            {!overviewQuery.isLoading && !overviewQuery.isError ? (
                <Card>
                    <CardContent className="grid gap-3 py-4 md:grid-cols-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <BarChart3 className="size-4 text-primary" />
                            KPI tab answers records and missing coverage by team.
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ClipboardList className="size-4 text-primary" />
                            Assessment tab answers TNA need severity and department-level attention.
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Target className="size-4 text-primary" />
                            Drill-down links are prepared for deeper record inspection routes.
                        </div>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
