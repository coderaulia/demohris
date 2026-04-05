import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, GraduationCap, Target, UserCog2 } from 'lucide-react';

import { employeesAdapter, kpiAdapter, tnaAdapter, type EmployeeUpdateInput } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SelectField } from '@/components/ui/select';
import { useAuth } from '@/providers/AuthProvider';
import type { EmployeeInsights, EmployeeRecord } from '@demo-kpi/contracts';

function formatDate(value: string | null) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
}

function SummarySection({ icon, title, description, cards, isLoading }: { icon: ReactNode; title: string; description: string; cards: Array<{ label: string; value: string; hint: string; deferred?: boolean }>; isLoading?: boolean }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {isLoading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="animate-pulse rounded-lg border p-3">
                            <div className="mb-2 h-3 w-20 rounded bg-muted" />
                            <div className="h-6 w-16 rounded bg-muted" />
                        </div>
                    ))
                    : cards.map(card => (
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

function trendLabel(trend: 'up' | 'down' | 'flat' | null): string {
    if (trend === 'up') return 'Up';
    if (trend === 'down') return 'Down';
    if (trend === 'flat') return 'Stable';
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
        { label: 'Latest KPI', value: kpi.latest_score !== null ? `${kpi.latest_score}` : 'No data', hint: kpi.latest_score !== null ? 'Most recent score' : 'No KPI records yet' },
        { label: 'KPI Trend', value: trendLabel(kpi.trend), hint: 'Recent periods versus prior periods' },
        { label: 'KPI Records', value: String(kpi.record_count), hint: 'Stored KPI records' },
    ];
}

function buildAssessmentCards(insights: EmployeeInsights | undefined, isLoading: boolean, lastAssessmentDate: string | null) {
    if (isLoading || !insights) return [];
    const { assessment } = insights.insights;
    return [
        { label: 'Gap Level', value: gapLabel(assessment.gap_level), hint: assessment.gap_level ? 'Derived from training need records' : 'No assessment needs yet' },
        { label: 'Last Assessed', value: assessment.last_assessed_at ? formatDate(assessment.last_assessed_at) : (lastAssessmentDate ? formatDate(lastAssessmentDate) : 'No data'), hint: 'Latest TNA or manager assessment date' },
        { label: 'TNA Records', value: String(assessment.history_count), hint: 'Identified assessment needs' },
    ];
}

function buildLmsCards(insights: EmployeeInsights | undefined, isLoading: boolean) {
    if (isLoading || !insights) return [];
    const { lms } = insights.insights;
    return [
        { label: 'Enrollments', value: String(lms.enrolled_count), hint: 'All LMS enrollments' },
        { label: 'Completed', value: String(lms.completed_count), hint: 'Completed LMS courses' },
        { label: 'Completion %', value: lms.enrolled_count > 0 ? `${lms.completion_pct}%` : 'No data', hint: lms.enrolled_count > 0 ? 'Completion ratio across enrollments' : 'No LMS enrollments yet' },
    ];
}

function emptyKpiForm() {
    return { period: '', score: '', target_value: '', notes: '' };
}

function emptyNeedForm() {
    return { competency_name: '', required_level: '', current_level: '', priority: 'medium', notes: '' };
}

export function EmployeeDetailPage() {
    const { employeeId } = useParams();
    const auth = useAuth();
    const queryClient = useQueryClient();
    const decodedEmployeeId = useMemo(() => decodeURIComponent(String(employeeId || '')), [employeeId]);
    const [editForm, setEditForm] = useState<EmployeeUpdateInput | null>(null);
    const [editMessage, setEditMessage] = useState('');
    const [kpiOpen, setKpiOpen] = useState(false);
    const [needOpen, setNeedOpen] = useState(false);
    const [kpiForm, setKpiForm] = useState(emptyKpiForm());
    const [needForm, setNeedForm] = useState(emptyNeedForm());
    const [kpiError, setKpiError] = useState('');
    const [needError, setNeedError] = useState('');

    const detailQuery = useQuery({
        queryKey: ['employees', 'detail', decodedEmployeeId],
        queryFn: () => employeesAdapter.getEmployee(decodedEmployeeId),
        enabled: Boolean(decodedEmployeeId),
        staleTime: 30_000,
    });

    const managerOptionsQuery = useQuery({
        queryKey: ['employees', 'manager-options', auth.role],
        queryFn: () => employeesAdapter.list({ limit: 500 }, { employeeId: String(auth.user?.employee_id || ''), role: auth.role || null }),
        enabled: auth.role === 'superadmin' || auth.role === 'hr',
        staleTime: 30_000,
    });

    const insightsQuery = useQuery({
        queryKey: ['employees', 'insights', decodedEmployeeId],
        queryFn: () => employeesAdapter.fetchInsights(decodedEmployeeId),
        enabled: Boolean(decodedEmployeeId) && Boolean(detailQuery.data),
        staleTime: 60_000,
        retry: 1,
    });

    useEffect(() => {
        if (!detailQuery.data) return;
        setEditForm({
            employee_id: String(detailQuery.data.employee_id),
            name: detailQuery.data.name || '',
            email: String(detailQuery.data.email || detailQuery.data.auth_email || ''),
            department: detailQuery.data.department || '',
            position: detailQuery.data.position || '',
            role: detailQuery.data.role,
            manager_id: detailQuery.data.manager_id || null,
            join_date: detailQuery.data.join_date || null,
        });
    }, [detailQuery.data]);

    const canEditAll = auth.role === 'superadmin' || auth.role === 'hr';
    const canEditLimited = auth.role === 'manager';
    const canToggleStatus = canEditAll;
    const canAddKpi = canEditAll;
    const canAddNeed = canEditAll || auth.role === 'manager';

    const updateMutation = useMutation({
        mutationFn: (payload: EmployeeUpdateInput) => employeesAdapter.update(payload),
        onSuccess: async () => {
            setEditMessage('Employee profile updated.');
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: (status: 'active' | 'inactive') => employeesAdapter.toggleStatus(decodedEmployeeId, status),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
    });

    const createKpiMutation = useMutation({
        mutationFn: () => kpiAdapter.createRecord({
            employee_id: decodedEmployeeId,
            period: kpiForm.period,
            score: Number(kpiForm.score),
            target_value: kpiForm.target_value ? Number(kpiForm.target_value) : undefined,
            notes: kpiForm.notes.trim() || undefined,
        }),
        onSuccess: async () => {
            setKpiOpen(false);
            setKpiForm(emptyKpiForm());
            setKpiError('');
            await queryClient.invalidateQueries({ queryKey: ['employees', 'insights', decodedEmployeeId] });
        },
    });

    const createNeedMutation = useMutation({
        mutationFn: () => tnaAdapter.createNeed({
            employee_id: decodedEmployeeId,
            competency_name: needForm.competency_name.trim(),
            required_level: Number(needForm.required_level),
            current_level: Number(needForm.current_level),
            priority: needForm.priority,
            notes: needForm.notes.trim() || undefined,
        }),
        onSuccess: async () => {
            setNeedOpen(false);
            setNeedForm(emptyNeedForm());
            setNeedError('');
            await queryClient.invalidateQueries({ queryKey: ['employees', 'insights', decodedEmployeeId] });
        },
    });

    const managerOptions = useMemo(() => {
        const rows = managerOptionsQuery.data?.employees || [];
        return [{ value: '', label: 'No manager' }, ...rows
            .filter(employee => ['manager', 'hr', 'superadmin', 'director'].includes(String(employee.role || '').toLowerCase()))
            .map(employee => ({ value: String(employee.employee_id), label: `${employee.name} (${employee.employee_id})` }))];
    }, [managerOptionsQuery.data]);

    const managerName = useMemo(() => {
        const rows = managerOptionsQuery.data?.employees || [];
        const manager = rows.find(row => String(row.employee_id) === String(detailQuery.data?.manager_id || ''));
        return manager?.name || null;
    }, [detailQuery.data?.manager_id, managerOptionsQuery.data]);

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

    const employee = detailQuery.data;
    const lastAssessmentDate = String((employee as Record<string, unknown> | undefined)?.assessment_updated_at || '').trim() || null;
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
            </div>

            {detailQuery.isLoading ? <Card><CardContent className="py-10 text-sm text-muted-foreground">Loading employee detail...</CardContent></Card> : null}
            {detailQuery.isError ? (
                <Card className="border-destructive/40">
                    <CardHeader>
                        <CardTitle className="text-destructive">Failed To Load Employee</CardTitle>
                        <CardDescription>{detailQuery.error instanceof Error ? detailQuery.error.message : 'Unknown detail-loading error.'}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}
            {!detailQuery.isLoading && !detailQuery.isError && !employee ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Employee Not Available</CardTitle>
                        <CardDescription>This employee could not be found in your current visibility scope.</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {employee ? (
                <>
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                        <CardHeader className="space-y-3">
                            <CardTitle className="text-2xl">{employee.name || employee.employee_id}</CardTitle>
                            <CardDescription>{employee.position || 'Position not set'}</CardDescription>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">ID: {employee.employee_id}</Badge>
                                <Badge variant="outline">Role: {employee.role}</Badge>
                                <Badge variant="outline">Department: {employee.department || '-'}</Badge>
                                <Badge variant="outline">Manager: {managerName || employee.manager_id || '-'}</Badge>
                                <Badge variant={String(employee.status || 'active') === 'active' ? 'secondary' : 'outline'}>{String(employee.status || 'active') === 'active' ? 'Active' : 'Inactive'}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                                <p className="font-medium">{employee.email || employee.auth_email || '-'}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Join Date</p>
                                <p className="font-medium">{formatDate(employee.join_date)}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Seniority</p>
                                <p className="font-medium">{employee.seniority || '-'}</p>
                            </div>
                            <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Password Reset Required</p>
                                <p className="font-medium">{employee.must_change_password ? 'Yes' : 'No'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {(canEditAll || canEditLimited) && editForm ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg"><UserCog2 className="size-4 text-primary" />Inline Profile Edit</CardTitle>
                                <CardDescription>
                                    {canEditAll ? 'HR and superadmin can update the full employee profile.' : 'Managers can update department and position for direct reports.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Name</label>
                                        <Input value={editForm.name || ''} onChange={event => setEditForm(prev => prev ? { ...prev, name: event.target.value } : prev)} disabled={!canEditAll} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email</label>
                                        <Input type="email" value={editForm.email || ''} onChange={event => setEditForm(prev => prev ? { ...prev, email: event.target.value } : prev)} disabled={!canEditAll} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Department</label>
                                        <Input value={editForm.department || ''} onChange={event => setEditForm(prev => prev ? { ...prev, department: event.target.value } : prev)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Position</label>
                                        <Input value={editForm.position || ''} onChange={event => setEditForm(prev => prev ? { ...prev, position: event.target.value } : prev)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Role</label>
                                        <SelectField value={String(editForm.role || 'employee')} onChange={event => setEditForm(prev => prev ? { ...prev, role: event.target.value as EmployeeRecord['role'] } : prev)} disabled={!canEditAll} options={[
                                            { value: 'employee', label: 'Employee' },
                                            { value: 'manager', label: 'Manager' },
                                            { value: 'hr', label: 'HR' },
                                            { value: 'director', label: 'Director' },
                                            { value: 'superadmin', label: 'Superadmin' },
                                        ]} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Manager</label>
                                        <SelectField value={String(editForm.manager_id || '')} onChange={event => setEditForm(prev => prev ? { ...prev, manager_id: event.target.value || null } : prev)} disabled={!canEditAll} options={managerOptions} />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-medium">Join Date</label>
                                        <Input type="date" value={String(editForm.join_date || '')} onChange={event => setEditForm(prev => prev ? { ...prev, join_date: event.target.value || null } : prev)} disabled={!canEditAll} />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" onClick={() => editForm && updateMutation.mutate(editForm)} disabled={updateMutation.isPending}>
                                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                    {canToggleStatus ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => toggleStatusMutation.mutate(String(employee.status || 'active') === 'active' ? 'inactive' : 'active')}
                                            disabled={toggleStatusMutation.isPending}
                                        >
                                            {toggleStatusMutation.isPending ? 'Updating...' : String(employee.status || 'active') === 'active' ? 'Deactivate' : 'Activate'}
                                        </Button>
                                    ) : null}
                                </div>
                                {editMessage ? <p className="text-sm text-emerald-600">{editMessage}</p> : null}
                                {updateMutation.isError ? <p className="text-sm text-destructive">{updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update employee.'}</p> : null}
                                {toggleStatusMutation.isError ? <p className="text-sm text-destructive">{toggleStatusMutation.error instanceof Error ? toggleStatusMutation.error.message : 'Failed to update employee status.'}</p> : null}
                            </CardContent>
                        </Card>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Employee Actions</CardTitle>
                            <CardDescription>Add KPI records and assessment needs directly from this page.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {canAddKpi ? <Button type="button" onClick={() => setKpiOpen(true)}>Add KPI Record</Button> : null}
                            {canAddNeed ? <Button type="button" variant="outline" onClick={() => setNeedOpen(true)}>Add Assessment Need</Button> : null}
                            <Link to="/dashboard"><Button type="button" variant="outline">Open Dashboard</Button></Link>
                        </CardContent>
                    </Card>

                    <SummarySection icon={<ClipboardList className="size-4 text-primary" />} title="Assessment Summary" description="Gap level and last-assessment visibility from TNA need records." cards={assessmentCards} isLoading={insightsLoading} />
                    <SummarySection icon={<Target className="size-4 text-primary" />} title="KPI Summary" description="Latest KPI score, trend, and record count from the canonical insights endpoint." cards={kpiCards} isLoading={insightsLoading} />
                    <SummarySection icon={<GraduationCap className="size-4 text-primary" />} title="LMS Summary" description="Enrollment count and completion rate from the canonical insights endpoint." cards={lmsCards} isLoading={insightsLoading} />

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
                </>
            ) : null}

            <Modal
                open={kpiOpen}
                onClose={() => setKpiOpen(false)}
                title="Add KPI Record"
                description="Create a KPI record for this employee using the migrated KPI endpoint."
                actions={(
                    <>
                        <Button type="button" variant="outline" onClick={() => setKpiOpen(false)} disabled={createKpiMutation.isPending}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setKpiError('');
                                if (!/^\d{4}-\d{2}$/.test(kpiForm.period) || !kpiForm.score.trim()) {
                                    setKpiError('Period and score are required. Period must use YYYY-MM.');
                                    return;
                                }
                                createKpiMutation.mutate();
                            }}
                            disabled={createKpiMutation.isPending}
                        >
                            {createKpiMutation.isPending ? 'Saving...' : 'Create KPI Record'}
                        </Button>
                    </>
                )}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Period</label>
                        <Input placeholder="2026-04" value={kpiForm.period} onChange={event => setKpiForm(prev => ({ ...prev, period: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Score</label>
                        <Input type="number" value={kpiForm.score} onChange={event => setKpiForm(prev => ({ ...prev, score: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Target Value</label>
                        <Input type="number" value={kpiForm.target_value} onChange={event => setKpiForm(prev => ({ ...prev, target_value: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Notes</label>
                        <textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={kpiForm.notes} onChange={event => setKpiForm(prev => ({ ...prev, notes: event.target.value }))} />
                    </div>
                </div>
                {kpiError ? <p className="mt-4 text-sm text-destructive">{kpiError}</p> : null}
                {createKpiMutation.isError ? <p className="mt-4 text-sm text-destructive">{createKpiMutation.error instanceof Error ? createKpiMutation.error.message : 'Failed to create KPI record.'}</p> : null}
            </Modal>

            <Modal
                open={needOpen}
                onClose={() => setNeedOpen(false)}
                title="Add Assessment Need"
                description="Create a training need record with an automatically calculated gap level."
                actions={(
                    <>
                        <Button type="button" variant="outline" onClick={() => setNeedOpen(false)} disabled={createNeedMutation.isPending}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setNeedError('');
                                if (!needForm.competency_name.trim() || !needForm.required_level.trim() || !needForm.current_level.trim()) {
                                    setNeedError('Competency, required level, and current level are required.');
                                    return;
                                }
                                createNeedMutation.mutate();
                            }}
                            disabled={createNeedMutation.isPending}
                        >
                            {createNeedMutation.isPending ? 'Saving...' : 'Create Need'}
                        </Button>
                    </>
                )}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Competency</label>
                        <Input value={needForm.competency_name} onChange={event => setNeedForm(prev => ({ ...prev, competency_name: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Required Level</label>
                        <Input type="number" value={needForm.required_level} onChange={event => setNeedForm(prev => ({ ...prev, required_level: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Current Level</label>
                        <Input type="number" value={needForm.current_level} onChange={event => setNeedForm(prev => ({ ...prev, current_level: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Priority</label>
                        <SelectField value={needForm.priority} onChange={event => setNeedForm(prev => ({ ...prev, priority: event.target.value }))} options={[
                            { value: 'low', label: 'Low' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'high', label: 'High' },
                            { value: 'critical', label: 'Critical' },
                        ]} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Notes</label>
                        <textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={needForm.notes} onChange={event => setNeedForm(prev => ({ ...prev, notes: event.target.value }))} />
                    </div>
                </div>
                {needError ? <p className="mt-4 text-sm text-destructive">{needError}</p> : null}
                {createNeedMutation.isError ? <p className="mt-4 text-sm text-destructive">{createNeedMutation.error instanceof Error ? createNeedMutation.error.message : 'Failed to create assessment need.'}</p> : null}
            </Modal>
        </div>
    );
}
