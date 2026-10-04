"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { FarmConfig, ForecastParams, ForecastResult } from "@/types";
import { MINERS } from "@/lib/catalog";
import { computeFarmReport, type FarmReport } from "@/lib/farmReport";
import { generateForecast } from "@/lib/forecasting";
import {
  FALLBACK_MARKET,
  toMarketSnapshot,
  withDerived,
  type NetworkData as ServerNetworkData,
} from "@/lib/networkData";

/**
 * Client data layer. Calculations run in the browser on the same pure engine
 * the REST API and MCP use (D1); the only request the UI makes is for the live
 * market snapshot (/api/network).
 */

/**
 * fetch + JSON parse that rejects on non-2xx responses, so error bodies such as a
 * 429 `{ error }` are never mistaken for data.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json() as Promise<T>;
}

// ─── Catalog ───────────────────────────────────────────────────────────────────

/** The miner catalog is bundled (data/miners.json), so there is nothing to load. */
export function useMiners() {
  return { miners: MINERS, loading: false };
}

// ─── Market snapshot (one shared poller for every component) ───────────────────

/** /api/network as JSON (Dates arrive as ISO strings). */
export type NetworkData = Omit<ServerNetworkData, "lastUpdated"> & { lastUpdated: string };

const NETWORK_POLL_MS = 5 * 60 * 1000;
const useNetworkStore = create<{ data: NetworkData | null }>(() => ({ data: null }));
let networkSubscribers = 0;
let networkTimer: ReturnType<typeof setInterval> | null = null;
let networkController: AbortController | null = null;

function refreshNetworkData() {
  networkController?.abort();
  const controller = new AbortController();
  networkController = controller;
  fetchJson<NetworkData>("/api/network", { signal: controller.signal })
    .then((data) => {
      if (!controller.signal.aborted) useNetworkStore.setState({ data });
    })
    .catch(() => {
      // Keep the last good snapshot (or the offline estimate).
    });
}

export function useNetworkData() {
  const data = useNetworkStore((s) => s.data);
  useEffect(() => {
    if (networkSubscribers++ === 0) {
      refreshNetworkData();
      networkTimer = setInterval(refreshNetworkData, NETWORK_POLL_MS);
    }
    return () => {
      if (--networkSubscribers === 0) {
        if (networkTimer) clearInterval(networkTimer);
        networkTimer = null;
        networkController?.abort();
      }
    };
  }, []);
  return { data, loading: data === null };
}

const FALLBACK_NETWORK_DATA: NetworkData = (() => {
  const derived = withDerived(FALLBACK_MARKET);
  return { ...derived, lastUpdated: derived.asOf };
})();

/**
 * The market snapshot to compute with: live /api/network data once it arrives,
 * otherwise the dated offline estimate (`isLive === false`, label it in the UI).
 */
export function useMarket(): NetworkData {
  const { data } = useNetworkData();
  return data ?? FALLBACK_NETWORK_DATA;
}

// ─── Calculations (in the browser, synchronous) ────────────────────────────────

export type CalculateResponse = FarmReport;

export function useCalculation(config: FarmConfig): { data: FarmReport | null; loading: false } {
  const market = useMarket();
  const data = useMemo(
    () => (config.miners.length === 0 ? null : computeFarmReport(config, toMarketSnapshot(market))),
    [config, market],
  );
  return { data, loading: false };
}

export function useForecast(config: FarmConfig, params: ForecastParams): { data: ForecastResult | null; loading: false } {
  const market = useMarket();
  const data = useMemo(
    () => (config.miners.length === 0 ? null : generateForecast(config, params, toMarketSnapshot(market), new Date())),
    [config, params, market],
  );
  return { data, loading: false };
}
