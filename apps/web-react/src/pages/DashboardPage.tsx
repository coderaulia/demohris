import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Building2, Users, Target, TrendingUp,
  Award, AlertTriangle, Shield, ListChecks, Layers3,
} from 'lucide-react'

import { dashboardAdapter, kpiAdapter } from '@/adapters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/providers/AuthProvider'
import { SelectField, type SelectOption } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { KpiDrillDownModal } from '@/components/KpiDrillDownModal'

// Charts
import {
  BarChart, Bar,
  ComposedChart, Line,
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts'

type DashboardMode = 'kpi' | 'assessment'

interface FilterState {
  department: string
  manager: string
  period: string
}

interface DepartmentCardViewModel {
  department: string
  manager: string | null
  employeeCount: number | null
  recordCount: number
  metCount: number | null
  secondaryMetricLabel: string
  secondaryMetricValue: string
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toStringValue(value: unknown) {
  return String(value ?? '').trim()
}

function normalizePeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function isManagerPosition(position: string) {
  const lowered = position.toLowerCase()
  return ['manager', 'supervisor', 'head', 'lead', 'director'].some(keyword => lowered.includes(keyword))
}

function buildAssessmentDepartmentCards(
  rows: Array<Record<string, unknown>>,
  selectedManager: string,
): DepartmentCardViewModel[] {
  const byDepartment = new Map<string, { employees: Set<string>; records: number; critical: number; high: number; managers: Set<string> }>()

  for (const row of rows) {
    const department = toStringValue(row.department) || 'Unassigned'
    const employeeId = toStringValue(row.employee_id)
    const employeeName = toStringValue(row.employee_name)
    const position = toStringValue(row.position)
    const priority = toStringValue(row.priority).toLowerCase()

    if (!byDepartment.has(department)) {
      byDepartment.set(department, { employees: new Set<string>(), records: 0, critical: 0, high: 0, managers: new Set<string>() })
    }

    const current = byDepartment.get(department)!
    current.records += 1
    if (employeeId) current.employees.add(employeeId)
    if (priority === 'critical') current.critical += 1
    if (priority === 'high') current.high += 1
    if (employeeName && isManagerPosition(position)) current.managers.add(employeeName)
  }

  return [...byDepartment.entries()]
    .map(([department, value]) => {
      const manager = [...value.managers].sort((a, b) => a.localeCompare(b))[0] || null
      return {
        department,
        manager,
        employeeCount: value.employees.size,
        recordCount: value.records,
        metCount: null,
        secondaryMetricLabel: 'Critical',
        secondaryMetricValue: String(value.critical),
      }
    })
    .filter(card => !selectedManager || card.manager === selectedManager)
    .sort((a, b) => a.department.localeCompare(b.department))
}

function buildKpiDepartmentCards(
  kpiRows: Array<Record<string, unknown>>,
  selectedManager: string,
): DepartmentCardViewModel[] {
  return kpiRows
    .map(row => ({
      department: toStringValue(row.department) || 'Unassigned',
      manager: toStringValue(row.manager) || null,
      employeeCount: toNumber(row.employee_count),
      recordCount: toNumber(row.record_count),
      metCount: null,
      secondaryMetricLabel: 'Avg Achievement',
      secondaryMetricValue: row.avg_achievement != null
        ? `${toNumber(row.avg_achievement).toFixed(1)}%`
        : 'No data',
    }))
    .filter(card => !selectedManager || card.manager === selectedManager)
    .sort((a, b) => a.department.localeCompare(b.department))
}

function buildDepartmentOptions(
  gapsRows: Array<Record<string, unknown>>,
  lmsRows: Array<Record<string, unknown>>,
  kpiRows: Array<Record<string, unknown>>,
): SelectOption[] {
  const set = new Set<string>()
  for (const row of gapsRows) { const department = toStringValue(row.department); if (department) set.add(department) }
  for (const row of lmsRows) { const department = toStringValue(row.department); if (department) set.add(department) }
  for (const row of kpiRows) { const department = toStringValue(row.department); if (department) set.add(department) }
  return [
    { value: '', label: 'All departments' },
    ...[...set].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value })),
  ]
}

function buildManagerOptions(
  gapsRows: Array<Record<string, unknown>>,
  kpiRows: Array<Record<string, unknown>>,
): SelectOption[] {
  const managers = new Set<string>()
  for (const row of gapsRows) {
    const name = toStringValue(row.employee_name)
    const position = toStringValue(row.position)
    if (!name || !isManagerPosition(position)) continue
    managers.add(name)
  }
  for (const row of kpiRows) {
    const name = toStringValue(row.manager)
    if (name) managers.add(name)
  }
  return [
    { value: '', label: 'All managers' },
    ...[...managers].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value })),
  ]
}

