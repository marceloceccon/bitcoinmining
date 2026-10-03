/**
 * Golden-fixture cases: the 4 UI presets run through the engine exactly as the UI
 * builds them (store reset → catalogs → addMiner → infrastructure).
 *
 * Every engine change that moves a number must re-capture the fixtures
 * (`pnpm test:golden:update`) and explain the delta in the PR body.
 */
import minersJson from '@/data/miners.json';
import dryCoolersJson from '@/data/dryCoolers.json';
import airFansJson from '@/data/airFans.json';
import { useFarmStore } from '@/lib/store';
import type { AirFanModel, DryCoolerModel, FarmConfig, ForecastParams, InfrastructureType, MarketSnapshot, Miner } from '@/types';

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
  avgFeesPerBlockBtc: 0,
  asOf: '2026-10-03T00:00:00.000Z',
  isLive: false,
  sources: ['golden fixture'],
};

interface GoldenPreset {
  slug: string;
  miners: { id: string; quantity: number }[];
  infrastructure: InfrastructureType;
}

/** Mirrors components/FarmPresets.tsx as of 13068ae. */
export const GOLDEN_PRESETS: GoldenPreset[] = [
  { slug: 'home', miners: [{ id: 's21-pro', quantity: 2 }], infrastructure: 'racks' },
  { slug: 'garage', miners: [{ id: 's21-pro', quantity: 10 }], infrastructure: 'racks' },
  { slug: 'small-farm', miners: [{ id: 's21-pro', quantity: 100 }], infrastructure: 'containers' },
  { slug: 'industrial', miners: [{ id: 's21-hyd', quantity: 500 }], infrastructure: 'containers' },
];

/** The Projections tab defaults ("fixed" price model → final price = starting price). */
export const GOLDEN_FORECAST_PARAMS: ForecastParams = {
  months: 48,
  revenueMode: 'sell_opex',
  btcPriceModel: 'fixed',
  pessimisticAdjustPercent: -20,
  networkHashrateGrowthPercent: 10,
  asicDegradationPercent: 4,
  discountRatePercent: 10,
  startingBtcPrice: GOLDEN_BTC_PRICE,
  finalBtcPrice: GOLDEN_BTC_PRICE,
};

export function buildPresetConfig(preset: GoldenPreset): FarmConfig {
  const store = useFarmStore.getState();
  store.setDryCoolerCatalog(dryCoolersJson as DryCoolerModel[]);
  store.setAirFanCatalog(airFansJson as AirFanModel[]);
  store.reset();
  for (const { id, quantity } of preset.miners) {
    const miner = (minersJson as Miner[]).find((m) => m.id === id);
    if (!miner) throw new Error(`Golden preset ${preset.slug}: unknown miner id ${id}`);
    store.addMiner({ miner, quantity });
  }
  store.updateInfrastructureType(preset.infrastructure);
  return structuredClone(useFarmStore.getState().config);
}
