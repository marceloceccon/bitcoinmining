"use client";

import { create } from 'zustand';
import type { FarmConfig, FarmMiner, ElectricalConfig, CoolingConfig, SolarConfig, RegionalConfig, PayoutScheme, LaborConfig, TemperatureConfig, InfrastructureType, ImportTaxConfig, MaintenanceLaborConfig } from '@/types';
import { DRY_COOLERS } from '@/lib/dryCoolerData';
import { AIR_FANS } from '@/lib/airFanData';

interface FarmStore {
  config: FarmConfig;
  addMiner: (miner: FarmMiner) => void;
  removeMiner: (minerId: string) => void;
  updateMinerQuantity: (minerId: string, quantity: number) => void;
  updateElectrical: (electrical: Partial<ElectricalConfig>) => void;
  updateCooling: (cooling: Partial<CoolingConfig>) => void;
  updateSolar: (solar: Partial<SolarConfig>) => void;
  updateRegional: (regional: Partial<RegionalConfig>) => void;
  updateParasiticLoad: (percent: number) => void;
  updateUptime: (percent: number) => void;
  updatePoolFee: (percent: number) => void;
  updateMaintenanceOpex: (percent: number) => void;
  updatePayoutScheme: (scheme: PayoutScheme) => void;
  updateLabor: (labor: Partial<LaborConfig>) => void;
  updateTemperature: (temperature: Partial<TemperatureConfig>) => void;
  updateInfrastructureType: (type: InfrastructureType) => void;
  updateImportTax: (importTax: Partial<ImportTaxConfig>) => void;
  updateMaintenanceLabor: (maintenanceLabor: Partial<MaintenanceLaborConfig>) => void;
  loadConfig: (config: FarmConfig) => void;
  reset: () => void;
}

const defaultConfig: FarmConfig = {
  miners: [],
  electrical: {
    cableLength: 50,
    cableGauge: 6,
    copperPricePerKg: 9.5,
  },
  cooling: {
    type: "air",
    airCost: 5000,
  },
  solar: {
    coveragePercent: 0,
    installationCostPerKw: 1200,
    maintenancePercentPerYear: 1,
    injectionRatePercent: 100,
  },
  regional: {
    region: "US",
    electricityPriceKwh: 0.10,
    taxAdderPercent: 0,
    energyInflationPercent: 3,
  },
  parasiticLoadPercent: 5,
  uptimePercent: 98,
  poolFeePercent: 2.5,
  maintenanceOpexPercent: 5,
  payoutScheme: "fpps" as PayoutScheme,
  labor: {
    manHoursPerMiner: 2.5,
    hourlyLaborCostUsd: 35,
    cablesPerMinerUsd: 85,
    manHoursPerTransformer: 8,
    manHoursPerRack: 4,
    manHoursPerContainer: 40,
  },
  temperature: {
    location: null,
    dryCoolerSelections: [],
    airFanSelections: [],
  },
  infrastructureType: "racks" as InfrastructureType,
  importTax: {
    containers: 10,
    racks: 10,
    miners: 10,
    fans: 10,
    dryCoolers: 10,
  },
  maintenanceLabor: {
    hourlyMaintenanceCostUsd: 35,
  },
};

/**
 * Auto-configure cooling selections when miners change.
 * Picks the best-fit dry cooler / air fan and calculates quantity.
 */
