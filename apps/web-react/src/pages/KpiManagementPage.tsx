import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField, type SelectOption } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { kpiAdapter } from '@/adapters/kpiAdapter';
import { employeesAdapter } from '@/adapters/employeesAdapter';
import { useAuth } from '@/providers/AuthProvider';

// ==================================================
// KPI MANAGEMENT SETTINGS PAGE
// ==================================================

export function KpiManagementPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const role = String(user?.role || '').toLowerCase();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                <EmployeeTargetsConfig />
                {role === 'superadmin' && <KpiGovernanceSection />}
                {(role === 'superadmin' || role === 'hr') && <KpiDefinitionForm />}
            </div>

            <div className="space-y-6">
                <KpiDefinitionsList />
                {(role === 'superadmin' || role === 'hr') && <PendingApprovalsSection />}
                <KpiVersionHistory />
            </div>
        </div>
    );
}

// ==================================================
// EMPLOYEE TARGETS CONFIG
// ==================================================

function EmployeeTargetsConfig() {
    const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [overrides, setOverrides] = useState<Record<string, string>>({});

    const { data: employeesData } = useQuery({
        queryKey: ['employees', 'list'],
        queryFn: () => employeesAdapter.list({}, { role: null, employeeId: '' }),
    });

    const { data: targetsData } = useQuery({
        queryKey: ['kpi-targets', selectedEmployeeId, targetMonth],
        queryFn: () => kpiAdapter.getTargets(selectedEmployeeId, targetMonth),
        enabled: !!selectedEmployeeId && !!targetMonth,
    });

    const employeeOptions: SelectOption[] = useMemo(() => {
        const opts: SelectOption[] = [{ value: '', label: 'Choose...' }];
        employeesData?.employees?.forEach(emp => {
            opts.push({ value: emp.employee_id, label: emp.name });
        });
        return opts;
    }, [employeesData]);

    const handleSaveTargets = async () => {
        if (!selectedEmployeeId || !targetMonth) return;
        const targets = Object.entries(overrides)
            .filter(([_, v]) => v !== '')
            .map(([kpiDefinitionId, targetValue]) => ({
                kpi_definition_id: kpiDefinitionId,
                target_value: Number(targetValue),
            }));

        if (targets.length === 0) return;

        try {
            await kpiAdapter.setTargets(selectedEmployeeId, targetMonth, targets);
            alert('Targets saved successfully');
        } catch (error) {
            console.error('Failed to save targets:', error);
            alert('Failed to save targets');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Employee Targets Config</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Target Month</label>
                        <Input type="month" value={targetMonth} onChange={e => setTargetMonth(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Select Employee</label>
                        <SelectField
                            options={employeeOptions}
                            value={selectedEmployeeId}
                            onChange={e => setSelectedEmployeeId(e.target.value)}
                        />
                    </div>
                </div>

                {targetsData?.targets && targetsData.targets.length > 0 && (
                    <div className="space-y-2">
                        {targetsData.targets.map(target => (
                            <div key={target.kpi_definition_id} className="flex items-center gap-3">
                                <span className="text-sm flex-1">{target.kpi_name}</span>
                                <span className="text-xs text-muted-foreground w-16 text-right">
                                    Default: {target.target_value}{target.unit}
                                </span>
                                <Input
                                    type="number"
                                    className="w-24"
                                    placeholder={String(target.target_value)}
                                    value={overrides[target.kpi_definition_id] || ''}
                                    onChange={e => setOverrides(prev => ({
                                        ...prev,
                                        [target.kpi_definition_id]: e.target.value,
                                    }))}
                                />
                                <span className="text-xs text-muted-foreground w-8">{target.unit}</span>
                            </div>
                        ))}
                    </div>
                )}

                <Button onClick={handleSaveTargets} disabled={!selectedEmployeeId} className="w-full">
                    Save Targets
                </Button>
            </CardContent>
        </Card>
    );
}

// ==================================================
// KPI GOVERNANCE
// ==================================================

function KpiGovernanceSection() {
    const { data: governanceData, isLoading } = useQuery({
        queryKey: ['kpi-governance'],
        queryFn: () => kpiAdapter.getGovernance(),
    });

    const [requireHrApproval, setRequireHrApproval] = useState(governanceData?.require_hr_approval || false);

    const handleSave = async () => {
        try {
            await kpiAdapter.setGovernance(requireHrApproval);
            alert('Governance rule saved');
        } catch (error) {
            console.error('Failed to save governance:', error);
            alert('Failed to save governance rule');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">KPI Governance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={requireHrApproval}
                            onChange={e => setRequireHrApproval(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <span className="text-sm font-medium">Require HR approval for manager KPI changes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                    When enabled, KPI changes made by managers will be pending until approved by HR or Superadmin.
                </p>
                <Button onClick={handleSave} disabled={isLoading} className="w-full">
                    Save Governance Rule
                </Button>
            </CardContent>
        </Card>
    );
}

// ==================================================
// KPI DEFINITION FORM
// ==================================================

function KpiDefinitionForm() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        name: '',
        description: '',
        applies_to_position: '',
        effective_date: new Date().toISOString().slice(0, 10),
        unit: '%',
        target_value: '',
        change_note: '',
        kpi_type: 'direct' as 'direct' | 'ratio',
    });

    const unitOptions: SelectOption[] = [
        { value: '%', label: '%' },
        { value: 'Count', label: 'Count' },
        { value: 'IDR', label: 'IDR' },
        { value: 'Days', label: 'Days' },
        { value: 'Ratio', label: 'Ratio' },
    ];

    const typeOptions: SelectOption[] = [
        { value: 'direct', label: 'Direct' },
        { value: 'ratio', label: 'Ratio' },
    ];

    const handleSubmit = async () => {
        if (!form.name || !form.effective_date) return;
        try {
            await kpiAdapter.createDefinition({
                name: form.name,
                description: form.description || undefined,
                unit: form.unit,
                kpi_type: form.kpi_type,
                applies_to_position: form.applies_to_position || undefined,
                target_value: form.target_value ? Number(form.target_value) : undefined,
                effective_date: form.effective_date,
                change_note: form.change_note || undefined,
            });
            queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
            setForm({
                name: '',
                description: '',
                applies_to_position: '',
                effective_date: new Date().toISOString().slice(0, 10),
                unit: '%',
                target_value: '',
                change_note: '',
                kpi_type: 'direct',
            });
            alert('KPI definition created');
        } catch (error) {
            console.error('Failed to create definition:', error);
            alert('Failed to create KPI definition');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">KPI Definition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <Input
                    placeholder="KPI Name"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                    placeholder="Description"
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        placeholder="Apply to Position"
                        value={form.applies_to_position}
                        onChange={e => setForm(prev => ({ ...prev, applies_to_position: e.target.value }))}
                    />
                    <Input
                        type="date"
                        value={form.effective_date}
                        onChange={e => setForm(prev => ({ ...prev, effective_date: e.target.value }))}
                    />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <SelectField
                        options={unitOptions}
                        value={form.unit}
                        onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                    />
                    <Input
                        type="number"
                        placeholder="Target Value"
                        value={form.target_value}
                        onChange={e => setForm(prev => ({ ...prev, target_value: e.target.value }))}
                    />
                    <SelectField
                        options={typeOptions}
                        value={form.kpi_type}
                        onChange={e => setForm(prev => ({ ...prev, kpi_type: e.target.value as 'direct' | 'ratio' }))}
                    />
                </div>
                <Input
                    placeholder="Change Note (optional)"
                    value={form.change_note}
                    onChange={e => setForm(prev => ({ ...prev, change_note: e.target.value }))}
                />
                <div className="flex gap-2">
                    <Button onClick={handleSubmit} className="flex-1">Save</Button>
                    <Button
                        variant="outline"
                        onClick={() => setForm({
                            name: '',
                            description: '',
                            applies_to_position: '',
                            effective_date: new Date().toISOString().slice(0, 10),
                            unit: '%',
                            target_value: '',
                            change_note: '',
                            kpi_type: 'direct',
                        })}
                    >
                        Clear
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ==================================================
// KPI DEFINITIONS LIST
// ==================================================

function KpiDefinitionsList() {
    const { data: definitionsData, isLoading } = useQuery({
        queryKey: ['kpi-definitions'],
        queryFn: () => kpiAdapter.getDefinitions({}),
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-100 text-green-700 text-xs">Approved</Badge>;
            case 'pending': return <Badge className="bg-amber-100 text-amber-700 text-xs">Pending</Badge>;
            case 'rejected': return <Badge className="bg-red-100 text-red-700 text-xs">Rejected</Badge>;
            case 'archived': return <Badge className="bg-gray-100 text-gray-600 text-xs">Archived</Badge>;
            default: return <Badge className="bg-gray-100 text-gray-600 text-xs">{status}</Badge>;
        }
    };

    if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">KPI Definitions</CardTitle>
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm">↓ Export</Button>
                    <Button variant="ghost" size="sm">↑ Import</Button>
                </div>
            </CardHeader>
            <CardContent>
                {definitionsData?.definitions ? (
                    <div className="space-y-4">
                        {Object.entries(definitionsData.definitions).map(([category, defs]) => (
                            <div key={category}>
                                <h4 className="font-semibold text-sm mb-2 text-muted-foreground">{category}</h4>
                                <div className="space-y-2">
                                    {defs.map((def: Record<string, unknown>) => (
                                        <div key={String(def.id)} className="flex items-start justify-between p-3 bg-muted/30 rounded-md">
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{String(def.name)}</div>
                                                {def.description && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">{String(def.description)}</div>
                                                )}
                                                <div className="flex gap-2 mt-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        Target: {def.target_value ?? '—'}{def.unit}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {String(def.effective_date)}
                                                    </Badge>
                                                    {getStatusBadge(String(def.status))}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">📋</Button>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">✏️</Button>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">🗑️</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted-foreground">No KPI definitions found</div>
                )}
            </CardContent>
        </Card>
    );
}

// ==================================================
// PENDING APPROVALS SECTION
// ==================================================

function PendingApprovalsSection() {
    const queryClient = useQueryClient();

    const { data: approvalsData, isLoading } = useQuery({
        queryKey: ['kpi-approvals'],
        queryFn: () => kpiAdapter.getPendingApprovals(),
    });

    const handleApprove = async (definitionId: string) => {
        try {
            await kpiAdapter.approveDefinition(definitionId);
            queryClient.invalidateQueries({ queryKey: ['kpi-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
        } catch (error) {
            console.error('Failed to approve:', error);
        }
    };

    const handleReject = async (definitionId: string) => {
        try {
            await kpiAdapter.rejectDefinition(definitionId);
            queryClient.invalidateQueries({ queryKey: ['kpi-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
        } catch (error) {
            console.error('Failed to reject:', error);
        }
    };

    if (isLoading) return <div className="text-center py-4 text-muted-foreground">Loading...</div>;

    const pending = approvalsData?.pending || [];
    if (pending.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Pending KPI Approvals</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {pending.map((item: Record<string, unknown>) => (
                        <div key={String(item.id)} className="flex items-center justify-between p-3 bg-amber-50 rounded-md">
                            <div>
                                <div className="font-medium text-sm">{String(item.name)}</div>
                                <div className="text-xs text-muted-foreground">
                                    by {String(item.created_by || 'Unknown')} · {String(item.change_note || 'No note')}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(String(item.id))}>
                                    Approve
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleReject(String(item.id))}>
                                    Reject
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// ==================================================
// KPI VERSION HISTORY
// ==================================================

function KpiVersionHistory() {
    const { data: historyData, isLoading } = useQuery({
        queryKey: ['kpi-version-history'],
        queryFn: () => kpiAdapter.getVersionHistory(undefined, 20),
    });

    if (isLoading) return <div className="text-center py-4 text-muted-foreground">Loading...</div>;

    const history = historyData?.history || [];
    if (history.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">KPI Version History</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-2 font-medium">Type</th>
                                <th className="text-left p-2 font-medium">Scope</th>
                                <th className="text-left p-2 font-medium">Effective</th>
                                <th className="text-center p-2 font-medium">Version</th>
                                <th className="text-center p-2 font-medium">Status</th>
                                <th className="text-right p-2 font-medium">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item: Record<string, unknown>, idx: number) => (
                                <tr key={idx} className="border-t">
                                    <td className="p-2">
                                        <Badge className={cn(
                                            'text-xs',
                                            item.type === 'created' ? 'bg-green-100 text-green-700' :
                                            item.type === 'updated' ? 'bg-blue-100 text-blue-700' :
                                            'bg-red-100 text-red-700'
                                        )}>
                                            {String(item.type)}
                                        </Badge>
                                    </td>
                                    <td className="p-2">{String(item.scope)}</td>
                                    <td className="p-2">{String(item.effective)}</td>
                                    <td className="p-2 text-center">{String(item.version)}</td>
                                    <td className="p-2 text-center">{String(item.status)}</td>
                                    <td className="p-2 text-right">{item.value !== null ? String(item.value) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
