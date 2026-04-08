import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OrgSettingsResponse, OrgSettingsSaveInput } from '@demo-kpi/contracts';
import { settingsAdapter } from '@/adapters/settingsAdapter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function createDepartment() {
    return {
        id: `tmp-dept-${crypto.randomUUID()}`,
        name: '',
        positions: [] as Array<{ id: string; name: string }>,
    };
}

function createPosition() {
    return {
        id: `tmp-pos-${crypto.randomUUID()}`,
        name: '',
    };
}

export function SettingsOrgPage() {
    const queryClient = useQueryClient();
    const importRef = useRef<HTMLInputElement | null>(null);
    const [seniorityText, setSeniorityText] = useState('');
    const [departments, setDepartments] = useState<Array<{ id: string; name: string; positions: Array<{ id: string; name: string }> }>>([]);

    const orgQuery = useQuery<OrgSettingsResponse>({
        queryKey: ['settings', 'org'],
        queryFn: () => settingsAdapter.getOrg(),
    });

    const saveMutation = useMutation({
        mutationFn: (payload: OrgSettingsSaveInput) => settingsAdapter.saveOrg(payload),
        onSuccess: (data) => {
            applyResponse(data);
            queryClient.invalidateQueries({ queryKey: ['settings', 'org'] });
            queryClient.invalidateQueries({ queryKey: ['settings', 'competencies'] });
        },
    });

    function applyResponse(data: OrgSettingsResponse) {
        setSeniorityText((data.org_settings.seniority_levels || []).join(', '));
        setDepartments(
            (data.departments || []).map((department) => ({
                id: department.id,
                name: department.name,
                positions: (department.positions || []).map((position) => ({
                    id: position.id,
                    name: position.name,
                })),
            })),
        );
    }

    if (orgQuery.data && departments.length === 0 && seniorityText === '') {
        applyResponse(orgQuery.data);
    }

    function addDepartment() {
        setDepartments((current) => [...current, createDepartment()]);
    }

    function updateDepartment(id: string, name: string) {
        setDepartments((current) => current.map((department) => (
            department.id === id ? { ...department, name } : department
        )));
    }

    function removeDepartment(id: string) {
        setDepartments((current) => current.filter((department) => department.id !== id));
    }

    function addPosition(departmentId: string) {
        setDepartments((current) => current.map((department) => (
            department.id === departmentId
                ? { ...department, positions: [...department.positions, createPosition()] }
                : department
        )));
    }

    function updatePosition(departmentId: string, positionId: string, name: string) {
        setDepartments((current) => current.map((department) => (
            department.id === departmentId
                ? {
                    ...department,
                    positions: department.positions.map((position) => (
                        position.id === positionId ? { ...position, name } : position
                    )),
                }
                : department
        )));
    }

    function removePosition(departmentId: string, positionId: string) {
        setDepartments((current) => current.map((department) => (
            department.id === departmentId
                ? { ...department, positions: department.positions.filter((position) => position.id !== positionId) }
                : department
        )));
    }

    function buildPayload(): OrgSettingsSaveInput {
        return {
            seniority_levels: seniorityText.split(',').map((item) => item.trim()).filter(Boolean),
            departments: departments
                .map((department) => ({
                    id: department.id.startsWith('tmp-') ? undefined : department.id,
                    name: department.name.trim(),
                    positions: department.positions
                        .map((position) => ({
                            id: position.id.startsWith('tmp-') ? undefined : position.id,
                            name: position.name.trim(),
                        }))
                        .filter((position) => position.name),
                }))
                .filter((department) => department.name),
        };
    }

    async function handleImport(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const payload = JSON.parse(text) as OrgSettingsSaveInput;
        setSeniorityText((payload.seniority_levels || []).join(', '));
        setDepartments(
            (payload.departments || []).map((department) => ({
                id: department.id || `tmp-dept-${crypto.randomUUID()}`,
                name: department.name,
                positions: (department.positions || []).map((position) => ({
                    id: position.id || `tmp-pos-${crypto.randomUUID()}`,
                    name: position.name,
                })),
            })),
        );
        event.target.value = '';
    }

    return (
        <div className="space-y-6">
            <Card className="border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50">
                <CardHeader>
                    <CardTitle>Organization Map</CardTitle>
                    <CardDescription>Keep structure data tight and portable: seniority levels, departments, and positions.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.35fr,0.65fr]">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Seniority levels</label>
                        <textarea
                            className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            value={seniorityText}
                            onChange={(event) => setSeniorityText(event.target.value)}
                            placeholder="Junior, Mid, Senior, Lead"
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated, saved to `org_settings`.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button type="button" variant="outline" onClick={() => downloadJson('organization-map.json', buildPayload())}>
                            <Download className="mr-2 size-4" />
                            Export JSON
                        </Button>
                        <Button type="button" variant="outline" onClick={() => importRef.current?.click()}>
                            <Upload className="mr-2 size-4" />
                            Import JSON
                        </Button>
                        <Button type="button" onClick={() => saveMutation.mutate(buildPayload())} disabled={saveMutation.isPending}>
                            <Save className="mr-2 size-4" />
                            Save Organization
                        </Button>
                        <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Departments Editor</h2>
                    <p className="text-sm text-muted-foreground">Create, rename, delete departments, and manage their positions inline.</p>
                </div>
                <Button type="button" variant="outline" onClick={addDepartment}>
                    <Plus className="mr-2 size-4" />
                    Add Department
                </Button>
            </div>

            {orgQuery.isLoading && departments.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading organization settings...</CardContent></Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
                {departments.map((department) => (
                    <Card key={department.id}>
                        <CardHeader className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Input
                                    value={department.name}
                                    onChange={(event) => updateDepartment(department.id, event.target.value)}
                                    placeholder="Department name"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeDepartment(department.id)}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <Badge variant="outline">{department.positions.length} positions</Badge>
                                <Button type="button" variant="outline" size="sm" onClick={() => addPosition(department.id)}>
                                    <Plus className="mr-2 size-3" />
                                    Add Position
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {department.positions.map((position) => (
                                <div key={position.id} className="flex items-center gap-2 rounded-xl border bg-muted/20 p-2">
                                    <Input
                                        value={position.name}
                                        onChange={(event) => updatePosition(department.id, position.id, event.target.value)}
                                        placeholder="Position name"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removePosition(department.id, position.id)}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ))}
                            {department.positions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No positions added yet.</p>
                            ) : null}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
