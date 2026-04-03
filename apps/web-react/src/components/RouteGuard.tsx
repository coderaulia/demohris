import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/providers/AuthProvider';

export function RouteGuard({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const location = useLocation();

    if (auth.loading) {
        return (
            <main className="surface centered">
                <p>Checking auth session...</p>
            </main>
        );
    }

    if (!auth.isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <>{children}</>;
}
