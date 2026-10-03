/**
 * Spot mining economics at a market snapshot — the one revenue formula shared by
 * the forecast engine, the dashboard, the warnings and (later) MCP.
 */
import type { MarketSnapshot } from '@/types';
import { BLOCKS_PER_DAY } from '@/lib/bitcoin';
import { DAYS_PER_MONTH } from '@/lib/calculations';

export interface MiningAssumptions {
  uptimePercent: number;
  poolFeePercent: number;
}

/**
 * BTC per day earned by `hashrateThs`: share of network hashrate × 144 blocks ×
 * (subsidy + fees per block), after uptime and pool fee.
 */
export function dailyBtcMined(
  hashrateThs: number,
  market: Pick<MarketSnapshot, 'networkHashrateEh' | 'blockReward' | 'avgFeesPerBlockBtc'>,
  farm: MiningAssumptions,
  feesPerBlockBtc: number = market.avgFeesPerBlockBtc,
): number {
  if (market.networkHashrateEh <= 0) return 0;
  const share = hashrateThs / 1e6 / market.networkHashrateEh;
  return (
    BLOCKS_PER_DAY *
    share *
    (market.blockReward + feesPerBlockBtc) *
    (farm.uptimePercent / 100) *
    (1 - farm.poolFeePercent / 100)
  );
}

/** BTC per average month (30.4375 days). */
export function monthlyBtcMined(
  hashrateThs: number,
  market: Pick<MarketSnapshot, 'networkHashrateEh' | 'blockReward' | 'avgFeesPerBlockBtc'>,
  farm: MiningAssumptions,
  feesPerBlockBtc?: number,
): number {
  return dailyBtcMined(hashrateThs, market, farm, feesPerBlockBtc) * DAYS_PER_MONTH;
}
