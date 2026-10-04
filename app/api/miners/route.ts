import { NextResponse } from 'next/server';
import { getMiners } from '@/lib/catalog';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { serverCache, CACHE_KEYS, CACHE_TTL } from '@/lib/serverCache';

/** A single ASIC miner model from the database */
type MinerResponse = {
  id: string; // Unique miner identifier, e.g. "s21-pro"
  name: string; // Human-readable model name, e.g. "Antminer S21 Pro"
  manufacturer: string; // Manufacturer name: Bitmain, MicroBT, Canaan, etc.
  algorithm: string; // Mining algorithm, always "SHA-256" for Bitcoin
  hash_rate_ths: number; // Hash rate in terahashes per second (TH/s)
  power_watts: number; // Power consumption in watts
  price_usd: number; // Approximate market price in USD
  efficiency_jth: number; // Energy efficiency in joules per terahash (J/TH), lower is better
  release_year: number; // Year the model was released
  watercooled: boolean; // Whether the miner needs liquid cooling (hydro or immersion); equals cooling !== "air"
  degradation_year1: number; // Annual hashrate degradation % in year 1
  degradation_year2: number; // Annual hashrate degradation % in year 2
  degradation_year3plus: number; // Annual hashrate degradation % in year 3+
  cooling: "air" | "hydro" | "immersion"; // Cooling method
  status: "current" | "legacy" | "announced"; // current = shipping, legacy = pre-2023 or superseded, announced = not yet shipping
  segment: "industrial" | "home"; // Market segment
  price_basis: "new" | "used" | "index"; // How price_usd was obtained: shop/reseller new price, used-market listings, or $/TH index band x TH/s
  price_as_of: string; // ISO date the price was observed
  price_source: string; // URL or index band the price came from
  spec_source: string; // URL of the manufacturer/spec page
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

/**
 * List all ASIC miners
 * @description Returns the complete catalog of Bitcoin ASIC mining hardware (industrial and home units) with specs, pricing and degradation curves. Every row carries its price provenance (price_basis, price_as_of, price_source) and a spec_source URL; status marks current, legacy and announced (not yet shipping) models. Check GET /updates for the last refresh date.
 * @response MinerResponse[]
 * @openapi
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const miners = await serverCache.getOrLoad(
      CACHE_KEYS.miners,
      CACHE_TTL.catalog,
      async () => getMiners(),
    );
    return NextResponse.json(miners, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load miner catalog', detail: String(err) },
      { status: 500, headers }
    );
  }
}
