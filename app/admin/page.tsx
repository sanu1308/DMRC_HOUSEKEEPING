"use client"
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Bell,
  Bug,
  CircleDot,
  FileDown,
  Filter,
  HardHat,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAreas } from '@/hooks/use-areas';
import { useStations } from '@/hooks/use-stations';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type DecisionStatus = 'good' | 'warn' | 'bad';

type DashboardStats = {
  date: string;
  stats: {
    staff: {
      total_staff_entries: number;
      total_persons: number;
      stations_covered: number;
    };
    chemicals: {
      total_usage_records: number;
      chemicals_used: number;
      total_quantity_used: number;
    };
    inventory: {
      total_chemicals: number;
      low_stock_count: number;
      sufficient_stock_count: number;
    };
    pest: {
      total_activities: number;
      pest_types_handled: number;
      stations_serviced: number;
      total_chemical_used?: number;
    };
    machinery: {
      total_usage_records: number;
      machine_types_used: number;
      total_hours: number;
      stations_covered: number;
    };
  };
};

type StationAlert = {
  id: number;
  station_id: number | null;
  alert_type: string;
  message: string;
  created_at: string;
  station_name?: string | null;
};

type StationPulseData = {
  metrics: {
    avgComplianceScore?: number;
    overdueActions?: number;
    pendingExports?: number;
    activeAlerts?: number;
  };
  alerts: StationAlert[];
};

type StationManpowerAllocation = {
  id?: number;
  station_id: number;
  station_name: string;
  station_code?: string;
  total_manpower: number;
};

const demoStats: DashboardStats = {
  date: new Date().toISOString(),
  stats: {
    staff: { total_staff_entries: 156, total_persons: 89, stations_covered: 42 },
    chemicals: { total_usage_records: 234, chemicals_used: 18, total_quantity_used: 1250 },
    inventory: { total_chemicals: 45, low_stock_count: 3, sufficient_stock_count: 42 },
    pest: { total_activities: 67, pest_types_handled: 8, stations_serviced: 35, total_chemical_used: 120 },
    machinery: { total_usage_records: 98, machine_types_used: 12, total_hours: 456, stations_covered: 38 },
  },
};

