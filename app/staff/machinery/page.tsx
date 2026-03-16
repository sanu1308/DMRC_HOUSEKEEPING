'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

const MACHINE_TYPES = ['Scrubber', 'Vacuum Cleaner', 'Blower', 'Other'];
const MACHINE_NAMES: Record<string, string[]> = {
  Scrubber: ['Walk-behind Scrubber', 'Ride-on Scrubber', 'Floor Scrubber'],
  'Vacuum Cleaner': ['Dry Vacuum', 'Wet & Dry Vacuum'],
  Blower: ['Air Blower'],
  Other: ['Other'],
};

type MachineryUsageRecord = {
  id: number;
  machine_type: string;
  machine_name: string;
  area_used?: string | null;
  usage_hours: number;
  manpower_used?: number | null;
  status: string;
  usage_date: string;
  shift: string;
  notes: string | null;
  station_name?: string | null;
  station_id?: number | null;
};

type DecodedUser = {
  role: 'superadmin' | 'user' | null;
  stationId: number | null;
};

type FieldErrors = Partial<
  Record<
    | 'shift'
    | 'station'
    | 'machineType'
    | 'machineName'
    | 'area'
    | 'usageHours'
    | 'status'
    | 'usageDate'
    | 'manpower',
    string
  >
>;

type SortKey = 'machine_name' | 'usage_hours' | 'manpower_used' | 'usage_date' | 'shift';

function decodeToken(token: string | null): DecodedUser {
  if (!token) {
    return { role: null, stationId: null };
  }

  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return { role: null, stationId: null };
    }

    const decoded = JSON.parse(atob(payload));
    return {
      role: decoded?.role ?? null,
      stationId: decoded?.station_id ?? decoded?.stationId ?? null,
    };
  } catch (error) {
    console.warn('Failed to decode auth token', error);
    return { role: null, stationId: null };
  }
}

