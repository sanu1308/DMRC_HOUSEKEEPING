'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Bug, FlaskConical, Wrench } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type DashboardStats = {
  machineryCount: number;
  chemicalCount: number;
  pestControlCount: number;
};

export default function StaffDashboardPage() {
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  async function apiFetch(path: string) {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Request failed');
    }

    return res.json();
  }

  async function loadStats() {
    try {
      setLoading(true);

      const [machineryRes, chemicalRes, pestRes] = await Promise.all([
        apiFetch('/machinery-usage'),
        apiFetch('/chemical-usage'),
        apiFetch('/pest-control'),
      ]);

      const machineryData = machineryRes.data || machineryRes || [];
      const chemicalData = chemicalRes.data || chemicalRes || [];
      const pestData = pestRes.data || pestRes || [];

      setStats({
        machineryCount: Array.isArray(machineryData)
          ? machineryData.length
          : 0,
        chemicalCount: Array.isArray(chemicalData) ? chemicalData.length : 0,
        pestControlCount: Array.isArray(pestData) ? pestData.length : 0,
      });

      const totalSubmissions =
        (Array.isArray(machineryData) ? machineryData.length : 0) +
        (Array.isArray(chemicalData) ? chemicalData.length : 0) +
        (Array.isArray(pestData) ? pestData.length : 0);
      const completion = Math.min(
        100,
        Math.round((totalSubmissions / 9) * 100) || 10,
      );

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'dmrc_staff_progress_hint',
          completion.toString(),
        );
        window.dispatchEvent(
          new CustomEvent('dmrc-progress-update', { detail: completion }),
        );
      }

      setLastUpdated(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    } catch (error: any) {
      toast({
        title: 'Failed to load dashboard data',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const statusMeta = (
    count: number,
  ): { label: string; badgeBg: string; badgeText: string } => {
    if (count >= 5) {
      return {
        label: 'Completed',
        badgeBg: 'bg-[#ECFDF5]',
        badgeText: 'text-[#15803D]',
      };
    }
    if (count > 0) {
      return {
        label: 'Pending',
        badgeBg: 'bg-[#FFFBEB]',
        badgeText: 'text-[#92400E]',
      };
    }
    return {
      label: 'Needs Review',
      badgeBg: 'bg-[#FEF2F2]',
      badgeText: 'text-[#B91C1C]',
    };
  };

  const cards = useMemo(
    () => [
      {
        key: 'machinery',
        title: 'Machinery Usage',
        count: stats?.machineryCount ?? 0,
        helper: 'Logs recorded for scrubbers, polishers, and dryers.',
        borderClass: 'border-l-[#6366F1]',
        icon: Wrench,
        iconBg: 'bg-[#EEF2FF]',
        iconColor: 'text-[#4F46E5]',
      },
      {
        key: 'chemicals',
        title: 'Chemical Usage',
        count: stats?.chemicalCount ?? 0,
        helper: 'Dosing updates and dilution records.',
        borderClass: 'border-l-[#22C55E]',
        icon: FlaskConical,
        iconBg: 'bg-[#ECFDF5]',
        iconColor: 'text-[#16A34A]',
      },
      {
        key: 'pest',
        title: 'Pest Control',
        count: stats?.pestControlCount ?? 0,
        helper: 'Spot treatments and follow-up visits.',
        borderClass: 'border-l-[#F59E0B]',
        icon: Bug,
        iconBg: 'bg-[#FFFBEB]',
        iconColor: 'text-[#D97706]',
      },
    ],
    [stats?.chemicalCount, stats?.machineryCount, stats?.pestControlCount],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Daily Snapshot
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">
            Your activity across all logs
          </h2>
          <p className="text-sm text-slate-500">
            Monitor submissions for machinery, chemical usage, and pest control in one place.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="text-sm font-semibold text-slate-700">Last updated</p>
          <p>{lastUpdated || 'Waiting for sync...'}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const status = statusMeta(card.count);
          return (
            <Card
              key={card.key}
              className={cn(
                'group relative overflow-hidden border-l-4 bg-white/95 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                card.borderClass,
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {card.title}
                  </p>
                  <div className="mt-3 flex items-end gap-2">
                    <span
                      className={cn(
                        'text-4xl font-bold tracking-tight text-slate-900 transition-all duration-500',
                        mounted ? 'opacity-100' : 'opacity-0 translate-y-2',
                      )}
                    >
                      {loading && !stats ? '—' : card.count}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {card.count === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    'rounded-2xl p-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
                    card.iconBg,
                  )}
                >
                  <Icon className={cn('h-5 w-5', card.iconColor)} />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">{card.helper}</p>

              <div className="mt-4 flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                    status.badgeBg,
                    status.badgeText,
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Status: {status.label}
                </span>
                {card.count === 0 ? (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Log your first entry</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    {lastUpdated ? `Synced ${lastUpdated}` : 'Syncing...'}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
