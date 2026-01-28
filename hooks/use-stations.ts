"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const API_BASE = `${API_URL}/api`;

export type Station = {
  id: number;
  station_name: string;
  station_code: string;
};

export function useStations() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("dmrc_token")
      : null;

  const fetchStations = useCallback(async () => {
    if (!token) {
      setError("Not authenticated");
      setStations([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/stations`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fetch stations");
      }

      const data = await res.json();
      setStations(data.data || data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load stations");
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchStations();
    }
  }, [token, fetchStations]);

  return {
    stations,
    loading,
    error,
    refresh: fetchStations,
  };
}
