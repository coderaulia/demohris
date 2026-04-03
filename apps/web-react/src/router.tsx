import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { env } from '@/lib/env';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardPage } from '@/pages/DashboardPage';
import { LmsPlaceholderPage } from '@/pages/LmsPlaceholderPage';
import { LoginPage } from '@/pages/LoginPage';
import { TnaPlaceholderPage } from '@/pages/TnaPlaceholderPage';

const moduleRoutes: RouteObject[] = [
];

if (env.enableLmsRoute) {
    moduleRoutes.push({
        path: 'lms/*',
        element: <LmsPlaceholderPage />,
    });
}

if (env.enableTnaRoute) {
    moduleRoutes.push({
        path: 'tna/*',
        element: <TnaPlaceholderPage />,
    });
}

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/',
        element: (
            <RouteGuard>
                <AppLayout />
            </RouteGuard>
        ),
        children: [
            {
                index: true,
                element: <Navigate to="/dashboard" replace />,
            },
            {
                path: 'dashboard',
                element: <DashboardPage />,
            },
            ...moduleRoutes,
        ],
    },
    {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
    },
]);
