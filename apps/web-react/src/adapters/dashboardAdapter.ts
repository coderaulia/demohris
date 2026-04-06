import { lmsAdapter } from './lmsAdapter'
import { modulesAdapter } from './modulesAdapter'
import { tnaAdapter } from './tnaAdapter'
import { kpiAdapter } from './kpiAdapter'
import { env } from '@/lib/env'
import { getSupabaseSession } from '@/lib/supabaseClient'
import { transport } from './transport'

interface DashboardFiltersInput {
  department?: string
  period?: string
  manager_id?: string
}

export interface DashboardDataResult {
  modules: unknown[]
  tnaSummary: Record<string, unknown> | null
  gapsReport: Array<Record<string, unknown>>
  lmsReport: {
    summary: Record<string, unknown>
    by_course: Array<Record<string, unknown>>
  } | null
  courseCatalog: unknown[]
  deferred: {
    managerFilterSource: boolean
    kpiScoreSummary: boolean
  }
  summary?: {
    total_employees_with_kpi: number
    total_kpi_definitions: number
    total_records: number
    records_period: string
    avg_achievement_pct: number | null
    met_target_count: number
  }
  achievementByCategory?: Array<{
    category: string
    avg_achievement: number
    record_count: number
  }>
  topPerformers?: {
    monthly: Array<{ employee_id: string; name: string; position: string; department: string; avg_achievement: number; kpi_count: number }>
    quarterly: Array<{ employee_id: string; name: string; position: string; department: string; avg_achievement: number; kpi_count: number }>
  }
  leadership?: {
    probation_pass_rate: number
    probation_pass_count: number
    probation_total_closed: number
    pip_conversion_rate: number
    pip_active_count: number
    pip_total_eligible: number
    pip_success_rate: number
    risk_watchlist: Array<{
      employee_id: string
      name: string
      position: string
      department: string
      avg_score: number
      has_active_pip: boolean
      risk_level: 'high' | 'medium'
    }>
  }
  kpiTrend?: Array<{
    month: string
    period: string
    avg_kpi_score: number
    at_risk_employee_count: number
  }>
  managerCalibration?: Array<{
    manager_id: string
    manager_name: string
    manager_employee_id: string
    team_size: number
    kpi_avg: number | null
    assessment_avg: number | null
    probation_pass_count: number
    active_pip_count: number
    risk_count: number
  }>
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>
}

async function getAccessToken(): Promise<string> {
  const session = await getSupabaseSession()
  return String(session?.access_token || '')
}

export const dashboardAdapter = {
  async getOverview(input: DashboardFiltersInput = {}): Promise<DashboardDataResult> {
    const department = String(input.department || '').trim()
    const period = String(input.period || '').trim()

    const [modulesResult, tnaSummaryResult, gapsReportResult, lmsReportResult, lmsCoursesResult] = await Promise.allSettled([
      modulesAdapter.active(),
      tnaAdapter.summary({ period }),
      tnaAdapter.gapsReport(department ? { department } : {}),
      tnaAdapter.lmsReport(department ? { department } : {}),
      lmsAdapter.listCourses({ status: 'published', page: 1, limit: 200 }),
    ])

    return {
      modules:
        modulesResult.status === 'fulfilled' ? toObjectArray(toObject(modulesResult.value).modules) : [],
      tnaSummary:
        tnaSummaryResult.status === 'fulfilled' ? toObject(toObject(tnaSummaryResult.value).data) : null,
      gapsReport:
        gapsReportResult.status === 'fulfilled' ? toObjectArray(toObject(gapsReportResult.value).data) : [],
      lmsReport:
        lmsReportResult.status === 'fulfilled'
          ? ({
              summary: toObject(toObject(toObject(lmsReportResult.value).data).summary),
              by_course: toObjectArray(toObject(toObject(lmsReportResult.value).data).by_course),
            })
          : null,
      courseCatalog:
        lmsCoursesResult.status === 'fulfilled' ? toObjectArray(toObject(lmsCoursesResult.value).courses) : [],
      deferred: {
        managerFilterSource: true,
        kpiScoreSummary: true,
      },
    }
  },

  async getSummary(filters: DashboardFiltersInput = {}) {
    const accessToken = await getAccessToken()
    return transport.execute({
      domain: 'dashboard',
      action: 'dashboard/summary',
      payload: filters,
      method: 'POST',
      schema: null as any,
      accessToken: accessToken || undefined,
    })
  },

  async getAchievementByCategory(filters: DashboardFiltersInput = {}) {
    const accessToken = await getAccessToken()
    return transport.execute({
      domain: 'dashboard',
      action: 'dashboard/achievement-by-category',
      payload: filters,
      method: 'POST',
      schema: null as any,
      accessToken: accessToken || undefined,
    })
  },

  async getTopPerformers(scope: 'monthly' | 'quarterly' = 'monthly', filters: DashboardFiltersInput = {}) {
    const accessToken = await getAccessToken()
    return transport.execute({
      domain: 'dashboard',
      action: 'dashboard/top-performers',
      payload: { ...filters, scope },
      method: 'POST',
      schema: null as any,
      accessToken: accessToken || undefined,
    })
  },

  async getLeadershipAnalytics(filters: DashboardFiltersInput = {}) {
    const accessToken = await getAccessToken()
    return transport.execute({
      domain: 'dashboard',
      action: 'dashboard/leadership-analytics',
      payload: filters,
      method: 'POST',
      schema: null as any,
      accessToken: accessToken || undefined,
    })
  },

  async getKpiTrend(filters: DashboardFiltersInput & { months?: number } = {}) {
    const accessToken = await getAccessToken()
    return transport.execute({
      domain: 'dashboard',
      action: 'dashboard/kpi-trend',
      payload: filters,
      method: 'POST',
      schema: null as any,
      accessToken: accessToken || undefined,
    })
  },

  async getManagerCalibration(filters: DashboardFiltersInput = {}) {
    const accessToken = await getAccessToken()
    return transport.execute({
      domain: 'dashboard',
      action: 'dashboard/manager-calibration',
      payload: filters,
      method: 'POST',
      schema: null as any,
      accessToken: accessToken || undefined,
    })
  },
}

