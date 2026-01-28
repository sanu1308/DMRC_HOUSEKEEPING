'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  Bug,
  FlaskConical,
  LayoutDashboard,
  Wrench,
} from 'lucide-react';

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/staff', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staff/machinery', label: 'Machinery', icon: Wrench },
    { href: '/staff/chemicals', label: 'Chemicals', icon: FlaskConical },
    { href: '/staff/pest-control', label: 'Pest Control', icon: Bug },
  ];

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('dmrc_token');
      router.push('/login');
    }
  }

  return (
    <SidebarProvider>
      <Sidebar
        variant="sidebar"
        collapsible="icon"
        className="bg-white/95 shadow-md border-r"
      >
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <Building2 className="h-5 w-5 text-blue-600" />
            <span className="text-base font-semibold tracking-tight">
              Metro Housekeeping
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {links.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === '/staff'
                  ? pathname === '/staff'
                  : pathname.startsWith(link.href);

              return (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2"
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : null}
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset
        className="transition-[padding] duration-300 md:pl-[calc(var(--sidebar-width)+1rem)] lg:pl-[calc(var(--sidebar-width)+2rem)]"
      >
        <div className="flex min-h-svh flex-1 flex-col bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 transition-colors duration-500">
          <header className="flex items-center justify-between border-b bg-white/85 px-4 py-3 shadow-md shadow-slate-900/5 backdrop-blur supports-[backdrop-filter]:bg-white/60 transition-all duration-500">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="flex flex-col">
                <span className="text-lg font-semibold tracking-tight">
                  Staff Dashboard
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </header>
          <main className="flex-1 px-3 py-4 md:px-8 md:py-6 transition-all duration-500">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_25px_65px_-35px_rgba(15,23,42,0.75)] ring-1 ring-slate-100/80 backdrop-blur-sm transition-all duration-500 hover:shadow-[0_35px_75px_-45px_rgba(15,23,42,0.8)] sm:p-6">
                {children}
              </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

