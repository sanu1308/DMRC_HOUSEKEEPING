'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Download, Filter, TrendingUp } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

function ChemicalUsagePage() {

  const { toast } = useToast();

  const [records, setRecords] = useState<ChemicalUsageRecord[]>([]);
  const [summary, setSummary] = useState<UsageSummary[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

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

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error('Request failed');

    return res.json();
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (selectedStation && selectedStation !== '__all__')
        params.set('station_id', selectedStation);

      if (selectedArea && selectedArea !== '__all__')
        params.set('area', selectedArea);

      if (selectedChemical && selectedChemical !== '__all__')
        params.set('chemical_name', selectedChemical);

      const data = await apiFetch(
        `/admin/chemical-usage${params.toString() ? `?${params}` : ''}`,
      );

      setRecords(data.data || []);
      setSummary(data.summary?.usage_by_chemical || []);
      setTotalRecords(data.summary?.total_records || 0);
    } catch (err: any) {
      toast({
        title: 'Failed to load data',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedStation, selectedArea, selectedChemical]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-4">
        Chemical Usage Insights
      </h1>

      <Button onClick={loadData}>
        Reload Data
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chemical</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.chemical_name}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>{r.unit}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChemicalUsagePage />
    </Suspense>
  );
}