function autoConfigureCooling(config: FarmConfig): FarmConfig {
  const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };

  if (config.miners.length === 0) {
    return {
      ...config,
      temperature: { ...temperature, dryCoolerSelections: [], airFanSelections: [] },
    };
  }

  const hasHydro = config.miners.some(({ miner }) => miner.watercooled);
  const hasAir = config.miners.some(({ miner }) => !miner.watercooled);

  const minerPowerW = config.miners.reduce((t, { miner, quantity }) => t + miner.power_watts * quantity, 0);
  const totalPowerKw = (minerPowerW * (1 + config.parasiticLoadPercent / 100)) / 1000;

  let { dryCoolerSelections, airFanSelections } = temperature;

  // Auto-select dry coolers for hydro miners
  if (hasHydro && totalPowerKw > 0) {
    const sorted = [...DRY_COOLERS].sort(
      (a, b) => Math.abs(a.kw_capacity_35c - totalPowerKw) - Math.abs(b.kw_capacity_35c - totalPowerKw)
    );
    const best = sorted[0];
    if (best) {
      const qty = Math.max(1, Math.ceil(totalPowerKw / best.kw_capacity_35c));
      dryCoolerSelections = [{ model: best.model, quantity: qty }];
    }
  } else if (!hasHydro) {
    dryCoolerSelections = [];
  }

  // Auto-select air fans for air-cooled miners
  if (hasAir && totalPowerKw > 0) {
    const m3hNeeded = totalPowerKw * 200;
    // Pick the largest fan for fewest units
    const bestFan = AIR_FANS[AIR_FANS.length - 1];
    if (bestFan) {
      const qty = Math.max(1, Math.ceil(m3hNeeded / bestFan.airflow_m3h));
      airFanSelections = [{ model: bestFan.model, quantity: qty }];
    }
  } else if (!hasAir) {
    airFanSelections = [];
  }

  return {
    ...config,
    temperature: { ...temperature, dryCoolerSelections, airFanSelections },
  };
}

export const useFarmStore = create<FarmStore>((set) => ({
  config: defaultConfig,

  addMiner: (miner) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: [...state.config.miners, miner],
      };
      return { config: autoConfigureCooling(updated) };
    }),

  removeMiner: (minerId) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: state.config.miners.filter((m) => m.miner.id !== minerId),
      };
      return { config: autoConfigureCooling(updated) };
    }),

  updateMinerQuantity: (minerId, quantity) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: state.config.miners.map((m) =>
          m.miner.id === minerId ? { ...m, quantity } : m
        ),
      };
      return { config: autoConfigureCooling(updated) };
    }),

  updateElectrical: (electrical) =>
    set((state) => ({
      config: {
        ...state.config,
        electrical: { ...state.config.electrical, ...electrical },
      },
    })),

  updateCooling: (cooling) =>
    set((state) => ({
      config: {
        ...state.config,
        cooling: { ...state.config.cooling, ...cooling },
      },
    })),

  updateSolar: (solar) =>
    set((state) => ({
      config: {
        ...state.config,
        solar: { ...state.config.solar, ...solar },
      },
    })),

  updateRegional: (regional) =>
    set((state) => ({
      config: {
        ...state.config,
        regional: { ...state.config.regional, ...regional },
      },
    })),

  updateParasiticLoad: (percent) =>
    set((state) => ({
      config: { ...state.config, parasiticLoadPercent: percent },
    })),

  updateUptime: (percent) =>
    set((state) => ({
      config: { ...state.config, uptimePercent: percent },
    })),

  updatePoolFee: (percent) =>
    set((state) => ({
      config: { ...state.config, poolFeePercent: percent },
    })),

  updateMaintenanceOpex: (percent) =>
    set((state) => ({
      config: { ...state.config, maintenanceOpexPercent: percent },
    })),

  updatePayoutScheme: (scheme) =>
    set((state) => ({
      config: { ...state.config, payoutScheme: scheme },
    })),

  updateLabor: (labor) =>
    set((state) => ({
      config: { ...state.config, labor: { ...state.config.labor, ...labor } },
    })),

  updateTemperature: (temperature) =>
    set((state) => ({
      config: {
        ...state.config,
        temperature: { ...state.config.temperature!, ...temperature },
      },
    })),

  updateInfrastructureType: (type) =>
    set((state) => ({
      config: { ...state.config, infrastructureType: type },
    })),

  updateImportTax: (importTax) =>
    set((state) => ({
      config: { ...state.config, importTax: { ...state.config.importTax, ...importTax } },
    })),

  updateMaintenanceLabor: (maintenanceLabor) =>
    set((state) => ({
      config: { ...state.config, maintenanceLabor: { ...state.config.maintenanceLabor, ...maintenanceLabor } },
    })),

  loadConfig: (config) =>
    set(() => ({
      config,
    })),

  reset: () => set(() => ({ config: defaultConfig })),
}));
