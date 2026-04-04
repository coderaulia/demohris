import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  message: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      message: '',
    }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected application error',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App shell error boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Shell Error</CardTitle>
              <CardDescription>The React shell encountered an unexpected runtime error.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-destructive">{this.state.message}</p>
              <Button type="button" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </CardContent>
          </Card>
        </main>
      )
    }

    return this.props.children
  }
}

