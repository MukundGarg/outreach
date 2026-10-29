'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronRight,
  Command,
  Compass,
  LayoutDashboard,
  Mail,
  Menu,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { DemoProvider } from './demo-provider';
import { AuthenticatedWorkspaceProvider } from './authenticated-provider';
import { WorkspaceConfigProvider, useWorkspaceConfig } from './workspace-config';
import { useWorkspace } from './use-workspace';
const links = [
  ['/dashboard', 'Overview', LayoutDashboard],
  ['/profile', 'Candidate profile', UserRound],
  ['/preferences', 'Job preferences', SlidersHorizontal],
  ['/applications', 'Applications', BriefcaseBusiness],
  ['/outreach', 'Outreach', Mail],
  ['/settings', 'Settings', Settings2],
] as const;
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <Compass size={21} />
      </span>
      ApplyPilot
      <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
        AI
      </span>
    </Link>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { isDemo } = useWorkspaceConfig();
  const { data, loading, error, refresh } = useWorkspace();

  const userDisplayName = isDemo
    ? 'Alex Morgan'
    : (data.profile.name || 'Your Profile');
  const userInitials = isDemo
    ? 'AM'
    : (data.profile.name
        ? data.profile.name
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
        : 'AP');
  const userSubtext = isDemo
    ? 'Sample candidate · Demo'
    : (data.profile.headline || 'Authenticated workspace');

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="between">
          <Brand />
          {open && (
            <button
              className="icon-button mobile-menu"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="nav-label">{isDemo ? 'YOUR WORKSPACE' : 'PRODUCTION WORKSPACE'}</div>
        <nav>
          {links.map(([href, title, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              className={`nav-link ${path.startsWith(href) ? 'active' : ''}`}
              key={href}
              href={href}
            >
              <Icon size={17} />
              {title}
              {path.startsWith(href) && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade">
            <ChartNoAxesCombined size={19} />
            <h3 style={{ margin: '10px 0 0' }}>A little momentum. A big move.</h3>
            <p>One thoughtful application at a time. Your next chapter starts here.</p>
            <Link href="/applications" className="button" style={{ width: '100%', fontSize: 11 }}>
              Explore your pipeline <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="row" style={{ padding: '0 8px' }}>
            <div className="avatar">{userInitials}</div>
            <div>
              <strong style={{ fontSize: 12 }}>{userDisplayName}</strong>
              <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                {userSubtext}
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="row">
            <button
              aria-label="Open navigation"
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              Workspace <span className="muted">/</span>{' '}
              <strong>{links.find(([href]) => path.startsWith(href))?.[1] ?? 'Overview'}</strong>
            </span>
          </div>
          <div className="row">
            {isDemo ? (
              <span className="demo-bar">● DEMO WORKSPACE · SAMPLE DATA</span>
            ) : (
              <span className="demo-bar" style={{ background: '#e0efe4', color: '#1f5f3e' }}>
                ● AUTHENTICATED WORKSPACE · SUPABASE PERSISTED
              </span>
            )}
            <span className="search-hint">
              <Command size={14} /> Built for your next chapter
            </span>
          </div>
        </header>
        <main className="content">
          {!isDemo && loading ? (
            <section className="card">
              <h2>Loading your workspace…</h2>
              <p className="muted">Retrieving your saved profile, preferences and applications.</p>
            </section>
          ) : !isDemo && error ? (
            <section className="card stack">
              <h2>Workspace connection error</h2>
              <p className="notice" role="alert">{error}</p>
              <p className="muted">Please verify your Supabase database connection and table permissions.</p>
              {refresh && (
                <div>
                  <button className="button primary" onClick={() => refresh()}>
                    Retry connection
                  </button>
                </div>
              )}
            </section>
          ) : (
            children
          )}
          <footer className="footer">
            <span>© 2026 ApplyPilot AI · Make your next move count.</span>
            <span className="row">
              <ShieldCheck size={13} />{' '}
              {isDemo
                ? 'Demo changes stay in this browser session'
                : 'Authenticated data securely persisted in Supabase'}
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}

export function Shell({
  children,
  isDemo = true,
}: {
  children: React.ReactNode;
  isDemo?: boolean;
}) {
  return (
    <WorkspaceConfigProvider isDemo={isDemo}>
      {isDemo ? (
        <DemoProvider>
          <ShellInner>{children}</ShellInner>
        </DemoProvider>
      ) : (
        <AuthenticatedWorkspaceProvider>
          <ShellInner>{children}</ShellInner>
        </AuthenticatedWorkspaceProvider>
      )}
    </WorkspaceConfigProvider>
  );
}

