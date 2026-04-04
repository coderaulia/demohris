import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/lib/env'

export function LmsPlaceholderPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LMS Module (Feature-Flagged)</CardTitle>
        <CardDescription>
          LMS React route remains intentionally limited while mutation-heavy workflows are still validating parity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => window.open(env.legacyAppUrl, '_self')}>
          <ExternalLink className="size-4" />
          Open Legacy LMS Flow
        </Button>
      </CardContent>
    </Card>
  )
}