export default function MachineryUsagePage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<MachineryUsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [shift, setShift] = useState<'Day' | 'Evening' | 'Night' | ''>('');
  const [stationId, setStationId] = useState('');
  const [machineType, setMachineType] = useState('');
  const [machineName, setMachineName] = useState('');
  const [areaUsed, setAreaUsed] = useState('');
  const [usageHours, setUsageHours] = useState('');
  const [status, setStatus] = useState<
    'Working' | 'Breakdown' | 'Maintenance' | 'Operational' | ''
  >('');
  const [usageDate, setUsageDate] = useState('');
  const [notes, setNotes] = useState('');
  const [manpowerUsed, setManpowerUsed] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const clearError = useCallback((field: keyof FieldErrors) => {
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const decodedUser = useMemo(() => decodeToken(token), [token]);
  const assignedStationId = decodedUser.stationId;
  const isSuperAdmin = decodedUser.role === 'superadmin';

  const filteredMachineNames = useMemo(
    () => MACHINE_NAMES[machineType] || [],
    [machineType],
  );

  const {
    areas,
    loading: areasLoading,
    error: areasError,
    refresh: refreshAreas,
  } = useAreas();
  const {
    stations,
    loading: stationsLoading,
    error: stationsError,
    refresh: refreshStations,
  } = useStations();

  const sortedRecords = useMemo(() => {
    if (!sortConfig) {
      return records;
    }
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const getValue = (record: MachineryUsageRecord) => {
        if (key === 'usage_hours') {
          return Number(record.usage_hours) || 0;
        }
        if (key === 'manpower_used') {
          return Number(record.manpower_used) || 0;
        }
        if (key === 'usage_date') {
          return new Date(record.usage_date).getTime();
        }
        return (record[key] || '').toString().toLowerCase();
      };

      const valueA = getValue(a);
      const valueB = getValue(b);

      if (valueA < valueB) return -1 * multiplier;
      if (valueA > valueB) return 1 * multiplier;
      return 0;
    });
  }, [records, sortConfig]);

  const displayRecords = sortedRecords;
  const visibleCount = displayRecords.length;

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="ml-1 h-3.5 w-3.5 text-slate-600" />;
    }
    return <ArrowDown className="ml-1 h-3.5 w-3.5 text-slate-600" />;
  };

  const formatUsageDate = (value: string) => {
    try {
      return format(new Date(value), 'dd MMM yyyy');
    } catch (error) {
      return value;
    }
  };

  const getShiftBadgeClasses = (value: string) => {
    switch (value) {
      case 'Night':
        return 'bg-slate-900/90 text-white shadow-sm';
      case 'Evening':
        return 'bg-amber-100 text-amber-900 border border-amber-200';
      default:
        return 'bg-emerald-100 text-emerald-900 border border-emerald-200';
    }
  };

  const getStatusBadgeClasses = (value: string) => {
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold';
    switch (value) {
      case 'Breakdown':
        return `${base} bg-rose-100 text-rose-900 border border-rose-200`;
      case 'Maintenance':
        return `${base} bg-amber-100 text-amber-900 border border-amber-200`;
      case 'Operational':
        return `${base} bg-sky-100 text-sky-900 border border-sky-200`;
      default:
        return `${base} bg-emerald-100 text-emerald-900 border border-emerald-200`;
    }
  };

  const rowTintByStatus: Record<string, string> = {
    Breakdown: 'bg-gradient-to-r from-rose-50/80 via-white to-white',
    Maintenance: 'bg-gradient-to-r from-amber-50/80 via-white to-white',
    Operational: 'bg-gradient-to-r from-sky-50/80 via-white to-white',
    Working: 'bg-gradient-to-r from-emerald-50/80 via-white to-white',
  };

  const areaPillPalette = [
    'bg-sky-50 text-sky-700 border border-sky-100',
    'bg-emerald-50 text-emerald-700 border border-emerald-100',
    'bg-amber-50 text-amber-800 border border-amber-100',
    'bg-rose-50 text-rose-700 border border-rose-100',
  ];

  const getAreaBadgeClass = (area?: string | null) => {
    if (!area) {
      return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
    const safeArea = area.trim();
    const paletteIndex = Math.abs(safeArea.length + safeArea.charCodeAt(0)) % areaPillPalette.length;
    return areaPillPalette[paletteIndex];
  };

  useEffect(() => {
    if (assignedStationId) {
      setStationId((prev) => {
        const nextId = String(assignedStationId);
        if (prev === nextId) {
          return prev;
        }
        clearError('station');
        return nextId;
      });
      return;
    }

    if (!stationsLoading && stations.length && !stationId) {
      setStationId((prev) => {
        if (prev) {
          return prev;
        }
        clearError('station');
        return String(stations[0].id);
      });
    }
  }, [assignedStationId, stationsLoading, stations, stationId, clearError]);

  function validateForm() {
    const nextErrors: FieldErrors = {};
    const trimmedArea = areaUsed.trim();
    const parsedHours = Number(usageHours);
    const parsedManpower = Number(manpowerUsed);
    const stationValue = assignedStationId
      ? String(assignedStationId)
      : stationId;

    if (!shift) {
      nextErrors.shift = 'Shift is required.';
    }

    if (!stationValue) {
      nextErrors.station = 'Select a station.';
    }

    if (!machineType) {
      nextErrors.machineType = 'Machine type is required.';
    }

    if (!machineName) {
      nextErrors.machineName = 'Machine name is required.';
    }

    if (!trimmedArea) {
      nextErrors.area = 'Area is required.';
    }

    if (!usageHours) {
      nextErrors.usageHours = 'Usage hours are required.';
    } else if (Number.isNaN(parsedHours) || parsedHours <= 0) {
      nextErrors.usageHours = 'Enter a positive number of hours.';
    }

    if (!status) {
      nextErrors.status = 'Status is required.';
    }

    if (!usageDate) {
      nextErrors.usageDate = 'Usage date is required.';
    }

    if (!manpowerUsed) {
      nextErrors.manpower = 'Manpower used is required.';
    } else if (!Number.isInteger(parsedManpower) || parsedManpower <= 0) {
      nextErrors.manpower = 'Enter manpower as a positive whole number.';
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      trimmedArea,
      parsedHours,
      parsedManpower,
      stationValue,
    };
  }

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

  async function loadRecords() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const data = await apiFetch(
        `/machinery-usage${params.toString() ? `?${params.toString()}` : ''}`,
      );
      setRecords(data.data || []);
    } catch (err: any) {
      toast({
        title: 'Failed to load machinery usage',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate() {
    if (isSaving) return;

    const { isValid, trimmedArea, parsedHours, parsedManpower, stationValue } = validateForm();
    if (!isValid) {
      toast({
        title: 'Missing fields',
        description: 'Please fill the highlighted fields before saving.',
        variant: 'destructive',
      });
      return;
    }

    const resolvedStationId = Number(stationValue);
    if (!resolvedStationId || Number.isNaN(resolvedStationId)) {
      toast({
        title: 'Station unavailable',
        description: 'Please refresh stations or contact an administrator.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      shift,
      station_id: resolvedStationId,
      machine_type: machineType,
      machine_name: machineName,
      area_used: trimmedArea,
      usage_hours: parsedHours,
      manpower_used: parsedManpower,
      status,
      usage_date: usageDate,
      notes: notes || null,
    };

    setIsSaving(true);
    try {
      await apiFetch('/machinery-usage', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast({
        title: 'Record added',
        description: 'Machinery usage record created successfully.',
      });

      setModalOpen(false);
      setShift('');
      setStationId(assignedStationId ? String(assignedStationId) : '');
      setMachineType('');
      setMachineName('');
      setAreaUsed('');
      setUsageHours('');
      setStatus('');
      setUsageDate('');
      setNotes('');
      setManpowerUsed('');
      setErrors({});
      await loadRecords();
    } catch (err: any) {
      toast({
        title: 'Failed to add record',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this record?')) return;
    try {
      await apiFetch(`/machinery-usage/${id}`, { method: 'DELETE' });
      toast({ title: 'Deleted', description: 'Record deleted successfully.' });
      await loadRecords();
    } catch (err: any) {
      toast({
        title: 'Failed to delete record',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  function handleExportCsv() {
    if (!records.length) return;
    const header = [
      'Machine',
      'Type',
      'Station',
      'Area',
      'Hours',
      'Manpower Used',
      'Status',
      'Date',
      'Shift',
      'Notes',
    ];
    const rows = records.map((r) => [
      r.machine_name,
      r.machine_type,
      r.station_name || '',
      r.area_used || '',
      String(r.usage_hours),
      r.manpower_used ? String(r.manpower_used) : '',
      r.status,
      r.usage_date,
      r.shift,
      r.notes || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `machinery-usage-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/95 px-5 py-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Machinery log
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Machinery Usage
              </h2>
              <p className="text-sm text-slate-500">
                Monitor scrubbers, vacuums, and other assets with refined filters and exports.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 w-32 rounded-full border-slate-200 text-sm"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-32 rounded-full border-slate-200 text-sm"
              />
              <Button variant="outline" size="sm" onClick={loadRecords} className="rounded-full">
                Apply
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv} className="rounded-full">
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full bg-blue-600 text-white shadow hover:bg-blue-700">
                    <Plus className="mr-1 h-4 w-4" />
                    Add Record
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-lg font-semibold">
                      Add Machinery Usage
                    </DialogTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Close"
                      onClick={() => setModalOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogHeader>
                  <div className="grid gap-4 pt-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Shift</label>
                      <Select
                        value={shift}
                        onValueChange={(value: 'Day' | 'Evening' | 'Night') => {
                          setShift(value);
                          clearError('shift');
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            errors.shift && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-invalid={!!errors.shift}
                        >
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Day">Day</SelectItem>
                          <SelectItem value="Evening">Evening</SelectItem>
                          <SelectItem value="Night">Night</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.shift ? (
                        <p className="text-xs text-red-600">{errors.shift}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Station</label>
                        <button
                          type="button"
                          onClick={refreshStations}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Refresh
                        </button>
                      </div>
                      <Select
                        value={stationId}
                        onValueChange={(value) => {
                          setStationId(value);
                          clearError('station');
                        }}
                        disabled={stationsLoading}
                      >
                        <SelectTrigger
                          className={cn(
                            errors.station && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-invalid={!!errors.station}
                        >
                          <SelectValue
                            placeholder={
                              stationsLoading ? 'Loading stations...' : 'Select station'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {stations.map((station) => (
                            <SelectItem
                              key={station.id}
                              value={String(station.id)}
                              disabled={!isSuperAdmin && !!assignedStationId && station.id !== assignedStationId}
                            >
                              {station.station_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.station ? (
                        <p className="text-xs text-red-600">{errors.station}</p>
                      ) : null}
                      {stationsError ? (
                        <p className="text-xs text-red-600">{stationsError}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Machine Type</label>
                      <Select
                        value={machineType}
                        onValueChange={(value) => {
                          setMachineType(value);
                          setMachineName('');
                          clearError('machineType');
                          clearError('machineName');
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            errors.machineType && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-invalid={!!errors.machineType}
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {MACHINE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.machineType ? (
                        <p className="text-xs text-red-600">{errors.machineType}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Machine Name</label>
                      <Select
                        value={machineName}
                        onValueChange={(value) => {
                          setMachineName(value);
                          clearError('machineName');
                        }}
                        disabled={!machineType}
                      >
                        <SelectTrigger
                          className={cn(
                            errors.machineName && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-invalid={!!errors.machineName}
                        >
                          <SelectValue placeholder="Select machine" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredMachineNames.map((n) => (
                            <SelectItem key={n} value={n}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.machineName ? (
                        <p className="text-xs text-red-600">{errors.machineName}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Area Used</label>
                        <button
                          type="button"
                          onClick={refreshAreas}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Refresh
                        </button>
                      </div>
                      <Select
                        value={areaUsed}
                        onValueChange={(value) => {
                          setAreaUsed(value);
                          clearError('area');
                        }}
                        disabled={areasLoading}
                      >
                        <SelectTrigger
                          className={cn(
                            errors.area && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-invalid={!!errors.area}
                        >
                          <SelectValue
                            placeholder={areasLoading ? 'Loading areas...' : 'Select area'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {areas.map((item) => (
                            <SelectItem key={item.id} value={item.area_name}>
                              {item.area_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.area ? (
                        <p className="text-xs text-red-600">{errors.area}</p>
                      ) : null}
                      {areasError ? (
                        <p className="text-xs text-red-600">{areasError}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Usage Hours</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={usageHours}
                        onChange={(e) => {
                          setUsageHours(e.target.value);
                          clearError('usageHours');
                        }}
                        className={cn(
                          errors.usageHours && 'border-red-500 focus-visible:ring-red-500',
                        )}
                        aria-invalid={!!errors.usageHours}
                      />
                      {errors.usageHours ? (
                        <p className="text-xs text-red-600">{errors.usageHours}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Manpower Used</label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={manpowerUsed}
                        onChange={(e) => {
                          setManpowerUsed(e.target.value);
                          clearError('manpower');
                        }}
                        placeholder="Enter number of staff deployed"
                        className={cn(
                          errors.manpower && 'border-red-500 focus-visible:ring-red-500',
                        )}
                        aria-invalid={!!errors.manpower}
                      />
                      {errors.manpower ? (
                        <p className="text-xs text-red-600">{errors.manpower}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={status}
                        onValueChange={(value) => {
                          setStatus(value);
                          clearError('status');
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            errors.status && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-invalid={!!errors.status}
                        >
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Working">Working</SelectItem>
                          <SelectItem value="Operational">Operational</SelectItem>
                          <SelectItem value="Breakdown">Breakdown</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.status ? (
                        <p className="text-xs text-red-600">{errors.status}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Usage Date</label>
                      <Input
                        type="date"
                        value={usageDate}
                        onChange={(e) => {
                          setUsageDate(e.target.value);
                          clearError('usageDate');
                        }}
                        className={cn(
                          errors.usageDate && 'border-red-500 focus-visible:ring-red-500',
                        )}
                        aria-invalid={!!errors.usageDate}
                      />
                      {errors.usageDate ? (
                        <p className="text-xs text-red-600">{errors.usageDate}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm font-medium">Notes</label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional remarks"
                      />
                    </div>
                  </div>
                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleCreate} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-white to-slate-50 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
            <div>
              <p className="text-sm font-semibold">Usage history</p>
              <p className="text-xs text-white/80">{visibleCount} record(s) in this view</p>
            </div>
            <p className="text-xs text-white/70">Click highlighted headers to sort</p>
          </div>
          <div className="relative max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-900/5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('machine_name')}
                      className="inline-flex items-center text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Machine
                      {getSortIcon('machine_name')}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-slate-600">
                    Station & Area
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-right text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('usage_hours')}
                      className="inline-flex items-center justify-end text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Hours
                      {getSortIcon('usage_hours')}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-right text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('manpower_used')}
                      className="inline-flex items-center justify-end text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Manpower
                      {getSortIcon('manpower_used')}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-slate-600">
                    Status
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('usage_date')}
                      className="inline-flex items-center text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Date
                      {getSortIcon('usage_date')}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleSort('shift')}
                      className="inline-flex items-center text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Shift
                      {getSortIcon('shift')}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-slate-900/5 px-4 py-3 text-right text-slate-600">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-6 text-center text-sm">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : visibleCount === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-6 text-center text-sm">
                      No records match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className={cn(
                        'border-b border-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
                        rowTintByStatus[record.status] ?? 'bg-white',
                      )}
                    >
                      <TableCell className="whitespace-nowrap px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{record.machine_name}</span>
                          <span className="text-xs text-slate-500">{record.machine_type}</span>
                          {record.notes ? (
                            <span className="text-xs text-slate-400">{record.notes}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">{record.station_name || '—'}</span>
                          <span
                            className={cn(
                              'inline-flex w-fit items-center rounded-full px-3 py-0.5 text-xs font-semibold',
                              getAreaBadgeClass(record.area_used),
                            )}
                          >
                            {record.area_used || '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right font-semibold text-slate-900 tabular-nums">
                        <span className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-sm">
                          {record.usage_hours}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right font-semibold text-slate-900 tabular-nums">
                        <span className="inline-flex items-center rounded-full bg-white/60 px-3 py-1 text-sm shadow-inner">
                          {record.manpower_used ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <span className={getStatusBadgeClasses(record.status)}>{record.status}</span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatUsageDate(record.usage_date)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm',
                            getShiftBadgeClasses(record.shift),
                          )}
                        >
                          {record.shift}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full bg-white/70 text-rose-500 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50"
                              onClick={() => handleDelete(record.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" align="center">
                            Delete record
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
