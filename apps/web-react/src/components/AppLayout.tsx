import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, LibraryBig, ListTodo, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

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
  )
}

export function AppLayout() {
  const auth = useAuth()

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:flex-row lg:p-6">
        <aside className="w-full rounded-xl border bg-card p-4 shadow-sm lg:w-72">
          <div className="space-y-1 pb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Supabase-first shell</p>
            <h1 className="text-xl font-semibold tracking-tight">HR Performance Suite</h1>
          </div>

          <nav className="flex flex-col gap-1">
            <SidebarLink to="/dashboard" label="Dashboard" icon={<LayoutDashboard className="size-4" />} />
            {env.enableLmsRoute ? (
              <SidebarLink to="/lms" label="LMS Module" icon={<LibraryBig className="size-4" />} />
            ) : null}
            {env.enableTnaRoute ? (
              <SidebarLink to="/tna" label="TNA Module" icon={<ListTodo className="size-4" />} />
            ) : null}
          </nav>

          <div className="mt-6 rounded-lg border bg-muted/40 p-3 text-xs">
            <p className="text-muted-foreground">Auth Source</p>
            <p className="font-medium">{auth.source}</p>
            <p className="mt-2 text-muted-foreground">Role</p>
            <p className="font-medium">{auth.role || '-'}</p>
            {env.showLegacyAppLink ? (
              <a className="mt-3 inline-block text-primary underline-offset-4 hover:underline" href={env.legacyAppUrl}>
                Open legacy app
              </a>
            ) : null}
          </div>
        </aside>

        <main className="flex-1 space-y-4">
          <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Management Console</h2>
              <p className="text-sm text-muted-foreground">
                Contract-safe migration shell with Supabase-backed read slices.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void auth.logout()
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
  )
}
