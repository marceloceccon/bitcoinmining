"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ForecastParams } from "@/types";
import { DEFAULT_NETWORK_GROWTH_PERCENT } from "@/lib/networkData";

export const DEFAULT_FORECAST_PARAMS: ForecastParams = {
  months: 48,
  revenueMode: "sell_opex",
  btcPriceModel: "flat",
  annualGrowthPercent: 30,
  finalBtcPrice: null,
  networkHashrateGrowthPercent: DEFAULT_NETWORK_GROWTH_PERCENT, // replaced by the trailing default unless overridden
  asicDegradationPercent: 4,
  discountRatePercent: 10,
};

/** Projections inputs, shared so share links and persistence can include them. */
interface ForecastStore {
  params: ForecastParams;
  /** User-set network growth; null = follow the trailing 12-month default */
  growthOverride: number | null;
  setParams: (params: ForecastParams) => void;
  setGrowthOverride: (value: number | null) => void;
  load: (params: ForecastParams, growthOverride: number | null) => void;
}

export const useForecastStore = create<ForecastStore>()(persist((set) => ({
  params: DEFAULT_FORECAST_PARAMS,
  growthOverride: null,
  setParams: (params) => set({ params }),
  setGrowthOverride: (growthOverride) => set({ growthOverride }),
  load: (params, growthOverride) => set({ params, growthOverride }),
}), {
  name: "mf-forecast",
  version: 1,
  storage: createJSONStorage(() => {
    try {
      return localStorage;
    } catch {
      return undefined as unknown as Storage;
    }
  }),
  partialize: (s) => ({ params: s.params, growthOverride: s.growthOverride }),
  migrate: (persisted, version) => (version === 1 ? (persisted as Partial<ForecastStore>) : {}),
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<Pick<ForecastStore, "params" | "growthOverride">>;
    return { ...current, params: { ...DEFAULT_FORECAST_PARAMS, ...p.params }, growthOverride: p.growthOverride ?? null };
  },
  skipHydration: true,
}));
