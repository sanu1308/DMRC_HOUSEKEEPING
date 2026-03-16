'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Plus, Trash2 } from 'lucide-react';

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
import { useChemicals } from '@/hooks/use-chemicals';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type ChemicalUsageRecord = {
  id: number;
  chemical_name: string;
  quantity: number;
  unit: string;
  area: string;
  shift: string;
  manpower_used?: number;
  usage_date: string;
  notes: string | null;
  station_id?: number | null;
  station_name?: string | null;
};

type DecodedUser = {
  role: 'superadmin' | 'user' | null;
  stationId: number | null;
};

type FieldErrors = Partial<
  Record<
    'shift' | 'station' | 'chemical' | 'quantity' | 'area' | 'usageDate' | 'manpower',
    string
  >
>;

const shiftBadgeStyles: Record<string, string> = {
  Day: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Night: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
};

const areaPillPalette = [
  'bg-sky-50 text-sky-700 border border-sky-100',
  'bg-rose-50 text-rose-700 border border-rose-100',
  'bg-amber-50 text-amber-800 border border-amber-100',
  'bg-lime-50 text-lime-700 border border-lime-100',
];

const rowTintByShift: Record<string, string> = {
  Day: 'bg-gradient-to-r from-emerald-50/70 via-white to-white',
  Night: 'bg-gradient-to-r from-indigo-50/70 via-white to-white',
};

