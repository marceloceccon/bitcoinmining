import { NextResponse } from 'next/server';
import { getAirFans } from '@/lib/serverData';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { serverCache, CACHE_KEYS, CACHE_TTL } from '@/lib/serverCache';

/** A single industrial axial fan model with specs and costs. */
type AirFanItem = {
  /** Model name / identifier (e.g. "Multifan 6E63") */
  model: string;
  /** Fan blade diameter (mm) */
  diameter_mm: number;
  /** Motor frequency (Hz, typically 50 or 60) */
  hz: number;
  /** Rotational speed (revolutions per minute) */
  rpm: number;
  /** Maximum airflow capacity (m³/h) */
  airflow_m3h: number;
  /** Sound pressure level (dB at rated speed) */
  noise_db: number;
  /** Electrical power consumption (W) */
  power_w: number;
  /** Unit height including frame (mm) */
  height_mm: number;
  /** Unit width including frame (mm) */
  width_mm: number;
  /** Purchase cost per unit (USD) */
  cost_usd: number;
  /** Labor hours required for on-site deployment */
  man_hours_deploy: number;
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

/**
 * List all air cooling fan models
 * @description Returns the catalog of industrial axial fan models for air-cooled Bitcoin mining ventilation. Includes airflow capacity, power consumption, noise level, and deployment labor.
 * @response AirFanItem[]
 * @openapi
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const airFans = await serverCache.getOrLoad(
      CACHE_KEYS.airFans,
      CACHE_TTL.catalog,
      async () => getAirFans() satisfies AirFanItem[],
    );
    return NextResponse.json(airFans, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load air fan catalog', detail: String(err) },
      { status: 500, headers }
    );
  }
}
