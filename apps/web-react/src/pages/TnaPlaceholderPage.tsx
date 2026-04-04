import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/lib/env'

export function TnaPlaceholderPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>TNA Module (Feature-Flagged)</CardTitle>
        <CardDescription>
          TNA React route remains protected until mutation and workflow parity is validated against Supabase-backed
          paths.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => window.open(env.legacyAppUrl, '_self')}>
          <ExternalLink className="size-4" />
          Open Legacy TNA Flow
        </Button>
      </CardContent>
    </Card>
  )
}