const getAreaBadgeClass = (area: string | null | undefined) => {
  if (!area) {
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
  const safeArea = area.trim();
  const paletteIndex = Math.abs(safeArea.length + safeArea.charCodeAt(0)) % areaPillPalette.length;
  return areaPillPalette[paletteIndex];
};

const formatUsageDate = (value: string) => {
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch (error) {
    return value;
  }
};

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

export default function ChemicalUsagePage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<ChemicalUsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);

  const [shift, setShift] = useState<'Day' | 'Night' | ''>('');
  const [stationId, setStationId] = useState('');
  const [chemicalId, setChemicalId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [area, setArea] = useState('');
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

  useEffect(() => {
    if (assignedStationId) {
      setStationId((prev) => {
        const next = String(assignedStationId);
        if (prev === next) {
          return prev;
        }
        clearError('station');
        return next;
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
  const {
    chemicals,
    loading: chemicalsLoading,
    error: chemicalsError,
    refresh: refreshChemicals,
  } = useChemicals();

  const selectedChemical = useMemo(() => {
    if (!chemicalId) {
      return null;
    }
    return chemicals.find((item) => String(item.id) === chemicalId) || null;
  }, [chemicalId, chemicals]);

  const resolvedUnit = selectedChemical?.measuring_unit || '';
  const availableStock = selectedChemical?.total_stock;

  function validateForm() {
    const nextErrors: FieldErrors = {};
    const trimmedArea = area.trim();
    const parsedQuantity = Number(quantity);
    const parsedManpower = Number(manpowerUsed);

    if (!shift) {
      nextErrors.shift = 'Shift is required.';
    }

    if (!stationId) {
      nextErrors.station = 'Select a station.';
    }

    if (!chemicalId) {
      nextErrors.chemical = 'Select a chemical.';
    }

    if (!quantity) {
      nextErrors.quantity = 'Quantity is required.';
    } else if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      nextErrors.quantity = 'Enter a positive quantity.';
    }

    if (!trimmedArea) {
      nextErrors.area = 'Area is required.';
    }

    if (!usageDate) {
      nextErrors.usageDate = 'Usage date is required.';
    }

    if (!manpowerUsed) {
      nextErrors.manpower = 'Manpower used is required.';
    } else if (!Number.isInteger(parsedManpower) || parsedManpower <= 0) {
      nextErrors.manpower = 'Enter manpower as a positive whole number.';
    }

    if (!selectedChemical) {
      nextErrors.chemical = 'Selected chemical is unavailable. Refresh list.';
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      trimmedArea,
      parsedQuantity,
      parsedManpower,
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
        `/chemical-usage${params.toString() ? `?${params.toString()}` : ''}`,
      );
      setRecords(data.data || []);
    } catch (err: any) {
      toast({
        title: 'Failed to load chemical usage',
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

    const { isValid, trimmedArea, parsedQuantity, parsedManpower } = validateForm();
    if (!isValid) {
      toast({
        title: 'Missing fields',
        description: 'Please fill the highlighted fields before saving.',
        variant: 'destructive',
      });
      return;
    }

    const finalChemicalName = selectedChemical?.chemical_name;
    const finalUnit = resolvedUnit;

    if (!finalChemicalName || !finalUnit) {
      toast({
        title: 'Chemical unavailable',
        description: 'Please refresh the chemical list and try again.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      shift,
      chemical_id: Number(chemicalId),
      chemical_name: finalChemicalName,
      quantity: parsedQuantity,
      unit: finalUnit,
      area: trimmedArea,
      usage_date: usageDate,
      station_id: Number(stationId),
      notes: notes || null,
      manpower_used: parsedManpower,
    };

    setIsSaving(true);
    try {
      await apiFetch('/chemical-usage', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast({
        title: 'Record added',
        description: 'Chemical usage record created successfully.',
      });

      setModalOpen(false);
      setShift('');
      setStationId('');
      setChemicalId('');
      setQuantity('');
      setArea('');
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
      await apiFetch(`/chemical-usage/${id}`, { method: 'DELETE' });
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
      'Chemical Name',
      'Quantity',
      'Unit',
      'Area',
      'Shift',
      'Manpower Used',
      'Usage Date',
      'Notes',
    ];
    const rows = records.map((r) => [
      r.chemical_name,
      String(r.quantity),
      r.unit,
      r.area,
      r.shift,
      r.manpower_used ? String(r.manpower_used) : '',
      r.usage_date,
      r.notes || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemical-usage-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Chemical Usage
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 w-36"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 w-36"
          />
          <Button variant="outline" size="sm" onClick={loadRecords}>
            Apply
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="mr-1 h-4 w-4" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Add Chemical Usage</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 pt-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Shift</label>
                  <Select
                    value={shift}
                    onValueChange={(value: 'Day' | 'Night') => {
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
                      <SelectItem value="Night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.shift ? (
                    <p className="text-xs text-red-600">{errors.shift}</p>
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Area</label>
                    <button
                      type="button"
                      onClick={refreshAreas}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <Select
                    value={area}
                    onValueChange={(value) => {
                      setArea(value);
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

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Chemical</label>
                    <button
                      type="button"
                      onClick={refreshChemicals}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <Select
                    value={chemicalId}
                    onValueChange={(value) => {
                      setChemicalId(value);
                      clearError('chemical');
                    }}
                    disabled={chemicalsLoading}
                  >
                    <SelectTrigger
                      className={cn(
                        errors.chemical && 'border-red-500 focus-visible:ring-red-500',
                      )}
                      aria-invalid={!!errors.chemical}
                    >
                      <SelectValue
                        placeholder={
                          chemicalsLoading ? 'Loading chemicals...' : 'Select chemical'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {chemicals.map((chemical) => (
                        <SelectItem key={chemical.id} value={String(chemical.id)}>
                          {chemical.chemical_name} ({chemical.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.chemical ? (
                    <p className="text-xs text-red-600">{errors.chemical}</p>
                  ) : null}
                  {chemicalsError ? (
                    <p className="text-xs text-red-600">{chemicalsError}</p>
                  ) : null}
                  {availableStock !== undefined ? (
                    <p className="text-xs text-slate-500">
                      Available stock: {availableStock} {resolvedUnit || 'units'}
                    </p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Quantity Used</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value);
                          clearError('quantity');
                        }}
                        className={cn(
                          errors.quantity && 'border-red-500 focus-visible:ring-red-500',
                        )}
                        aria-invalid={!!errors.quantity}
                      />
                      {errors.quantity ? (
                        <p className="text-xs text-red-600">{errors.quantity}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Unit</label>
                      <Input value={resolvedUnit} readOnly placeholder="Auto" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
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
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-white to-slate-50 shadow-xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
          <p className="text-lg font-semibold">Usage Records</p>
          <p className="text-sm text-white/70">Recent submissions across all shifts</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1FA6C8] text-xs uppercase tracking-wide text-white">
              <TableHead className="font-semibold text-white">Station</TableHead>
              <TableHead className="font-semibold text-white">Chemical</TableHead>
              <TableHead className="font-semibold text-white">Quantity</TableHead>
              <TableHead className="font-semibold text-white">Unit</TableHead>
              <TableHead className="font-semibold text-white">Area</TableHead>
              <TableHead className="font-semibold text-white">Shift</TableHead>
              <TableHead className="font-semibold text-white">Manpower</TableHead>
              <TableHead className="font-semibold text-white">Usage Date</TableHead>
              <TableHead className="w-20 text-right font-semibold text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="bg-slate-50/60 py-6 text-center text-sm text-slate-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="bg-slate-50/60 py-6 text-center text-sm text-slate-500">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    'border-b border-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
                    rowTintByShift[r.shift] ?? 'bg-white',
                  )}
                >
                  <TableCell className="font-semibold text-slate-900">
                    <div className="flex flex-col">
                      <span>{r.station_name || '—'}</span>
                      <span className="text-xs font-medium text-slate-500">#{r.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{r.chemical_name}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-lg font-semibold text-slate-900">{r.quantity}</span>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">
                      {r.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        getAreaBadgeClass(r.area),
                      )}
                    >
                      {r.area}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        shiftBadgeStyles[r.shift] || 'bg-slate-100 text-slate-600 border border-slate-200',
                      )}
                    >
                      {r.shift}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-xl bg-slate-900/5 px-3 py-1 text-sm font-semibold text-slate-900">
                      {r.manpower_used ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">{formatUsageDate(r.usage_date)}</span>
                      <span className="text-xs text-slate-500">Logged entry</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full bg-white/70 text-red-500 shadow-sm ring-1 ring-red-100 hover:bg-red-50"
                      onClick={() => handleDelete(r.id)}
                      aria-label="Delete record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
