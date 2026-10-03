/**
 * Bitcoin chain arithmetic. Pure: every input (height, time) is a parameter.
 */

export const BLOCKS_PER_DAY = 144;
export const HALVING_INTERVAL = 210_000;
export const INITIAL_SUBSIDY_BTC = 50;
export const TARGET_BLOCK_MINUTES = 10;

/** Block subsidy at `height`, BTC: 50 / 2^floor(height / 210,000); 0 after 64 halvings. */
export function subsidyAtHeight(height: number): number {
  const halvings = Math.floor(Math.max(0, height) / HALVING_INTERVAL);
  return halvings >= 64 ? 0 : INITIAL_SUBSIDY_BTC / 2 ** halvings;
}

/** Height of the first halving after `height` (1,050,000 for any height in [840,000, 1,050,000)). */
export function nextHalvingHeight(height: number): number {
  return (Math.floor(Math.max(0, height) / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
}

/**
 * Mean subsidy per block over heights [fromHeight, toHeight), BTC.
 * A range that straddles a halving is weighted by the blocks on each side.
 */
export function averageSubsidy(fromHeight: number, toHeight: number): number {
  if (toHeight <= fromHeight) return subsidyAtHeight(fromHeight);
  let total = 0;
  let height = fromHeight;
  while (height < toHeight) {
    const end = Math.min(nextHalvingHeight(height), toHeight);
    total += (end - height) * subsidyAtHeight(height);
    height = end;
  }
  return total / (toHeight - fromHeight);
}

/** Estimated time block `targetHeight` is mined, assuming `avgBlockMinutes` per block from `tipHeight` at `now`. */
export function estimateHalvingDate(
  targetHeight: number,
  tipHeight: number,
  now: Date,
  avgBlockMinutes = TARGET_BLOCK_MINUTES,
): Date {
  return new Date(now.getTime() + (targetHeight - tipHeight) * avgBlockMinutes * 60_000);
}

/** Next halving `{ height, estimatedDate }` as seen from the chain tip at `now`. */
export function nextHalving(tipHeight: number, now: Date): { height: number; estimatedDate: string } {
  const height = nextHalvingHeight(tipHeight);
  return { height, estimatedDate: estimateHalvingDate(height, tipHeight, now).toISOString() };
}

/**
 * Hashprice in USD per PH/s per day, **including** transaction fees:
 * 144 × (subsidy + fees) × price / (network EH/s × 1000 PH/EH).
 */
export function hashpriceUsdPerPhDay(market: {
  btcPriceUsd: number;
  networkHashrateEh: number;
  blockReward: number;
  avgFeesPerBlockBtc: number;
}): number {
  if (market.networkHashrateEh <= 0) return 0;
  const dailyBtc = BLOCKS_PER_DAY * (market.blockReward + market.avgFeesPerBlockBtc);
  return (dailyBtc * market.btcPriceUsd) / (market.networkHashrateEh * 1000);
}
