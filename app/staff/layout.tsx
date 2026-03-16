
'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  Bug,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  accent: string;
};

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

function NavigationList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/staff'
            ? pathname === '/staff'
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-300',
              isActive
                ? 'bg-[#1FA6C8] text-white shadow-lg shadow-cyan-900/40'
                : 'text-[#C7D6E5] hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 transition-colors',
              isActive ? 'text-white' : 'text-[#C7D6E5]',
              )}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('Team Member');
  const [progress, setProgress] = useState(68);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ringRadius = 42;
  const circumference = 2 * Math.PI * ringRadius;

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        href: '/staff',
        label: 'My Dashboard',
        icon: LayoutDashboard,
        accent: 'from-[#4C1D95]/90 via-[#6D28D9]/90 to-[#C084FC]/90',
      },
      {
        href: '/staff/machinery',
        label: 'My Machinery Logs',
        icon: Wrench,
        accent: 'from-[#0F766E]/90 via-[#14B8A6]/90 to-[#2DD4BF]/90',
      },
      {
        href: '/staff/chemicals',
        label: 'Chemical Records',
        icon: FlaskConical,
        accent: 'from-[#0369A1]/90 via-[#0EA5E9]/90 to-[#38BDF8]/90',
      },
      {
        href: '/staff/pest-control',
        label: 'Pest Reports',
        icon: Bug,
        accent: 'from-[#9D174D]/90 via-[#DB2777]/90 to-[#FB7185]/90',
      },
    ],
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = window.localStorage.getItem('dmrc_token');
    if (token) {
      try {
        const [, payload] = token.split('.');
        if (payload) {
          const decoded = JSON.parse(window.atob(payload));
          if (decoded?.name) {
            setDisplayName(decoded.name);
          }
        }
      } catch (error) {
        console.warn('Unable to decode token payload', error);
      }
    }

    const cachedProgress = window.localStorage.getItem('dmrc_staff_progress_hint');
    if (cachedProgress) {
      const numeric = Number(cachedProgress);
      if (!Number.isNaN(numeric)) {
        setProgress(Math.min(100, Math.max(0, numeric)));
      }
    }

    const updateTimestamp = () => {
      setLastSynced(timeFormatter.format(new Date()));
    };

    updateTimestamp();

    const handleProgressUpdate = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === 'number') {
        setProgress(Math.min(100, Math.max(0, detail)));
        updateTimestamp();
      }
    };

    window.addEventListener('dmrc-progress-update', handleProgressUpdate);
    return () => {
      window.removeEventListener('dmrc-progress-update', handleProgressUpdate);
    };
  }, []);

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('dmrc_token');
      router.push('/login');
    }
  }

  const formattedLastSynced = lastSynced ?? '—';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-svh bg-slate-50">
        <aside className="hidden w-72 flex-col justify-between bg-[#0F2A44] p-4 text-white shadow-[0_20px_60px_rgba(15,42,68,0.6)] lg:flex">
          <div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-white/90">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/60">Team Console</p>
                <span className="text-base font-semibold tracking-tight text-white">
                  Metro Housekeeping
                </span>
              </div>
            </div>
            <div className="mt-6">
              <NavigationList items={navItems} pathname={pathname} />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white/80 shadow-inner shadow-black/20 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-white/60">Daily reminder</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Keep logs updated before the nightly reset.
            </p>
            <p className="text-xs text-white/70">
              Fresh entries boost the command center insights for your station.
            </p>
          </div>
        </aside>
        <div className="flex flex-1 flex-col bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
          <header className="px-3 py-4 sm:px-6">
            <div className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(90deg,#4F46E5,#06B6D4)] px-4 py-5 text-white shadow-xl shadow-blue-900/30 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <SheetTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20 lg:hidden"
                      >
                        <PanelLeft className="h-4 w-4" />
                        Menu
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-72 border-none bg-[#0F2A44] p-0 text-white"
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-white/90">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-white/60">
                              Team Console
                            </p>
                            <span className="text-base font-semibold tracking-tight text-white">
                              Metro Housekeeping
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-6 px-4 pb-8">
                        <NavigationList
                          items={navItems}
                          pathname={pathname}
                          onNavigate={() => setMobileNavOpen(false)}
                        />
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white/80 shadow-inner shadow-black/20 backdrop-blur">
                          <p className="text-xs uppercase tracking-wider text-white/60">
                            Daily reminder
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            Keep logs updated before the nightly reset.
                          </p>
                          <p className="text-xs text-white/70">
                            Fresh entries boost the command center insights for your station.
                          </p>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                    Workspace
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="border-white/70 bg-white/10 text-white shadow-sm hover:bg-white/20"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span className="font-semibold tracking-wide">Logout</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="end" className="text-xs">
                    Sign out of your session
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-col gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white/80">
                    👋 Welcome back, {displayName}
                  </p>
                  <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
                    Here’s a quick overview of your activity today
                  </h1>
                  <p className="text-xs text-white/75">
                    Stay consistent to keep every station spotless.
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative h-20 w-20">
                    <svg className="h-full w-full" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r={ringRadius}
                        stroke="white"
                        strokeOpacity="0.2"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={ringRadius}
                        stroke="url(#progressGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={
                          circumference - (progress / 100) * circumference
                        }
                        transform="rotate(-90 50 50)"
                      />
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.9" />
                        </linearGradient>
                      </defs>
                      <text
                        x="50"
                        y="54"
                        textAnchor="middle"
                        className="text-sm font-semibold fill-white"
                      >
                        {progress}%
                      </text>
                    </svg>
                  </div>
                  <div className="text-right text-xs text-white/80">
                    <p className="text-sm font-semibold text-white">Daily completion</p>
                    <p>{progress}% synced</p>
                    <p>Last updated {formattedLastSynced}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 px-3 py-4 transition-all duration-500 md:px-8 md:py-6">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_25px_65px_-35px_rgba(15,23,42,0.75)] ring-1 ring-slate-100/80 backdrop-blur-sm transition-all duration-500 hover:shadow-[0_35px_75px_-45px_rgba(15,23,42,0.8)] sm:p-6">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

