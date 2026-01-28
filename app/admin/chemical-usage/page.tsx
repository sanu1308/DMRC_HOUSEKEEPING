'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Download, Filter, TrendingUp } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useStations } from '@/hooks/use-stations';
import { useAreas } from '@/hooks/use-areas';
import { useChemicals } from '@/hooks/use-chemicals';
import {
  persistSharedAdminFilters,
  resolveSharedAdminFilters,
  clearSharedAdminFilters,
} from '@/lib/admin-filter-sync';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type ChemicalUsageRecord = {
  id: number;
  chemical_name: string;
  quantity: number;
  unit: string;
  area: string;
  shift: string;
  usage_date: string;
  notes: string | null;
  station_id?: number | null;
  station_name?: string | null;
};

type UsageSummary = {
  chemical_name: string;
  unit: string;
  total_quantity: number;
  usage_count: number;
};

export default function AdminChemicalUsagePage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<ChemicalUsageRecord[]>([]);
  const [summary, setSummary] = useState<UsageSummary[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filtersReadyToken, setFiltersReadyToken] = useState(0);
  const [hydratedQueryKey, setHydratedQueryKey] = useState<string | null>(null);

  // Filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedChemical, setSelectedChemical] = useState('');

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const searchParams = useSearchParams();
  const { stations } = useStations();
  const { areas } = useAreas();
  const { chemicals } = useChemicals();
  const searchParamKey = searchParams?.toString() || '';

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (selectedStation && selectedStation !== '__all__') params.set('station_id', selectedStation);
      if (selectedArea && selectedArea !== '__all__') params.set('area', selectedArea);
      if (selectedChemical && selectedChemical !== '__all__') params.set('chemical_name', selectedChemical);

      persistSharedAdminFilters({
        stationId: selectedStation && selectedStation !== '__all__' ? selectedStation : '',
        from,
        to,
      });

      const data = await apiFetch(
        `/admin/chemical-usage${params.toString() ? `?${params.toString()}` : ''}`,
      );

      setRecords(data.data || []);
      setSummary(data.summary?.usage_by_chemical || []);
      setTotalRecords(data.summary?.total_records || 0);
    } catch (err: any) {
      toast({
        title: 'Failed to load chemical usage analytics',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [from, selectedArea, selectedChemical, selectedStation, to, token, toast]);

  useEffect(() => {
    const resolved = resolveSharedAdminFilters(searchParams);
    const stationValue = resolved.stationId || '';
    const fromValue = resolved.from || '';
    const toValue = resolved.to || '';
    const areaValue = searchParams?.get('area') ?? '';
    const chemicalValue = searchParams?.get('chemical_name') ?? '';

    setSelectedStation((prev) => (prev === stationValue ? prev : stationValue));
    setFrom((prev) => (prev === fromValue ? prev : fromValue));
    setTo((prev) => (prev === toValue ? prev : toValue));
    setSelectedArea((prev) => (prev === areaValue ? prev : areaValue));
    setSelectedChemical((prev) => (prev === chemicalValue ? prev : chemicalValue));

    const nextKey = `${stationValue}|${fromValue}|${toValue}|${areaValue}|${chemicalValue}`;
    if (hydratedQueryKey !== nextKey) {
      setHydratedQueryKey(nextKey);
      setFiltersReadyToken((prev) => prev + 1);
      persistSharedAdminFilters({
        stationId: stationValue && stationValue !== '__all__' ? stationValue : '',
        from: fromValue,
        to: toValue,
      });
    }
  }, [searchParamKey, searchParams, hydratedQueryKey]);

  useEffect(() => {
    if (!token || filtersReadyToken === 0) {
      return;
    }

    loadData();
  }, [filtersReadyToken, loadData, token]);

  function handleExportCsv() {
    if (!records.length) return;
    const header = [
      'Station',
      'Chemical Name',
      'Quantity',
      'Unit',
      'Area',
      'Shift',
      'Usage Date',
      'Notes',
    ];
    const rows = records.map((r) => [
      r.station_name || '',
      r.chemical_name,
      String(r.quantity),
      r.unit,
      r.area,
      r.shift,
      r.usage_date,
      r.notes || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-chemical-usage-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setFrom('');
    setTo('');
    setSelectedStation('');
    setSelectedArea('');
    setSelectedChemical('');
    clearSharedAdminFilters();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Chemical Usage Analytics
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitor chemical consumption and identify over-usage patterns
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Apply filters to narrow down chemical usage records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Station</label>
              <Select
                value={selectedStation}
                onValueChange={setSelectedStation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Stations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Stations</SelectItem>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={String(station.id)}>
                      {station.station_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Area</label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger>
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Areas</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.area_name}>
                      {area.area_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Chemical</label>
              <Select
                value={selectedChemical}
                onValueChange={setSelectedChemical}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Chemicals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Chemicals</SelectItem>
                  {chemicals.map((chemical) => (
                    <SelectItem key={chemical.id} value={chemical.chemical_name}>
                      {chemical.chemical_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={loadData} size="sm">
              Apply Filters
            </Button>
            <Button onClick={clearFilters} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Total Usage Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{totalRecords}</p>
            <p className="text-sm text-slate-500">Total usage records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Chemicals by Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <span className="text-sm font-medium">
                    {item.chemical_name}
                  </span>
                  <span className="text-sm text-slate-600">
                    {item.total_quantity} {item.unit} ({item.usage_count} uses)
                  </span>
                </div>
              ))}
              {summary.length === 0 && (
                <p className="text-sm text-slate-500">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Chemical Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Chemical</CardTitle>
          <CardDescription>
            Total consumption breakdown by chemical type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chemical Name</TableHead>
                <TableHead>Total Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Usage Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {item.chemical_name}
                  </TableCell>
                  <TableCell>{item.total_quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.usage_count}</TableCell>
                </TableRow>
              ))}
              {summary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm">
                    No summary data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed Records */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Usage Records</CardTitle>
          <CardDescription>
            All chemical usage entries matching your filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Chemical</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.usage_date}</TableCell>
                    <TableCell>{r.station_name || '—'}</TableCell>
                    <TableCell>{r.chemical_name}</TableCell>
                    <TableCell>
                      {r.quantity} {r.unit}
                    </TableCell>
                    <TableCell>{r.area}</TableCell>
                    <TableCell>{r.shift}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
