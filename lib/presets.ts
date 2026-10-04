/**
 * Farm presets reference miners by catalog id and are resolved against the
 * loaded catalog, so a data refresh can never leave a preset with stale specs
 * or prices. Every preset must be profitable at the default $0.05/kWh at the
 * current market (tests/presets.test.ts).
 */
import type { AirFanModel, DryCoolerModel, FarmConfig, FarmMiner, InfrastructureType, Miner } from '@/types';
import { AIR_FANS, DRY_COOLERS, MINERS } from '@/lib/catalog';
import { recommendCoolingSelections } from '@/lib/cooling';
import { defaultConfig } from '@/lib/defaults';

export type PresetId = 'home' | 'garage' | 'small-farm' | 'industrial';

export interface FarmPreset {
  id: PresetId;
  name: string;
  description: string;
  miners: { minerId: string; quantity: number }[];
  infrastructure: InfrastructureType;
  /** Settings that differ from the defaults for this kind of farm */
  overrides?: Partial<Pick<FarmConfig, 'maintenanceLabor' | 'electrical'>>;
}

export const PRESETS: FarmPreset[] = [
  {
    id: 'home',
    name: 'Home Miner',
    description: 'One quiet home unit on residential power, no transformer needed',
    miners: [{ minerId: 'avalon-q', quantity: 1 }],
    infrastructure: 'racks',
    // A home miner looks after their own unit (no paid technician hours) and
    // plugs into a nearby circuit (a short cable run, not a 50 m feeder).
    overrides: {
      maintenanceLabor: { hourlyMaintenanceCostUsd: 0 },
      electrical: { ...defaultConfig.electrical, cableLength: 5 },
    },
  },
  {
    id: 'garage',
    name: 'Garage Setup',
    description: '10 air-cooled units, semi-professional, single transformer',
    miners: [{ minerId: 's21-xp', quantity: 10 }],
    infrastructure: 'racks',
  },
  {
    id: 'small-farm',
    name: 'Small Farm',
    description: '100 air-cooled units in containers',
    miners: [{ minerId: 's21-xp', quantity: 100 }],
    infrastructure: 'containers',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    description: '500 hydro-cooled units, 3-phase power, full infrastructure',
    miners: [{ minerId: 's21-xp-hyd', quantity: 500 }],
    infrastructure: 'containers',
  },
];

/** What a fresh visit loads: a realistic, profitable farm rather than an empty one. */
export const DEFAULT_PRESET_ID: PresetId = 'small-farm';

export function getPreset(id: PresetId): FarmPreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset ${id}`);
  return preset;
}

/** The preset's miners, resolved from the catalog. Throws on an id the catalog doesn't have. */
export function resolvePresetMiners(preset: FarmPreset, catalog: Miner[] = MINERS): FarmMiner[] {
  return preset.miners.map(({ minerId, quantity }) => {
    const miner = catalog.find((m) => m.id === minerId);
    if (!miner) throw new Error(`Preset ${preset.id} references unknown miner id ${minerId}`);
    return { miner, quantity };
  });
}

/** A complete farm config for the preset: defaults + resolved miners + auto-sized cooling. */
export function buildPresetConfig(
  preset: FarmPreset,
  catalogs: { miners?: Miner[]; dryCoolers?: DryCoolerModel[]; airFans?: AirFanModel[] } = {},
  base: FarmConfig = defaultConfig,
): FarmConfig {
  const config: FarmConfig = {
    ...base,
    ...preset.overrides,
    miners: resolvePresetMiners(preset, catalogs.miners),
    infrastructureType: preset.infrastructure,
  };
  const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };
  return {
    ...config,
    temperature: {
      ...temperature,
      ...recommendCoolingSelections(config, catalogs.dryCoolers ?? DRY_COOLERS, catalogs.airFans ?? AIR_FANS),
    },
  };
}
