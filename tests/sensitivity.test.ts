import { describe, it, expect } from 'vitest';
import { keyDrivers } from '@/lib/sensitivity';
import { buildPresetConfig, getPreset } from '@/lib/presets';
import { GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW } from './golden/cases';

describe('keyDrivers (tornado)', () => {
  const config = buildPresetConfig(getPreset('small-farm'));
  const result = keyDrivers(config, GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW);

  it('every driver has a downside below and an upside above the base NPV', () => {
    for (const d of result.drivers) {
      expect(d.low.npv, d.driver).toBeLessThan(result.baseNpv);
      expect(d.high.npv, d.driver).toBeGreaterThan(result.baseNpv);
    }
  });

  it('is sorted by swing, largest first', () => {
    const swings = result.drivers.map((d) => d.high.npv - d.low.npv);
    expect([...swings].sort((a, b) => b - a)).toEqual(swings);
  });

  it('BTC ±10% is symmetric for a linear revenue model', () => {
    const btc = result.drivers.find((d) => d.driver === 'BTC price')!;
    expect(btc.high.npv - result.baseNpv).toBeCloseTo(result.baseNpv - btc.low.npv, 0);
  });
});
