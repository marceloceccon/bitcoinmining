/**
 * Production dependencies for the MCP tools: the cached live market snapshot
 * and an ERA5 climate lookup cached by rounded coordinates.
 */
import type { LocationData } from '@/types';
import { getCachedNetworkData, resolveMarket } from '@/lib/networkData';
import { fetchClimate, reverseGeocode } from '@/lib/climate';
import { serverCache } from '@/lib/serverCache';
import { SITE_URL } from '@/lib/site';
import type { McpDeps } from './tools';

/** Nominatim's policy asks clients to identify themselves. */
export const MCP_USER_AGENT = `MineForge/1.0 (+${SITE_URL}/mcp)`;
const CLIMATE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a year of ERA5 data changes once a year

export async function getClimateCached(lat: number, lon: number): Promise<LocationData> {
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  return serverCache.getOrLoad(`climate:${rLat}:${rLon}`, CLIMATE_TTL_MS, async () => {
    const [climate, city] = await Promise.all([
      fetchClimate(rLat, rLon, { userAgent: MCP_USER_AGENT }),
      reverseGeocode(rLat, rLon, { userAgent: MCP_USER_AGENT }),
    ]);
    return { lat: rLat, lng: rLon, city, ...climate };
  });
}

export const productionDeps: McpDeps = {
  getMarket: () => resolveMarket(),
  getNetwork: () => getCachedNetworkData(),
  getClimate: getClimateCached,
  now: () => new Date(),
};