function SummaryStat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wide">{icon}{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon, label, value, subtext, color = 'gray',
}: {
  icon?: ReactNode; label: string; value: string; subtext: string
  color?: 'blue' | 'green' | 'red' | 'purple' | 'gray'
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    gray: 'text-foreground',
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}<span>{label}</span>
        </div>
        <div className={cn('text-2xl font-bold', colorMap[color])}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
      </CardContent>
    </Card>
  )
}

function TopPerformerPanel({
  title, icon, performers,
}: {
  title: string; icon: ReactNode
  performers: Array<{ employee_id: string; name: string; position: string; department: string; avg_achievement: number; kpi_count: number }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {performers.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">No KPI data yet.</div>
        ) : (
          <div className="space-y-3">
            {performers.map((p, idx) => (
              <div key={p.employee_id} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.position} · {p.department}</div>
                </div>
                <Badge className={cn('text-xs', p.avg_achievement >= 100 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                  {p.avg_achievement}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================================================
// MAIN DASHBOARD PAGE
// ==================================================

export function DashboardPage() {
  const auth = useAuth()
  const [mode, setMode] = useState<DashboardMode>('kpi')
  const [draftFilters, setDraftFilters] = useState<FilterState>({
    department: '',
    manager: '',
    period: normalizePeriod(),
  })
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    department: '',
    manager: '',
    period: normalizePeriod(),
  })
  const [drillDownDepartment, setDrillDownDepartment] = useState<string | null>(null)

  // Original dashboard data
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview', appliedFilters.department, appliedFilters.period],
    queryFn: () => dashboardAdapter.getOverview(appliedFilters),
    staleTime: 30_000,
  })

  // New dashboard endpoints
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', appliedFilters.department, appliedFilters.period],
    queryFn: () => dashboardAdapter.getSummary({ department: appliedFilters.department, period: appliedFilters.period }),
    staleTime: 60_000,
  })

  const categoryQuery = useQuery({
    queryKey: ['dashboard', 'achievement-by-category', appliedFilters.department, appliedFilters.period],
    queryFn: () => dashboardAdapter.getAchievementByCategory({ department: appliedFilters.department, period: appliedFilters.period }),
    staleTime: 60_000,
  })

  const kpiOverviewQuery = useQuery({
    queryKey: ['dashboard', 'kpi-overview', appliedFilters.department, appliedFilters.manager, appliedFilters.period, auth.user?.employee_id, auth.role],
    queryFn: () => kpiAdapter.getOverview(
      {
        department: appliedFilters.department,
        manager_id: appliedFilters.manager,
        period: appliedFilters.period,
      },
      {
        employeeId: String(auth.user?.employee_id || ''),
        role: auth.role || null,
      },
    ),
    staleTime: 60_000,
  })

  const monthlyPerformersQuery = useQuery({
    queryKey: ['dashboard', 'top-performers', 'monthly', appliedFilters.department],
    queryFn: () => dashboardAdapter.getTopPerformers('monthly', { department: appliedFilters.department }),
    staleTime: 60_000,
  })

  const quarterlyPerformersQuery = useQuery({
    queryKey: ['dashboard', 'top-performers', 'quarterly', appliedFilters.department],
    queryFn: () => dashboardAdapter.getTopPerformers('quarterly', { department: appliedFilters.department }),
    staleTime: 60_000,
  })

  const leadershipQuery = useQuery({
    queryKey: ['dashboard', 'leadership-analytics'],
    queryFn: () => dashboardAdapter.getLeadershipAnalytics({}),
    staleTime: 60_000,
  })

  const trendQuery = useQuery({
    queryKey: ['dashboard', 'kpi-trend', appliedFilters.department],
    queryFn: () => dashboardAdapter.getKpiTrend({ department: appliedFilters.department, months: 6 }),
    staleTime: 60_000,
  })

  const calibrationQuery = useQuery({
    queryKey: ['dashboard', 'manager-calibration'],
    queryFn: () => dashboardAdapter.getManagerCalibration({}),
    staleTime: 60_000,
  })

  const gapsRows = dashboardQuery.data?.gapsReport || []
  const lmsByCourseRows = dashboardQuery.data?.lmsReport?.by_course || []
  const tnaSummary = dashboardQuery.data?.tnaSummary || {}
  const activeModules = dashboardQuery.data?.modules || []
  const courseCatalog = dashboardQuery.data?.courseCatalog || []
  const kpiGroupRows = (kpiOverviewQuery.data?.kpi.groups || []) as Array<Record<string, unknown>>

  const managerOptions = useMemo(() => buildManagerOptions(gapsRows, kpiGroupRows), [gapsRows, kpiGroupRows])
  const departmentOptions = useMemo(
    () => buildDepartmentOptions(gapsRows, lmsByCourseRows, kpiGroupRows),
    [gapsRows, lmsByCourseRows, kpiGroupRows],
  )

  const assessmentCards = useMemo(
    () => buildAssessmentDepartmentCards(gapsRows, appliedFilters.manager),
    [gapsRows, appliedFilters.manager],
  )
  const kpiCards = useMemo(
    () => buildKpiDepartmentCards(kpiGroupRows, appliedFilters.manager),
    [kpiGroupRows, appliedFilters.manager],
  )

  const currentCards = mode === 'kpi' ? kpiCards : assessmentCards
  const deferred = dashboardQuery.data?.deferred

  const summary = summaryQuery.data
  const categories = categoryQuery.data?.categories || []
  const monthlyPerformers = monthlyPerformersQuery.data?.top_performers || []
  const quarterlyPerformers = quarterlyPerformersQuery.data?.top_performers || []
  const leadership = leadershipQuery.data
  const trend = trendQuery.data?.trend || []
  const calibration = calibrationQuery.data?.calibration || []

  const riskLevelLabel = (avg: number | null) => {
    if (avg === null) return { text: 'No Data', className: 'text-gray-500' }
    if (avg >= 100) return { text: 'Above Target', className: 'text-green-600' }
    if (avg >= 80) return { text: 'On Target', className: 'text-blue-600' }
    return { text: 'Below Target', className: 'text-red-600' }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="text-2xl">HR Management Dashboard</CardTitle>
          <CardDescription>
            Filter-first operational dashboard with KPI vs assessment summary workflows and drill-down-ready department cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStat icon={<Layers3 className="size-4 text-primary" />} label="Active Modules" value={String(activeModules.length)} hint="Supabase-backed module visibility" />
          <SummaryStat icon={<ListChecks className="size-4 text-primary" />} label="Published Courses" value={String(courseCatalog.length)} hint="Read-only LMS catalog cutover" />
          <SummaryStat icon={<Target className="size-4 text-primary" />} label="TNA Needs" value={String(toNumber(tnaSummary.total_needs_identified))} hint="Current identified training needs" />
          <SummaryStat icon={<BarChart3 className="size-4 text-primary" />} label="Enrollments" value={String(toNumber(dashboardQuery.data?.lmsReport?.summary?.total_enrollments))} hint="LMS report summary records" />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Preserves legacy filter-first workflow for management reporting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Department</label>
            <SelectField
              value={draftFilters.department}
              options={departmentOptions}
              onChange={event => setDraftFilters(prev => ({ ...prev, department: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Manager</label>
            <SelectField
              value={draftFilters.manager}
              options={managerOptions}
              onChange={event => setDraftFilters(prev => ({ ...prev, manager: event.target.value }))}
              disabled={managerOptions.length <= 1}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Period</label>
            <Input
              type="month"
              value={draftFilters.period}
              onChange={event => setDraftFilters(prev => ({ ...prev, period: event.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="default" onClick={() => setAppliedFilters(draftFilters)} disabled={dashboardQuery.isFetching} className="w-full">
              Apply Filters
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              const reset = { department: '', manager: '', period: normalizePeriod() }
              setDraftFilters(reset)
              setAppliedFilters(reset)
            }}>
              Clear
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Applied Department: {appliedFilters.department || 'All'}</Badge>
          <Badge variant="outline">Applied Manager: {appliedFilters.manager || 'All'}</Badge>
          <Badge variant="outline">Applied Period: {appliedFilters.period || 'All'}</Badge>
        </CardFooter>
      </Card>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total Employees (KPI)" value={String(summary?.total_employees_with_kpi ?? '—')} subtext={`With KPI records: ${summary?.total_employees_with_kpi ?? 0}`} color="blue" />
        <StatCard icon={<Target className="h-4 w-4" />} label="Total KPIs" value={String(summary?.total_kpi_definitions ?? '—')} subtext="Active definitions" color="purple" />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Records" value={String(summary?.total_records ?? '—')} subtext={summary?.records_period || ''} color="gray" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg Achievement" value={summary?.avg_achievement_pct != null ? `${summary.avg_achievement_pct}%` : '—'} subtext={riskLevelLabel(summary?.avg_achievement_pct ?? null).text} color={summary?.avg_achievement_pct != null && summary.avg_achievement_pct >= 100 ? 'green' : summary?.avg_achievement_pct != null && summary.avg_achievement_pct >= 80 ? 'blue' : 'red'} />
        <StatCard icon={<Award className="h-4 w-4" />} label="Met Target" value={String(summary?.met_target_count ?? '—')} subtext="Achievement ≥ 100%" color="green" />
      </div>

      {/* KPI / Assessment Tabs */}
      <Tabs value={mode} onValueChange={value => setMode(value as DashboardMode)}>
        <TabsList>
          <TabsTrigger value="kpi">KPI Summary</TabsTrigger>
          <TabsTrigger value="assessment">Assessment Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="kpi" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryStat icon={<Building2 className="size-4 text-primary" />} label="Departments" value={String(kpiCards.length)} hint="Departments with KPI records or scoped employees" />
            <SummaryStat icon={<ListChecks className="size-4 text-primary" />} label="KPI Records" value={String(kpiCards.reduce((sum, row) => sum + row.recordCount, 0))} hint="Grouped KPI records for current filter scope" />
            <SummaryStat icon={<Target className="size-4 text-primary" />} label="Employees In Scope" value={String(kpiCards.reduce((sum, row) => sum + (row.employeeCount || 0), 0))} hint="Employee population represented in KPI grouping" />
            <SummaryStat icon={<BarChart3 className="size-4 text-primary" />} label="Average Achievement" value={summary?.avg_achievement_pct != null ? `${summary.avg_achievement_pct}%` : 'No data'} hint="Supabase KPI summary for current period" />
          </div>
        </TabsContent>

        <TabsContent value="assessment" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryStat icon={<Building2 className="size-4 text-primary" />} label="Departments" value={String(assessmentCards.length)} hint="Departments with active gap records" />
            <SummaryStat icon={<Users className="size-4 text-primary" />} label="Needs Identified" value={String(toNumber(tnaSummary.total_needs_identified))} hint="Total training need records" />
            <SummaryStat icon={<ListChecks className="size-4 text-primary" />} label="Needs Completed" value={String(toNumber(tnaSummary.needs_completed))} hint="Completed need records" />
            <SummaryStat icon={<Target className="size-4 text-primary" />} label="Critical Gaps" value={String(toNumber(tnaSummary.critical_gaps))} hint="Critical priority count" />
          </div>
        </TabsContent>
      </Tabs>

      {/* Department Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Department Overview</CardTitle>
          <CardDescription>Grouped summary cards are prepared for drill-down navigation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {currentCards.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No department data available for current filters.
            </div>
          ) : null}
          {currentCards.map(card => (
            <Card key={`${mode}-${card.department}`} className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{card.department}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="secondary">{mode === 'kpi' ? 'KPI' : 'Assessment'}</Badge>
                  {card.manager ? <Badge variant="outline">Manager: {card.manager}</Badge> : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Employees</p><p className="text-lg font-semibold">{card.employeeCount ?? 'N/A'}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Records</p><p className="text-lg font-semibold">{card.recordCount}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Target Met</p><p className="text-lg font-semibold">{card.metCount ?? 'N/A'}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">{card.secondaryMetricLabel}</p><p className="text-lg font-semibold">{card.secondaryMetricValue}</p></div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => setDrillDownDepartment(card.department)}>
                  Open Drill-down
                </Button>
              </CardFooter>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Achievement by Category Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Achievement by Category</CardTitle>
          <CardDescription>Average KPI achievement per position category</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, categories.length * 50)}>
              <BarChart data={categories} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 150]} tickFormatter={v => `${v}%`} />
                <YAxis dataKey="category" type="category" width={90} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Achievement']} />
                <Bar dataKey="avg_achievement" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopPerformerPanel title="Monthly Top Performers" icon={<Award className="h-5 w-5 text-yellow-500" />} performers={monthlyPerformers} />
        <TopPerformerPanel title="Quarterly Top Performers" icon={<Award className="h-5 w-5 text-amber-500" />} performers={quarterlyPerformers} />
      </div>

      {/* Leadership Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> LEADERSHIP ANALYTICS
            <Badge variant="outline" className="ml-2">Scope: {normalizePeriod()}</Badge>
          </CardTitle>
          <CardDescription>Leadership view for probation, PIP coverage, KPI trend...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Shield className="h-4 w-4" />} label="Probation Pass Rate" value={`${leadership?.probation_pass_rate ?? 0}%`} subtext={`Pass ${leadership?.probation_pass_count ?? 0} of ${leadership?.probation_total_closed ?? 0} closed reviews`} color="green" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="PIP Conversion" value={`${leadership?.pip_conversion_rate ?? 0}%`} subtext={`Below-threshold covered: ${leadership?.pip_active_count ?? 0}/${leadership?.pip_total_eligible ?? 0}`} color="red" />
            <StatCard icon={<Award className="h-4 w-4" />} label="PIP Success Rate" value={`${leadership?.pip_success_rate ?? 0}%`} subtext="Completed of resolved plans" color="green" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Risk Watchlist" value={String(leadership?.risk_watchlist?.length ?? 0)} subtext={`Active PIP employees: ${leadership?.pip_active_count ?? 0}`} color="red" />
          </div>
        </CardContent>
      </Card>

      {/* KPI Trend + Risk Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>KPI Achievement Trend</CardTitle>
            <CardDescription>Monthly KPI score and at-risk employees</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No trend data</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trend} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" domain={[0, 120]} tickFormatter={v => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="avg_kpi_score" stroke="#3b82f6" strokeWidth={2} name="Avg KPI Score" dot={{ fill: '#3b82f6' }} />
                  <ReferenceLine yAxisId="left" y={70} strokeDasharray="5 5" stroke="#ef4444" label="Risk Threshold" />
                  <Bar yAxisId="right" dataKey="at_risk_employee_count" fill="rgba(239,68,68,0.5)" name="At-Risk Employees" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Risk Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!leadership?.risk_watchlist || leadership.risk_watchlist.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No employees at risk</div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {leadership.risk_watchlist.map(emp => (
                  <div key={emp.employee_id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-medium text-red-700">
                      {emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{emp.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{emp.position} · {emp.department}</div>
                    </div>
                    <Badge className={cn('text-xs', emp.risk_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                      {emp.avg_score}%
                    </Badge>
                    {emp.has_active_pip && <Badge className="bg-red-100 text-red-700 text-xs">PIP</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manager Calibration Table */}
      {calibration.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manager Calibration View</CardTitle>
            <CardDescription>Team performance overview by manager</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Manager</th>
                    <th className="text-center p-3 font-medium">Team Size</th>
                    <th className="text-center p-3 font-medium">KPI Avg</th>
                    <th className="text-center p-3 font-medium">Assessment Avg</th>
                    <th className="text-center p-3 font-medium">Probation Pass</th>
                    <th className="text-center p-3 font-medium">Active PIP</th>
                    <th className="text-center p-3 font-medium">Risk Count</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.map(mgr => (
                    <tr key={mgr.manager_id} className="border-t hover:bg-muted/30">
                      <td className="p-3"><div className="font-medium">{mgr.manager_name}</div><div className="text-xs text-muted-foreground">{mgr.manager_employee_id}</div></td>
                      <td className="p-3 text-center">{mgr.team_size}</td>
                      <td className="p-3 text-center">{mgr.kpi_avg != null ? `${mgr.kpi_avg}%` : '—'}</td>
                      <td className="p-3 text-center">{mgr.assessment_avg != null ? `${mgr.assessment_avg}%` : '—'}</td>
                      <td className="p-3 text-center">{mgr.probation_pass_count}</td>
                      <td className="p-3 text-center">{mgr.active_pip_count}</td>
                      <td className="p-3 text-center">
                        <Badge className={mgr.risk_count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                          {mgr.risk_count}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deferred Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Deferred Metrics Boundary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant={deferred?.managerFilterSource ? 'outline' : 'secondary'}>
            Manager Mapping Source: {deferred?.managerFilterSource ? 'Deferred' : 'Available'}
          </Badge>
          <Badge variant={deferred?.kpiScoreSummary ? 'outline' : 'secondary'}>
            KPI Weighted Score Summary: {deferred?.kpiScoreSummary ? 'Deferred' : 'Available'}
          </Badge>
        </CardContent>
      </Card>

      <KpiDrillDownModal
        department={drillDownDepartment || ''}
        isOpen={drillDownDepartment !== null}
        onClose={() => setDrillDownDepartment(null)}
      />
    </div>
  )
}
