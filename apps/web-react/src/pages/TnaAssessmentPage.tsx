import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    ChevronLeft, 
    ChevronRight, 
    Save, 
    ClipboardCheck,
    AlertCircle,
} from 'lucide-react';

import { tnaAdapter, employeesAdapter } from '@/adapters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import type { TnaAssessmentGetResponse, TnaCompetenciesListResponse } from '@demo-kpi/contracts';

interface AssessmentLine {
    need_id?: string;
    competency_name: string;
    manager_score: number;
    required_level: number;
    notes: string;
    self_assessment_score: number;
    self_assessment_notes: string;
}

export function TnaAssessmentPage() {
    const { employeeId: paramEmployeeId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const auth = useAuth();
    const queryClient = useQueryClient();

    const isEmployee = auth.role === 'employee';
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
        isEmployee ? (auth.user?.employee_id || '') : (paramEmployeeId || '')
    );
    const [period, setPeriod] = useState<string>(searchParams.get('period') || new Date().toISOString().slice(0, 7));
    const [assessments, setAssessments] = useState<Record<string, AssessmentLine>>({});
    const [step, setStep] = useState<'selection' | 'assessment'>(
        (paramEmployeeId || isEmployee) ? 'assessment' : 'selection'
    );

    // List employees for managers/HR
    const employeesQuery = useQuery({
        queryKey: ['employees', 'assessable'],
        queryFn: () => employeesAdapter.list({}, { 
            role: auth.role || null, 
            employeeId: auth.user?.employee_id || '' 
        }),
        enabled: !isEmployee && step === 'selection',
    });

    const selectedEmployee = employeesQuery.data?.employees.find(e => String(e.employee_id) === String(selectedEmployeeId)) 
        || (String(selectedEmployeeId) === String(auth.user?.employee_id) ? auth.user : null);

    // Get competencies (baseline)
    const competenciesQuery = useQuery<TnaCompetenciesListResponse>({
        queryKey: ['tna', 'competencies', selectedEmployee?.position],
        queryFn: () => tnaAdapter.listCompetencies({ position_name: String(selectedEmployee?.position || '') }),
        enabled: !!selectedEmployee?.position && step === 'assessment',
    });

    // Get existing assessment (if any)
    const existingQuery = useQuery<TnaAssessmentGetResponse>({
        queryKey: ['tna', 'assessment', 'get', selectedEmployeeId, period],
        queryFn: () => tnaAdapter.getAssessment({ employee_id: selectedEmployeeId, period }),
        enabled: !!selectedEmployeeId && !!period && step === 'assessment',
        retry: false,
    });

    // Initialize/Sync assessments
    useEffect(() => {
        if (!competenciesQuery.data?.success) return;

        const baseCompetencies = (competenciesQuery.data.competencies || []) as any[];
        const existingData = existingQuery.data?.success ? (existingQuery.data.assessment.competencies as any[]) : [];
        const initial: Record<string, AssessmentLine> = {};

        baseCompetencies.forEach((comp) => {
            const existing = existingData.find(e => e.competency_name === comp.name);
            initial[comp.name] = {
                need_id: existing?.id,
                competency_name: comp.name,
                manager_score: existing?.manager_score ?? 3,
                required_level: existing?.required_level ?? comp.required_level ?? 3,
                notes: existing?.notes ?? '',
                self_assessment_score: existing?.self_assessment_score ?? 3,
                self_assessment_notes: existing?.self_assessment_notes ?? '',
            };
        });
        setAssessments(initial);
    }, [competenciesQuery.data, existingQuery.data]);

    const createMutation = useMutation({
        mutationFn: (data: any) => tnaAdapter.createAssessment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tna'] });
            alert('Manager assessment submitted');
            navigate('/assessment/records');
        },
    });

    const selfSubmitMutation = useMutation({
        mutationFn: (data: any) => tnaAdapter.selfSubmitAssessment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tna'] });
            alert('Self-assessment submitted');
            navigate('/dashboard');
        },
    });

    const handleEmployeeSelect = (id: string) => {
        setSelectedEmployeeId(id);
        setStep('assessment');
    };

    const handleUpdate = (compName: string, field: keyof AssessmentLine, value: any) => {
        setAssessments(prev => ({
            ...prev,
            [compName]: { ...prev[compName], [field]: value }
        }));
    };

    const handleSubmit = () => {
        if (isEmployee) {
            const lines = Object.values(assessments).filter(a => !!a.need_id);
            if (!lines.length) {
                alert('No existing manager assessment found to complete your self-evaluation.');
                return;
            }
            selfSubmitMutation.mutate({
                employee_id: selectedEmployeeId,
                period,
                self_assessments: lines.map(a => ({
                    need_id: a.need_id!,
                    self_assessment_score: a.self_assessment_score,
                    self_assessment_notes: a.self_assessment_notes,
                }))
            });
        } else {
            createMutation.mutate({
                employee_id: selectedEmployeeId,
                period,
                assessments: Object.values(assessments)
            });
        }
    };

    if (step === 'selection') {
        return (
            <div className="space-y-6">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight">Competency Assessment Setup</h1>
                </header>
                <Card>
                    <CardHeader>
                        <CardTitle>Select Employee</CardTitle>
                        <CardDescription>Choose an employee to begin their competency assessment for {period}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {employeesQuery.isLoading ? (
                                <p className="text-muted-foreground p-4">Loading employees...</p>
                            ) : employeesQuery.data?.employees.map(emp => (
                                <button
                                    key={emp.employee_id}
                                    onClick={() => handleEmployeeSelect(String(emp.employee_id))}
                                    className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                                >
                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {String(emp.name || '').charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate text-sm">{String(emp.name || '')}</p>
                                        <p className="text-xs text-muted-foreground truncate">{String(emp.position || '')}</p>
                                    </div>
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasManagerAssessment = Object.values(assessments).some(a => !!a.need_id);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {!isEmployee && (
                        <Button variant="outline" size="icon" onClick={() => setStep('selection')}>
                            <ChevronLeft className="size-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isEmployee ? 'Self-Assessment' : 'Competency Assessment'}
                        </h1>
                        <p className="text-muted-foreground">
                            {String(selectedEmployee?.name || '')} • {String(selectedEmployee?.position || '')} • {period}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isEmployee && (
                        <Input 
                            type="month" 
                            value={period} 
                            onChange={(e) => setPeriod(e.target.value)} 
                            className="w-40"
                        />
                    )}
                    <Button 
                        onClick={handleSubmit} 
                        disabled={createMutation.isPending || selfSubmitMutation.isPending || !Object.keys(assessments).length}
                    >
                        <Save className="size-4 mr-2" />
                        Submit {isEmployee ? 'Self-Assessment' : 'Evaluation'}
                    </Button>
                </div>
            </div>

            <Card className="border-indigo-200 bg-indigo-50/20">
                <CardContent className="p-4 flex items-center gap-4 text-sm text-indigo-700">
                    <ClipboardCheck className="size-5 shrink-0" />
                    <p>
                        <strong>Workflow Progress:</strong> 
                        {hasManagerAssessment 
                            ? " Manager evaluation complete. Now awaiting employee self-assessment." 
                            : " Awaiting manager evaluation to identify baseline gaps."}
                    </p>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    {competenciesQuery.isLoading ? (
                        <p className="p-8 text-center text-muted-foreground">Loading competencies...</p>
                    ) : Object.values(assessments).map((comp) => {
                        const gap = comp.required_level - comp.manager_score;
                        return (
                            <Card key={comp.competency_name} className={cn(gap > 0 ? "border-amber-200" : "")}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base">{comp.competency_name}</CardTitle>
                                            <Badge variant="outline" className="mt-1">Required: {comp.required_level}</Badge>
                                        </div>
                                        {gap > 0 && (
                                            <Badge variant={gap >= 2 ? "destructive" : "warning" as any}>
                                                Gap: {gap}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground">
                                                {isEmployee ? "Manager Evaluation Score" : "Your Evaluation Score"}
                                            </label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Button
                                                        key={s}
                                                        variant={comp.manager_score === s ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => !isEmployee && handleUpdate(comp.competency_name, 'manager_score', s)}
                                                        disabled={isEmployee}
                                                        className="size-9 p-0"
                                                    >
                                                        {s}
                                                    </Button>
                                                ))}
                                            </div>
                                            {!isEmployee && (
                                                <textarea
                                                    value={comp.notes}
                                                    onChange={(e) => handleUpdate(comp.competency_name, 'notes', e.target.value)}
                                                    placeholder="Add evaluation notes..."
                                                    className="w-full text-xs p-2 border rounded-md min-h-[60px]"
                                                />
                                            )}
                                            {isEmployee && comp.notes && (
                                                <p className="text-xs italic text-muted-foreground p-2 border rounded bg-muted/30">
                                                    Note: {comp.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground">
                                                Self-Assessment Score
                                            </label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Button
                                                        key={s}
                                                        variant={comp.self_assessment_score === s ? "secondary" : "outline"}
                                                        size="sm"
                                                        onClick={() => isEmployee && handleUpdate(comp.competency_name, 'self_assessment_score', s)}
                                                        disabled={!isEmployee}
                                                        className="size-9 p-0"
                                                    >
                                                        {s}
                                                    </Button>
                                                ))}
                                            </div>
                                            <textarea
                                                value={comp.self_assessment_notes}
                                                onChange={(e) => handleUpdate(comp.competency_name, 'self_assessment_notes', e.target.value)}
                                                placeholder={isEmployee ? "Reflect on your performance..." : "Awaiting employee response..."}
                                                disabled={!isEmployee}
                                                className="w-full text-xs p-2 border rounded-md min-h-[60px]"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <aside className="space-y-4">
                    <Card className="sticky top-4">
                        <CardHeader><CardTitle className="text-lg">Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Competencies:</span>
                                    <span>{Object.keys(assessments).length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Critical Gaps:</span>
                                    <span className="text-destructive font-bold">
                                        {Object.values(assessments).filter(a => a.required_level - a.manager_score >= 2).length}
                                    </span>
                                </div>
                            </div>
                            {isEmployee && !hasManagerAssessment && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex gap-2">
                                    <AlertCircle className="size-4 shrink-0" />
                                    <span>You can only submit self-assessment once your manager has evaluated your competencies.</span>
                                </div>
                            )}
                            <Button 
                                className="w-full h-12" 
                                onClick={handleSubmit}
                                disabled={createMutation.isPending || selfSubmitMutation.isPending || (isEmployee && !hasManagerAssessment)}
                            >
                                Submit Full Assessment
                            </Button>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
