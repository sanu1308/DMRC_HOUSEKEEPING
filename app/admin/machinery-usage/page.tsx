'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Filter,
  Gauge,
  Settings,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';
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

export default function AdminMachineryUsagePage() {
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
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Machinery Usage Analytics
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitor machine load, performance, and maintenance patterns
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

      <Card>
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
          >
            {inventoryLoading ? 'Refreshing…' : 'Refresh counts'}
          </Button>
        </CardHeader>
        <CardContent>
          {inventorySummary ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Machines</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {inventorySummary.quantity_total.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-blue-50 p-3 text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">In Use</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {inventorySummary.quantity_in_use.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Available / Working</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {inventorySummary.quantity_working.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-50 p-3 text-slate-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Under Maintenance</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {inventorySummary.quantity_maintenance.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-amber-50 p-3 text-amber-600">
                      <Wrench className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Faulty</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {inventorySummary.quantity_faulty.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-full bg-red-50 p-3 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Utilization</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {inventorySummary.utilization.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-full bg-purple-50 p-3 text-purple-600">
                      <Gauge className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Tracking {inventorySummary.stations_with_inventory} stations with recorded machinery inventory.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {inventoryLoading ? 'Loading inventory summary…' : 'No machinery inventory has been recorded yet.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
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
          <div className="grid gap-4 md:grid-cols-4">
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
              <label className="text-sm font-medium">Machine Type</label>
              <Input
                type="text"
                placeholder="Machine type"
                value={selectedMachineType}
                onChange={(e) => setSelectedMachineType(e.target.value)}
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
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

        <Card>
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

        <Card>
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
