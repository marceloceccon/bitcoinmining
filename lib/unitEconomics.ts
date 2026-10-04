/**
 * Spot mining economics at a market snapshot — the one revenue formula shared by
 * the forecast engine, the dashboard, the warnings and (later) MCP.
 */
import type { MarketSnapshot, Miner } from '@/types';
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

export interface MinerEconomicsInput {
  electricityPriceKwh: number;
  uptimePercent: number;
  poolFeePercent: number;
}

export interface MinerEconomics {
  revenuePerDayUsd: number;
  powerCostPerDayUsd: number;
  profitPerDayUsd: number;
  /** Electricity price at which the miner just breaks even, $/kWh */
  breakEvenKwh: number;
  /** Hardware price per TH/s */
  usdPerTh: number;
  /** Days of profit to repay the hardware at today's market; null if it doesn't profit */
  paybackDays: number | null;
}

/**
 * One miner's daily economics at today's market and your power price — the
 * miner comparison table and MCP compare_miners. Wall power only (no parasitic
 * load); power is drawn only while the miner is up.
 */
export function minerEconomics(
  miner: Pick<Miner, 'hash_rate_ths' | 'power_watts' | 'price_usd'>,
  market: Pick<MarketSnapshot, 'btcPriceUsd' | 'networkHashrateEh' | 'blockReward' | 'avgFeesPerBlockBtc'>,
  input: MinerEconomicsInput,
): MinerEconomics {
  const revenuePerDayUsd = dailyBtcMined(miner.hash_rate_ths, market, input) * market.btcPriceUsd;
  const kwhPerDay = (miner.power_watts / 1000) * 24 * (input.uptimePercent / 100);
  const powerCostPerDayUsd = kwhPerDay * input.electricityPriceKwh;
  const profitPerDayUsd = revenuePerDayUsd - powerCostPerDayUsd;
  return {
    revenuePerDayUsd,
    powerCostPerDayUsd,
    profitPerDayUsd,
    breakEvenKwh: kwhPerDay > 0 ? revenuePerDayUsd / kwhPerDay : 0,
    usdPerTh: miner.hash_rate_ths > 0 ? miner.price_usd / miner.hash_rate_ths : 0,
    paybackDays: profitPerDayUsd > 0 ? miner.price_usd / profitPerDayUsd : null,
  };
}
