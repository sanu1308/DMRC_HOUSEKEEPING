"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const API_BASE = `${API_URL}/api`;

export type Chemical = {
  id: number;
  chemical_name: string;
  category: string;
  measuring_unit: string;
  total_stock: number;
  minimum_stock_level: number;
};

export function useChemicals() {
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("dmrc_token")
      : null;

  const fetchChemicals = useCallback(async () => {
    if (!token) {
      setError("Not authenticated");
      setChemicals([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/chemicals`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fetch chemicals");
      }

      const data = await res.json();
      setChemicals(data.data || data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load chemicals");
      setChemicals([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchChemicals();
    }
  }, [token, fetchChemicals]);

  return {
    chemicals,
    loading,
    error,
    refresh: fetchChemicals,
  };
}
