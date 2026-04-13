"use client";

import { create } from 'zustand';
import type { FarmConfig, FarmMiner, ElectricalConfig, CoolingConfig, SolarConfig, RegionalConfig, PayoutScheme, LaborConfig, TemperatureConfig, InfrastructureType, ImportTaxConfig, MaintenanceLaborConfig, DryCoolerModel, AirFanModel } from '@/types';

interface FarmStore {
  config: FarmConfig;
  // Cached catalog data (fetched from API on mount)
  dryCoolerCatalog: DryCoolerModel[];
  airFanCatalog: AirFanModel[];
  setDryCoolerCatalog: (catalog: DryCoolerModel[]) => void;
  setAirFanCatalog: (catalog: AirFanModel[]) => void;
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
    includeCommissioningInCapex: false,
  },
  regional: {
    region: "CUSTOM",
    electricityPriceKwh: 0.05,
    taxAdderPercent: 0,
    energyInflationPercent: 3,
  },
  parasiticLoadPercent: 5,
  uptimePercent: 98,
  poolFeePercent: 2.5,
  maintenanceOpexPercent: 5,
  payoutScheme: "fpps" as PayoutScheme,
  labor: {
    manHoursPerMiner: 1,
    hourlyLaborCostUsd: 20,
    cablesPerMinerUsd: 40,
    manHoursPerTransformer: 8,
    manHoursPerRack: 4,
    manHoursPerContainer: 80,
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
 * Uses cached catalog data from the store.
 */
function autoConfigureCooling(
  config: FarmConfig,
  dryCoolerCatalog: DryCoolerModel[],
  airFanCatalog: AirFanModel[],
): FarmConfig {
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

  // Climate: use selected location or temperate defaults
  const climate = temperature.location ?? { avgYearlyTempC: 25, maxTempC: 35, minTempC: 5, avgHumidityPercent: 60 };

  // Dry cooler derating: ~3% per °C above 35°C
  const deltaAbove35 = climate.maxTempC - 35;
  const dryCoolerDerating = deltaAbove35 > 0
    ? Math.max(0.5, 1 - deltaAbove35 * 0.03)
    : Math.min(1.3, 1 + Math.abs(deltaAbove35) * 0.02);

  // Auto-select dry coolers for hydro miners (account for derating)
  if (hasHydro && totalPowerKw > 0 && dryCoolerCatalog.length > 0) {
    const sorted = [...dryCoolerCatalog].sort(
      (a, b) => Math.abs(a.kw_capacity_35c - totalPowerKw) - Math.abs(b.kw_capacity_35c - totalPowerKw)
    );
    const best = sorted[0];
    if (best) {
      const effectiveCapacity = best.kw_capacity_35c * dryCoolerDerating;
      const qty = Math.max(1, Math.ceil(totalPowerKw / effectiveCapacity));
      dryCoolerSelections = [{ model: best.model, quantity: qty }];
    }
  } else if (!hasHydro) {
    dryCoolerSelections = [];
  }

  // Climate-adjusted ventilation: effective ΔT shrinks in hot climates
  const effectiveDeltaT = Math.max(5, 50 - climate.maxTempC);
  const baseM3hNeeded = (totalPowerKw * 1000 * 3600) / (1.2 * 1005 * effectiveDeltaT);
  // Humidity penalty: +1% per % above 70%, capped at 15%
  const humidityExcess = Math.max(0, climate.avgHumidityPercent - 70);
  const humidityPenalty = 1 + Math.min(humidityExcess * 0.01, 0.15);
  const m3hNeeded = baseM3hNeeded * humidityPenalty;

  // Auto-select air fans for air-cooled miners
  if (hasAir && totalPowerKw > 0 && airFanCatalog.length > 0) {
    const bestFan = airFanCatalog[airFanCatalog.length - 1];
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

export const useFarmStore = create<FarmStore>((set, get) => ({
  config: defaultConfig,
  dryCoolerCatalog: [],
  airFanCatalog: [],

  // Catalog setters re-run auto-configure so that miners added before the
  // async catalog fetch completes still get cooling selections populated
  // once the catalog arrives. Without this re-run, the user would see an
  // empty Temperature tab until they nudged a miner count.
  setDryCoolerCatalog: (catalog) =>
    set((state) => ({
      dryCoolerCatalog: catalog,
      config: autoConfigureCooling(state.config, catalog, state.airFanCatalog),
    })),
  setAirFanCatalog: (catalog) =>
    set((state) => ({
      airFanCatalog: catalog,
      config: autoConfigureCooling(state.config, state.dryCoolerCatalog, catalog),
    })),

  addMiner: (miner) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: [...state.config.miners, miner],
      };
      return { config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog) };
    }),

  removeMiner: (minerId) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: state.config.miners.filter((m) => m.miner.id !== minerId),
      };
      return { config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog) };
    }),

  updateMinerQuantity: (minerId, quantity) =>
    set((state) => {
      const safeQuantity = Math.max(1, quantity);
      const updated = {
        ...state.config,
        miners: state.config.miners.map((m) =>
          m.miner.id === minerId ? { ...m, quantity: safeQuantity } : m
        ),
      };
      return { config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog) };
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
        temperature: {
          ...(state.config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] }),
          ...temperature,
        },
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
