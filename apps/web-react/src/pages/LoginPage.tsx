import { FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/providers/AuthProvider';

export function LoginPage() {
    const auth = useAuth();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (auth.isAuthenticated) {
        const target = (location.state as { from?: string } | null)?.from || '/dashboard';
        return <Navigate to={target} replace />;
    }

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        try {
            await auth.login({ email, password });
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Login failed';
            setError(message);
        }
    }

    return (
        <main className="surface centered">
            <form className="card form-card" onSubmit={onSubmit}>
                <h1>Sign In</h1>
                <p>Uses Supabase Auth when configured, with legacy session fallback only in migration modes.</p>
                <label>
                    Email
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        autoComplete="email"
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        autoComplete="current-password"
                    />
                </label>
                {error ? <p className="error-text">{error}</p> : null}
                <button type="submit" disabled={auth.loading}>
                    {auth.loading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>
        </main>
    );
}
