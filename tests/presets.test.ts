import { describe, it, expect } from 'vitest';
import { DEFAULT_PRESET_ID, PRESETS, buildPresetConfig, getPreset, resolvePresetMiners } from '@/lib/presets';
import { computeFarmReport } from '@/lib/farmReport';
import { generateForecast } from '@/lib/forecasting';
import { FALLBACK_MARKET } from '@/lib/networkData';
import { useFarmStore } from '@/lib/store';
import { MINERS } from '@/lib/catalog';

// "Today's market" for the profitability check: the dated 2026-10-03 snapshot.
const MARKET = FALLBACK_MARKET;

describe('presets', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('%s resolves every miner id from the catalog', (_id, preset) => {
    const miners = resolvePresetMiners(preset);
    expect(miners.length).toBe(preset.miners.length);
    for (const { miner } of miners) expect(MINERS).toContain(miner);
  });

  it.each(PRESETS.map((p) => [p.id, p] as const))('%s is profitable at the default $0.05/kWh at today\'s market', (_id, preset) => {
    const config = buildPresetConfig(preset);
    expect(config.regional.electricityPriceKwh).toBe(0.05);
    const report = computeFarmReport(config, MARKET);
    expect(report.revenue.monthlyProfitUsd).toBeGreaterThan(0);
  });

  // The single home unit is OPEX-positive today but turns cash-negative after the
  // 2028 halving at a flat price, so this check covers the farm presets only.
  it.each(PRESETS.filter((p) => p.id !== 'home').map((p) => [p.id, p] as const))('%s: a flat-price 48-month forecast stays cash-positive after OPEX', (_id, preset) => {
    const config = buildPresetConfig(preset);
    const forecast = generateForecast(
      config,
      { months: 48, revenueMode: 'sell_all', btcPriceModel: 'flat', networkHashrateGrowthPercent: 0, asicDegradationPercent: 4, discountRatePercent: 10 },
      MARKET,
      new Date(MARKET.asOf),
    );
    expect(forecast.summary.totalProfit).toBeGreaterThan(0);
  });

  it('the home preset needs no transformer; the industrial preset is hydro-cooled', () => {
    const home = computeFarmReport(buildPresetConfig(getPreset('home')), MARKET);
    expect(home.metrics.transformerCost).toBe(0);
    const industrial = buildPresetConfig(getPreset('industrial'));
    expect(industrial.miners.every(({ miner }) => miner.watercooled)).toBe(true);
    expect(industrial.temperature!.dryCoolerSelections.length).toBe(1);
  });

  it('a fresh visit loads the Small Farm preset, and applyPreset replaces the farm', () => {
    expect(DEFAULT_PRESET_ID).toBe('small-farm');
    const store = useFarmStore.getState();
    store.applyPreset('industrial');
    expect(useFarmStore.getState().config).toEqual(buildPresetConfig(getPreset('industrial')));
    store.applyPreset('small-farm');
    expect(useFarmStore.getState().config).toEqual(buildPresetConfig(getPreset(DEFAULT_PRESET_ID)));
  });

  it('throws a clear error for an unknown miner id', () => {
    expect(() => resolvePresetMiners({ ...getPreset('garage'), miners: [{ minerId: 'nope', quantity: 1 }] })).toThrow(
      /unknown miner id nope/,
    );
  });
});
