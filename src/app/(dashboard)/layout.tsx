'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth/neon';
import {
  Map,
  Plane,
  Newspaper,
  Link2,
  Bell,
  LogOut,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = auth.useSession();

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/', icon: Map, label: 'Map' },
    { href: '/aircraft', icon: Plane, label: 'Aircraft' },
    { href: '/news', icon: Newspaper, label: 'News' },
    { href: '/correlations', icon: Link2, label: 'Correlations' },
    { href: '/alerts', icon: Bell, label: 'Alerts' },
  ];

  const user = session.data?.user;
  const userInitial = (user?.email || user?.name || 'U')[0].toUpperCase();
  const userDisplay = user?.name || user?.email || 'User';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <Plane className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">OSINT Aviation</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {userInitial}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userDisplay}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
