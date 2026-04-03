import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authAdapter, type AuthSource } from '@/adapters';
import { supabase } from '@/lib/supabaseClient';

interface LoginInput {
    email: string;
    password: string;
}

interface AuthContextValue {
    user: Awaited<ReturnType<typeof authAdapter.getAuthContext>>['user'];
    role: Awaited<ReturnType<typeof authAdapter.getAuthContext>>['role'];
    source: AuthSource;
    loading: boolean;
    isAuthenticated: boolean;
    login: (input: LoginInput) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_QUERY_KEY = ['auth', 'context'];

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    const authQuery = useQuery({
        queryKey: AUTH_QUERY_KEY,
        queryFn: authAdapter.getAuthContext,
        staleTime: 10_000,
    });

    const loginMutation = useMutation({
        mutationFn: authAdapter.login,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        },
    });

    const logoutMutation = useMutation({
        mutationFn: authAdapter.logout,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        },
    });

    useEffect(() => {
        if (!supabase) return;
        const { data } = supabase.auth.onAuthStateChange(() => {
            void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        });
        return () => {
            data.subscription.unsubscribe();
        };
    }, [queryClient]);

    const value = useMemo<AuthContextValue>(() => {
        const context = authQuery.data ?? { user: null, role: null, source: 'none' as const };
        return {
            user: context.user,
            role: context.role,
            source: context.source,
            loading: authQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
            isAuthenticated: Boolean(context.user),
            login: async input => {
                await loginMutation.mutateAsync(input);
            },
            logout: async () => {
                await logoutMutation.mutateAsync();
            },
            refresh: async () => {
                await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
            },
        };
    }, [
        authQuery.data,
        authQuery.isLoading,
        loginMutation,
        logoutMutation,
        queryClient,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
