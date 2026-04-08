import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CompetenciesListResponse, CompetencyMatrixCreateInput, OrgSettingsResponse, PositionMatrix } from '@demo-kpi/contracts';
import { settingsAdapter } from '@/adapters/settingsAdapter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectField, type SelectOption } from '@/components/ui/select';

function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function createCompetency() {
    return { name: '', level: 3 };
}

export function SettingsCompetenciesPage() {
    const queryClient = useQueryClient();
    const importRef = useRef<HTMLInputElement | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [positionName, setPositionName] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [competencies, setCompetencies] = useState<Array<{ name: string; level: number }>>([createCompetency()]);

    const matricesQuery = useQuery<CompetenciesListResponse>({
        queryKey: ['settings', 'competencies'],
        queryFn: () => settingsAdapter.listCompetencies(),
    });

    const orgQuery = useQuery<OrgSettingsResponse>({
        queryKey: ['settings', 'org'],
        queryFn: () => settingsAdapter.getOrg(),
    });

    const saveMutation = useMutation({
        mutationFn: (payload: CompetencyMatrixCreateInput & { position_id?: string }) => {
            if (payload.position_id) {
                return settingsAdapter.updateCompetencyMatrix({
                    position_id: payload.position_id,
                    name: payload.name,
                    department_id: payload.department_id,
                    competencies: payload.competencies,
                });
            }
            return settingsAdapter.createCompetencyMatrix(payload);
        },
        onSuccess: () => {
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['settings', 'competencies'] });
            queryClient.invalidateQueries({ queryKey: ['settings', 'org'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (positionId: string) => settingsAdapter.deleteCompetencyMatrix(positionId),
        onSuccess: () => {
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['settings', 'competencies'] });
            queryClient.invalidateQueries({ queryKey: ['settings', 'org'] });
        },
    });

    const departmentOptions: SelectOption[] = useMemo(() => {
        const options: SelectOption[] = [{ value: '', label: 'No department' }];
        for (const department of orgQuery.data?.departments || []) {
            options.push({ value: department.id, label: department.name });
        }
        return options;
    }, [orgQuery.data]);

    function resetForm() {
        setEditingId(null);
        setPositionName('');
        setDepartmentId('');
        setCompetencies([createCompetency()]);
    }

    function addCompetency() {
        setCompetencies((current) => [...current, createCompetency()]);
    }

    function updateCompetency(index: number, field: 'name' | 'level', value: string) {
        setCompetencies((current) => current.map((row, currentIndex) => {
            if (currentIndex !== index) return row;
            if (field === 'level') return { ...row, level: Number(value) || 1 };
            return { ...row, name: value };
        }));
    }

    function removeCompetency(index: number) {
        setCompetencies((current) => current.filter((_, currentIndex) => currentIndex !== index));
    }

    function startEdit(position: PositionMatrix) {
        setEditingId(position.id);
        setPositionName(position.name);
        setDepartmentId(position.department_id || '');
        setCompetencies(position.competencies.length > 0 ? position.competencies.map((row) => ({ name: row.name, level: row.level })) : [createCompetency()]);
    }

    function buildPayload() {
        return {
            position_id: editingId || undefined,
            name: positionName.trim(),
            department_id: departmentId || null,
            competencies: competencies.map((row) => ({
                name: row.name.trim(),
                level: row.level,
            })).filter((row) => row.name),
        };
    }

    async function handleImport(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const payload = JSON.parse(text) as Array<PositionMatrix>;
        for (const position of payload) {
            await settingsAdapter.createCompetencyMatrix({
                name: position.name,
                department_id: position.department_id,
                competencies: position.competencies,
            });
        }
        event.target.value = '';
        queryClient.invalidateQueries({ queryKey: ['settings', 'competencies'] });
    }

    const positions = matricesQuery.data?.positions || [];

    return (
        <div className="grid gap-6 xl:grid-cols-[1fr,0.95fr]">
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50">
                <CardHeader>
                    <CardTitle>Skill Matrices</CardTitle>
                    <CardDescription>Save one role matrix at a time, then manage the whole catalog from the right panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <Input value={positionName} onChange={(event) => setPositionName(event.target.value)} placeholder="Position name" />
                        <SelectField options={departmentOptions} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} />
                    </div>

                    <div className="space-y-3">
                        {competencies.map((row, index) => (
                            <div key={`${editingId || 'new'}-${index}`} className="grid gap-2 rounded-xl border bg-background p-3 md:grid-cols-[1fr,120px,44px]">
                                <Input
                                    value={row.name}
                                    onChange={(event) => updateCompetency(index, 'name', event.target.value)}
                                    placeholder="Competency name"
                                />
                                <Input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={row.level}
                                    onChange={(event) => updateCompetency(index, 'level', event.target.value)}
                                    placeholder="Level"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeCompetency(index)} disabled={competencies.length === 1}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={addCompetency}>
                            <Plus className="mr-2 size-4" />
                            Add Competency
                        </Button>
                        <Button type="button" variant="outline" onClick={() => downloadJson('skill-matrices.json', positions)}>
                            <Download className="mr-2 size-4" />
                            Export JSON
                        </Button>
                        <Button type="button" variant="outline" onClick={() => importRef.current?.click()}>
                            <Upload className="mr-2 size-4" />
                            Import JSON
                        </Button>
                        <Button type="button" onClick={() => saveMutation.mutate(buildPayload())} disabled={saveMutation.isPending}>
                            <Save className="mr-2 size-4" />
                            {editingId ? 'Update Position' : 'Save Position'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={resetForm}>Clear</Button>
                        <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing Positions</CardTitle>
                    <CardDescription>Open a matrix, edit it, or remove it entirely.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {matricesQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading skill matrices...</p>
                    ) : null}

                    {positions.map((position) => (
                        <div key={position.id} className="rounded-xl border bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{position.name}</h3>
                                        <Badge variant="outline">{position.competencies.length} skills</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{position.department_name || 'No department assigned'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(position)}>Edit</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteMutation.mutate(position.id)}>Delete</Button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {position.competencies.map((competency) => (
                                    <Badge key={`${position.id}-${competency.name}`} className="bg-slate-900 text-white">
                                        {competency.name} · L{competency.level}
                                    </Badge>
                                ))}
                                {position.competencies.length === 0 ? <span className="text-sm text-muted-foreground">No competencies saved.</span> : null}
                            </div>
                        </div>
                    ))}

                    {!matricesQuery.isLoading && positions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No positions saved yet.</p>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
