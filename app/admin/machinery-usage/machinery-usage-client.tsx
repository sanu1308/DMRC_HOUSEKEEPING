'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Download,
  Filter,
  Gauge,
  Settings,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type MachineryUsageRecord = {
  id: number;
  machine_type: string;
  machine_name: string;
  area_used: string;
  usage_hours: number;
  status: string;
  usage_date: string;
  shift: string;
  notes: string;
  station_id: number;
  station_name: string;
};

type MachinePerformance = {
  machine_type: string;
  machine_name: string;
  usage_count: number;
  total_hours: number;
  avg_hours_per_use: number;
  breakdown_count: number;
  maintenance_count: number;
  operational_count: number;
};

type StationAnalysis = {
  station_id: number;
  station_name: string;
  total_usage: number;
  total_hours: number;
  distinct_machines: number;
};

type StationInventorySnapshot = {
  station_id: number;
  station_name: string;
  quantity_total: number;
  quantity_in_use: number;
  quantity_working: number;
  quantity_faulty: number;
  quantity_maintenance: number;
  utilization: number;
};

type InventorySummary = {
  quantity_total: number;
  quantity_in_use: number;
  quantity_working: number;
  quantity_faulty: number;
  quantity_maintenance: number;
  utilization: number;
  stations_with_inventory: number;
};

