import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Filter, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';

import { employeesAdapter, type EmployeeCreateInput } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SelectField, type SelectOption } from '@/components/ui/select';
import { useAuth } from '@/providers/AuthProvider';

interface EmployeeFilters {
    search: string;
    department: string;
    role: string;
    manager_id: string;
    status: '' | 'active' | 'inactive';
}

interface CreateEmployeeForm {
    name: string;
    email: string;
    department: string;
    position: string;
    role: 'employee' | 'manager' | 'hr' | 'superadmin' | 'director';
    manager_id: string;
    join_date: string;
}

function toOptions(labelAll: string, values: string[]): SelectOption[] {
    return [{ value: '', label: labelAll }, ...values.map(value => ({ value, label: value }))];
}

function emptyCreateForm(): CreateEmployeeForm {
    return {
        name: '',
        email: '',
        department: '',
        position: '',
        role: 'employee',
        manager_id: '',
        join_date: '',
    };
}

export function EmployeesPage() {
    const auth = useAuth();
    const queryClient = useQueryClient();
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
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState<CreateEmployeeForm>(emptyCreateForm());
    const [createError, setCreateError] = useState('');

    const listQuery = useQuery({
        queryKey: ['employees', 'list', filters, auth.user?.employee_id, auth.role],
        queryFn: () => employeesAdapter.list(filters, {
            employeeId: String(auth.user?.employee_id || ''),
            role: auth.role || null,
        }),
        staleTime: 30_000,
    });

    const employees = listQuery.data?.employees || [];
    const filterOptions = useMemo(() => employeesAdapter.getFilterOptions(employees), [employees]);
    const managerById = useMemo(
        () => new Map(employees.map(employee => [String(employee.employee_id), employee])),
        [employees],
    );

    const createMutation = useMutation({
        mutationFn: (payload: EmployeeCreateInput) => employeesAdapter.create(payload),
        onSuccess: async () => {
            setCreateOpen(false);
            setCreateForm(emptyCreateForm());
            setCreateError('');
            await queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
    });

    const stats = useMemo(() => {
        const active = employees.filter(employee => String(employee.status || 'active') === 'active').length;
        const inactive = employees.length - active;
        const departments = new Set(
            employees
                .map(employee => String(employee.department || '').trim())
                .filter(Boolean),
        ).size;
        return { total: employees.length, active, inactive, departments };
    }, [employees]);

    const departmentOptions = useMemo(() => toOptions('All departments', filterOptions.departments), [filterOptions.departments]);
    const roleOptions = useMemo(() => toOptions('All roles', filterOptions.roles), [filterOptions.roles]);
    const managerOptions = useMemo(() => [{ value: '', label: 'All managers' }, ...filterOptions.managers], [filterOptions.managers]);
    const statusOptions = useMemo(
        () => [
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
        ],
        [],
    );
    const canCreateEmployee = auth.role === 'superadmin' || auth.role === 'hr';
    const managerSelectOptions = useMemo(
        () => [{ value: '', label: 'No manager' }, ...employees
            .filter(employee => ['manager', 'hr', 'superadmin', 'director'].includes(String(employee.role || '').toLowerCase()))
            .map(employee => ({ value: String(employee.employee_id), label: `${employee.name} (${employee.employee_id})` }))],
        [employees],
    );

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle className="text-2xl">Workforce Directory</CardTitle>
                            <CardDescription>
                                Full employee management workflow with scoped create, inline detail editing, and status control in the React shell.
                            </CardDescription>
                        </div>
                        {canCreateEmployee ? (
                            <Button type="button" onClick={() => setCreateOpen(true)}>
                                <UserPlus className="size-4" />
                                Add Employee
                            </Button>
                        ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Employees</p>
                            <p className="text-2xl font-semibold">{stats.total}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                            <p className="text-2xl font-semibold">{stats.active}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inactive</p>
                            <p className="text-2xl font-semibold">{stats.inactive}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Departments</p>
                            <p className="text-2xl font-semibold">{stats.departments}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">Source: {listQuery.data?.source || 'supabase'}</Badge>
                        <Badge variant="outline">Role: {auth.role || '-'}</Badge>
                        <Badge variant="outline">
                            Scope: {auth.role === 'manager' ? 'My Team' : 'Full Workforce'}
                        </Badge>
                        {(listQuery.data?.deferred || []).map(item => (
                            <Badge key={item} variant="secondary">{item}</Badge>
                        ))}
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filter Employees</CardTitle>
                    <CardDescription>Search by name or email and narrow the directory by department, role, manager, and operational status.</CardDescription>
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
                                placeholder="Name or email"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</label>
                        <SelectField value={draftFilters.department} options={departmentOptions} onChange={event => setDraftFilters(prev => ({ ...prev, department: event.target.value }))} />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</label>
                        <SelectField value={draftFilters.role} options={roleOptions} onChange={event => setDraftFilters(prev => ({ ...prev, role: event.target.value }))} />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</label>
                        <SelectField value={draftFilters.manager_id} options={managerOptions} onChange={event => setDraftFilters(prev => ({ ...prev, manager_id: event.target.value }))} disabled={managerOptions.length <= 1} />
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                        <SelectField value={draftFilters.status} options={statusOptions} onChange={event => setDraftFilters(prev => ({ ...prev, status: event.target.value as EmployeeFilters['status'] }))} />
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
                                const reset = { search: '', department: '', role: '', manager_id: '', status: '' } as EmployeeFilters;
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
                            Server-side scope stays authoritative for create, read, and edit permissions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {employees.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No employees matched the current filters.</div>
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
                                            const status = String(employee.status || 'active').toLowerCase();
                                            return (
                                                <tr key={employee.employee_id} className="border-t">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium">{employee.name || employee.employee_id}</p>
                                                        <p className="text-xs text-muted-foreground">{employee.employee_id}</p>
                                                        <p className="text-xs text-muted-foreground">{employee.email || employee.auth_email || 'No email'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{employee.department || '-'}</td>
                                                    <td className="px-4 py-3"><Badge variant="outline">{employee.role}</Badge></td>
                                                    <td className="px-4 py-3">{manager?.name || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={status === 'active' ? 'secondary' : 'outline'}>{status === 'active' ? 'Active' : 'Inactive'}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link to={`/employees/${encodeURIComponent(String(employee.employee_id))}`}>
                                                            <Button type="button" size="sm" variant="outline">
                                                                Manage
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

            <Card className="border-amber-300/50 bg-amber-50/40">
                <CardContent className="flex items-start gap-3 py-4 text-sm text-amber-900">
                    <Users className="mt-0.5 size-4 shrink-0" />
                    Managers can edit department and position for their direct reports. HR and superadmin can create employees, edit full profiles, and toggle active status.
                </CardContent>
            </Card>

            <Modal
                open={createOpen}
                onClose={() => {
                    if (createMutation.isPending) return;
                    setCreateOpen(false);
                    setCreateError('');
                }}
                title="Add Employee"
                description="Create a new employee record, provision a Supabase auth user, and sync the profile mapping."
                actions={(
                    <>
                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setCreateError('');
                                const email = createForm.email.trim().toLowerCase();
                                if (!createForm.name.trim() || !email || !createForm.department.trim() || !createForm.position.trim()) {
                                    setCreateError('Name, email, department, and position are required.');
                                    return;
                                }
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                    setCreateError('Enter a valid email address.');
                                    return;
                                }
                                createMutation.mutate({
                                    name: createForm.name.trim(),
                                    email,
                                    department: createForm.department.trim(),
                                    position: createForm.position.trim(),
                                    role: createForm.role,
                                    manager_id: createForm.manager_id || null,
                                    join_date: createForm.join_date || null,
                                });
                            }}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Employee'}
                        </Button>
                    </>
                )}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <Input value={createForm.name} onChange={event => setCreateForm(prev => ({ ...prev, name: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input type="email" value={createForm.email} onChange={event => setCreateForm(prev => ({ ...prev, email: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Department</label>
                        <Input value={createForm.department} onChange={event => setCreateForm(prev => ({ ...prev, department: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Position</label>
                        <Input value={createForm.position} onChange={event => setCreateForm(prev => ({ ...prev, position: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Role</label>
                        <SelectField value={createForm.role} onChange={event => setCreateForm(prev => ({ ...prev, role: event.target.value as CreateEmployeeForm['role'] }))} options={[
                            { value: 'employee', label: 'Employee' },
                            { value: 'manager', label: 'Manager' },
                            { value: 'hr', label: 'HR' },
                            { value: 'director', label: 'Director' },
                            { value: 'superadmin', label: 'Superadmin' },
                        ]} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Manager</label>
                        <SelectField value={createForm.manager_id} onChange={event => setCreateForm(prev => ({ ...prev, manager_id: event.target.value }))} options={managerSelectOptions} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Join Date</label>
                        <Input type="date" value={createForm.join_date} onChange={event => setCreateForm(prev => ({ ...prev, join_date: event.target.value }))} />
                    </div>
                </div>
                {createError ? <p className="mt-4 text-sm text-destructive">{createError}</p> : null}
                {createMutation.isError ? (
                    <p className="mt-4 text-sm text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create employee.'}</p>
                ) : null}
            </Modal>
        </div>
    );
}
