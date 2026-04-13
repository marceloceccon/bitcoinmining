import { describe, it, expect, beforeEach } from 'vitest';
import { useFarmStore } from '@/lib/store';
import type { Miner, DryCoolerModel, AirFanModel } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────

const S21_PRO: Miner = {
  id: 's21pro',
  name: 'Antminer S21 Pro',
  manufacturer: 'Bitmain',
  algorithm: 'SHA-256',
  hash_rate_ths: 234,
  power_watts: 3510,
  price_usd: 5499,
  efficiency_jth: 15,
  release_year: 2024,
  watercooled: false,
  degradation_year1: 3,
  degradation_year2: 5,
  degradation_year3plus: 8,
};

const S21_HYDRO: Miner = {
  id: 's21hydro',
  name: 'Antminer S21 Hydro',
  manufacturer: 'Bitmain',
  algorithm: 'SHA-256',
  hash_rate_ths: 335,
  power_watts: 5360,
  price_usd: 7999,
  efficiency_jth: 16,
  release_year: 2024,
  watercooled: true,
  degradation_year1: 3,
  degradation_year2: 5,
  degradation_year3plus: 8,
};

const SAMPLE_DRY_COOLER: DryCoolerModel = {
  model: 'Test-Cooler-50',
  kw_capacity_35c: 50,
  water_flow_m3h: 8,
  pressure_drop_kpa: 25,
  air_flow_m3h: 20000,
  fan_motor_w: 1500,
  fan_motor_a: 6.5,
  sound_dba: 65,
  length_mm: 2000,
  width_mm: 1200,
  height_mm: 1800,
  inlet_mm: 'DN65',
  weight_kg: 350,
  estimated_cost_usd: 4500,
  man_hours_deploy: 16,
  plumbing_fluid_cost_usd: 800,
};

const SAMPLE_AIR_FAN: AirFanModel = {
  model: 'Test-Fan-1000',
  diameter_mm: 1000,
  hz: 50,
  rpm: 900,
  airflow_m3h: 20000,
  noise_db: 78,
  power_w: 750,
  height_mm: 1100,
  width_mm: 1100,
  cost_usd: 280,
  man_hours_deploy: 2.5,
};

beforeEach(() => {
  useFarmStore.getState().reset();
  useFarmStore.setState({ dryCoolerCatalog: [], airFanCatalog: [] });
});

// ════════════════════════════════════════════════════════════════════════
// Catalog setters — race condition fix
// ════════════════════════════════════════════════════════════════════════

describe('store: catalog setters re-run autoConfigureCooling', () => {
  it('regression: hydro miner added BEFORE dry cooler catalog arrives still gets a selection when the catalog finally loads', () => {
    // Step 1: user adds a hydro miner. Catalog is still empty.
    useFarmStore.getState().addMiner({ miner: S21_HYDRO, quantity: 5 });

    // No selection yet because the catalog wasn't loaded.
    expect(useFarmStore.getState().config.temperature?.dryCoolerSelections).toEqual([]);

    // Step 2: catalog finishes loading — store setter must re-run auto-configure.
    useFarmStore.getState().setDryCoolerCatalog([SAMPLE_DRY_COOLER]);

    // Now there must be a selection.
    const sels = useFarmStore.getState().config.temperature?.dryCoolerSelections ?? [];
    expect(sels.length).toBeGreaterThan(0);
    expect(sels[0]?.model).toBe('Test-Cooler-50');
    expect(sels[0]?.quantity).toBeGreaterThan(0);
  });

  it('regression: air-cooled miner added before fan catalog arrives still gets a selection when the catalog loads', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 5 });
    expect(useFarmStore.getState().config.temperature?.airFanSelections).toEqual([]);

    useFarmStore.getState().setAirFanCatalog([SAMPLE_AIR_FAN]);

    const sels = useFarmStore.getState().config.temperature?.airFanSelections ?? [];
    expect(sels.length).toBeGreaterThan(0);
    expect(sels[0]?.model).toBe('Test-Fan-1000');
  });

  it('does not duplicate selections if the catalog setter is called twice', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 5 });
    useFarmStore.getState().setAirFanCatalog([SAMPLE_AIR_FAN]);
    useFarmStore.getState().setAirFanCatalog([SAMPLE_AIR_FAN]);

    const sels = useFarmStore.getState().config.temperature?.airFanSelections ?? [];
    expect(sels.length).toBe(1);
  });

  it('clears air-fan selections when air-cooled miners are removed and the catalog setter fires', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 5 });
    useFarmStore.getState().setAirFanCatalog([SAMPLE_AIR_FAN]);
    expect(useFarmStore.getState().config.temperature?.airFanSelections.length).toBeGreaterThan(0);

    useFarmStore.getState().removeMiner(S21_PRO.id);
    expect(useFarmStore.getState().config.temperature?.airFanSelections).toEqual([]);
  });

  it('switching catalogs preserves the FarmConfig identity except for the temperature.{air,dry} selections', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 5 });
    const before = useFarmStore.getState().config;

    useFarmStore.getState().setAirFanCatalog([SAMPLE_AIR_FAN]);
    const after = useFarmStore.getState().config;

    // Top-level numeric and primitive fields are unchanged
    expect(after.parasiticLoadPercent).toBe(before.parasiticLoadPercent);
    expect(after.uptimePercent).toBe(before.uptimePercent);
    expect(after.miners).toEqual(before.miners);
    expect(after.electrical).toEqual(before.electrical);
    // The only thing that should have changed is the air fan selections
    expect(after.temperature?.airFanSelections).not.toEqual(before.temperature?.airFanSelections);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Store basic invariants
