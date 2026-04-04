import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/providers/AuthProvider'

export function RouteGuard({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Checking auth session...</CardContent>
        </Card>
      </main>
    )
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

