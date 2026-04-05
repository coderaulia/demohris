import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { kpiAdapter } from '@/adapters/kpiAdapter';

// ==================================================
// KPI DEPARTMENT DRILL-DOWN MODAL
// ==================================================

interface KpiDrillDownModalProps {
    department: string;
    isOpen: boolean;
    onClose: () => void;
}

export function KpiDrillDownModal({ department, isOpen, onClose }: KpiDrillDownModalProps) {
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

    // Generate last 4 months for period tabs
    const periodTabs = useMemo(() => {
        const tabs: string[] = [];
        const now = new Date();
        for (let i = 0; i < 4; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            tabs.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return tabs;
    }, []);

    const { data: summaryData, isLoading } = useQuery({
        queryKey: ['kpi-department-summary', department, selectedPeriod],
        queryFn: () => kpiAdapter.getDepartmentSummary(department, selectedPeriod),
        enabled: isOpen,
    });

    const filteredEmployees = useMemo(() => {
        if (!summaryData?.employees) return [];
        if (!searchQuery) return summaryData.employees;
        const q = searchQuery.toLowerCase();
        return summaryData.employees.filter(
            emp => emp.name.toLowerCase().includes(q) || emp.position.toLowerCase().includes(q)
        );
    }, [summaryData, searchQuery]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'on_track':
                return <Badge className="bg-green-100 text-green-700 text-xs">On Track</Badge>;
            case 'at_risk':
                return <Badge className="bg-red-100 text-red-700 text-xs">At Risk</Badge>;
            case 'below_target':
                return <Badge className="bg-amber-100 text-amber-700 text-xs">Below Target</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-600 text-xs">N/A</Badge>;
        }
    };

    const getAchievementLabel = (pct: number | null) => {
        if (pct === null) return { text: 'No Data', className: 'text-gray-500' };
        if (pct >= 100) return { text: 'Above Target', className: 'text-green-600' };
        if (pct >= 80) return { text: 'On Target', className: 'text-blue-600' };
        return { text: 'Below Target', className: 'text-red-600' };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">{department}</h2>
                            <p className="text-sm text-muted-foreground">Department KPI Drill-down</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                    </div>
                </div>

                {/* Stat Cards */}
                {summaryData && (
                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Employees"
                            value={String(summaryData.total_employees)}
                            subtext={summaryData.employees_without_records > 0
                                ? `${summaryData.employees_without_records} without KPI record`
                                : 'All have records'}
                            variant="default"
                        />
                        <StatCard
                            label="Active KPIs"
                            value={String(summaryData.active_kpis)}
                            subtext="Targets set"
                            variant="blue"
                        />
                        <StatCard
                            label="Overall Achievement"
                            value={`${summaryData.overall_achievement_pct}%`}
                            subtext={getAchievementLabel(summaryData.overall_achievement_pct).text}
                            variant={summaryData.overall_achievement_pct >= 100 ? 'green' : summaryData.overall_achievement_pct >= 80 ? 'blue' : 'red'}
                        />
                        <StatCard
                            label="6-Month Trend"
                            value={
                                <div className="flex items-end gap-0.5 h-8">
                                    {summaryData.six_month_trend.slice(-6).map((m, i) => {
                                        const height = Math.max(4, Math.min(32, m.avg_achievement / 3));
                                        return (
                                            <div
                                                key={m.month}
                                                className="w-3 bg-blue-500 rounded-sm"
                                                style={{ height: `${height}px` }}
                                                title={`${m.month}: ${m.avg_achievement}%`}
                                            />
                                        );
                                    })}
                                </div>
                            }
                            subtext="Last 6 months"
                            variant="default"
                        />
                    </div>
                )}

                {/* Period Tabs */}
                <div className="px-6 border-b">
                    <div className="flex gap-2">
                        {periodTabs.map(period => (
                            <button
                                key={period}
                                className={cn(
                                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                                    period === selectedPeriod
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'text-muted-foreground hover:bg-muted'
                                )}
                                onClick={() => setSelectedPeriod(period)}
                            >
                                {new Date(period + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search */}
                <div className="p-4 border-b">
                    <Input
                        placeholder="Search employees..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                    />
                </div>

                {/* Employee Performance Table */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No employees found</div>
                    ) : (
                        <div className="space-y-2">
                            {filteredEmployees.map(emp => (
                                <div key={emp.employee_id}>
                                    {emp.has_record ? (
                                        <>
                                            {/* Collapsed Row */}
                                            <div
                                                className={cn(
                                                    'flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors',
                                                    expandedEmployee === emp.employee_id ? 'bg-muted' : 'hover:bg-muted/50'
                                                )}
                                                onClick={() => setExpandedEmployee(
                                                    expandedEmployee === emp.employee_id ? null : emp.employee_id
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar initials={emp.name} />
                                                    <div>
                                                        <div className="font-medium text-sm">{emp.name}</div>
                                                        <div className="text-xs text-muted-foreground">{emp.position}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-muted-foreground">
                                                        {emp.kpis.length} KPI{emp.kpis.length !== 1 ? 's' : ''}
                                                    </span>
                                                    {emp.avg_achievement !== null && (
                                                        <Badge className={cn(
                                                            'text-xs',
                                                            emp.avg_achievement >= 100 ? 'bg-green-100 text-green-700' :
                                                            emp.avg_achievement >= 80 ? 'bg-blue-100 text-blue-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        )}>
                                                            {emp.avg_achievement}%
                                                        </Badge>
                                                    )}
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                        {expandedEmployee === emp.employee_id ? '▼' : '▶'}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Expanded Rows */}
                                            {expandedEmployee === emp.employee_id && (
                                                <div className="ml-12 mt-1 mb-2 space-y-1">
                                                    {emp.kpis.map((kpi, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                                                            <span className="font-medium">{kpi.kpi_name}</span>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-muted-foreground">
                                                                    Target: {kpi.target ?? '—'}{kpi.unit}
                                                                </span>
                                                                <span>
                                                                    Actual: {kpi.actual}{kpi.unit}
                                                                </span>
                                                                {getStatusBadge(kpi.status)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        /* No Record Row */
                                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-md">
                                            <div className="flex items-center gap-3">
                                                <Avatar initials={emp.name} />
                                                <div>
                                                    <div className="font-medium text-sm">{emp.name}</div>
                                                    <div className="text-xs text-muted-foreground">{emp.position}</div>
                                                </div>
                                            </div>
                                            <Badge className="bg-amber-100 text-amber-700">
                                                No KPI Record ({new Date(selectedPeriod + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button variant="outline">Export Excel</Button>
                    <Button variant="outline">Export PDF</Button>
                </div>
            </div>
        </div>
    );
}

// ==================================================
// STAT CARD
// ==================================================

function StatCard({
    label,
    value,
    subtext,
    variant = 'default',
}: {
    label: string;
    value: string | React.ReactNode;
    subtext: string;
    variant?: 'default' | 'blue' | 'green' | 'red';
}) {
    const colorMap = {
        default: 'text-foreground',
        blue: 'text-blue-600',
        green: 'text-green-600',
        red: 'text-red-600',
    };

    return (
        <Card>
            <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={cn('text-2xl font-bold', colorMap[variant])}>{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
            </CardContent>
        </Card>
    );
}

// ==================================================
// AVATAR
// ==================================================

function Avatar({ initials }: { initials: string }) {
    const initialsText = initials.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
            {initialsText}
        </div>
    );
}
