'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Bug, Download, Filter } from 'lucide-react';
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
import { usePests } from '@/hooks/use-pests';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type PestControlRecord = {
  id: number;
  pest_type: string;
  pest_control_type: string;
  control_method: string;
  chemical_used: string;
  quantity_used: number;
  measuring_unit: string;
  area_covered: string;
  station_id: number;
  station_name: string;
  service_date: string;
  date: string;
  notes: string;
};

type RecurringIssue = {
  pest_type: string;
  area_covered: string;
  station_id: number;
  station_name: string;
  occurrence_count: number;
  last_occurrence: string;
};

export default function AdminPestControlPage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<PestControlRecord[]>([]);
  const [recurringIssues, setRecurringIssues] = useState<RecurringIssue[]>([]);
  const [pestSummary, setPestSummary] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filtersReadyToken, setFiltersReadyToken] = useState(0);

  // Filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedPestType, setSelectedPestType] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedStation, setSelectedStation] = useState('');

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const searchParams = useSearchParams();
  const { stations } = useStations();
  const { pestTypes } = usePests();

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
      if (selectedPestType && selectedPestType !== '__all__') params.set('pest_type', selectedPestType);
      if (selectedArea) params.set('area_covered', selectedArea);
      if (selectedMethod) params.set('control_method', selectedMethod);
      if (selectedStation && selectedStation !== '__all__') params.set('station_id', selectedStation);

      const data = await apiFetch(
        `/admin/pest-control${params.toString() ? `?${params.toString()}` : ''}`,
      );

      setRecords(data.data || []);
      setRecurringIssues(data.summary?.recurring_issues || []);
      setPestSummary(data.summary?.pest_summary || []);
      setTotalRecords(data.summary?.total_records || 0);
    } catch (err: any) {
      toast({
        title: 'Failed to load pest control analytics',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [from, selectedArea, selectedMethod, selectedPestType, selectedStation, to, token, toast]);

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const stationParam = searchParams.get('station_id') ?? '';
    const pestTypeParam = searchParams.get('pest_type') ?? '';
    const areaParam = searchParams.get('area') ?? searchParams.get('area_covered') ?? '';
    const methodParam = searchParams.get('control_method') ?? '';
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
    setSelectedPestType(pestTypeParam);
    setSelectedArea(areaParam);
    setSelectedMethod(methodParam);
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

  function handleExportCsv() {
    if (!records.length) return;
    const header = [
      'Date',
      'Station',
      'Pest Type',
      'Control Method',
      'Chemical Used',
      'Quantity',
      'Area Covered',
      'Notes',
    ];
    const rows = records.map((r) => [
      r.service_date || r.date,
      r.station_name || '',
      r.pest_type || r.pest_control_type,
      r.control_method || '',
      r.chemical_used,
      `${r.quantity_used} ${r.measuring_unit}`,
      r.area_covered || '',
      r.notes || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-pest-control-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setFrom('');
    setTo('');
    setSelectedPestType('');
    setSelectedArea('');
    setSelectedMethod('');
    setSelectedStation('');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Pest Control Analytics
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitor pest control activities and detect recurring issues
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
            Apply filters to narrow down pest control records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
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
              <label className="text-sm font-medium">Pest Type</label>
              <Select
                value={selectedPestType}
                onValueChange={setSelectedPestType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Types</SelectItem>
                  {pestTypes.map((pest) => (
                    <SelectItem key={pest} value={pest}>
                      {pest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Area</label>
              <Input
                type="text"
                placeholder="Area name"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Control Method</label>
              <Input
                type="text"
                placeholder="Method"
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-orange-600" />
              Total Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{totalRecords}</p>
            <p className="text-sm text-slate-500">Pest control records</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Recurring Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">
              {recurringIssues.length}
            </p>
            <p className="text-sm text-red-600">
              Areas with multiple pest occurrences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recurring Issues Alert */}
      {recurringIssues.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Recurring Pest Issues - Requires Attention
            </CardTitle>
            <CardDescription>
              These locations have reported the same pest multiple times
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pest Type</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Occurrences</TableHead>
                  <TableHead>Last Occurrence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringIssues.map((issue, idx) => (
                  <TableRow key={idx} className="bg-red-50/50">
                    <TableCell className="font-medium">
                      {issue.pest_type}
                    </TableCell>
                    <TableCell>{issue.station_name}</TableCell>
                    <TableCell>{issue.area_covered || '—'}</TableCell>
                    <TableCell>
                      <span className="font-bold text-red-700">
                        {issue.occurrence_count}x
                      </span>
                    </TableCell>
                    <TableCell>{issue.last_occurrence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pest Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Pest Summary</CardTitle>
          <CardDescription>
            Breakdown of incidents by pest type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pest Type</TableHead>
                <TableHead>Total Incidents</TableHead>
                <TableHead>Total Chemical Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pestSummary.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.pest_type}</TableCell>
                  <TableCell>{item.total_incidents}</TableCell>
                  <TableCell>
                    {item.total_chemical_used || 0} {item.measuring_unit}
                  </TableCell>
                </TableRow>
              ))}
              {pestSummary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm">
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
          <CardTitle>Detailed Pest Control Records</CardTitle>
          <CardDescription>
            All pest control entries matching your filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Pest Type</TableHead>
                <TableHead>Control Method</TableHead>
                <TableHead>Chemical</TableHead>
                <TableHead>Quantity</TableHead>
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
                    <TableCell>{r.service_date || r.date}</TableCell>
                    <TableCell>{r.station_name}</TableCell>
                    <TableCell>{r.pest_type || r.pest_control_type}</TableCell>
                    <TableCell>{r.control_method || '—'}</TableCell>
                    <TableCell>{r.chemical_used}</TableCell>
                    <TableCell>
                      {r.quantity_used} {r.measuring_unit}
                    </TableCell>
                    <TableCell>{r.area_covered || '—'}</TableCell>
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
