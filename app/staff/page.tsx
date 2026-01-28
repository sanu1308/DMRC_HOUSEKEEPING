'use client';

import { useEffect, useState } from 'react';
import { Activity, Bug, FlaskConical, Wrench } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Staff Dashboard
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Overview of your submitted records for machinery usage, chemical usage,
        and pest control.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Machinery Usage Records
            </CardTitle>
            <Wrench className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading && !stats ? '—' : stats?.machineryCount ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total machinery usage entries submitted.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chemical Usage</CardTitle>
            <FlaskConical className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading && !stats ? '—' : stats?.chemicalCount ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total chemical usage entries submitted.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pest Control</CardTitle>
            <Bug className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading && !stats ? '—' : stats?.pestControlCount ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total pest control records submitted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
