import { describe, it, expect, beforeEach } from 'vitest';
import { DRY_COOLERS, AIR_FANS, MINERS } from '@/lib/catalog';
import {
  DEFAULT_CLIMATE,
  coolingHeatLoadKw,
  dryCoolerDeratingFactor,
  recommendCoolingSelections,
  requiredAirflowM3h,
  sizeAirCooling,
  sizeHydroCooling,
} from '@/lib/cooling';
import { calculateVentilation, getDryCoolerDeratingFactor } from '@/lib/calculations';
import { useFarmStore } from '@/lib/store';
import type { LocationData, Miner } from '@/types';

const S21_PRO = MINERS.find((m) => m.id === 's21-pro') as Miner;
const S21_HYD = MINERS.find((m) => m.id === 's21-hyd') as Miner;

const HOT: LocationData = { ...DEFAULT_CLIMATE, city: 'Hot', maxTempC: 46, avgHumidityPercent: 40 };
const COLD: LocationData = { ...DEFAULT_CLIMATE, city: 'Cold', maxTempC: 24, avgHumidityPercent: 75 };

beforeEach(() => {
  useFarmStore.getState().reset();
});

describe('dryCoolerDeratingFactor', () => {
  it('is 1.0 at the 35 °C rating, −3 %/°C above (floor 0.5), +2 %/°C below (cap 1.3)', () => {
    expect(dryCoolerDeratingFactor(35)).toBe(1);
    expect(dryCoolerDeratingFactor(45)).toBeCloseTo(0.7);
    expect(dryCoolerDeratingFactor(60)).toBe(0.5);
    expect(dryCoolerDeratingFactor(30)).toBeCloseTo(1.1);
    expect(dryCoolerDeratingFactor(0)).toBe(1.3);
  });
});

describe('coolingHeatLoadKw', () => {
  it('splits a mixed farm by cooling type, each with the parasitic share', () => {
    const config = {
      miners: [{ miner: S21_PRO, quantity: 10 }, { miner: S21_HYD, quantity: 4 }],
      parasiticLoadPercent: 5,
    };
    expect(coolingHeatLoadKw(config, 'air')).toBeCloseTo((10 * S21_PRO.power_watts * 1.05) / 1000);
    expect(coolingHeatLoadKw(config, 'hydro')).toBeCloseTo((4 * S21_HYD.power_watts * 1.05) / 1000);
  });
});

describe('sizeHydroCooling / sizeAirCooling', () => {
  it('a hot climate needs more dry coolers than a cold one for the same heat', () => {
    const hot = sizeHydroCooling(2814, HOT, DRY_COOLERS)!;
    const cold = sizeHydroCooling(2814, COLD, DRY_COOLERS)!;
    expect(hot.model.model).toBe(cold.model.model);
    expect(hot.quantity).toBeGreaterThan(cold.quantity);
    expect(hot.effectiveCapacity).toBeGreaterThanOrEqual(2814);
    expect(cold.effectiveCapacity).toBeGreaterThanOrEqual(2814);
  });

  it('a hot climate needs more fans than a cold one for the same heat', () => {
    const hot = sizeAirCooling(368.55, HOT, AIR_FANS)!;
    const cold = sizeAirCooling(368.55, COLD, AIR_FANS)!;
    expect(hot.quantity).toBeGreaterThan(cold.quantity);
    expect(hot.required).toBeCloseTo(requiredAirflowM3h(368.55, HOT));
  });

  it('returns null for zero heat or an empty catalog', () => {
    expect(sizeHydroCooling(0, DEFAULT_CLIMATE, DRY_COOLERS)).toBeNull();
    expect(sizeAirCooling(100, DEFAULT_CLIMATE, [])).toBeNull();
  });

  it('prices CAPEX as hardware + deploy labor (+ plumbing for dry coolers)', () => {
    const sized = sizeHydroCooling(100, DEFAULT_CLIMATE, DRY_COOLERS, 30)!;
    const m = sized.model;
    expect(sized.capexUsd).toBeCloseTo(
      sized.quantity * (m.estimated_cost_usd + m.man_hours_deploy * 30 + m.plumbing_fluid_cost_usd),
    );
  });
});

