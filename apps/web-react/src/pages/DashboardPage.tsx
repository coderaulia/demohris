import { useQuery } from '@tanstack/react-query';

import { authAdapter } from '@/adapters';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';

export function DashboardPage() {
    const auth = useAuth();
    const snapshotQuery = useQuery({
        queryKey: ['dashboard', 'auth-snapshot'],
        queryFn: authAdapter.getAuthContext,
        staleTime: 10_000,
    });

    return (
        <div className="dashboard-grid">
            <article className="card">
                <h3>Identity</h3>
                <p>
                    Employee ID: <strong>{auth.user?.employee_id || '-'}</strong>
                </p>
                <p>
                    Role: <strong>{auth.role || '-'}</strong>
                </p>
                <p>
                    Source: <strong>{auth.source}</strong>
                </p>
            </article>

            <article className="card">
                <h3>Migration Mode</h3>
                <p>
                    Adapter target: <strong>{env.backendTarget}</strong>
                </p>
                <p>
                    API base: <strong>{env.apiBaseUrl}</strong>
                </p>
                <p>
                    Supabase configured:{' '}
                    <strong>{env.supabaseUrl && env.supabaseAnonKey ? 'yes' : 'no'}</strong>
                </p>
            </article>

            <article className="card">
                <h3>Contract Snapshot</h3>
                {snapshotQuery.isLoading ? <p>Loading snapshot...</p> : null}
                {snapshotQuery.isError ? (
                    <p className="error-text">
                        {snapshotQuery.error instanceof Error ? snapshotQuery.error.message : 'Failed to load'}
                    </p>
                ) : null}
                {snapshotQuery.data ? (
                    <pre>{JSON.stringify(snapshotQuery.data, null, 2)}</pre>
                ) : null}
            </article>
        </div>
    );
}
