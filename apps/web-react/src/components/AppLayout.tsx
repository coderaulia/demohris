import { NavLink, Outlet } from 'react-router-dom';
import {
    BarChart3,
    BookOpen,
    BriefcaseBusiness,
    Building2,
    Compass,
    Gauge,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Settings,
    Shield,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';

type Role = 'superadmin' | 'hr' | 'manager' | 'employee' | 'director';

interface NavItem {
    to: string;
    label: string;
    icon: ReactNode;
    roles: Role[];
}

interface NavSection {
    label: string;
    roles: Role[];
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        label: 'Core',
        roles: ['superadmin', 'hr', 'manager'],
        items: [
            { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
        ],
    },
    {
        label: 'Workforce',
        roles: ['superadmin', 'hr', 'manager'],
        items: [
            { to: '/workforce/directory', label: 'Employee Directory', icon: <Users className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/workforce/manpower-planning', label: 'Manpower Planning', icon: <BriefcaseBusiness className="size-4" />, roles: ['superadmin', 'hr'] },
        ],
    },
    {
        label: 'Assessment (TNA)',
        roles: ['superadmin', 'hr', 'manager'],
        items: [
            { to: '/assessment/dashboard', label: 'Assessment Dashboard', icon: <Gauge className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/assessment/start', label: 'Start Assessment', icon: <Compass className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/assessment/records', label: 'Assessment Records', icon: <BarChart3 className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/assessment/recommendation', label: 'Training Recommendation', icon: <GraduationCap className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/assessment/history', label: 'Training History', icon: <BookOpen className="size-4" />, roles: ['superadmin', 'hr'] },
        ],
    },
    {
        label: 'Performance',
        roles: ['superadmin', 'hr', 'manager'],
        items: [
            { to: '/performance/kpi-records', label: 'KPI Records', icon: <BarChart3 className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/performance/kpi-input', label: 'KPI Input', icon: <Gauge className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/performance/appraisal', label: 'Performance Appraisal', icon: <Compass className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/performance/probation', label: 'Probation', icon: <Shield className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/performance/pip', label: 'PIP', icon: <Shield className="size-4" />, roles: ['superadmin', 'hr'] },
        ],
    },
    {
        label: 'Learning (LMS)',
        roles: ['superadmin', 'hr', 'manager'],
        items: [
            { to: '/lms', label: 'Training Catalog', icon: <BookOpen className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/lms/my-courses', label: 'My Courses', icon: <GraduationCap className="size-4" />, roles: ['superadmin', 'hr', 'manager'] },
            { to: '/learning/settings', label: 'LMS Settings', icon: <Settings className="size-4" />, roles: ['superadmin', 'hr'] },
        ],
    },
    {
        label: 'Organization',
        roles: ['superadmin', 'hr'],
        items: [
            { to: '/organization/company-profile', label: 'Company Profile', icon: <Building2 className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/organization/structure', label: 'Organization Structure', icon: <Building2 className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/organization/departments', label: 'Departments', icon: <Building2 className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/organization/positions', label: 'Positions & Job Levels', icon: <Building2 className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/organization/grades', label: 'Grades / Classes', icon: <Building2 className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/organization/branches', label: 'Branches', icon: <Building2 className="size-4" />, roles: ['superadmin', 'hr'] },
        ],
    },
    {
        label: 'System Settings',
        roles: ['superadmin', 'hr'],
        items: [
            { to: '/system/site-settings', label: 'Site Settings', icon: <Settings className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/system/users-roles', label: 'Users & Roles', icon: <Settings className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/system/competencies', label: 'Competencies', icon: <Settings className="size-4" />, roles: ['superadmin', 'hr'] },
            { to: '/system/kpi-settings', label: 'KPI Settings', icon: <Settings className="size-4" />, roles: ['superadmin', 'hr'] },
        ],
    },
];

function SidebarLink({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : '',
                )
            }
        >
            {icon}
            {label}
        </NavLink>
    );
}

export function AppLayout() {
    const auth = useAuth();
    const role = (auth.role || 'employee') as Role;

    const visibleSections = navSections
        .filter(section => section.roles.includes(role))
        .map(section => ({
            ...section,
            items: section.items.filter(item => item.roles.includes(role)),
        }))
        .filter(section => section.items.length > 0);

    return (
        <div className="min-h-screen bg-muted/30">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-4 p-4 lg:flex-row lg:p-6">
                <aside className="w-full rounded-xl border bg-card p-4 shadow-sm lg:w-80">
                    <div className="space-y-1 pb-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">HR SaaS Shell</p>
                        <h1 className="text-xl font-semibold tracking-tight">HR Performance Suite</h1>
                    </div>

                    <nav className="space-y-4">
                        {visibleSections.map(section => (
                            <div key={section.label} className="space-y-1">
                                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {section.label}
                                </p>
                                <div className="space-y-1">
                                    {section.items.map(item => (
                                        <SidebarLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className="mt-6 rounded-lg border bg-muted/40 p-3 text-xs">
                        <p className="text-muted-foreground">Auth Source</p>
                        <p className="font-medium">{auth.source}</p>
                        <p className="mt-2 text-muted-foreground">Role</p>
                        <p className="font-medium">{auth.role || '-'}</p>
                    </div>
                </aside>

                <main className="flex-1 space-y-4">
                    <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Management Console</h2>
                            <p className="text-sm text-muted-foreground">
                                Read-first shell with role-scoped navigation and safe gradual cutover boundaries.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                void auth.logout();
                            }}
                        >
                            <LogOut className="size-4" />
                            Sign Out
                        </Button>
                    </header>
                    <section className="space-y-4">
                        <Outlet />
                    </section>
                </main>
            </div>
        </div>
    );
}
