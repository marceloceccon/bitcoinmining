import { NextResponse } from 'next/server';
import { getCachedNetworkData } from '@/lib/networkData';
import type { NetworkData } from '@/lib/networkData';
import { corsHeaders, handleOptions } from '@/lib/cors';

// ── Response type ────────────────────────────────────────────────────

/** Next halving estimate. */
type NextHalving = {
  /** Block height of the next halving */
  height: number;
  /** ISO 8601 estimate at 10 minutes per block from the current tip */
  estimatedDate: string;
};

/** Live Bitcoin market snapshot (the same values the calculators use). */
type NetworkDataResponse = {
  /** Current Bitcoin spot price in USD */
  btcPriceUsd: number;
  /** Total network hashrate in exahashes per second (EH/s) */
  networkHashrateEh: number;
  /** Chain tip height */
  blockHeight: number;
  /** Block subsidy at the tip, BTC (50 / 2^floor(height / 210000)) */
  blockReward: number;
  /** Average transaction fees per block over the last 144 blocks, BTC */
  avgFeesPerBlockBtc: number;
  /** Current mining difficulty */
  difficulty: number;
  /** Hashprice in USD per petahash per day ($/PH/day), including transaction fees */
  hashpriceUsdPhDay: number;
  /** Next halving height and estimated date */
  nextHalving: NextHalving;
  /** ISO 8601 timestamp of when this snapshot was taken */
  asOf: string;
  /** Same as asOf (kept for backward compatibility) */
  lastUpdated: string;
  /** true when price, hashrate and tip height all came from live sources; false = offline estimate */
  isLive: boolean;
  /** Where each value came from */
  sources: string[];
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

function serializeNetworkData(data: NetworkData) {
  return {
    ...data,
    lastUpdated:
      data.lastUpdated instanceof Date
        ? data.lastUpdated.toISOString()
        : data.lastUpdated,
  };
}

/**
 * Get live Bitcoin network data
 * @description Returns the live Bitcoin market snapshot used by every calculation: BTC price (USD), network hashrate (EH/s), chain tip height, block subsidy, average fees per block, difficulty, hashprice including fees ($/PH/day) and the next halving estimate. Sourced from mempool.space (CoinGecko as a price backup) with a 60-second server-side cache. When sources are unreachable, values fall back to a dated offline estimate and isLive is false.
 * @response NetworkDataResponse
 * @openapi
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const data = await getCachedNetworkData();
    return NextResponse.json(serializeNetworkData(data), { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch network data', detail: String(err) },
      { status: 500, headers }
    );
  }
}