// ════════════════════════════════════════════════════════════════════════

describe('store: basic invariants', () => {
  it('starts with an empty miners array', () => {
    expect(useFarmStore.getState().config.miners).toEqual([]);
  });

  it('addMiner appends to the miners array', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 3 });
    expect(useFarmStore.getState().config.miners).toHaveLength(1);
    expect(useFarmStore.getState().config.miners[0].quantity).toBe(3);
  });

  it('updateMinerQuantity floors to 1 (cannot drop a miner to zero this way)', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 5 });
    useFarmStore.getState().updateMinerQuantity(S21_PRO.id, 0);
    expect(useFarmStore.getState().config.miners[0].quantity).toBe(1);
    useFarmStore.getState().updateMinerQuantity(S21_PRO.id, -10);
    expect(useFarmStore.getState().config.miners[0].quantity).toBe(1);
  });

  it('reset returns to default config', () => {
    useFarmStore.getState().addMiner({ miner: S21_PRO, quantity: 5 });
    useFarmStore.getState().reset();
    expect(useFarmStore.getState().config.miners).toEqual([]);
    expect(useFarmStore.getState().config.payoutScheme).toBe('fpps');
  });

  it('updatePayoutScheme changes the scheme', () => {
    useFarmStore.getState().updatePayoutScheme('pplns');
    expect(useFarmStore.getState().config.payoutScheme).toBe('pplns');
  });

  it('updateRegional merges partial updates without nuking other regional fields', () => {
    useFarmStore.getState().updateRegional({ electricityPriceKwh: 0.07 });
    const r = useFarmStore.getState().config.regional;
    expect(r.electricityPriceKwh).toBe(0.07);
    expect(r.region).toBe('CUSTOM'); // preserved from default
    expect(r.energyInflationPercent).toBe(3);
  });

  it('default config has taxAdderPercent: 0', () => {
    expect(useFarmStore.getState().config.regional.taxAdderPercent).toBe(0);
  });

  it('default config has solar.includeCommissioningInCapex: false', () => {
    expect(useFarmStore.getState().config.solar.includeCommissioningInCapex).toBe(false);
  });

  it('updateSolar can toggle includeCommissioningInCapex without losing other solar fields', () => {
    useFarmStore.getState().updateSolar({ includeCommissioningInCapex: true });
    const s = useFarmStore.getState().config.solar;
    expect(s.includeCommissioningInCapex).toBe(true);
    expect(s.coveragePercent).toBe(0); // preserved from default
    expect(s.installationCostPerKw).toBe(1200);
  });
});
