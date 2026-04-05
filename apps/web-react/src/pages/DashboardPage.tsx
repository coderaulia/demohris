import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart3, Building2, Layers3, ListChecks, Target, Users } from 'lucide-react'

import { dashboardAdapter } from '@/adapters'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectField, type SelectOption } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { KpiDrillDownModal } from '@/components/KpiDrillDownModal'

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
  const byDepartment = new Map<
    string,
    {
      employees: Set<string>
      records: number
      critical: number
      high: number
      managers: Set<string>
    }
  >()

  for (const row of rows) {
    const department = toStringValue(row.department) || 'Unassigned'
    const employeeId = toStringValue(row.employee_id)
    const employeeName = toStringValue(row.employee_name)
    const position = toStringValue(row.position)
    const priority = toStringValue(row.priority).toLowerCase()

    if (!byDepartment.has(department)) {
      byDepartment.set(department, {
        employees: new Set<string>(),
        records: 0,
        critical: 0,
        high: 0,
        managers: new Set<string>(),
      })
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
        secondaryMetricLabel: 'Critical/High',
        secondaryMetricValue: `${value.critical}/${value.high}`,
      }
    })
    .filter(card => !selectedManager || card.manager === selectedManager)
    .sort((a, b) => a.department.localeCompare(b.department))
}

function buildKpiDepartmentCards(
  rows: Array<Record<string, unknown>>,
  assessmentCards: DepartmentCardViewModel[],
  selectedManager: string,
): DepartmentCardViewModel[] {
  const assessmentLookup = new Map(assessmentCards.map(card => [card.department, card]))
  const byDepartment = new Map<
    string,
    {
      recordCount: number
      completed: number
      inProgress: number
    }
  >()

  for (const row of rows) {
    const department = toStringValue(row.department) || 'Unassigned'
    if (!byDepartment.has(department)) {
      byDepartment.set(department, { recordCount: 0, completed: 0, inProgress: 0 })
    }

    const current = byDepartment.get(department)!
    current.recordCount += toNumber(row.total_enrolled)
    current.completed += toNumber(row.completed)
    current.inProgress += toNumber(row.in_progress)
  }

  return [...byDepartment.entries()]
    .map(([department, value]) => {
      const assessmentContext = assessmentLookup.get(department)
      return {
        department,
        manager: assessmentContext?.manager || null,
        employeeCount: assessmentContext?.employeeCount ?? null,
        recordCount: value.recordCount,
        metCount: value.completed,
        secondaryMetricLabel: 'In Progress',
        secondaryMetricValue: String(value.inProgress),
      }
    })
    .filter(card => !selectedManager || card.manager === selectedManager)
    .sort((a, b) => a.department.localeCompare(b.department))
}

function buildDepartmentOptions(
  gapsRows: Array<Record<string, unknown>>,
  lmsRows: Array<Record<string, unknown>>,
): SelectOption[] {
  const set = new Set<string>()
  for (const row of gapsRows) {
    const department = toStringValue(row.department)
    if (department) set.add(department)
  }
  for (const row of lmsRows) {
    const department = toStringValue(row.department)
    if (department) set.add(department)
  }

  return [
    { value: '', label: 'All departments' },
    ...[...set].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value })),
  ]
}

function buildManagerOptions(gapsRows: Array<Record<string, unknown>>): SelectOption[] {
  const managers = new Set<string>()
  for (const row of gapsRows) {
    const name = toStringValue(row.employee_name)
    const position = toStringValue(row.position)
    if (!name || !isManagerPosition(position)) continue
    managers.add(name)
  }

  return [
    { value: '', label: 'All managers' },
    ...[...managers].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value })),
  ]
}

function SummaryStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
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

