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
import { usePests } from '@/hooks/use-pests';
import { useChemicals } from '@/hooks/use-chemicals';
import { useStations } from '@/hooks/use-stations';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type PestControlRecord = {
  id: number;
  pest_type: string | null;
  control_method: string | null;
  chemical_used: string | null;
  area_covered: string | null;
  quantity_used: number | null;
  manpower_used?: number | null;
  status: string | null;
  service_date: string | null;
  notes: string | null;
  station_name?: string | null;
};

type DecodedUser = {
  role: 'superadmin' | 'user' | null;
  stationId: number | null;
};

type FieldErrors = Partial<
  Record<
    | 'shift'
    | 'station'
    | 'pestType'
    | 'controlMethod'
    | 'chemical'
    | 'quantity'
    | 'area'
    | 'serviceDate'
    | 'manpower',
    string
  >
>;

const statusBadgeStyles: Record<string, string> = {
  Completed: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  Scheduled: 'bg-sky-100 text-sky-900 border border-sky-200',
  Pending: 'bg-amber-100 text-amber-900 border border-amber-200',
};

const getStatusBadgeClass = (status?: string | null) =>
  statusBadgeStyles[status || ''] || 'bg-slate-100 text-slate-600 border border-slate-200';

const rowTintByStatus: Record<string, string> = {
  Completed: 'bg-gradient-to-r from-emerald-50/80 via-white to-white',
  Scheduled: 'bg-gradient-to-r from-sky-50/80 via-white to-white',
  Pending: 'bg-gradient-to-r from-amber-50/80 via-white to-white',
};

const badgePalette = [
  'bg-rose-50 text-rose-700 border border-rose-100',
  'bg-sky-50 text-sky-700 border border-sky-100',
  'bg-lime-50 text-lime-700 border border-lime-100',
  'bg-amber-50 text-amber-800 border border-amber-100',
];

