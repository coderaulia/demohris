import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField, type SelectOption } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { kpiAdapter, type KpiRecordEnriched } from '@/adapters/kpiAdapter';
import { employeesAdapter } from '@/adapters/employeesAdapter';
import { useAuth } from '@/providers/AuthProvider';

// ==================================================
// KPI RECORDS PAGE
// ==================================================

export function KpiRecordsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [periodFilter, setPeriodFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [editingRecord, setEditingRecord] = useState<KpiRecordEnriched | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const role = String(user?.role || 'employee').toLowerCase();

    const { data: employeesData } = useQuery({
        queryKey: ['employees', 'list'],
        queryFn: () => employeesAdapter.list({}, { role: user?.role || null, employeeId: user?.employee_id || '' }),
    });

    const { data: recordsData, isLoading } = useQuery({
        queryKey: ['kpi-records', employeeFilter, periodFilter, departmentFilter],
        queryFn: () => kpiAdapter.listRecords({
            employee_id: employeeFilter || undefined,
            period: periodFilter || undefined,
        }),
    });

    const records = recordsData?.records || [];

    const filteredRecords = useMemo(() => {
        if (!departmentFilter) return records;
        return records.filter(r => r.department === departmentFilter);
    }, [records, departmentFilter]);

    const departments = useMemo(() => {
        const deptSet = new Set<string>();
        records.forEach(r => { if (r.department) deptSet.add(r.department); });
        return Array.from(deptSet).sort();
    }, [records]);

    const employeeOptions: SelectOption[] = useMemo(() => {
        const opts: SelectOption[] = [{ value: '', label: 'All Employees' }];
        employeesData?.employees?.forEach(emp => {
            opts.push({ value: emp.employee_id, label: emp.name });
        });
        return opts;
    }, [employeesData]);

    const departmentOptions: SelectOption[] = useMemo(() => {
        const opts: SelectOption[] = [{ value: '', label: 'All Departments' }];
        departments.forEach(d => opts.push({ value: d, label: d }));
        return opts;
    }, [departments]);

    const handleDelete = useCallback(async (recordId: string) => {
        if (!confirm('Are you sure you want to delete this KPI record?')) return;
        try {
            await kpiAdapter.deleteRecord(recordId);
            queryClient.invalidateQueries({ queryKey: ['kpi-records'] });
        } catch (error) {
            console.error('Failed to delete record:', error);
            alert('Failed to delete record');
        }
    }, [queryClient]);

    const handleEdit = useCallback((record: KpiRecordEnriched) => {
        setEditingRecord(record);
        setShowEditModal(true);
    }, []);

    const getAchievementBadge = (pct: number | null) => {
        if (pct === null) return { label: 'N/A', className: 'bg-gray-100 text-gray-600' };
        if (pct >= 100) return { label: `${pct}%`, className: 'bg-green-100 text-green-700' };
        if (pct >= 80) return { label: `${pct}%`, className: 'bg-blue-100 text-blue-700' };
        if (pct >= 60) return { label: `${pct}%`, className: 'bg-amber-100 text-amber-700' };
        return { label: `${pct}%`, className: 'bg-red-100 text-red-700' };
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">KPI Achievement Records</h2>
                    <p className="text-sm text-muted-foreground">
                        {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                {role !== 'employee' && (
                    <SelectField
                        options={departmentOptions}
                        value={departmentFilter}
                        onChange={e => setDepartmentFilter(e.target.value)}
                        className="w-[180px]"
                    />
                )}
                <SelectField
                    options={employeeOptions}
                    value={employeeFilter}
                    onChange={e => setEmployeeFilter(e.target.value)}
                    className="w-[200px]"
                />
                <Input
                    type="month"
                    value={periodFilter}
                    onChange={e => setPeriodFilter(e.target.value)}
                    placeholder="Period"
                    className="w-[160px]"
                />
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading records...</div>
            ) : filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No KPI records found</div>
            ) : (
                <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-3 font-medium">Employee</th>
                                <th className="text-left p-3 font-medium">KPI</th>
                                <th className="text-left p-3 font-medium">Period</th>
                                <th className="text-right p-3 font-medium">Value</th>
                                <th className="text-right p-3 font-medium">Target</th>
                                <th className="text-right p-3 font-medium">Achievement</th>
                                <th className="text-left p-3 font-medium">Updated</th>
                                {(role === 'superadmin' || role === 'hr') && (
                                    <th className="text-left p-3 font-medium">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map(record => {
                                const badge = getAchievementBadge(record.achievement_pct);
                                return (
                                    <tr key={record.id} className="border-t hover:bg-muted/30">
                                        <td className="p-3">
                                            <div className="font-medium">{record.employee_name}</div>
                                            <div className="text-xs text-muted-foreground">{record.department}</div>
                                        </td>
                                        <td className="p-3">{record.kpi_name}</td>
                                        <td className="p-3">{record.period}</td>
                                        <td className="p-3 text-right">{record.actual_value}{record.unit}</td>
                                        <td className="p-3 text-right">{record.target_value ?? '—'}{record.unit}</td>
                                        <td className="p-3 text-right">
                                            <Badge className={cn('text-xs', badge.className)}>
                                                {badge.label}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <div className="text-xs">{record.updated_by_name || record.submitted_by}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {record.updated_at || record.submitted_at ? new Date(record.updated_at || record.submitted_at || '').toLocaleString() : ''}
                                            </div>
                                        </td>
                                        {(role === 'superadmin' || role === 'hr') && (
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>✏️</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(record.id)}>🗑️</Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showEditModal && editingRecord && (
                <KpiRecordEditModal
                    record={editingRecord}
                    onClose={() => { setShowEditModal(false); setEditingRecord(null); }}
                    onSuccess={() => {
                        setShowEditModal(false);
                        setEditingRecord(null);
                        queryClient.invalidateQueries({ queryKey: ['kpi-records'] });
                    }}
                />
            )}
        </div>
    );
}

// ==================================================
// KPI RECORD EDIT MODAL
// ==================================================

function KpiRecordEditModal({
    record,
    onClose,
    onSuccess,
}: {
    record: KpiRecordEnriched;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [value, setValue] = useState(String(record.actual_value));
    const [targetValue, setTargetValue] = useState(String(record.target_value || ''));
    const [period, setPeriod] = useState(record.period);
    const [notes, setNotes] = useState(record.notes || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await kpiAdapter.updateRecord({
                record_id: record.id,
                period,
                actual_value: Number(value),
                target_value: targetValue ? Number(targetValue) : undefined,
                notes: notes || undefined,
            });
            onSuccess();
        } catch (error) {
            console.error('Failed to update record:', error);
            alert('Failed to update record');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold">Edit KPI Record</h3>
                    <p className="text-sm text-muted-foreground">{record.employee_name} — {record.kpi_name}</p>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium">Period</label>
                        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} required />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Actual Value</label>
                        <Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} required />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Target Value</label>
                        <Input type="number" step="0.01" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Notes</label>
                        <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