export default function AdminMachineryUsageClient() {
  const { toast } = useToast();

  const [records, setRecords] = useState<MachineryUsageRecord[]>([]);
  const [machinePerformance, setMachinePerformance] = useState<
    MachinePerformance[]
  >([]);
  const [stationAnalysis, setStationAnalysis] = useState<StationAnalysis[]>(
    [],
  );
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filtersReadyToken, setFiltersReadyToken] = useState(0);
  const [inventorySummary, setInventorySummary] =
    useState<InventorySummary | null>(null);
  const [stationInventory, setStationInventory] = useState<
    StationInventorySnapshot[]
  >([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedMachineType, setSelectedMachineType] = useState('');
  const [selectedStation, setSelectedStation] = useState('');

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const searchParams = useSearchParams();
  const { stations } = useStations();
  const utilizationPercent = inventorySummary?.utilization ?? 0;
  const isLowUtilization = utilizationPercent > 0 && utilizationPercent < 60;

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
      if (selectedMachineType) params.set('machine_type', selectedMachineType);
      if (selectedStation && selectedStation !== '__all__') params.set('station_id', selectedStation);

      const data = await apiFetch(
        `/admin/machinery-usage${params.toString() ? `?${params.toString()}` : ''}`,
      );

      setRecords(data.data || []);
      setMachinePerformance(data.summary?.machine_performance || []);
      setStationAnalysis(data.summary?.station_analysis || []);
      setTotalRecords(data.summary?.total_records || 0);
      const rawTotalHours = data.summary?.total_usage_hours;
      const numericTotalHours =
        typeof rawTotalHours === 'number'
          ? rawTotalHours
          : Number(rawTotalHours ?? 0) || 0;
      setTotalHours(numericTotalHours);
    } catch (err: any) {
      toast({
        title: 'Failed to load machinery usage analytics',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [from, selectedMachineType, selectedStation, to, token, toast]);

  const loadInventorySummary = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setInventoryLoading(true);
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (selectedStation && selectedStation !== '__all__') {
        params.set('station_id', selectedStation);
      }

      const endpoint = `/admin/machinery-inventory${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiFetch(endpoint);
      setInventorySummary(data?.data?.summary || null);
      setStationInventory(data?.data?.stations || []);
    } catch (err: any) {
      toast({
        title: 'Failed to load machinery inventory',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setInventoryLoading(false);
    }
  }, [from, selectedStation, to, toast, token]);

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const stationParam = searchParams.get('station_id') ?? '';
    const machineTypeParam = searchParams.get('machine_type') ?? '';
    const fromParam = searchParams.get('from') ?? '';
    const toParam = searchParams.get('to') ?? '';
    const singleDate = searchParams.get('date') ?? '';

    let normalizedFrom = fromParam;
    let normalizedTo = toParam;

    if (!normalizedFrom && !normalizedTo && singleDate) {
      normalizedFrom = singleDate;
      normalizedTo = singleDate;
    }

    setSelectedStation(stationParam);
    setSelectedMachineType(machineTypeParam);
    setFrom(normalizedFrom);
    setTo(normalizedTo);
    setFiltersReadyToken((prev) => prev + 1);
  }, [searchParams]);

  useEffect(() => {
    if (!token || filtersReadyToken === 0) {
      return;
    }

    loadData();
  }, [filtersReadyToken, loadData, token]);

  useEffect(() => {
    if (token) {
      loadInventorySummary();
    }
  }, [token, loadInventorySummary]);

  function handleExportCsv() {
    if (!records.length) return;
    const header = [
      'Date',
      'Station',
      'Machine Type',
      'Machine Name',
      'Area Used',
      'Usage Hours',
      'Status',
      'Shift',
      'Notes',
    ];
    const rows = records.map((r) => [
      r.usage_date,
      r.station_name,
      r.machine_type,
      r.machine_name,
      r.area_used,
      String(r.usage_hours),
      r.status,
      r.shift,
      r.notes || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-machinery-usage-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setFrom('');
    setTo('');
    setSelectedMachineType('');
    setSelectedStation('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-white px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 rounded-4xl bg-white/85 p-4 shadow-2xl ring-1 ring-amber-100 backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-amber-100 via-white to-rose-100 px-5 py-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Machinery Pulse</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Machinery Usage Analytics
            </h2>
            <p className="text-sm text-slate-600">
              Track utilization, risk, and performance in one glance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
              <Link href="/admin" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="rounded-full border-amber-200 text-amber-700 hover:bg-amber-50">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

      <Card className="border-0 bg-gradient-to-br from-white via-amber-50 to-rose-50 shadow-xl">
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Machinery Inventory Health</CardTitle>
            <CardDescription>
              Station-level stock, availability, and utilization pulled from the new inventory endpoint
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadInventorySummary}
            disabled={inventoryLoading}
            className="rounded-full border-amber-200 text-amber-700 hover:bg-white"
          >
            {inventoryLoading ? 'Refreshing...' : 'Refresh counts'}
          </Button>
        </CardHeader>
        <CardContent>
          {inventorySummary ? (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</p>
                  <div className="mt-4 space-y-3 text-slate-900">
                    <div>
                      <p className="text-sm text-slate-500">Total Machines</p>
                      <p className="text-2xl font-semibold">
                        {inventorySummary.quantity_total.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/70 pt-3 text-sm">
                      <span className="text-slate-600">Available / Working</span>
                      <span className="font-semibold">
                        {inventorySummary.quantity_working.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">In Use</span>
                      <span className="font-semibold">
                        {inventorySummary.quantity_in_use.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Risk</p>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-rose-600">Faulty</p>
                        <p className="text-lg font-semibold text-rose-900">
                          {inventorySummary.quantity_faulty.toLocaleString()}
                        </p>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200/80 pt-4">
                      <div>
                        <p className="text-sm text-amber-600">Under Maintenance</p>
                        <p className="text-lg font-semibold text-amber-900">
                          {inventorySummary.quantity_maintenance.toLocaleString()}
                        </p>
                      </div>
                      <Wrench className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Performance</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Runtime Utilization</span>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-slate-900">
                        {utilizationPercent.toFixed(1)}%
                      </span>
                      {isLowUtilization ? (
                        <AlertTriangle
                          className="h-5 w-5 text-amber-500"
                          aria-label="Low utilization warning"
                        />
                      ) : (
                        <Gauge className="h-5 w-5 text-slate-500" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      Utilization across {inventorySummary.stations_with_inventory} stations
                    </p>
                    <p className="text-xs text-slate-500">
                      {isLowUtilization
                        ? 'Low runtime detected — redistribute workloads to avoid idle fleets.'
                        : 'Healthy runtime — maintain rotation schedule.'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Tracking {inventorySummary.stations_with_inventory} stations with recorded machinery inventory.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {inventoryLoading ? 'Loading inventory summary...' : 'No machinery inventory has been recorded yet.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-0 bg-gradient-to-br from-white via-amber-50 to-rose-50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Apply filters to narrow down machinery usage records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Date</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-sm text-slate-500">to</span>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-[200px]">
                <p className="text-xs font-semibold uppercase text-slate-500">Station</p>
                <Select value={selectedStation} onValueChange={setSelectedStation}>
                  <SelectTrigger className="w-[220px]">
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

              <div className="flex flex-col gap-2 min-w-[200px]">
                <p className="text-xs font-semibold uppercase text-slate-500">Machine Type</p>
                <Input
                  type="text"
                  placeholder="e.g. Scrubber"
                  value={selectedMachineType}
                  onChange={(e) => setSelectedMachineType(e.target.value)}
                  className="w-[220px]"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={loadData} className="whitespace-nowrap rounded-full bg-amber-600 text-white hover:bg-amber-500">
                  Apply
                </Button>
                <Button onClick={clearFilters} variant="outline" className="whitespace-nowrap rounded-full border-slate-200 text-slate-600 hover:bg-white">
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 bg-white/90 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Total Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{totalRecords}</p>
            <p className="text-sm text-slate-500">Usage records</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/90 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {Number.isFinite(totalHours) ? totalHours.toFixed(1) : '0.0'}
            </p>
            <p className="text-sm text-slate-500">Machine operation hours</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/90 shadow-xl">
          <CardHeader>
            <CardTitle>Avg Hours/Use</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {totalRecords > 0 ? (totalHours / totalRecords).toFixed(1) : 0}
            </p>
            <p className="text-sm text-slate-500">Average usage duration</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Station Inventory Snapshot</CardTitle>
          <CardDescription>
            Compare total machines versus deployment, availability, maintenance, and faults per station
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Station</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>In Use</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Maintenance</TableHead>
                <TableHead>Faulty</TableHead>
                <TableHead>Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm">
                    Loading inventory data…
                  </TableCell>
                </TableRow>
              ) : stationInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm">
                    No station inventory records yet.
                  </TableCell>
                </TableRow>
              ) : (
                stationInventory.map((station) => (
                  <TableRow key={station.station_id}>
                    <TableCell className="font-medium">
                      {station.station_name}
                    </TableCell>
                    <TableCell>{station.quantity_total}</TableCell>
                    <TableCell>{station.quantity_in_use}</TableCell>
                    <TableCell>{station.quantity_working}</TableCell>
                    <TableCell>{station.quantity_maintenance}</TableCell>
                    <TableCell>{station.quantity_faulty}</TableCell>
                    <TableCell>{station.utilization.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Machine Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Machine Performance Analysis</CardTitle>
          <CardDescription>
            Detailed performance metrics for each machine type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine Type</TableHead>
                <TableHead>Machine Name</TableHead>
                <TableHead>Usage Count</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Avg Hours/Use</TableHead>
                <TableHead>Operational</TableHead>
                <TableHead>Maintenance</TableHead>
                <TableHead className="text-red-600">Breakdowns</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machinePerformance.map((perf, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {perf.machine_type}
                  </TableCell>
                  <TableCell>{perf.machine_name}</TableCell>
                  <TableCell>{perf.usage_count}</TableCell>
                  <TableCell>{Number(perf.total_hours || 0).toFixed(1)} hrs</TableCell>
                  <TableCell>{Number(perf.avg_hours_per_use || 0).toFixed(1)} hrs</TableCell>
                  <TableCell>
                    <span className="text-green-600 font-medium">
                      {perf.operational_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-yellow-600 font-medium">
                      {perf.maintenance_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-red-600 font-bold">
                      {perf.breakdown_count}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {machinePerformance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm">
                    No performance data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Station Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Station-wise Analysis</CardTitle>
          <CardDescription>
            Machine usage distribution across stations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Station</TableHead>
                <TableHead>Total Usage</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Distinct Machines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stationAnalysis.map((stat, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {stat.station_name}
                  </TableCell>
                  <TableCell>{stat.total_usage}</TableCell>
                  <TableCell>{Number(stat.total_hours || 0).toFixed(1)} hrs</TableCell>
                  <TableCell>{stat.distinct_machines}</TableCell>
                </TableRow>
              ))}
              {stationAnalysis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm">
                    No station data available.
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
            All machinery usage entries matching your filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Machine Type</TableHead>
                <TableHead>Machine Name</TableHead>
                <TableHead>Usage Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Area</TableHead>
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
                    <TableCell>{r.station_name}</TableCell>
                    <TableCell>{r.machine_type}</TableCell>
                    <TableCell>{r.machine_name}</TableCell>
                    <TableCell>{r.usage_hours} hrs</TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          r.status === 'Breakdown'
                            ? 'text-red-600'
                            : r.status === 'Maintenance'
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>{r.area_used}</TableCell>
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
