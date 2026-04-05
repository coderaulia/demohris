import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField, type SelectOption } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { kpiAdapter } from '@/adapters/kpiAdapter';
import { employeesAdapter } from '@/adapters/employeesAdapter';
import { useAuth } from '@/providers/AuthProvider';

// ==================================================
// KPI INPUT PAGE — Assessment Setup + KPI Achievement Input
// ==================================================

export function KpiInputPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [showInputPanel, setShowInputPanel] = useState(false);

    const role = String(user?.role || 'employee').toLowerCase();

    const { data: employeesData, isLoading: loadingEmployees } = useQuery({
        queryKey: ['employees', 'list', role],
        queryFn: () => employeesAdapter.list({}, { role: user?.role || null, employeeId: user?.employee_id || '' }),
    });

    const selectedEmployee = useMemo(() => {
        if (!selectedEmployeeId || !employeesData?.employees) return null;
        return employeesData.employees.find(e => e.employee_id === selectedEmployeeId) || null;
    }, [selectedEmployeeId, employeesData]);

    const employeeOptions: SelectOption[] = useMemo(() => {
        const opts: SelectOption[] = [{ value: '', label: 'Choose an employee...' }];
        employeesData?.employees?.forEach(emp => {
            opts.push({ value: emp.employee_id, label: emp.name });
        });
        return opts;
    }, [employeesData]);

    const handleSelectEmployee = useCallback((empId: string) => {
        setSelectedEmployeeId(empId);
        setShowInputPanel(false);
    }, []);

    const handleInputKpi = useCallback(() => {
        if (selectedEmployeeId) setShowInputPanel(true);
    }, [selectedEmployeeId]);

    const handleChangeEmployee = useCallback(() => {
        setShowInputPanel(false);
        setSelectedEmployeeId('');
    }, []);

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-2">Assessment Setup</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>Assessment Flow:</strong> Manager assesses employee competencies →
                            Employee reviews & completes self-assessment
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Select Employee</label>
                            <SelectField
                                options={employeeOptions}
                                value={selectedEmployeeId}
                                onChange={e => handleSelectEmployee(e.target.value)}
                            />
                        </div>
                    </div>

                    {selectedEmployee && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <InfoField label="Employee ID" value={selectedEmployee.employee_id} />
                            <InfoField label="Full Name" value={selectedEmployee.name} />
                            <InfoField label="Join Date" value={selectedEmployee.join_date || '—'} />
                            <InfoField label="Seniority" value={selectedEmployee.seniority || '—'} />
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            disabled={!selectedEmployeeId}
                            onClick={() => {
                                if (selectedEmployeeId) {
                                    window.location.href = `/tna/employee/${selectedEmployeeId}`;
                                }
                            }}
                        >
                            Assess Competencies
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={!selectedEmployeeId}
                            onClick={handleInputKpi}
                        >
                            Input KPI Achievement
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {showInputPanel && selectedEmployee && (
                <KpiInputPanel
                    employee={selectedEmployee}
                    onChangeEmployee={handleChangeEmployee}
                    onSuccess={() => {
                        setShowInputPanel(false);
                        queryClient.invalidateQueries({ queryKey: ['kpi-records'] });
                    }}
                />
            )}
        </div>
    );
}

// ==================================================
// INFO FIELD
// ==================================================

function InfoField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-medium text-sm">{value}</div>
        </div>
    );
}

// ==================================================
// KPI INPUT PANEL
// ==================================================

