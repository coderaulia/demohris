import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
    children: ReactNode;
}

interface AppErrorBoundaryState {
    hasError: boolean;
    message: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    constructor(props: AppErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            message: '',
        };
    }

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return {
            hasError: true,
            message: error.message || 'Unexpected application error',
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('App shell error boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <main className="surface centered">
                    <div className="card">
                        <h1>Shell Error</h1>
                        <p>{this.state.message}</p>
                        <button type="button" onClick={() => window.location.reload()}>
                            Reload
                        </button>
                    </div>
                </main>
            );
        }

        return this.props.children;
    }
}
