import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { env } from '@/lib/env';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardDrilldownPage } from '@/pages/DashboardDrilldownPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
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
            {
                path: 'dashboard/drilldown/:mode/:department',
                element: <DashboardDrilldownPage />,
            },
            ...(env.enableEmployeesRoute
                ? [
                      {
                          path: 'employees',
                          element: <EmployeesPage />,
                      },
                      {
                          path: 'employees/:employeeId',
                          element: <EmployeeDetailPage />,
                      },
                  ]
                : []),
            ...moduleRoutes,
        ],
    },
    {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
    },
]);
