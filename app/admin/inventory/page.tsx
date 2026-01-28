'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

type InventoryItem = {
  id: number;
  chemical_name: string;
  category: string;
  measuring_unit: string;
  total_stock: number;
  minimum_stock_level: number;
  total_used: number;
  remaining_stock: number;
  stock_status: 'LOW' | 'SUFFICIENT';
};

type InventorySummary = {
  total_chemicals: number;
  low_stock_count: number;
  sufficient_stock_count: number;
};

export default function AdminInventoryPage() {
  const { toast } = useToast();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    total_chemicals: 0,
    low_stock_count: 0,
    sufficient_stock_count: 0,
  });
  const [loading, setLoading] = useState(false);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

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

  async function loadInventory() {
    try {
      setLoading(true);
      const data = await apiFetch('/admin/inventory');

      setInventory(data.data || []);
      setSummary(data.summary || {
        total_chemicals: 0,
        low_stock_count: 0,
        sufficient_stock_count: 0,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to load inventory',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Inventory Status
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitor chemical stock levels and plan timely purchases
            </p>
          </div>
        </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Total Chemicals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {summary.total_chemicals}
            </p>
            <p className="text-sm text-slate-500">Chemical products tracked</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">
              {summary.low_stock_count}
            </p>
            <p className="text-sm text-red-600">Require immediate purchase</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Sufficient Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {summary.sufficient_stock_count}
            </p>
            <p className="text-sm text-green-600">Stock levels healthy</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {summary.low_stock_count > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert - Action Required
            </CardTitle>
            <CardDescription>
              The following chemicals are at or below minimum stock levels and require immediate purchase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chemical Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Remaining Stock</TableHead>
                  <TableHead>Minimum Level</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory
                  .filter((item) => item.stock_status === 'LOW')
                  .map((item) => (
                    <TableRow key={item.id} className="bg-red-50/50">
                      <TableCell className="font-medium">
                        {item.chemical_name}
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        <span className="font-bold text-red-700">
                          {item.remaining_stock}
                        </span>
                      </TableCell>
                      <TableCell>{item.minimum_stock_level}</TableCell>
                      <TableCell>{item.measuring_unit}</TableCell>
                      <TableCell>{item.total_used}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Complete Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Inventory Status</CardTitle>
          <CardDescription>
            All chemical products with stock calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Chemical Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Total Stock</TableHead>
                <TableHead>Total Used</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Min. Level</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : inventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm">
                    No inventory data available.
                  </TableCell>
                </TableRow>
              ) : (
                inventory.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.stock_status === 'LOW' ? 'bg-red-50/30' : 'bg-green-50/20'
                    }
                  >
                    <TableCell>
                      {item.stock_status === 'LOW' ? (
                        <span className="flex items-center gap-1 text-red-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs font-semibold">LOW</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-semibold">OK</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.chemical_name}
                    </TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.total_stock}</TableCell>
                    <TableCell>{item.total_used}</TableCell>
                    <TableCell>
                      <span
                        className={`font-bold ${
                          item.stock_status === 'LOW'
                            ? 'text-red-700'
                            : 'text-green-700'
                        }`}
                      >
                        {item.remaining_stock}
                      </span>
                    </TableCell>
                    <TableCell>{item.minimum_stock_level}</TableCell>
                    <TableCell>{item.measuring_unit}</TableCell>
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
