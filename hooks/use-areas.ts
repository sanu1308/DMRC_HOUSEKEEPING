'use client';

import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

export type Area = {
  id: number;
  area_name: string;
  description: string | null;
  is_active: boolean;
};

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const fetchAreas = useCallback(async () => {
    if (!token) {
      setError('Not authenticated');
      setAreas([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/areas`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to fetch areas');
      }

      const data = await res.json();
      setAreas(data.data || data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load areas');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchAreas();
    }
  }, [token, fetchAreas]);

  return {
    areas,
    loading,
    error,
    refresh: fetchAreas,
  };
}