describe('one sizing path: store, engine and Thermal tab agree', () => {
  it('the store auto-sizes with the same quantities as sizeHydroCooling at the site climate', () => {
    const store = useFarmStore.getState();
    store.addMiner({ miner: S21_HYD, quantity: 500 });
    store.updateTemperature({ location: HOT });
    const { config } = useFarmStore.getState();
    const direct = sizeHydroCooling(coolingHeatLoadKw(config, 'hydro'), HOT, DRY_COOLERS)!;
    expect(config.temperature!.dryCoolerSelections).toEqual([{ model: direct.model.model, quantity: direct.quantity }]);
    expect(getDryCoolerDeratingFactor(config)).toBeCloseTo(dryCoolerDeratingFactor(HOT.maxTempC));
  });

  it('the store auto-sizes fans to the airflow the engine reports as required', () => {
    const store = useFarmStore.getState();
    store.addMiner({ miner: S21_PRO, quantity: 100 });
    store.updateTemperature({ location: HOT });
    const { config } = useFarmStore.getState();
    const direct = sizeAirCooling(coolingHeatLoadKw(config, 'air'), HOT, AIR_FANS)!;
    expect(direct.required).toBeCloseTo(calculateVentilation(config).m3h);
    expect(config.temperature!.airFanSelections).toEqual([{ model: direct.model.model, quantity: direct.quantity }]);
  });

  it('picking a location re-sizes cooling (hot site → more dry coolers)', () => {
    const store = useFarmStore.getState();
    store.addMiner({ miner: S21_HYD, quantity: 500 });
    store.updateTemperature({ location: COLD });
    const coldQty = useFarmStore.getState().config.temperature!.dryCoolerSelections[0].quantity;
    store.updateTemperature({ location: HOT });
    const hotQty = useFarmStore.getState().config.temperature!.dryCoolerSelections[0].quantity;
    expect(hotQty).toBeGreaterThan(coldQty);
  });

  it('a manual quantity survives a location change, until the miners change or the user re-sizes', () => {
    const store = useFarmStore.getState();
    store.addMiner({ miner: S21_HYD, quantity: 500 });
    const model = useFarmStore.getState().config.temperature!.dryCoolerSelections[0].model;
    store.updateTemperature({ dryCoolerSelections: [{ model, quantity: 2 }] });
    expect(useFarmStore.getState().coolingOverridden).toBe(true);

    store.updateTemperature({ location: HOT });
    expect(useFarmStore.getState().config.temperature!.dryCoolerSelections).toEqual([{ model, quantity: 2 }]);

    store.resetCoolingToAuto();
    expect(useFarmStore.getState().coolingOverridden).toBe(false);
    expect(useFarmStore.getState().config.temperature!.dryCoolerSelections[0].quantity).toBeGreaterThan(2);

    store.updateTemperature({ dryCoolerSelections: [{ model, quantity: 2 }] });
    store.updateMinerQuantity(S21_HYD.id, 400);
    expect(useFarmStore.getState().coolingOverridden).toBe(false);
    expect(useFarmStore.getState().config.temperature!.dryCoolerSelections[0].quantity).toBeGreaterThan(2);
  });

  it('a hydro-only farm needs no ventilation fans and an air-only farm no dry coolers', () => {
    const hydroOnly = recommendCoolingSelections(
      { miners: [{ miner: S21_HYD, quantity: 10 }], parasiticLoadPercent: 5, temperature: undefined, labor: undefined as never },
      DRY_COOLERS,
      AIR_FANS,
    );
    expect(hydroOnly.airFanSelections).toEqual([]);
    expect(hydroOnly.dryCoolerSelections).toHaveLength(1);
  });
});
