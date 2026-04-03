import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardPage } from '@/pages/DashboardPage';
import { LmsPlaceholderPage } from '@/pages/LmsPlaceholderPage';
import { LoginPage } from '@/pages/LoginPage';
import { TnaPlaceholderPage } from '@/pages/TnaPlaceholderPage';

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
            {
                path: 'lms/*',
                element: <LmsPlaceholderPage />,
            },
            {
                path: 'tna/*',
                element: <TnaPlaceholderPage />,
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
    },
]);