export function DashboardPage() {
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

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview', appliedFilters.department, appliedFilters.period],
    queryFn: () => dashboardAdapter.getOverview(appliedFilters),
    staleTime: 30_000,
  })

  const gapsRows = dashboardQuery.data?.gapsReport || []
  const lmsByCourseRows = dashboardQuery.data?.lmsReport?.by_course || []
  const lmsSummary = dashboardQuery.data?.lmsReport?.summary || {}
  const tnaSummary = dashboardQuery.data?.tnaSummary || {}
  const activeModules = dashboardQuery.data?.modules || []
  const courseCatalog = dashboardQuery.data?.courseCatalog || []

  const managerOptions = useMemo(() => buildManagerOptions(gapsRows), [gapsRows])
  const departmentOptions = useMemo(
    () => buildDepartmentOptions(gapsRows, lmsByCourseRows),
    [gapsRows, lmsByCourseRows],
  )

  const assessmentCards = useMemo(
    () => buildAssessmentDepartmentCards(gapsRows, appliedFilters.manager),
    [gapsRows, appliedFilters.manager],
  )
  const kpiCards = useMemo(
    () => buildKpiDepartmentCards(lmsByCourseRows, assessmentCards, appliedFilters.manager),
    [lmsByCourseRows, assessmentCards, appliedFilters.manager],
  )

  const currentCards = mode === 'kpi' ? kpiCards : assessmentCards
  const deferred = dashboardQuery.data?.deferred

  const kpiStats = {
    departments: kpiCards.length,
    records: toNumber(lmsSummary.total_enrollments),
    met: toNumber(lmsSummary.completed),
    avgScore: Number.isFinite(Number(lmsSummary.avg_score)) ? Number(lmsSummary.avg_score).toFixed(1) : 'N/A',
  }

  const assessmentStats = {
    departments: assessmentCards.length,
    needs: toNumber(tnaSummary.total_needs_identified),
    completed: toNumber(tnaSummary.needs_completed),
    critical: toNumber(tnaSummary.critical_gaps),
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="text-2xl">HR Management Dashboard</CardTitle>
          <CardDescription>
            Filter-first operational dashboard with KPI vs assessment summary workflows and drill-down-ready department
            cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStat
            icon={<Layers3 className="size-4 text-primary" />}
            label="Active Modules"
            value={String(activeModules.length)}
            hint="Supabase-backed module visibility"
          />
          <SummaryStat
            icon={<ListChecks className="size-4 text-primary" />}
            label="Published Courses"
            value={String(courseCatalog.length)}
            hint="Read-only LMS catalog cutover"
          />
          <SummaryStat
            icon={<Target className="size-4 text-primary" />}
            label="TNA Needs"
            value={String(assessmentStats.needs)}
            hint="Current identified training needs"
          />
          <SummaryStat
            icon={<BarChart3 className="size-4 text-primary" />}
            label="Enrollments"
            value={String(kpiStats.records)}
            hint="LMS report summary records"
          />
        </CardContent>
      </Card>

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
            <Button
              type="button"
              variant="default"
              onClick={() => setAppliedFilters(draftFilters)}
              disabled={dashboardQuery.isFetching}
              className="w-full"
            >
              Apply Filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const reset = { department: '', manager: '', period: normalizePeriod() }
                setDraftFilters(reset)
                setAppliedFilters(reset)
              }}
            >
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

      {dashboardQuery.isLoading ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Loading dashboard metrics...</CardContent>
        </Card>
      ) : null}

      {dashboardQuery.isError ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Dashboard Load Failed</CardTitle>
            <CardDescription>
              {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'Failed to load dashboard data.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Tabs value={mode} onValueChange={value => setMode(value as DashboardMode)}>
        <TabsList>
          <TabsTrigger value="kpi">KPI Summary</TabsTrigger>
          <TabsTrigger value="assessment">Assessment Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="kpi" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryStat
              icon={<Building2 className="size-4 text-primary" />}
              label="Departments"
              value={String(kpiStats.departments)}
              hint="LMS report grouped departments"
            />
            <SummaryStat
              icon={<ListChecks className="size-4 text-primary" />}
              label="Enrollment Records"
              value={String(kpiStats.records)}
              hint="Total records from lms-report"
            />
            <SummaryStat
              icon={<Target className="size-4 text-primary" />}
              label="Met Target"
              value={String(kpiStats.met)}
              hint="Completed enrollments (available metric)"
            />
            <SummaryStat
              icon={<BarChart3 className="size-4 text-primary" />}
              label="Average Score"
              value={kpiStats.avgScore}
              hint="Null-safe legacy parity average"
            />
          </div>
        </TabsContent>

        <TabsContent value="assessment" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryStat
              icon={<Building2 className="size-4 text-primary" />}
              label="Departments"
              value={String(assessmentStats.departments)}
              hint="Departments with active gap records"
            />
            <SummaryStat
              icon={<Users className="size-4 text-primary" />}
              label="Needs Identified"
              value={String(assessmentStats.needs)}
              hint="Total training need records"
            />
            <SummaryStat
              icon={<ListChecks className="size-4 text-primary" />}
              label="Needs Completed"
              value={String(assessmentStats.completed)}
              hint="Completed need records"
            />
            <SummaryStat
              icon={<Target className="size-4 text-primary" />}
              label="Critical Gaps"
              value={String(assessmentStats.critical)}
              hint="Critical priority count"
            />
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Department Overview</CardTitle>
          <CardDescription>
            Grouped summary cards are prepared for drill-down navigation. Metrics shown are only from verified read
            endpoints.
          </CardDescription>
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
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Employees</p>
                  <p className="text-lg font-semibold">{card.employeeCount ?? 'N/A'}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Records</p>
                  <p className="text-lg font-semibold">{card.recordCount}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Target Met</p>
                  <p className="text-lg font-semibold">{card.metCount ?? 'N/A'}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">{card.secondaryMetricLabel}</p>
                  <p className="text-lg font-semibold">{card.secondaryMetricValue}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => setDrillDownDepartment(card.department)}
                >
                  Open Drill-down
                </Button>
              </CardFooter>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deferred Metrics Boundary</CardTitle>
          <CardDescription>
            Explicitly tracks workflow parity fields that require additional endpoint cutover before final dashboard
            parity can be declared.
          </CardDescription>
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
