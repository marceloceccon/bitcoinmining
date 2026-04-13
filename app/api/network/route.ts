import { NextResponse } from 'next/server';
import { fetchNetworkData } from '@/lib/networkData';
import type { NetworkData } from '@/lib/networkData';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { serverCache, CACHE_KEYS, CACHE_TTL } from '@/lib/serverCache';

// ── Response type ────────────────────────────────────────────────────

/** Live Bitcoin network statistics response. */
type NetworkDataResponse = {
  /** Current Bitcoin spot price in USD */
  btcPriceUsd: number;
  /** Total network hashrate in exahashes per second (EH/s) */
  networkHashrateEh: number;
  /** Current mining difficulty */
  difficulty: number;
  /** Current block subsidy reward in BTC (e.g. 3.125 after 2024 halving) */
  blockReward: number;
  /** Mining hashprice in USD per petahash per day ($/PH/day) */
  hashpriceUsdPhDay: number;
  /** ISO 8601 timestamp of when this data was last fetched */
  lastUpdated: string;
  /** Whether the data is from a live API call (true) or fallback estimates (false) */
  isLive: boolean;
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
 * @description Returns current Bitcoin network statistics including BTC price (USD), total network hashrate (EH/s), mining difficulty, block reward, and hashprice ($/PH/day). Data is sourced from mempool.space and CoinGecko with a 60-second server-side cache. Falls back to estimated values when APIs are unreachable.
 * @response NetworkDataResponse
 * @openapi
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const data = await serverCache.getOrLoad(
      CACHE_KEYS.networkData,
      CACHE_TTL.network,
      fetchNetworkData,
    );
    return NextResponse.json(serializeNetworkData(data), { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch network data', detail: String(err) },
      { status: 500, headers }
    );
  }
}
