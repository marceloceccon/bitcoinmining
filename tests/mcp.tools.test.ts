import { describe, it, expect } from 'vitest';
import { runTool, type McpDeps } from '@/lib/mcp/tools';
import { withDerived } from '@/lib/networkData';
import { buildPresetConfig, getPreset } from '@/lib/presets';
import { computeFarmReport } from '@/lib/farmReport';
import { GOLDEN_MARKET, GOLDEN_NOW } from './golden/cases';
import type { LocationData } from '@/types';

const HOT: LocationData = { lat: 31.9, lng: -102.1, city: 'Midland', avgYearlyTempC: 19, maxTempC: 43, minTempC: -6, avgHumidityPercent: 45 };
const deps: McpDeps = {
  getMarket: async () => GOLDEN_MARKET,
  getNetwork: async () => withDerived(GOLDEN_MARKET, undefined, 7.5),
  getClimate: async () => HOT,
  now: () => GOLDEN_NOW,
};
const SMALL_FARM = { miners: [{ id: 's21-xp', quantity: 100 }], electricityPriceKwh: 0.05, infrastructure: 'containers' as const };

describe('MCP tools', () => {
  it('get_network_stats returns the snapshot, hashprice incl. fees and the next halving', async () => {
    const r = await runTool('get_network_stats', {}, deps);
    expect(r.isError).toBeUndefined();
    expect(r.structuredContent).toMatchObject({ market: { btcPriceUsd: 84700, networkHashrateEh: 964 }, nextHalving: { height: 1_050_000 }, hashrateGrowth12mPercent: 7.5 });
    expect(r.content[0].text.split('\n').length).toBeLessThanOrEqual(5);
  });

  it('list_miners hides announced models by default and filters', async () => {
    const all = await runTool('list_miners', { limit: 100 }, deps);
    const rows = (all.structuredContent!.miners as { status: string }[]);
    expect(rows.every((m) => m.status !== 'announced')).toBe(true);
    const home = await runTool('list_miners', { segment: 'home', sortBy: 'price' }, deps);
    expect((home.structuredContent!.miners as { segment: string }[]).every((m) => m.segment === 'home')).toBe(true);
  });

  it('get_miner returns provenance, and suggests ids for typos', async () => {
    const r = await runTool('get_miner', { id: 's21-xp' }, deps);
    expect(r.structuredContent!.miner).toMatchObject({ id: 's21-xp', price_basis: expect.any(String), spec_source: expect.any(String) });
    const bad = await runTool('get_miner', { id: 's21xp' }, deps);
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/Did you mean 's21-xp'/);
  });

  it('compare_miners ranks by profit and echoes the market', async () => {
    const r = await runTool('compare_miners', { electricityPriceKwh: 0.05, minerIds: ['s21-xp', 's19j-pro', 'm70s'] }, deps);
    const miners = r.structuredContent!.miners as { id: string; profitPerDayUsd: number }[];
    expect(miners.map((m) => m.id)).toHaveLength(3);
    expect(miners[0].profitPerDayUsd).toBeGreaterThanOrEqual(miners[2].profitPerDayUsd);
    expect((r.structuredContent!.assumptions as { market: unknown }).market).toEqual(GOLDEN_MARKET);
    const bad = await runTool('compare_miners', { electricityPriceKwh: 0.05, minerIds: ['nope-9000'] }, deps);
    expect(bad.isError).toBe(true);
  });

  it('calculate_farm(Small Farm) equals the UI engine output exactly', async () => {
    const r = await runTool('calculate_farm', SMALL_FARM, deps);
    const ui = computeFarmReport(buildPresetConfig(getPreset('small-farm')), GOLDEN_MARKET);
    expect(r.structuredContent!.metrics).toEqual(ui.metrics);
    expect(r.structuredContent!.revenue).toEqual(ui.revenue);
    expect((r.structuredContent!.assumptions as { market: unknown }).market).toEqual(GOLDEN_MARKET);
  });

  it('calculate_farm sizes cooling for a location (hot site → more fans than the default)', async () => {
    const atDefault = await runTool('calculate_farm', SMALL_FARM, deps);
    const hot = await runTool('calculate_farm', { ...SMALL_FARM, location: { lat: 31.9, lon: -102.1 } }, deps);
    const fans = (r: typeof hot) => ((r.structuredContent!.cooling as { airFans: { quantity: number }[] }).airFans[0].quantity);
    expect(fans(hot)).toBeGreaterThan(fans(atDefault));
    expect((hot.structuredContent!.assumptions as { climateSource: string }).climateSource).toMatch(/ERA5/);
  });

  it('calculate_farm rejects unknown ids with an actionable message', async () => {
    const r = await runTool('calculate_farm', { ...SMALL_FARM, miners: [{ id: 's21xp', quantity: 1 }] }, deps);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Unknown miner id 's21xp'. Did you mean 's21-xp'/);
  });

  it('forecast_farm returns yearly periods, the summary and its assumptions', async () => {
    const r = await runTool('forecast_farm', { ...SMALL_FARM, months: 36, priceScenario: { type: 'growth', annualGrowthPercent: -30 } }, deps);
    expect(r.isError).toBeUndefined();
    const years = r.structuredContent!.years as { year: number }[];
    expect(years.map((y) => y.year)).toEqual([1, 2, 3]);
    const a = r.structuredContent!.assumptions as { priceScenario: string; networkHashrateGrowthPercent: number };
    expect(a.priceScenario).toMatch(/^growth: −?-?30%\/yr/);
    expect(a.networkHashrateGrowthPercent).toBe(8); // trailing 7.5% → clamped/rounded default
  });

  it('size_cooling: a hot site derates dry coolers and needs more of them', async () => {
    const hot = await runTool('size_cooling', { cooling: 'hydro', heatLoadKw: 2800, location: { lat: 31.9, lon: -102.1 } }, deps);
    const mild = await runTool('size_cooling', { cooling: 'hydro', heatLoadKw: 2800, climate: { maxTempC: 28, avgHumidityPercent: 60 } }, deps);
    const qty = (r: typeof hot) => (r.structuredContent!.recommendation as { quantity: number }).quantity;
    expect(qty(hot)).toBeGreaterThan(qty(mild));
    expect(hot.structuredContent!.dryCoolerDeratingFactor).toBeCloseTo(0.76);
    const missing = await runTool('size_cooling', { cooling: 'air' }, deps);
    expect(missing.isError).toBe(true);
  });

  it('never throws raw errors: a failing dependency becomes an isError result', async () => {
    const broken: McpDeps = { ...deps, getMarket: async () => { throw new Error('upstream down'); } };
    const r = await runTool('compare_miners', { electricityPriceKwh: 0.05 }, broken);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/compare_miners failed: upstream down/);
  });
});
