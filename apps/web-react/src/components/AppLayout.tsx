import { NavLink, Outlet } from 'react-router-dom';

import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';

function SidebarLink({ to, label }: { to: string; label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')}
        >
            {label}
        </NavLink>
    );
}

export function AppLayout() {
    const auth = useAuth();

    return (
        <div className="shell">
            <aside className="sidebar">
                <div className="brand">
                    <h1>demo-kpi</h1>
                    <p>React migration shell</p>
                </div>

                <nav className="sidebar-nav">
                    <SidebarLink to="/dashboard" label="Dashboard" />
                    <SidebarLink to="/lms" label="LMS (Legacy Placeholder)" />
                    <SidebarLink to="/tna" label="TNA (Legacy Placeholder)" />
                </nav>

                <div className="sidebar-meta">
                    <div>
                        <small>Auth Source</small>
                        <p>{auth.source}</p>
                    </div>
                    <div>
                        <small>Role</small>
                        <p>{auth.role || '-'}</p>
                    </div>
                    <a href={env.legacyAppUrl} className="legacy-link">
                        Open Legacy App
                    </a>
                </div>
            </aside>

            <main className="content">
                <header className="content-header">
                    <div>
                        <h2>HR Performance Suite</h2>
                        <p>Adapter-based strangler migration</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            void auth.logout();
                        }}
                    >
                        Sign Out
                    </button>
                </header>
                <section className="content-body">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}
