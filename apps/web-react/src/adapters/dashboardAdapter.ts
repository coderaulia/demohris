import { lmsAdapter } from './lmsAdapter'
import { modulesAdapter } from './modulesAdapter'
import { tnaAdapter } from './tnaAdapter'

interface DashboardFiltersInput {
  department?: string
  period?: string
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
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>
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
}

