/**
 * Golden-fixture cases: the 4 shipping presets run through the engine.
 *
 * Every engine change that moves a number must re-capture the fixtures
 * (`pnpm test:golden:update`) and explain the delta in the PR body.
 */
import dryCoolersJson from '@/data/dryCoolers.json';
import airFansJson from '@/data/airFans.json';
import { useFarmStore } from '@/lib/store';
import { PRESETS, resolvePresetMiners, type FarmPreset } from '@/lib/presets';
import type { AirFanModel, DryCoolerModel, FarmConfig, ForecastParams, MarketSnapshot } from '@/types';

export const GOLDEN_NOW = new Date('2026-10-03T00:00:00Z');

export const GOLDEN_BTC_PRICE = 84700;

/**
 * Frozen market snapshot (Appendix C, 2026-10-03). Deliberately not FALLBACK_MARKET,
 * which gets refreshed over time; changing this is an explained fixture delta.
 */
export const GOLDEN_MARKET: MarketSnapshot = {
  btcPriceUsd: GOLDEN_BTC_PRICE,
  networkHashrateEh: 964,
  blockHeight: 969763,
  blockReward: 3.125,
  avgFeesPerBlockBtc: 0.027,
  asOf: '2026-10-03T00:00:00.000Z',
  isLive: false,
  sources: ['golden fixture'],
};

/** The shipping presets (lib/presets.ts), resolved against data/miners.json. */
export const GOLDEN_PRESETS = PRESETS.map((p) => ({ slug: p.id, preset: p }));

/** The P1.9 investigation case: the pre-P2 Industrial preset (500 × S21 Hyd in containers). */
export const P19_INDUSTRIAL: FarmPreset = {
  id: 'industrial',
  name: 'Industrial (pre-P2)',
  description: '500 × S21 Hyd',
  miners: [{ minerId: 's21-hyd', quantity: 500 }],
  infrastructure: 'containers',
};

export const GOLDEN_FORECAST_PARAMS: ForecastParams = {
  months: 48,
  revenueMode: 'sell_opex',
  btcPriceModel: 'flat',
  networkHashrateGrowthPercent: 10,
  asicDegradationPercent: 4,
  discountRatePercent: 10,
};

/** Build a preset through the store, exactly as the UI does. */
export function buildGoldenConfig(preset: FarmPreset): FarmConfig {
  const store = useFarmStore.getState();
  store.setDryCoolerCatalog(dryCoolersJson as DryCoolerModel[]);
  store.setAirFanCatalog(airFansJson as AirFanModel[]);
  store.reset();
  for (const entry of resolvePresetMiners(preset)) store.addMiner(entry);
  store.updateInfrastructureType(preset.infrastructure);
  return structuredClone(useFarmStore.getState().config);
}