function KpiInputPanel({
    employee,
    onChangeEmployee,
    onSuccess,
}: {
    employee: { employee_id: string; name: string; position: string };
    onChangeEmployee: () => void;
    onSuccess: () => void;
}) {
    const [selectedKpiId, setSelectedKpiId] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [numerator, setNumerator] = useState('');
    const [denominator, setDenominator] = useState('');
    const [actualValue, setActualValue] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: definitionsData } = useQuery({
        queryKey: ['kpi-definitions', employee.position],
        queryFn: () => kpiAdapter.getDefinitions({ applies_to_position: employee.position }),
        enabled: !!employee.position,
    });

    const { data: targetsData } = useQuery({
        queryKey: ['kpi-targets', employee.employee_id, period],
        queryFn: () => kpiAdapter.getTargets(employee.employee_id, period),
        enabled: !!employee.employee_id && !!period,
    });

    const definitions = useMemo(() => {
        const defs: Array<Record<string, unknown>> = [];
        if (definitionsData?.definitions) {
            for (const category of Object.values(definitionsData.definitions)) {
                if (Array.isArray(category)) defs.push(...category);
            }
        }
        return defs;
    }, [definitionsData]);

    const kpiOptions: SelectOption[] = useMemo(() => {
        const opts: SelectOption[] = [{ value: '', label: 'Select a KPI...' }];
        definitions.forEach((def: Record<string, unknown>) => {
            opts.push({ value: String(def.id), label: `${String(def.name)} (${String(def.unit)})` });
        });
        return opts;
    }, [definitions]);

    const selectedKpi = useMemo(() => {
        return definitions.find((d: Record<string, unknown>) => String(d.id) === selectedKpiId) || null;
    }, [definitions, selectedKpiId]);

    const selectedTarget = useMemo(() => {
        if (!targetsData?.targets || !selectedKpiId) return null;
        return targetsData.targets.find(t => t.kpi_definition_id === selectedKpiId) || null;
    }, [targetsData, selectedKpiId]);

    const kpiType = String(selectedKpi?.kpi_type || 'direct').trim();
    const unit = String(selectedKpi?.unit || '%').trim();
    const targetValue = selectedTarget?.target_value ?? (selectedKpi?.target_value as number | null) ?? null;

    const finalValue = useMemo(() => {
        if (kpiType === 'ratio' && numerator && denominator) {
            const num = Number(numerator);
            const den = Number(denominator);
            if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
                return Math.round((num / den) * 10000) / 100;
            }
        }
        return null;
    }, [kpiType, numerator, denominator]);

    const handleSubmit = async () => {
        if (!selectedKpiId || !period) return;
        setIsSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                employee_id: employee.employee_id,
                kpi_definition_id: selectedKpiId,
                period,
                notes: notes || undefined,
            };

            if (kpiType === 'ratio') {
                payload.numerator = Number(numerator);
                payload.denominator = Number(denominator);
            } else {
                payload.actual_value = Number(actualValue);
            }

            await kpiAdapter.createRecord(payload);
            onSuccess();
        } catch (error) {
            console.error('Failed to submit KPI achievement:', error);
            alert('Failed to submit KPI achievement');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Input KPI Achievement</h3>
                    <Button variant="link" className="text-sm" onClick={onChangeEmployee}>
                        Change Employee
                    </Button>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                    <p className="text-sm text-green-800">
                        Log actual KPI values for <strong>{employee.name}</strong> for a specific period.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">KPI Metric</label>
                        <SelectField
                            options={kpiOptions}
                            value={selectedKpiId}
                            onChange={e => setSelectedKpiId(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Period</label>
                        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
                    </div>
                </div>

                {selectedKpi && (
                    <div className="space-y-4 mb-4">
                        {kpiType === 'ratio' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Attained (Numerator)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={numerator}
                                        onChange={e => setNumerator(e.target.value)}
                                        placeholder="e.g. 85"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Total (Denominator)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={denominator}
                                        onChange={e => setDenominator(e.target.value)}
                                        placeholder="e.g. 100"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-sm font-medium mb-1 block">Actual Value</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={actualValue}
                                    onChange={e => setActualValue(e.target.value)}
                                    placeholder={`Enter value in ${unit}`}
                                />
                            </div>
                        )}

                        {kpiType === 'ratio' && finalValue !== null && (
                            <div className="bg-muted rounded-md p-3">
                                <span className="text-sm text-muted-foreground">Final Value: </span>
                                <span className="font-semibold">{finalValue}{unit}</span>
                            </div>
                        )}

                        {targetValue !== null && (
                            <div className="text-sm text-muted-foreground">
                                Target: <span className="font-medium">{targetValue}{unit}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4">
                    <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                    <textarea
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        rows={3}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add any notes about this achievement..."
                    />
                </div>

                <Button
                    className="w-full"
                    disabled={!selectedKpiId || isSubmitting}
                    onClick={handleSubmit}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Achievement'}
                </Button>
            </CardContent>
        </Card>
    );
}
