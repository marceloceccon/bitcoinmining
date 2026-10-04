"use client";

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { recommendCoolingSelections } from '@/lib/cooling';
import { DRY_COOLERS, AIR_FANS, MINERS } from '@/lib/catalog';
import { defaultConfig } from '@/lib/defaults';
import { DEFAULT_PRESET_ID, buildPresetConfig, getPreset, type PresetId } from '@/lib/presets';
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
  /** Replace the farm with a preset (miners resolved from the catalog, cooling auto-sized) */
  applyPreset: (id: PresetId) => void;
  /** Empty farm with default settings */
  reset: () => void;
}


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

/** localStorage that never throws (private windows, blocked storage): the farm just isn't remembered. */
const safeStorage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** Persisted catalog miners are re-resolved by id so a saved farm never keeps stale specs or prices. */
function refreshMiners(config: FarmConfig): FarmConfig {
  return {
    ...config,
    miners: config.miners.map(({ miner, quantity }) => ({ miner: MINERS.find((m) => m.id === miner.id) ?? miner, quantity })),
  };
}

export const FARM_STORAGE_KEY = 'mf-farm';
const FARM_STORAGE_VERSION = 1;

export const useFarmStore = create<FarmStore>()(persist((set, get) => ({
  // A fresh visit starts from a realistic farm, not an empty one.
  config: buildPresetConfig(getPreset(DEFAULT_PRESET_ID)),
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

  applyPreset: (id) =>
    set((state) => ({
      config: buildPresetConfig(getPreset(id), { dryCoolers: state.dryCoolerCatalog, airFans: state.airFanCatalog }),
      coolingOverridden: false,
    })),

  reset: () => set(() => ({ config: defaultConfig, coolingOverridden: false })),
}), {
  name: FARM_STORAGE_KEY,
  version: FARM_STORAGE_VERSION,
  storage: createJSONStorage(() => safeStorage),
  partialize: (state) => ({ config: state.config, coolingOverridden: state.coolingOverridden }),
  // Unknown older shapes are dropped rather than half-loaded
  migrate: (persisted, version) => (version === FARM_STORAGE_VERSION ? (persisted as Partial<FarmStore>) : {}),
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<Pick<FarmStore, 'config' | 'coolingOverridden'>>;
    if (!p.config || !Array.isArray(p.config.miners)) return current;
    return { ...current, config: refreshMiners({ ...defaultConfig, ...p.config }), coolingOverridden: !!p.coolingOverridden };
  },
  // Rehydrated after mount (see FarmPersistence) so the server and first client render agree
  skipHydration: true,
}));
