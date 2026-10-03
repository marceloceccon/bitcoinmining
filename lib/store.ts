"use client";

import { create } from 'zustand';
import { recommendCoolingSelections } from '@/lib/cooling';
import { DRY_COOLERS, AIR_FANS } from '@/lib/catalog';
import type { FarmConfig, FarmMiner, ElectricalConfig, CoolingConfig, SolarConfig, RegionalConfig, PayoutScheme, LaborConfig, TemperatureConfig, InfrastructureType, ImportTaxConfig, MaintenanceLaborConfig, DryCoolerModel, AirFanModel } from '@/types';

interface FarmStore {
  config: FarmConfig;
  // Catalogs used for cooling auto-sizing (the bundled data/*.json; injectable for tests)
  dryCoolerCatalog: DryCoolerModel[];
  airFanCatalog: AirFanModel[];
  // True once the user hand-edits cooling selections: location / parasitic-load
  // changes then keep their quantities. Changing the miners re-sizes from scratch.
  coolingOverridden: boolean;
  resetCoolingToAuto: () => void;
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
 * Re-run cooling auto-sizing (lib/cooling.ts, the same path the engine and the
 * Thermal tab use) unless the user has hand-edited the cooling selections.
 */
function autoConfigureCooling(
  config: FarmConfig,
  dryCoolerCatalog: DryCoolerModel[],
  airFanCatalog: AirFanModel[],
  coolingOverridden = false,
): FarmConfig {
  if (coolingOverridden) return config;
  const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };
  return {
    ...config,
    temperature: { ...temperature, ...recommendCoolingSelections(config, dryCoolerCatalog, airFanCatalog) },
  };
}

export const useFarmStore = create<FarmStore>((set, get) => ({
  config: defaultConfig,
  dryCoolerCatalog: DRY_COOLERS,
  airFanCatalog: AIR_FANS,
  coolingOverridden: false,

  setDryCoolerCatalog: (catalog) =>
    set((state) => ({
      dryCoolerCatalog: catalog,
      config: autoConfigureCooling(state.config, catalog, state.airFanCatalog, state.coolingOverridden),
    })),
  setAirFanCatalog: (catalog) =>
    set((state) => ({
      airFanCatalog: catalog,
      config: autoConfigureCooling(state.config, state.dryCoolerCatalog, catalog, state.coolingOverridden),
    })),

  resetCoolingToAuto: () =>
    set((state) => ({
      coolingOverridden: false,
      config: autoConfigureCooling(state.config, state.dryCoolerCatalog, state.airFanCatalog),
    })),

  addMiner: (miner) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: [...state.config.miners, miner],
      };
      return { coolingOverridden: false, config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog) };
    }),

  removeMiner: (minerId) =>
    set((state) => {
      const updated = {
        ...state.config,
        miners: state.config.miners.filter((m) => m.miner.id !== minerId),
      };
      return { coolingOverridden: false, config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog) };
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
      return { coolingOverridden: false, config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog) };
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
      config: autoConfigureCooling(
        { ...state.config, parasiticLoadPercent: percent },
        state.dryCoolerCatalog,
        state.airFanCatalog,
        state.coolingOverridden,
      ),
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

  // Selection edits are manual overrides; a location change re-sizes cooling
  // for the new climate unless the user has overridden it.
  updateTemperature: (temperature) =>
    set((state) => {
      const manualEdit = 'dryCoolerSelections' in temperature || 'airFanSelections' in temperature;
      const coolingOverridden = state.coolingOverridden || manualEdit;
      const updated = {
        ...state.config,
        temperature: {
          ...(state.config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] }),
          ...temperature,
        },
      };
      return {
        coolingOverridden,
        config: autoConfigureCooling(updated, state.dryCoolerCatalog, state.airFanCatalog, coolingOverridden),
      };
    }),

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
      coolingOverridden: false,
    })),

  reset: () => set(() => ({ config: defaultConfig, coolingOverridden: false })),
}));
