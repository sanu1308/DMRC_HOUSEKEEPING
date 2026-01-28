'use client';

import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api`;

export function usePests() {
  const [pests, setPests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dmrc_token')
      : null;

  const fetchPests = useCallback(async () => {
    if (!token) {
      setError('Not authenticated');
      setPests([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/pest-types`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to fetch pest types');
      }

      const data = await res.json();
      setPests(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pest list');
      setPests([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPests();
    }
  }, [token, fetchPests]);

  return {
    pests,
    pestTypes: pests, // Alias for consistency
    loading,
    error,
    refresh: fetchPests,
  };
}
