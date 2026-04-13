import { NextResponse } from 'next/server';
import { getUpdates } from '@/lib/serverData';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { serverCache, CACHE_KEYS, CACHE_TTL } from '@/lib/serverCache';

/** Metadata about when a specific hardware catalog was last refreshed. */
type CatalogUpdate = {
  /** ISO 8601 timestamp of the last data update */
  lastUpdated: string;
  /** Human-readable note describing what changed */
  note: string;
};

/** Response containing update timestamps for each hardware catalog. */
type UpdatesResponse = {
  /** Last update info for the ASIC miner catalog */
  miners: CatalogUpdate;
  /** Last update info for the dry cooler catalog */
  dryCoolers: CatalogUpdate;
  /** Last update info for the air fan catalog */
  airFans: CatalogUpdate;
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

/**
 * Get data update timestamps
 * @description Returns the last update timestamps for all hardware catalogs (miners, dry coolers, air fans). Use this to check data freshness before making calculation requests.
 * @response UpdatesResponse
 * @openapi
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const updates = await serverCache.getOrLoad(
      CACHE_KEYS.updates,
      CACHE_TTL.catalog,
      async () => getUpdates(),
    );
    return NextResponse.json(updates, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load update timestamps', detail: String(err) },
      { status: 500, headers }
    );
  }
}