const getBadgeClass = (label?: string | null) => {
  if (!label) {
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
  const safeLabel = label.trim();
  const paletteIndex = Math.abs(safeLabel.length + safeLabel.charCodeAt(0)) % badgePalette.length;
  return badgePalette[paletteIndex];
};

const formatServiceDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
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

export default function PestControlPage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<PestControlRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);

  const [shift, setShift] = useState<'Day' | 'Night' | ''>('');
  const [stationId, setStationId] = useState('');
  const [pestType, setPestType] = useState('');
  const [controlMethod, setControlMethod] = useState('');
  const [chemicalId, setChemicalId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [areaCovered, setAreaCovered] = useState('');
  const [status, setStatus] = useState('');
  const [serviceDate, setServiceDate] = useState('');
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

  const { areas, loading: areasLoading, error: areasError, refresh } = useAreas();
  const {
    pests,
    loading: pestsLoading,
    error: pestsError,
    refresh: refreshPests,
  } = usePests();
  const {
    chemicals,
    loading: chemicalsLoading,
    error: chemicalsError,
    refresh: refreshChemicals,
  } = useChemicals();
  const {
    stations,
    loading: stationsLoading,
    error: stationsError,
    refresh: refreshStations,
  } = useStations();

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
    const trimmedArea = areaCovered.trim();
    const trimmedPest = pestType.trim();
    const parsedQuantity = Number(quantityUsed);
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

    if (!trimmedPest) {
      nextErrors.pestType = 'Pest type is required.';
    }

    if (!controlMethod) {
      nextErrors.controlMethod = 'Control method is required.';
    }

    if (!chemicalId) {
      nextErrors.chemical = 'Select a chemical.';
    }

    if (!quantityUsed) {
      nextErrors.quantity = 'Quantity is required.';
    } else if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      nextErrors.quantity = 'Enter a positive quantity.';
    }

    if (!trimmedArea) {
      nextErrors.area = 'Area is required.';
    }

    if (!serviceDate) {
      nextErrors.serviceDate = 'Service date is required.';
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
      trimmedPest,
      parsedQuantity,
      parsedManpower,
      stationValue,
    };
  }

  const selectedChemical = useMemo(() => {
    if (!chemicalId) return null;
    return chemicals.find((item) => String(item.id) === chemicalId) || null;
  }, [chemicalId, chemicals]);

  const chemicalUnit = selectedChemical?.measuring_unit || '';
  const availableStock = selectedChemical?.total_stock;

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
        `/pest-control${params.toString() ? `?${params.toString()}` : ''}`,
      );
      setRecords(data.data || data || []);
    } catch (err: any) {
      toast({
        title: 'Failed to load pest control records',
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

    const {
      isValid,
      trimmedArea,
      trimmedPest,
      parsedQuantity,
      parsedManpower,
      stationValue,
    } = validateForm();

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

    const finalChemicalName = selectedChemical?.chemical_name;
    const finalUnit = chemicalUnit;

    if (!finalChemicalName || !finalUnit) {
      toast({
        title: 'Chemical unavailable',
        description: 'Please refresh the chemical master and try again.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      shift,
      station_id: resolvedStationId,
      pest_type: trimmedPest,
      control_method: controlMethod,
      chemical_id: Number(chemicalId),
      chemical_used: finalChemicalName,
      measuring_unit: finalUnit,
      quantity_used: parsedQuantity,
      manpower_used: parsedManpower,
      area_covered: trimmedArea,
      status: status || 'Completed',
      service_date: serviceDate,
      notes: notes || null,
    };

    setIsSaving(true);
    try {
      await apiFetch('/pest-control', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast({
        title: 'Record added',
        description: 'Pest control record created successfully.',
      });

      setModalOpen(false);
      setShift('');
      setStationId(assignedStationId ? String(assignedStationId) : '');
      setPestType('');
      setControlMethod('');
      setChemicalId('');
      setQuantityUsed('');
      setAreaCovered('');
      setStatus('');
      setServiceDate('');
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
      await apiFetch(`/pest-control/${id}`, { method: 'DELETE' });
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
      'Station',
      'Pest Type',
      'Control Method',
      'Chemical Used',
      'Area Covered',
      'Quantity Used',
      'Manpower Used',
      'Status',
      'Service Date',
      'Notes',
    ];
    const rows = records.map((r) => [
      r.station_name || '',
      r.pest_type || '',
      r.control_method || '',
      r.chemical_used || '',
      r.area_covered || '',
      r.quantity_used ? String(r.quantity_used) : '',
      r.manpower_used ? String(r.manpower_used) : '',
      r.status || '',
      r.service_date || '',
      r.notes || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pest-control-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Pest Control
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
                <DialogTitle>Add Pest Control Record</DialogTitle>
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
                    <label className="text-sm font-medium">Pest Type</label>
                    <button
                      type="button"
                      onClick={refreshPests}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <Select
                    value={pestType}
                    onValueChange={(value) => {
                      setPestType(value);
                      clearError('pestType');
                    }}
                    disabled={pestsLoading}
                  >
                    <SelectTrigger
                      className={cn(
                        errors.pestType && 'border-red-500 focus-visible:ring-red-500',
                      )}
                      aria-invalid={!!errors.pestType}
                    >
                      <SelectValue
                        placeholder={pestsLoading ? 'Loading pests...' : 'Select pest'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {pests.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.pestType ? (
                    <p className="text-xs text-red-600">{errors.pestType}</p>
                  ) : null}
                  {pestsError ? (
                    <p className="text-xs text-red-600">{pestsError}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Control Method</label>
                  <Select
                    value={controlMethod}
                    onValueChange={(value) => {
                      setControlMethod(value);
                      clearError('controlMethod');
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        errors.controlMethod && 'border-red-500 focus-visible:ring-red-500',
                      )}
                      aria-invalid={!!errors.controlMethod}
                    >
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spray">Spray</SelectItem>
                      <SelectItem value="Trap">Trap</SelectItem>
                      <SelectItem value="Fogging">Fogging</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.controlMethod ? (
                    <p className="text-xs text-red-600">{errors.controlMethod}</p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Chemical Used</label>
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
                          {chemical.chemical_name}
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
                      Available stock: {availableStock} {chemicalUnit || 'units'}
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
                        value={quantityUsed}
                        onChange={(e) => {
                          setQuantityUsed(e.target.value);
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
                      <Input value={chemicalUnit} readOnly placeholder="Auto" />
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Area Covered</label>
                    <button
                      type="button"
                      onClick={refresh}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <Select
                    value={areaCovered}
                    onValueChange={(value) => setAreaCovered(value)}
                    disabled={areasLoading}
                  >
                    <SelectTrigger>
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
                  {areasError ? (
                    <p className="text-xs text-red-600">{areasError}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={status}
                    onValueChange={(v: any) => setStatus(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Service Date</label>
                  <Input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                  />
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
        <div className="border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
          <p className="text-lg font-semibold">Pest Control Records</p>
          <p className="text-sm text-white/80">Live log of field interventions</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-900/5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <TableHead className="text-slate-600">Station</TableHead>
              <TableHead className="text-slate-600">Pest Type</TableHead>
              <TableHead className="text-slate-600">Control Method</TableHead>
              <TableHead className="text-slate-600">Chemical Used</TableHead>
              <TableHead className="text-slate-600">Area Covered</TableHead>
              <TableHead className="text-slate-600">Qty Used</TableHead>
              <TableHead className="text-slate-600">Manpower</TableHead>
              <TableHead className="text-slate-600">Status</TableHead>
              <TableHead className="text-slate-600">Service Date</TableHead>
              <TableHead className="w-20 text-right text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="bg-slate-50/60 py-6 text-center text-sm text-slate-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="bg-slate-50/60 py-6 text-center text-sm text-slate-500">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    'border-b border-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
                    rowTintByStatus[r.status || ''] ?? 'bg-white',
                  )}
                >
                  <TableCell className="font-semibold text-slate-900">
                    <div className="flex flex-col">
                      <span>{r.station_name || '—'}</span>
                      <span className="text-xs font-medium text-slate-500">#{r.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        getBadgeClass(r.pest_type),
                      )}
                    >
                      {r.pest_type || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                      {r.control_method || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{r.chemical_used || '—'}</span>
                      {r.quantity_used ? (
                        <span className="text-xs text-slate-500">{r.quantity_used} units</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        getBadgeClass(r.area_covered),
                      )}
                    >
                      {r.area_covered || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-sm font-semibold text-slate-900">
                      {r.quantity_used ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-slate-900">
                      {r.manpower_used ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        getStatusBadgeClass(r.status),
                      )}
                    >
                      {r.status || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatServiceDate(r.service_date)}
                      </span>
                      <span className="text-xs text-slate-500">Service window</span>
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
