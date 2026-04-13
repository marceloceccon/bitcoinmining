"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  Miner,
  DryCoolerModel,
  AirFanModel,
  FarmConfig,
  FarmMetrics,
  ForecastParams,
  ForecastResult,
} from "@/types";

// ─── Catalog fetchers (static data, fetched once) ─────────────────────────────

/**
 * Generic one-shot catalog fetcher. Aborts the in-flight request when the
 * component unmounts so React never sees a setState on a dead component.
 */
function useCatalog<T>(url: string): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((result: T[]) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          // Catalogs are best-effort — empty array is the safe fallback.
          setData([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [url]);

  return { data, loading };
}

export function useMiners() {
  const { data, loading } = useCatalog<Miner>("/api/miners");
  return { miners: data, loading };
}

export function useDryCoolers() {
  const { data, loading } = useCatalog<DryCoolerModel>("/api/dry-coolers");
  return { dryCoolers: data, loading };
}

export function useAirFans() {
  const { data, loading } = useCatalog<AirFanModel>("/api/air-fans");
  return { airFans: data, loading };
}

// ─── Calculation response type ─────────────────────────────────────────────────

export interface CalculateResponse {
  metrics: FarmMetrics;
  ventilation: { m3h: number; cfm: number };
  totalHashRateThs: number;
  totalPowerKw: number;
  airFanPowerKw: number;
  climate: {
    lat: number;
    lng: number;
    city: string;
    avgYearlyTempC: number;
    maxTempC: number;
    minTempC: number;
    avgHumidityPercent: number;
  };
  dryCoolerDeratingFactor: number;
  effectiveDryCoolerCapacityKw: number;
}

/**
 * Generic debounced POST hook used by both useCalculation and useForecast.
 *
 * Lifecycle guarantees:
 * - If `inputs` change before the debounce fires, the pending timer is reset.
 * - If a new fetch is started while one is in flight, the previous request is aborted.
 * - On unmount, both the timer and any in-flight request are cancelled — no
 *   setState ever fires on a dead component.
 */
function useDebouncedPost<TBody, TResult>(
  url: string,
  body: TBody | null,
  delayMs: number,
  inputs: ReadonlyArray<unknown>,
): { data: TResult | null; loading: boolean } {
  const [data, setData] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (body === null) {
      setData(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((result: TResult) => {
          if (mountedRef.current && !controller.signal.aborted) {
            setData(result);
          }
        })
        .catch((err) => {
          // AbortError just means a newer request superseded us — not a real failure.
          if (err?.name === "AbortError") return;
          // Swallow other errors silently; the UI shows the last good data.
        })
        .finally(() => {
          if (mountedRef.current && !controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, inputs);

  return { data, loading };
}

// ─── Debounced calculation hook ────────────────────────────────────────────────

export function useCalculation(config: FarmConfig) {
  return useDebouncedPost<FarmConfig, CalculateResponse>(
    "/api/calculate",
    config.miners.length === 0 ? null : config,
    200,
    [config],
  );
}

// ─── Debounced forecast hook ───────────────────────────────────────────────────

export function useForecast(config: FarmConfig, params: ForecastParams) {
  return useDebouncedPost<{ config: FarmConfig; params: ForecastParams }, ForecastResult>(
    "/api/forecast",
    config.miners.length === 0 ? null : { config, params },
    400,
    [config, params],
  );
}

// ─── Network data hook ─────────────────────────────────────────────────────────

export interface NetworkData {
  btcPriceUsd: number;
  networkHashrateEh: number;
  difficulty: number;
  blockReward: number;
  hashpriceUsdPhDay: number;
  lastUpdated: string;
  isLive: boolean;
}

export function useNetworkData() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch("/api/network", { signal: controller.signal })
      .then((r) => r.json())
      .then((result: NetworkData) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  return { data, loading };
}
