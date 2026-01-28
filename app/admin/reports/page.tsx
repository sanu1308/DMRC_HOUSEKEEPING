'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Download, FileText, Calendar, TrendingUp } from 'lucide-react';

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useStations } from '@/hooks/use-stations';
import { useChemicals } from '@/hooks/use-chemicals';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type CleaningLog = {
  id: number;
  date: string;
  time: string;
  station_name: string;
  cleaning_area: string;
  cleaning_type: string;
  performed_by: string;
  remarks: string;
};

type ChemicalConsumption = {
  chemical_id: number;
  chemical_name: string;
  unit: string;
  total_quantity: number;
  usage_count: number;
  avg_quantity_per_use: number;
  first_usage: string;
  last_usage: string;
  stations_used: number;
  areas_covered: number;
  total_stock: number;
  minimum_stock_level: number;
  remaining_stock: number;
};

type StaffRecord = {
  id: number;
  date: string;
  day: string;
  station_name: string;
  shift: string;
  manpower: string;
  number_of_persons: number;
};

export default function AdminReportsPage() {
  const { toast } = useToast();
  const { stations } = useStations();
  const { chemicals } = useChemicals();

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  // Daily Cleaning Report State
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [cleaningSummary, setCleaningSummary] = useState<any>(null);
  const [cleaningFrom, setCleaningFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cleaningTo, setCleaningTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cleaningStation, setCleaningStation] = useState('');
  const [cleaningLoading, setCleaningLoading] = useState(false);

  // Chemical Consumption Report State
  const [chemicalData, setChemicalData] = useState<ChemicalConsumption[]>([]);
  const [chemicalSummary, setChemicalSummary] = useState<any>(null);
  const [chemicalMonth, setChemicalMonth] = useState(String(new Date().getMonth() + 1));
  const [chemicalYear, setChemicalYear] = useState(String(new Date().getFullYear()));
  const [chemicalStation, setChemicalStation] = useState('');
  const [chemicalId, setChemicalId] = useState('');
  const [chemicalLoading, setChemicalLoading] = useState(false);

  // Staff Utilization Report State
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [staffSummary, setStaffSummary] = useState<any>(null);
  const [staffFrom, setStaffFrom] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  );
  const [staffTo, setStaffTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [staffStation, setStaffStation] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

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

  async function loadDailyCleaningReport() {
    try {
      setCleaningLoading(true);
      const params = new URLSearchParams();
      if (cleaningFrom) params.set('from', cleaningFrom);
      if (cleaningTo) params.set('to', cleaningTo);
      if (cleaningStation && cleaningStation !== '__all__') params.set('station_id', cleaningStation);

      const data = await apiFetch(
        `/admin/reports/daily-cleaning${params.toString() ? `?${params.toString()}` : ''}`
      );

      setCleaningLogs(data.data || []);
      setCleaningSummary(data.summary || null);
    } catch (err: any) {
      toast({
        title: 'Failed to load daily cleaning report',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCleaningLoading(false);
    }
  }

  async function loadChemicalConsumptionReport() {
    try {
      setChemicalLoading(true);
      const params = new URLSearchParams();
      if (chemicalMonth) params.set('month', chemicalMonth);
      if (chemicalYear) params.set('year', chemicalYear);
      if (chemicalStation && chemicalStation !== '__all__') params.set('station_id', chemicalStation);
      if (chemicalId && chemicalId !== '__all__') params.set('chemical_id', chemicalId);

      const data = await apiFetch(
        `/admin/reports/chemical-consumption${params.toString() ? `?${params.toString()}` : ''}`
      );

      setChemicalData(data.data || []);
      setChemicalSummary(data.summary || null);
    } catch (err: any) {
      toast({
        title: 'Failed to load chemical consumption report',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setChemicalLoading(false);
    }
  }

  async function loadStaffUtilizationReport() {
    try {
      setStaffLoading(true);
      const params = new URLSearchParams();
      if (staffFrom) params.set('from', staffFrom);
      if (staffTo) params.set('to', staffTo);
      if (staffStation && staffStation !== '__all__') params.set('station_id', staffStation);

      const data = await apiFetch(
        `/admin/reports/staff-utilization${params.toString() ? `?${params.toString()}` : ''}`
      );

      setStaffRecords(data.data || []);
      setStaffSummary(data.summary || null);
    } catch (err: any) {
      toast({
        title: 'Failed to load staff utilization report',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setStaffLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadDailyCleaningReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function exportCleaningCsv() {
    if (!cleaningLogs.length) return;
    const header = ['Date', 'Time', 'Station', 'Cleaning Area', 'Cleaning Type', 'Performed By', 'Remarks'];
    const rows = cleaningLogs.map((r) => [
      r.date,
      r.time,
      r.station_name || '',
      r.cleaning_area,
      r.cleaning_type,
      r.performed_by,
      r.remarks || '',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    downloadCsv(csv, `daily-cleaning-report-${format(new Date(), 'yyyyMMdd')}.csv`);
  }

  function exportChemicalCsv() {
    if (!chemicalData.length) return;
    const header = [
      'Chemical Name',
      'Total Quantity',
      'Unit',
      'Usage Count',
      'Avg Per Use',
      'Stations Used',
      'Areas Covered',
      'Remaining Stock',
    ];
    const rows = chemicalData.map((r) => [
      r.chemical_name,
      String(r.total_quantity),
      r.unit,
      String(r.usage_count),
      r.avg_quantity_per_use.toFixed(2),
      String(r.stations_used),
      String(r.areas_covered),
      String(r.remaining_stock),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    downloadCsv(csv, `chemical-consumption-report-${chemicalYear}-${chemicalMonth}.csv`);
  }

  function exportStaffCsv() {
    if (!staffRecords.length) return;
    const header = ['Date', 'Day', 'Station', 'Shift', 'Manpower', 'Number of Persons'];
    const rows = staffRecords.map((r) => [
      r.date,
      r.day,
      r.station_name || '',
      r.shift,
      r.manpower,
      String(r.number_of_persons),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    downloadCsv(csv, `staff-utilization-report-${format(new Date(), 'yyyyMMdd')}.csv`);
  }

  function downloadCsv(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Admin Reports
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Generate comprehensive reports for audit, review, and presentations
            </p>
          </div>
        </div>

      <Tabs defaultValue="daily-cleaning" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily-cleaning" onClick={loadDailyCleaningReport}>
            <FileText className="mr-2 h-4 w-4" />
            Daily Cleaning
          </TabsTrigger>
          <TabsTrigger value="chemical-consumption" onClick={loadChemicalConsumptionReport}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Chemical Consumption
          </TabsTrigger>
          <TabsTrigger value="staff-utilization" onClick={loadStaffUtilizationReport}>
            <Calendar className="mr-2 h-4 w-4" />
            Staff Utilization
          </TabsTrigger>
        </TabsList>

        {/* Daily Cleaning Report */}
        <TabsContent value="daily-cleaning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Select date range and station to generate report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Input
                    type="date"
                    value={cleaningFrom}
                    onChange={(e) => setCleaningFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Input
                    type="date"
                    value={cleaningTo}
                    onChange={(e) => setCleaningTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Station</label>
                  <Select value={cleaningStation} onValueChange={setCleaningStation}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Stations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Stations</SelectItem>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.station_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadDailyCleaningReport} disabled={cleaningLoading}>
                    Generate Report
                  </Button>
                  <Button variant="outline" onClick={exportCleaningCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {cleaningSummary && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Activities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{cleaningSummary.total_cleaning_activities}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Stations Cleaned</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{cleaningSummary.stations_cleaned}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Staff Involved</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{cleaningSummary.staff_involved}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Days Covered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{cleaningSummary.days_covered}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Cleaning Activities</CardTitle>
              <CardDescription>Detailed log of all cleaning operations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleaningLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : cleaningLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    cleaningLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.date}</TableCell>
                        <TableCell>{log.time}</TableCell>
                        <TableCell>{log.station_name || '—'}</TableCell>
                        <TableCell>{log.cleaning_area}</TableCell>
                        <TableCell>{log.cleaning_type}</TableCell>
                        <TableCell className="text-sm">{log.performed_by}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{log.remarks || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chemical Consumption Report */}
        <TabsContent value="chemical-consumption" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Select month, year, and filters to generate report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Month</label>
                  <Select value={chemicalMonth} onValueChange={setChemicalMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year</label>
                  <Select value={chemicalYear} onValueChange={setChemicalYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Station</label>
                  <Select value={chemicalStation} onValueChange={setChemicalStation}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Stations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Stations</SelectItem>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.station_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chemical</label>
                  <Select value={chemicalId} onValueChange={setChemicalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Chemicals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Chemicals</SelectItem>
                      {chemicals.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.chemical_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadChemicalConsumptionReport} disabled={chemicalLoading}>
                    Generate Report
                  </Button>
                  <Button variant="outline" onClick={exportChemicalCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {chemicalSummary && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Chemicals Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{chemicalSummary.total_chemicals_used}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Quantity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{chemicalSummary.total_quantity_consumed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Usage Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{chemicalSummary.total_usage_records}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Avg Daily Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{chemicalSummary.avg_daily_consumption}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Chemical Consumption Details</CardTitle>
              <CardDescription>Breakdown by chemical product</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chemical Name</TableHead>
                    <TableHead>Total Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Usage Count</TableHead>
                    <TableHead>Avg Per Use</TableHead>
                    <TableHead>Stations</TableHead>
                    <TableHead>Remaining Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chemicalLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : chemicalData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    chemicalData.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.chemical_name}</TableCell>
                        <TableCell>{item.total_quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.usage_count}</TableCell>
                        <TableCell>{Number(item.avg_quantity_per_use || 0).toFixed(2)}</TableCell>
                        <TableCell>{item.stations_used}</TableCell>
                        <TableCell>
                          <span
                            className={
                              item.remaining_stock <= item.minimum_stock_level
                                ? 'font-bold text-red-600'
                                : 'text-green-600'
                            }
                          >
                            {item.remaining_stock}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Utilization Report */}
        <TabsContent value="staff-utilization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Select date range and station to generate report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Input
                    type="date"
                    value={staffFrom}
                    onChange={(e) => setStaffFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Input
                    type="date"
                    value={staffTo}
                    onChange={(e) => setStaffTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Station</label>
                  <Select value={staffStation} onValueChange={setStaffStation}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Stations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Stations</SelectItem>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.station_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadStaffUtilizationReport} disabled={staffLoading}>
                    Generate Report
                  </Button>
                  <Button variant="outline" onClick={exportStaffCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {staffSummary && (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Entries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{staffSummary.total_staff_entries}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Persons Deployed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{staffSummary.total_persons_deployed}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Avg Per Entry</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{staffSummary.avg_persons_per_entry}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Stations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{staffSummary.stations_covered}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Days Covered</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{staffSummary.days_covered}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>By Station</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Station</TableHead>
                          <TableHead>Total Persons</TableHead>
                          <TableHead>Avg/Day</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffSummary.by_station.map((s: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{s.station_name || '—'}</TableCell>
                            <TableCell>{s.total_persons}</TableCell>
                            <TableCell>{parseFloat(s.avg_persons_per_day).toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Shift</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shift</TableHead>
                          <TableHead>Total Persons</TableHead>
                          <TableHead>Avg</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffSummary.by_shift.map((s: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{s.shift}</TableCell>
                            <TableCell>{s.total_persons}</TableCell>
                            <TableCell>{parseFloat(s.avg_persons).toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Staff Deployment Details</CardTitle>
              <CardDescription>Complete staff utilization records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Manpower</TableHead>
                    <TableHead>Persons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : staffRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    staffRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{record.day}</TableCell>
                        <TableCell>{record.station_name || '—'}</TableCell>
                        <TableCell>{record.shift}</TableCell>
                        <TableCell>{record.manpower}</TableCell>
                        <TableCell className="font-semibold">{record.number_of_persons}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
