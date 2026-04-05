import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { RoleGate } from '@/components/RoleGate';
import { DashboardDrilldownPage } from '@/pages/DashboardDrilldownPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DeferredModulePage } from '@/pages/DeferredModulePage';
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { KpiDrilldownPage } from '@/pages/KpiDrilldownPage';
import { KpiReportingPage } from '@/pages/KpiReportingPage';
import { LmsCourseDetailPage } from '@/pages/LmsCourseDetailPage';
import { LmsReadOnlyPage } from '@/pages/LmsReadOnlyPage';
import { LoginPage } from '@/pages/LoginPage';
import { RouteGuard } from '@/components/RouteGuard';
import { env } from '@/lib/env';

const ADMIN_HR = ['superadmin', 'hr'] as const;
const ADMIN_HR_MANAGER = ['superadmin', 'hr', 'manager'] as const;
const EMPLOYEE_DETAIL_ACCESS = ['superadmin', 'hr', 'manager', 'employee'] as const;
const LMS_ACCESS = ['superadmin', 'hr', 'manager', 'employee'] as const;

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

            {
                path: 'workforce/directory',
                element: <Navigate to="/employees" replace />,
            },
            {
                path: 'employees',
                element: (
                    <RoleGate allow={[...ADMIN_HR_MANAGER]} redirectTo="/dashboard">
                        <EmployeesPage />
                    </RoleGate>
                ),
            },
            {
                path: 'workforce/directory/:employeeId',
                element: (
                    <RoleGate allow={[...EMPLOYEE_DETAIL_ACCESS]} redirectTo="/dashboard">
                        <EmployeeDetailPage />
                    </RoleGate>
                ),
            },
            {
                path: 'employees/:employeeId',
                element: (
                    <RoleGate allow={[...EMPLOYEE_DETAIL_ACCESS]} redirectTo="/dashboard">
                        <EmployeeDetailPage />
                    </RoleGate>
                ),
            },
            {
                path: 'workforce/manpower-planning',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage
                            title="Manpower Planning"
                            description="Planning and allocation workflows are deferred until dedicated cutover endpoints are verified."
                            boundaries={['No mutation tools in this slice', 'Planning models pending backend parity']}
                        />
                    </RoleGate>
                ),
            },

            {
                path: 'assessment/dashboard',
                element: (
                    <RoleGate allow={[...ADMIN_HR_MANAGER]}>
                        <KpiReportingPage initialMode="assessment" />
                    </RoleGate>
                ),
            },
            {
                path: 'assessment',
                element: <Navigate to="/assessment/dashboard" replace />,
            },
            {
                path: 'assessment/start',
                element: (
                    <RoleGate allow={[...ADMIN_HR_MANAGER]}>
                        <DeferredModulePage
                            title="Start Assessment"
                            description="Assessment initiation mutations are kept out of shell until mutation parity is fully verified."
                            boundaries={['Read-first rollout', 'Assessment mutation endpoints not fully migrated']}
                        />
                    </RoleGate>
                ),
            },
            {
                path: 'assessment/records',
                element: (
                    <RoleGate allow={[...ADMIN_HR_MANAGER]}>
                        <KpiReportingPage initialMode="assessment" />
                    </RoleGate>
                ),
            },
            {
                path: 'assessment/recommendation',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage
                            title="Training Recommendation"
                            description="Recommendation orchestration remains deferred until end-to-end LMS/TNA mutation parity is complete."
                            boundaries={['Recommendation mutation flow pending', 'Read-only reports are available in Assessment Dashboard']}
                        />
                    </RoleGate>
                ),
            },
            {
                path: 'assessment/history',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage
                            title="Training History"
                            description="Historical drill-down pages are planned after current read/mutation slices are stabilized."
                        />
                    </RoleGate>
                ),
            },

            {
                path: 'performance/kpi-records',
                element: <Navigate to="/kpi" replace />,
            },
            {
                path: 'kpi',
                element: (
                    <RoleGate allow={[...ADMIN_HR_MANAGER]} redirectTo="/dashboard">
                        <KpiReportingPage initialMode="kpi" />
                    </RoleGate>
                ),
            },
            {
                path: 'performance',
                element: <Navigate to="/performance/kpi-records" replace />,
            },
            {
                path: 'performance/kpi-input',
                element: (
                    <RoleGate allow={[...ADMIN_HR_MANAGER]}>
                        <DeferredModulePage
                            title="KPI Input"
                            description="KPI input mutations are temporarily deferred in shell to protect mutation parity rules."
                            boundaries={['KPI mutation tools deferred', 'Use controlled legacy flow for input/edit']}
                        />
                    </RoleGate>
                ),
            },
            {
                path: 'performance/appraisal',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Performance Appraisal" description="Appraisal mutation workflows remain deferred until backend cutover is verified." />
                    </RoleGate>
                ),
            },
            {
                path: 'performance/probation',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Probation" description="Probation domain is available in legacy flow while shell migration remains read-first." />
                    </RoleGate>
                ),
            },
            {
                path: 'performance/pip',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="PIP" description="PIP mutation-heavy workflow is intentionally held until verified cutover slices are complete." />
                    </RoleGate>
                ),
            },

            {
                path: 'lms',
                element: env.enableLmsRoute ? (
                    <RoleGate allow={[...LMS_ACCESS]}>
                        <LmsReadOnlyPage mode="catalog" />
                    </RoleGate>
                ) : <Navigate to="/dashboard" replace />,
            },
            {
                path: 'lms/my-courses',
                element: env.enableLmsRoute ? (
                    <RoleGate allow={[...LMS_ACCESS]}>
                        <LmsReadOnlyPage mode="my-courses" />
                    </RoleGate>
                ) : <Navigate to="/dashboard" replace />,
            },
            {
                path: 'lms/:courseId',
                element: env.enableLmsRoute ? (
                    <RoleGate allow={[...LMS_ACCESS]}>
                        <LmsCourseDetailPage />
                    </RoleGate>
                ) : <Navigate to="/dashboard" replace />,
            },
            {
                path: 'learning/settings',
                element: env.enableLmsRoute ? (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="LMS Settings" description="LMS admin settings are deferred until admin mutation endpoints are parity-tested." />
                    </RoleGate>
                ) : <Navigate to="/dashboard" replace />,
            },
            {
                path: 'learning',
                element: env.enableLmsRoute ? <Navigate to="/lms/my-courses" replace /> : <Navigate to="/dashboard" replace />,
            },

            {
                path: 'organization/company-profile',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Company Profile" description="Organization setup forms remain deferred during read-first migration." />
                    </RoleGate>
                ),
            },
            {
                path: 'organization/structure',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Organization Structure" description="Org chart and structural changes are held until safe mutation cutovers are ready." />
                    </RoleGate>
                ),
            },
            {
                path: 'organization/departments',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Departments" description="Department management remains legacy-backed for now." />
                    </RoleGate>
                ),
            },
            {
                path: 'organization/positions',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Positions & Job Levels" description="Position hierarchy tools are deferred during backend migration." />
                    </RoleGate>
                ),
            },
            {
                path: 'organization/grades',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Grades / Classes" description="Grade/class mutation tooling remains out of shell in this stage." />
                    </RoleGate>
                ),
            },
            {
                path: 'organization/branches',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Branches" description="Branch management is deferred until organization endpoints are fully cut over." />
                    </RoleGate>
                ),
            },

            {
                path: 'system/site-settings',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Site Settings" description="System mutation settings remain deferred for safety." />
                    </RoleGate>
                ),
            },
            {
                path: 'system/users-roles',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Users & Roles" description="Role/user management remains in controlled legacy path for now." />
                    </RoleGate>
                ),
            },
            {
                path: 'system/competencies',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="Competencies" description="Competency configuration mutation tools are deferred in shell." />
                    </RoleGate>
                ),
            },
            {
                path: 'system/kpi-settings',
                element: (
                    <RoleGate allow={[...ADMIN_HR]}>
                        <DeferredModulePage title="KPI Settings" description="KPI setting mutations are deferred while KPI endpoint cutover continues." />
                    </RoleGate>
                ),
            },

            {
                path: 'kpi/drilldown/:mode/:group',
                element: <KpiDrilldownPage />,
            },
            {
                path: 'tna',
                element: <Navigate to="/assessment/dashboard" replace />,
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
    },
]);
