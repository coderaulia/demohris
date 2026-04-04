import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function decodeSegment(value: string | undefined) {
  return decodeURIComponent(String(value || '').trim())
}

export function DashboardDrilldownPage() {
  const params = useParams<{ mode: string; department: string }>()
  const [searchParams] = useSearchParams()

  const mode = decodeSegment(params.mode) || 'kpi'
  const department = decodeSegment(params.department) || 'unknown'
  const period = String(searchParams.get('period') || '').trim() || 'all periods'
  const manager = String(searchParams.get('manager') || '').trim() || 'all managers'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department Drill-down (Prepared)</CardTitle>
        <CardDescription>
          Workflow parity is preserved with a drill-down route boundary. Detailed KPI/assessment mutation workflows are
          still being migrated.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Mode: {mode.toUpperCase()}</Badge>
          <Badge variant="outline">Department: {department}</Badge>
          <Badge variant="outline">Period: {period}</Badge>
          <Badge variant="outline">Manager: {manager}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Next cutover step will wire this route to department-level detail reads once mutation parity and permission
          boundaries are complete.
        </p>
        <div>
          <Button variant="default" onClick={() => window.history.back()}>
            Back to Dashboard
          </Button>
          <Link to="/dashboard" className="ml-3 text-sm text-muted-foreground hover:underline">
            Go to dashboard root
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