const decisionLabel: Record<DecisionStatus, string> = {
  good: 'Stable',
  warn: 'Watch',
  bad: 'Action Needed',
};

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [stats, setStats] = useState<DashboardStats | null>(demoStats);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'range'>('single');
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pulse, setPulse] = useState<StationPulseData | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [acknowledgeTarget, setAcknowledgeTarget] = useState<number | null>(null);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [exportForm, setExportForm] = useState({
    stationId: '',
    reportDate: format(new Date(), 'yyyy-MM-dd'),
    format: 'pdf' as 'pdf' | 'csv',
  });
  const [manpowerAllocations, setManpowerAllocations] = useState<StationManpowerAllocation[]>([]);
  const [manpowerLoading, setManpowerLoading] = useState(false);
  const [manpowerError, setManpowerError] = useState<string | null>(null);
  const { stations } = useStations();
  const { areas } = useAreas();

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const sharedQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedStation) {
      params.set('station_id', selectedStation);
    }
    if (dateFilterMode === 'range') {
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
    } else if (selectedDate) {
      params.set('date', selectedDate);
    }
    if (selectedArea) {
      params.set('area', selectedArea);
    }
    if (selectedShift) {
      params.set('shift', selectedShift);
    }
    if (selectedCategory) {
      params.set('category', selectedCategory);
    }
    return params.toString();
  }, [
    selectedStation,
    dateFilterMode,
    dateRange.from,
    dateRange.to,
    selectedDate,
    selectedArea,
    selectedShift,
    selectedCategory,
  ]);

  const detailQuerySuffix = sharedQueryString ? `?${sharedQueryString}` : '';
  const chemicalDetailHref = `/admin/chemical-usage${detailQuerySuffix}`;
  const inventoryDetailHref = `/admin/inventory${detailQuerySuffix}`;
  const machineryDetailHref = `/admin/machinery-usage${detailQuerySuffix}`;
  const pestDetailHref = `/admin/pest-control${detailQuerySuffix}`;

  const navigateToDetail = (href: string) => {
    router.push(href);
  };

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!token) {
      throw new Error('Not authenticated');
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Request failed');
    }
    return res.json();
  }

  async function loadDashboardStats() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFilterMode === 'range') {
        if (dateRange.from) params.set('from', dateRange.from);
        if (dateRange.to) params.set('to', dateRange.to);
      } else if (selectedDate) {
        params.set('date', selectedDate);
      }
      if (selectedStation) params.set('station_id', selectedStation);
      if (selectedArea) params.set('area', selectedArea);
      if (selectedShift) params.set('shift', selectedShift);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedArea) params.set('area', selectedArea);
      if (selectedShift) params.set('shift', selectedShift);
      if (selectedCategory) params.set('category', selectedCategory);

      const data = await apiFetch(
        `/admin/dashboard${params.toString() ? `?${params.toString()}` : ''}`
      );

      setStats(data);
    } catch (err: any) {
      // Keep demo stats on error for preview
      console.log('Using demo stats');
    } finally {
      setLoading(false);
    }
  }

  async function loadStationPulse() {
    try {
      setPulseLoading(true);
      const params = new URLSearchParams();
      if (dateFilterMode === 'range') {
        if (dateRange.from) params.set('from', dateRange.from);
        if (dateRange.to) params.set('to', dateRange.to);
      } else if (selectedDate) {
        params.set('date', selectedDate);
      }
      if (selectedStation) params.set('station_id', selectedStation);
      if (selectedArea) params.set('area', selectedArea);
      if (selectedShift) params.set('shift', selectedShift);
      if (selectedCategory) params.set('category', selectedCategory);
      const data = await apiFetch(
        `/admin/station-pulse${params.toString() ? `?${params.toString()}` : ''}`
      );
      setPulse(data?.data || null);
    } catch (err: any) {
      toast({
        title: 'Station Pulse unavailable',
        description: err?.message || 'Unable to load compliance and alert data.',
      });
    } finally {
      setPulseLoading(false);
    }
  }

  async function handleAcknowledgeAlert(alertId: number) {
    try {
      setAcknowledgeTarget(alertId);
      await apiFetch(`/admin/station-pulse/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });
      toast({
        title: 'Alert acknowledged',
        description: 'The alert has been cleared for all viewers.',
      });
      await loadStationPulse();
    } catch (err: any) {
      toast({
        title: 'Unable to acknowledge alert',
        description: err?.message || 'Please retry in a moment.',
        variant: 'destructive',
      });
    } finally {
      setAcknowledgeTarget(null);
    }
  }

  async function handleExportSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!exportForm.reportDate) {
      toast({
        title: 'Report date missing',
        description: 'Select a date for the export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExportSubmitting(true);
      await apiFetch('/admin/station-pulse/exports', {
        method: 'POST',
        body: JSON.stringify({
          stationId: exportForm.stationId ? Number(exportForm.stationId) : null,
          reportDate: exportForm.reportDate,
          format: exportForm.format,
        }),
      });
      toast({
        title: 'Export queued',
        description: 'You will see the file once generation completes.',
      });
      setExportForm((prev) => ({ ...prev, stationId: '' }));
      await loadStationPulse();
    } catch (err: any) {
      toast({
        title: 'Failed to request export',
        description: err?.message || 'Please try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setExportSubmitting(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setManpowerAllocations([]);
      setManpowerError(null);
      setManpowerLoading(false);
      return;
    }

    let cancelled = false;

    async function loadManpowerAllocations() {
      try {
        setManpowerLoading(true);
        const data = await apiFetch('/admin/manpower');
        if (!cancelled) {
          setManpowerAllocations(data.data || []);
          setManpowerError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setManpowerError(err?.message || 'Unable to load manpower reserve data.');
        }
      } finally {
        if (!cancelled) {
          setManpowerLoading(false);
        }
      }
    }

    loadManpowerAllocations();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (token) {
      loadDashboardStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    selectedDate,
    selectedStation,
    dateFilterMode,
    dateRange.from,
    dateRange.to,
    selectedArea,
    selectedShift,
    selectedCategory,
  ]);

  useEffect(() => {
    if (token) {
      loadStationPulse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    selectedStation,
    selectedDate,
    dateFilterMode,
    dateRange.from,
    dateRange.to,
    selectedArea,
    selectedShift,
    selectedCategory,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground font-medium">Loading dashboard...</p>
      </div>
    );
  }

  const isLowStock = stats?.stats.inventory.low_stock_count && stats.stats.inventory.low_stock_count > 0;
  const usingDateRange = dateFilterMode === 'range';
  const singleDayLabel = selectedDate
    ? format(new Date(selectedDate), 'dd/MM/yyyy')
    : 'Select a date';
  const rangeLabel = `${dateRange.from ? format(new Date(dateRange.from), 'dd/MM/yyyy') : 'Start'} → ${
    dateRange.to ? format(new Date(dateRange.to), 'dd/MM/yyyy') : 'End'
  }`;
  const filterDateLabel = usingDateRange ? rangeLabel : singleDayLabel;
  const friendlyDate = usingDateRange
    ? rangeLabel
    : stats
      ? format(new Date(stats.date), 'EEEE, MMMM dd, yyyy')
      : format(new Date(), 'EEEE, MMMM dd, yyyy');
  const selectedStationName = selectedStation
    ? stations.find((station) => String(station.id) === selectedStation)?.station_name || 'Selected station'
    : 'All Stations';
  const staffStats = stats?.stats.staff;
  const chemicalStats = stats?.stats.chemicals;
  const inventoryStats = stats?.stats.inventory;
  const machineryStats = stats?.stats.machinery;
  const pestStats = stats?.stats.pest;

  const staffCoverage = staffStats
    ? staffStats.total_persons / Math.max(staffStats.total_staff_entries || 1, 1)
    : 0;
  const staffStatus: DecisionStatus = staffCoverage >= 0.95 ? 'good' : staffCoverage >= 0.8 ? 'warn' : 'bad';
  const staffAnswer = staffStatus === 'good' ? 'Yes — shifts covered' : staffStatus === 'warn' ? 'Borderline' : 'Shortage';
  const staffMetric = `${Math.round(staffCoverage * 100)}% coverage`;
  const staffContext = staffStats
    ? `${staffStats.total_persons} persons deployed across ${staffStats.stations_covered} stations`
    : 'No staff data';

  const manpowerTotals = manpowerAllocations.reduce((sum, allocation) => sum + (allocation.total_manpower || 0), 0);
  const selectedAllocation = selectedStation
    ? manpowerAllocations.find((allocation) => String(allocation.station_id) === selectedStation)
    : null;
  const activeAllocation = selectedStation
    ? selectedAllocation?.total_manpower ?? null
    : manpowerAllocations.length
      ? manpowerTotals
      : null;
  const staffReserve = activeAllocation === null ? null : Math.max(0, activeAllocation - (staffStats?.total_persons || 0));
  const staffReserveStatus: DecisionStatus | null = staffReserve === null
    ? null
    : staffReserve === 0
      ? 'bad'
      : staffReserve <= Math.max(5, (activeAllocation || 0) * 0.1)
        ? 'warn'
        : 'good';
  const staffReserveValue = staffReserve === null
    ? manpowerError
      ? 'Reserve unavailable'
      : manpowerLoading
        ? 'Loading reserve...'
        : 'No allocation recorded'
    : `${staffReserve} staff on standby`;
  const staffReserveNote = staffReserve === null
    ? manpowerError
      ? 'Unable to reach manpower service. Try refreshing.'
      : 'Add or update station manpower allocation to surface reserve capacity.'
    : staffReserveStatus === 'bad'
      ? 'Reserve depleted. Mobilise emergency crew immediately.'
      : staffReserveStatus === 'warn'
        ? 'Reserve is thin. Keep standby roster ready.'
        : 'Reserve pool healthy for emergencies.';

  const lowStock = inventoryStats?.low_stock_count ?? 0;
  const inventoryStatus: DecisionStatus = lowStock === 0 ? 'good' : lowStock <= 2 ? 'warn' : 'bad';
  const inventoryAnswer = inventoryStatus === 'good' ? 'Stock is sufficient' : inventoryStatus === 'warn' ? 'Monitor low items' : 'Reorder now';
  const inventoryMetric = inventoryStats
    ? lowStock === 0
      ? '0 items below minimum'
      : `${lowStock} items below minimum`
    : 'No readings';
  const inventoryContext = inventoryStats
    ? `${inventoryStats.total_chemicals - lowStock} of ${inventoryStats.total_chemicals} chemicals are healthy`
    : 'No inventory data';
  const inventoryReserveCount = inventoryStats?.sufficient_stock_count ?? 0;
  const inventoryReserveStatus: DecisionStatus = inventoryReserveCount === 0 ? 'bad' : inventoryReserveCount <= 5 ? 'warn' : 'good';
  const inventoryReserveNote = inventoryReserveStatus === 'bad'
    ? 'No buffer stock available. Trigger emergency purchase.'
    : inventoryReserveStatus === 'warn'
      ? 'Reserve is thin. Plan replenishment now.'
      : 'Healthy reserve for emergency dispatches.';

  const avgChemicalUse = chemicalStats
    ? chemicalStats.total_quantity_used / Math.max(chemicalStats.total_usage_records || 1, 1)
    : 0;
  const chemicalStatus: DecisionStatus = avgChemicalUse <= 6 ? 'good' : avgChemicalUse <= 10 ? 'warn' : 'bad';
  const chemicalAnswer = chemicalStatus === 'good' ? 'Usage within plan' : chemicalStatus === 'warn' ? 'Watch spike' : 'Excessive consumption';
  const chemicalMetric = chemicalStats ? `${avgChemicalUse.toFixed(1)} units per use` : 'No data';
  const chemicalContext = chemicalStats
    ? `${chemicalStats.chemicals_used} chemicals across ${chemicalStats.total_usage_records} records`
    : 'No chemical data';

  const avgMachineHours = machineryStats
    ? machineryStats.total_hours / Math.max(machineryStats.total_usage_records || 1, 1)
    : 0;
  const machineryStatusLevel: DecisionStatus = avgMachineHours >= 3 ? 'good' : avgMachineHours >= 1 ? 'warn' : 'bad';
  const machineryAnswer = machineryStatusLevel === 'good' ? 'Healthy utilisation' : machineryStatusLevel === 'warn' ? 'Idle pockets' : 'Under-utilised';
  const machineryMetric = machineryStats ? `${avgMachineHours.toFixed(1)} hrs per use` : 'No data';
  const machineryContext = machineryStats
    ? `${machineryStats.machine_types_used} machine types over ${machineryStats.stations_covered} stations`
    : 'No machinery data';

  const pestIncidents = pestStats?.total_activities ?? 0;
  const pestStatus: DecisionStatus = pestIncidents <= 3 ? 'good' : pestIncidents <= 8 ? 'warn' : 'bad';
  const pestAnswer = pestStatus === 'good' ? 'Incidents under control' : pestStatus === 'warn' ? 'Monitor hotspots' : 'Escalate vendor';
  const pestMetric = pestStats ? `${pestIncidents} activities logged` : 'No data';
  const pestContext = pestStats
    ? `${pestStats.pest_types_handled} pest types across ${pestStats.stations_serviced} stations`
    : 'No pest data';

  const alertsList = pulse?.alerts || [];
  const machineryInUse = machineryStats?.total_usage_records ?? 0;
  const machineryFaultyAlerts = alertsList.filter((alert) =>
    alert.alert_type?.toLowerCase().includes('machinery'),
  ).length;
  const machineryMaintenanceAlerts = alertsList.filter((alert) =>
    alert.alert_type?.toLowerCase().includes('maintenance'),
  ).length;
  const pestRecurringAlerts = alertsList.filter((alert) =>
    alert.alert_type?.toLowerCase().includes('pest'),
  ).length;
  const pestActiveIssues = pestStats?.total_activities ?? 0;
  const chemicalLowStock = inventoryStats?.low_stock_count ?? 0;
  const chemicalConsumptionSignal = Number.isFinite(avgChemicalUse)
    ? avgChemicalUse.toFixed(1)
    : '0.0';
  const pendingExports = pulse?.metrics?.pendingExports ?? 0;
  const complianceScore = pulse?.metrics?.avgComplianceScore ?? null;
  const trendRecords = chemicalStats?.total_usage_records ?? 0;
  const trendStations = staffStats?.stations_covered ?? 0;

  const navItems = [
    {
      label: 'Machinery',
      description: 'Usage & uptime analysis',
      href: machineryDetailHref,
      icon: Settings,
    },
    {
      label: 'Chemicals',
      description: 'Consumption & stock trends',
      href: chemicalDetailHref,
      icon: Package,
    },
    {
      label: 'Pest Control',
      description: 'Recurring issues & actions',
      href: pestDetailHref,
      icon: Bug,
    },
    {
      label: 'Reports',
      description: 'Exports & historical views',
      href: `/admin/reports${detailQuerySuffix}`,
      icon: FileDown,
    },
    {
      label: 'Compliance',
      description: 'Audits & corrective actions',
      href: `/admin/reports${detailQuerySuffix}#compliance`,
      icon: ShieldCheck,
    },
    {
      label: 'Management',
      description: 'Inventory & manpower planning',
      href: inventoryDetailHref,
      icon: HardHat,
    },
  ];

  const sidebarAccents: Record<
    string,
    {
      accentBar: string;
      iconActive: string;
      iconInactive: string;
    }
  > = {
    Machinery: {
      accentBar: 'bg-amber-400',
      iconActive: 'text-amber-600',
      iconInactive: 'text-amber-300',
    },
    Chemicals: {
      accentBar: 'bg-sky-400',
      iconActive: 'text-sky-600',
      iconInactive: 'text-sky-300',
    },
    'Pest Control': {
      accentBar: 'bg-emerald-400',
      iconActive: 'text-emerald-600',
      iconInactive: 'text-emerald-300',
    },
    Reports: {
      accentBar: 'bg-violet-400',
      iconActive: 'text-violet-500',
      iconInactive: 'text-violet-300',
    },
    Compliance: {
      accentBar: 'bg-rose-400',
      iconActive: 'text-rose-500',
      iconInactive: 'text-rose-300',
    },
    Management: {
      accentBar: 'bg-lime-400',
      iconActive: 'text-lime-600',
      iconInactive: 'text-lime-300',
    },
  };

  const navGroups = [
    {
      label: 'OPERATIONS',
      items: [navItems[0], navItems[1], navItems[2]],
    },
    {
      label: 'OVERSIGHT',
      items: [navItems[3], navItems[4]],
    },
    {
      label: 'PLANNING',
      items: [navItems[5]],
    },
  ];

  const limitedAlerts = alertsList.slice(0, 4);
  const alertCount = pulse?.metrics?.activeAlerts ?? limitedAlerts.length;

  return (
    <div className="flex min-h-screen bg-slate-50 px-3 py-6 md:px-5 md:py-8">
      <aside className="hidden w-64 flex-shrink-0 rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-900 via-indigo-800 to-slate-900 px-4 py-7 text-white lg:flex lg:flex-col">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Control Center</p>
          <p className="text-2xl font-semibold text-white">Admin Navigation</p>
          <p className="text-sm text-white/80">Choose a module to open detailed views. All selections respect the filters above.</p>
        </div>
        <nav className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{group.label}</p>
              {group.items.map((item) => {
                if (!item) return null;
                const baseHref = item.href.split('#')[0].split('?')[0];
                const isActive = pathname === baseHref;
                const accent = sidebarAccents[item.label] || {
                  accentBar: 'bg-white',
                  iconActive: 'text-indigo-700',
                  iconInactive: 'text-indigo-300',
                };
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      'relative flex items-start gap-3 rounded-2xl border border-white/15 px-3.5 py-3.5 text-left text-white/90 transition',
                      'hover:bg-white/8',
                      isActive ? 'bg-white/12 shadow-lg' : 'bg-white/5',
                    )}
                  >
                    {isActive ? (
                      <span
                        className={cn(
                          'absolute inset-y-3 left-2 w-1 rounded-full',
                          accent.accentBar,
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        'mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5',
                        isActive && 'bg-white',
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5',
                          isActive ? accent.iconActive : accent.iconInactive,
                        )}
                      />
                    </span>
                    <div className="pl-1">
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-white/80">{item.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-white/20 bg-white/10 px-3 py-4 text-xs text-white/80">
          Filters selected in the header drive every insight on this dashboard and across the detailed modules in the sidebar.
        </div>
      </aside>

  <div className="hidden lg:flex w-px mx-3 rounded-full bg-gradient-to-b from-slate-200 via-slate-200/70 to-transparent" aria-hidden />

      <main className="flex-1 rounded-3xl bg-white/90 shadow-lg">
        <section className="sticky top-0 z-10 rounded-t-3xl border-b border-transparent bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 px-4 py-6 text-white shadow-lg md:px-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Station</p>
                <Select value={selectedStation || '__all__'} onValueChange={(value) => setSelectedStation(value === '__all__' ? '' : value)}>
                  <SelectTrigger className="mt-1 h-11 rounded-xl border-white/40 bg-white/20 text-white">
                    <SelectValue placeholder="All stations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All stations</SelectItem>
                    {stations.map((station) => (
                      <SelectItem key={station.id} value={String(station.id)}>
                        {station.station_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Date Range</p>
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                  <div className="flex w-full flex-wrap rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500 sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant={dateFilterMode === 'single' ? 'default' : 'ghost'}
                      className="rounded-full flex-1 sm:flex-none"
                      onClick={() => setDateFilterMode('single')}
                    >
                      Single day
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={dateFilterMode === 'range' ? 'default' : 'ghost'}
                      className="rounded-full flex-1 sm:flex-none"
                      onClick={() => setDateFilterMode('range')}
                    >
                      Range
                    </Button>
                  </div>
                  {dateFilterMode === 'single' ? (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                      <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-10 rounded-xl border-white/40 bg-white/20 text-white" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          setSelectedDate(today);
                          setDateRange({ from: today, to: today });
                        }}
                      >
                        Today
                      </Button>
                    </div>
                  ) : (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <Input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                        className="h-10 rounded-xl border-white/40 bg-white/20 text-white"
                      />
                      <span className="text-sm font-medium text-slate-200 sm:text-slate-500">to</span>
                      <Input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                        className="h-10 rounded-xl border-white/40 bg-white/20 text-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          setDateRange({ from: today, to: today });
                          setSelectedDate(today);
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white md:self-end"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
              >
                <Filter className="mr-2 h-4 w-4" /> Advanced filters
              </Button>
            </div>
            {showAdvancedFilters ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Area</p>
                  <Select value={selectedArea || '__all__'} onValueChange={(value) => setSelectedArea(value === '__all__' ? '' : value)}>
                    <SelectTrigger className="mt-1 h-11 rounded-xl border-white/40 bg-white/20 text-white">
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All areas</SelectItem>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.area_name}>
                          {area.area_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Shift</p>
                  <Select value={selectedShift || '__all__'} onValueChange={(value) => setSelectedShift(value === '__all__' ? '' : value)}>
                    <SelectTrigger className="mt-1 h-11 rounded-xl border-white/40 bg-white/20 text-white">
                      <SelectValue placeholder="All shifts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All shifts</SelectItem>
                      <SelectItem value="Day">Morning</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                      <SelectItem value="Night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Category</p>
                  <Select value={selectedCategory || '__all__'} onValueChange={(value) => setSelectedCategory(value === '__all__' ? '' : value)}>
                    <SelectTrigger className="mt-1 h-11 rounded-xl border-white/40 bg-white/20 text-white">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All categories</SelectItem>
                      <SelectItem value="chemical">Chemical</SelectItem>
                      <SelectItem value="pest">Pest</SelectItem>
                      <SelectItem value="machinery">Machinery</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-6 px-4 py-8 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Current view</p>
              <h2 className="text-2xl font-semibold text-slate-900">{selectedStationName}</h2>
              <p className="text-sm text-slate-600">{friendlyDate}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow">
              <CircleDot className="h-3.5 w-3.5 text-emerald-500" />
              Data refreshes whenever filters change
            </div>
          </div>

          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">🔥 Operational Risk</p>
                  <h3 className="text-xl font-semibold text-slate-900">Immediate interventions</h3>
                </div>
                <p className="text-sm text-slate-500">Always visible at the top to highlight urgent actions.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border-2 border-rose-200 border-l-8 border-l-rose-400 bg-rose-50/90 p-6 shadow-xl min-h-[260px]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-rose-800">Machinery</p>
                      <p className="mt-2 text-5xl font-black text-rose-950">{machineryInUse}</p>
                      <p className="text-xs text-rose-700">Usage logs in window</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                        machineryStatusLevel === 'bad'
                          ? 'bg-rose-600 text-white'
                          : machineryStatusLevel === 'warn'
                            ? 'bg-amber-400 text-slate-900'
                            : 'bg-emerald-500 text-white',
                      )}
                    >
                      {decisionLabel[machineryStatusLevel]}
                    </span>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[{
                      label: 'In Use',
                      value: machineryInUse,
                    }, {
                      label: 'Faulty',
                      value: machineryFaultyAlerts,
                    }, {
                      label: 'Under Maint.',
                      value: machineryMaintenanceAlerts,
                    }].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-white/80 p-3 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="link"
                    className="mt-4 px-0 text-sm font-semibold text-rose-800"
                    onClick={() => navigateToDetail(machineryDetailHref)}
                  >
                    Open machinery view →
                  </Button>
                </div>
                <div className="rounded-3xl border-2 border-amber-200 border-l-8 border-l-amber-400 bg-amber-50/95 p-6 shadow-xl min-h-[260px]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Pest Control</p>
                      <p className="mt-2 text-5xl font-black text-amber-950">{pestActiveIssues}</p>
                      <p className="text-xs text-amber-700">Active issues logged</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                        pestStatus === 'bad'
                          ? 'bg-rose-600 text-white'
                          : pestStatus === 'warn'
                            ? 'bg-amber-500 text-slate-900'
                            : 'bg-emerald-500 text-white',
                      )}
                    >
                      {decisionLabel[pestStatus]}
                    </span>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active Issues</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{pestActiveIssues}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recurring Problems</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{pestRecurringAlerts}</p>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    className="mt-4 px-0 text-sm font-semibold text-amber-900"
                    onClick={() => navigateToDetail(pestDetailHref)}
                  >
                    Investigate pest control →
                  </Button>
                </div>
                <div className="rounded-3xl border-2 border-sky-200 border-l-8 border-l-sky-400 bg-sky-50/95 p-6 shadow-xl min-h-[260px]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-sky-900">Chemicals</p>
                      <p className="mt-2 text-5xl font-black text-sky-950">{chemicalLowStock}</p>
                      <p className="text-xs text-sky-700">Chemicals below min stock</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                        chemicalStatus === 'bad'
                          ? 'bg-rose-600 text-white'
                          : chemicalStatus === 'warn'
                            ? 'bg-amber-500 text-slate-900'
                            : 'bg-emerald-500 text-white',
                      )}
                    >
                      {decisionLabel[chemicalStatus]}
                    </span>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Low Stock</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{chemicalLowStock}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Consumption Anomalies</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{chemicalConsumptionSignal}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">units / use</p>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    className="mt-4 px-0 text-sm font-semibold text-sky-900"
                    onClick={() => navigateToDetail(chemicalDetailHref)}
                  >
                    Review chemical usage →
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">🟡 Resource Health</p>
                  <h3 className="text-xl font-semibold text-slate-900">Important but not urgent</h3>
                </div>
                <p className="text-sm text-slate-500">Use these cards to plan staffing and supply moves.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff & Manpower</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">{staffMetric || '—'}</p>
                      <p className="text-sm text-slate-500">{staffContext}</p>
                    </div>
                    <Users className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Reserve</p>
                      <p className="text-base font-semibold text-slate-900">{staffReserveValue || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                      <p className="text-base font-semibold text-slate-900">{decisionLabel[staffStatus]}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory Health</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">{inventoryStats ? `${inventoryStats.total_chemicals - lowStock}/${inventoryStats.total_chemicals}` : '—'}</p>
                      <p className="text-sm text-slate-500">{inventoryContext}</p>
                    </div>
                    <Package className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Low Stock</p>
                      <p className="text-base font-semibold text-slate-900">{inventoryMetric}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Reserve health</p>
                      <p className="text-base font-semibold text-slate-900">{inventoryReserveNote}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts Summary</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">{alertCount || 0}</p>
                      <p className="text-sm text-slate-500">Signals queued for acknowledgement</p>
                    </div>
                    <Bell className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-4 text-sm text-slate-600">
                    {limitedAlerts.length === 0 ? 'No alerts triggered for the selected context.' : `${limitedAlerts.length} surfaced below.`}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">🔵 Oversight & Review</p>
                  <h3 className="text-xl font-semibold text-slate-900">Monitoring and analysis</h3>
                </div>
                <p className="text-sm text-slate-500">Lower visual weight cards for periodic checks.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Link
                  href="/admin/reports"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left text-slate-700 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Reports</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingExports}</p>
                      <p className="text-xs text-slate-500">Pending exports</p>
                    </div>
                    <FileDown className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
                <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 text-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Compliance</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{complianceScore ? `${complianceScore.toFixed(1)}%` : '—'}</p>
                      <p className="text-xs text-slate-500">Average score</p>
                    </div>
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 text-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Trends</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{trendRecords}</p>
                      <p className="text-xs text-slate-500">Usage records across {trendStations} stations</p>
                    </div>
                    <Activity className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <Card className="border border-slate-200 bg-white">
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Active Alerts</CardTitle>
                <CardDescription>Live signals filtered by your current station and date selections</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadStationPulse()}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {limitedAlerts.length === 0 ? (
                <p className="text-sm text-slate-500">All systems stable.</p>
              ) : (
                <ul className="space-y-3">
                  {limitedAlerts.map((alert) => (
                    <li key={alert.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{alert.station_name || 'Network'}</p>
                        <p className="text-sm text-slate-600">{alert.message}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{alert.alert_type.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
                        <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleAcknowledgeAlert(alert.id)} disabled={acknowledgeTarget === alert.id}>
                          {acknowledgeTarget === alert.id ? 'Clearing…' : 'Acknowledge'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}