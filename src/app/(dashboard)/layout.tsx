'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth/neon';
import {
  Map,
  Plane,
  Newspaper,
  Link2,
  Bell,
  Eye,
  Settings,
  LogOut,
  Activity,
  Radio,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = auth.useSession();

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/radar', icon: Radio, label: 'OSINT Radar' },
    { href: '/map', icon: Map, label: 'Live Map' },
    { href: '/aircraft', icon: Plane, label: 'Aircraft' },
    { href: '/news', icon: Newspaper, label: 'Intel Feed' },
    { href: '/correlations', icon: Link2, label: 'Correlations' },
    { href: '/alerts', icon: Bell, label: 'Alerts' },
    { href: '/watchlists', icon: Eye, label: 'Watchlists' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const user = session.data?.user;
  const userInitial = (user?.email || user?.name || 'U')[0].toUpperCase();
  const userDisplay = user?.name || user?.email || 'User';

  return (
    <div className="min-h-screen flex bg-background bg-grid">
      {/* Sidebar */}
      <aside className="w-64 glass flex flex-col border-r border-border/50 relative">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-border/50 relative">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <div className="relative p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Radio className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <span className="font-semibold text-foreground tracking-tight">OSINT</span>
            <span className="text-primary font-bold tracking-tight"> Aviation</span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs">
            <span className="status-dot status-online" />
            <span className="text-muted-foreground">System Active</span>
            <Activity className="h-3 w-3 text-primary ml-auto animate-pulse" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 relative">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary ml-0 pl-[10px]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 ml-0.5'
                  }
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <item.icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'text-primary' : 'group-hover:scale-110'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border/50 relative">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/30">
            <div className="relative">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-border/50">
                <span className="text-sm font-semibold text-foreground">
                  {userInitial}
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userDisplay}</p>
              <p className="text-xs text-muted-foreground">Analyst</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200 group"
          >
            <LogOut className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        {/* Subtle top border glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <div className="relative animate-spin rounded-full h-12 w-12 border-2 border-primary/30 border-t-primary" />
              </div>
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
