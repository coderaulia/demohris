import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Filter, Search, ShieldCheck, UserCog, Users } from 'lucide-react';

import { employeesAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField, type SelectOption } from '@/components/ui/select';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';

interface EmployeeFilters {
    search: string;
    department: string;
    role: string;
    manager_id: string;
    status: '' | 'assessed' | 'pending';
}

function assessedStatus(percentage: unknown, selfPercentage: unknown) {
    const managerScore = Number(percentage);
    const selfScore = Number(selfPercentage);
    return (Number.isFinite(managerScore) && managerScore > 0) || (Number.isFinite(selfScore) && selfScore > 0)
        ? 'assessed'
        : 'pending';
}

function toOptions(
    labelAll: string,
    values: string[],
): SelectOption[] {
    return [{ value: '', label: labelAll }, ...values.map(value => ({ value, label: value }))];
}

export function EmployeesPage() {
    const auth = useAuth();
    const [draftFilters, setDraftFilters] = useState<EmployeeFilters>({
        search: '',
        department: '',
        role: '',
        manager_id: '',
        status: '',
    });
    const [filters, setFilters] = useState<EmployeeFilters>({
        search: '',
        department: '',
        role: '',
        manager_id: '',
        status: '',
    });

    const listQuery = useQuery({
        queryKey: ['employees', 'list', filters, auth.user?.employee_id, auth.role],
        queryFn: () =>
            employeesAdapter.list(filters, {
                employeeId: String(auth.user?.employee_id || ''),
                role: auth.role || null,
            }),
        staleTime: 30_000,
    });

    const employees = listQuery.data?.employees || [];
    const filterOptions = useMemo(() => employeesAdapter.getFilterOptions(employees), [employees]);
    const managerById = useMemo(
        () =>
            new Map(
                employees.map(employee => [
                    String(employee.employee_id),
                    employee,
                ]),
            ),
        [employees],
    );

    const stats = useMemo(() => {
        const assessed = employees.filter(employee => assessedStatus(employee.percentage, employee.self_percentage) === 'assessed').length;
        const pending = employees.length - assessed;
        const departments = new Set(
            employees
                .map(employee => String(employee.department || '').trim())
                .filter(Boolean),
        ).size;
        return {
            total: employees.length,
            assessed,
            pending,
            departments,
        };
    }, [employees]);

    const departmentOptions = useMemo(
        () => toOptions('All departments', filterOptions.departments),
        [filterOptions.departments],
    );
    const roleOptions = useMemo(
        () => toOptions('All roles', filterOptions.roles),
        [filterOptions.roles],
    );
    const managerOptions = useMemo(
        () => [{ value: '', label: 'All managers' }, ...filterOptions.managers],
        [filterOptions.managers],
    );
    const statusOptions = useMemo(
        () => [
            { value: '', label: 'All statuses' },
            ...filterOptions.status.map(value => ({
                value,
                label: value === 'assessed' ? 'Assessed' : 'Pending',
            })),
        ],
        [filterOptions.status],
    );

    const canOpenCrud = auth.role === 'superadmin';
    const legacyEmployeesHref = `${env.legacyAppUrl.replace(/\/$/, '')}#employees`;

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle className="text-2xl">Employees</CardTitle>
                            <CardDescription>
                                Read-first employee management workflow with role-aware visibility, filters, and drill-down detail.
                            </CardDescription>
                        </div>
                        {canOpenCrud ? (
                            <a href={legacyEmployeesHref} className="inline-flex">
                                <Button type="button" variant="outline">
                                    <UserCog className="size-4" />
                                    Open Legacy CRUD
                                </Button>
                            </a>
                        ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Employees</p>
                            <p className="text-2xl font-semibold">{stats.total}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Assessed</p>
                            <p className="text-2xl font-semibold">{stats.assessed}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                            <p className="text-2xl font-semibold">{stats.pending}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Departments</p>
                            <p className="text-2xl font-semibold">{stats.departments}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">Source: {listQuery.data?.source || 'loading'}</Badge>
                        <Badge variant="outline">Role: {auth.role || '-'}</Badge>
                        {listQuery.data?.deferred.map(item => (
                            <Badge key={item} variant="secondary">{item}</Badge>
                        ))}
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filter Employees</CardTitle>
                    <CardDescription>Search by employee identity and narrow by department, role, manager, and assessment status.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className="xl:col-span-2">
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Search</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={draftFilters.search}
                                onChange={event => setDraftFilters(prev => ({ ...prev, search: event.target.value }))}
                                className="pl-9"
                                placeholder="Name, employee ID, email..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</label>
                        <SelectField
                            value={draftFilters.department}
                            options={departmentOptions}
                            onChange={event => setDraftFilters(prev => ({ ...prev, department: event.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</label>
                        <SelectField
                            value={draftFilters.role}
                            options={roleOptions}
                            onChange={event => setDraftFilters(prev => ({ ...prev, role: event.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</label>
                        <SelectField
                            value={draftFilters.manager_id}
                            options={managerOptions}
                            onChange={event => setDraftFilters(prev => ({ ...prev, manager_id: event.target.value }))}
                            disabled={managerOptions.length <= 1}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                        <SelectField
                            value={draftFilters.status}
                            options={statusOptions}
                            onChange={event => setDraftFilters(prev => ({ ...prev, status: event.target.value as EmployeeFilters['status'] }))}
                        />
                    </div>
                    <div className="md:col-span-2 xl:col-span-6 flex flex-wrap gap-2 pt-1">
                        <Button type="button" onClick={() => setFilters(draftFilters)} disabled={listQuery.isFetching}>
                            <Filter className="size-4" />
                            Apply Filters
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                const reset = {
                                    search: '',
                                    department: '',
                                    role: '',
                                    manager_id: '',
                                    status: '',
                                } as EmployeeFilters;
                                setDraftFilters(reset);
                                setFilters(reset);
                            }}
                        >
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {listQuery.isLoading ? (
                <Card>
                    <CardContent className="py-10 text-sm text-muted-foreground">Loading employee directory...</CardContent>
                </Card>
            ) : null}

            {listQuery.isError ? (
                <Card className="border-destructive/40">
                    <CardHeader>
                        <CardTitle className="text-destructive">Failed To Load Employees</CardTitle>
                        <CardDescription>{listQuery.error instanceof Error ? listQuery.error.message : 'Unknown employee list error.'}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {!listQuery.isLoading && !listQuery.isError ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Employee Directory</CardTitle>
                        <CardDescription>
                            <ShieldCheck className="mr-1 inline size-4 text-primary" />
                            Backend/RLS visibility controls remain authoritative. The shell renders only what your role can read.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {employees.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                No employees matched the current filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                            <th className="px-4 py-3 font-medium">Employee</th>
                                            <th className="px-4 py-3 font-medium">Department</th>
                                            <th className="px-4 py-3 font-medium">Role</th>
                                            <th className="px-4 py-3 font-medium">Manager</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map(employee => {
                                            const manager = managerById.get(String(employee.manager_id || ''));
                                            const status = assessedStatus(employee.percentage, employee.self_percentage);

                                            return (
                                                <tr key={employee.employee_id} className="border-t">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{employee.name || employee.employee_id}</p>
                                                        <p className="text-xs text-muted-foreground">{employee.employee_id}</p>
                                                        <p className="text-xs text-muted-foreground">{employee.position || 'Position not set'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{employee.department || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline">{employee.role}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3">{manager?.name || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={status === 'assessed' ? 'secondary' : 'outline'}>
                                                            {status === 'assessed' ? 'Assessed' : 'Pending'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link to={`/employees/${encodeURIComponent(String(employee.employee_id))}`}>
                                                            <Button type="button" size="sm" variant="outline">
                                                                View Detail
                                                                <ArrowUpRight className="size-4" />
                                                            </Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : null}

            {auth.role === 'employee' ? (
                <Card className="border-amber-300/50 bg-amber-50/40">
                    <CardContent className="flex items-start gap-3 py-4 text-sm text-amber-900">
                        <Users className="mt-0.5 size-4 shrink-0" />
                        Employee role scope is restricted to self-profile visibility in this shell to preserve parity with legacy access controls.
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
