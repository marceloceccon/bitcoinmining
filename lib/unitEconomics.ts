/**
 * Spot mining economics at a market snapshot — the one revenue formula shared by
 * the forecast engine, the dashboard, the warnings and (later) MCP.
 */
import type { MarketSnapshot } from '@/types';
import { BLOCKS_PER_DAY, hashpriceUsdPerPhDay } from '@/lib/bitcoin';
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

export interface SpotEconomics {
  dailyBtc: number;
  monthlyBtc: number;
  monthlyRevenueUsd: number;
  monthlyOpexUsd: number;
  monthlyProfitUsd: number;
  /** All-in monthly OPEX per BTC mined; null when nothing is mined */
  costPerBtcUsd: number | null;
  /** Network hashprice including fees, $/PH/day */
  hashpriceUsdPhDay: number;
}

/** A farm's revenue, OPEX and profit per month at today's market (no growth, degradation or halvings). */
export function calculateSpotEconomics(
  hashrateThs: number,
  monthlyOpexUsd: number,
  market: Pick<MarketSnapshot, 'btcPriceUsd' | 'networkHashrateEh' | 'blockReward' | 'avgFeesPerBlockBtc'>,
  farm: MiningAssumptions,
): SpotEconomics {
  const dailyBtc = dailyBtcMined(hashrateThs, market, farm);
  const monthlyBtc = dailyBtc * DAYS_PER_MONTH;
  const monthlyRevenueUsd = monthlyBtc * market.btcPriceUsd;
  return {
    dailyBtc,
    monthlyBtc,
    monthlyRevenueUsd,
    monthlyOpexUsd,
    monthlyProfitUsd: monthlyRevenueUsd - monthlyOpexUsd,
    costPerBtcUsd: monthlyBtc > 0 ? monthlyOpexUsd / monthlyBtc : null,
    hashpriceUsdPhDay: hashpriceUsdPerPhDay(market),
  };
}
