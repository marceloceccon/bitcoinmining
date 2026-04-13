import { NextResponse } from 'next/server';
import { getDryCoolers } from '@/lib/serverData';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { serverCache, CACHE_KEYS, CACHE_TTL } from '@/lib/serverCache';

/** A single dry cooler model with capacity ratings, dimensions, and costs. */
type DryCoolerItem = {
  /** Model name / identifier (e.g. "Alfa Laval Arctigo ID 45") */
  model: string;
  /** Heat rejection capacity at 35 °C ambient (kW) */
  kw_capacity_35c: number;
  /** Water flow rate (m³/h) */
  water_flow_m3h: number;
  /** Water-side pressure drop (kPa) */
  pressure_drop_kpa: number;
  /** Air flow rate through the unit (m³/h) */
  air_flow_m3h: number;
  /** Fan motor power consumption (W) */
  fan_motor_w: number;
  /** Fan motor current draw (A) */
  fan_motor_a: number;
  /** Sound pressure level (dBA at 10 m) */
  sound_dba: number;
  /** Unit length (mm) */
  length_mm: number;
  /** Unit width (mm) */
  width_mm: number;
  /** Unit height (mm) */
  height_mm: number;
  /** Inlet pipe diameter (mm, as string e.g. "DN80") */
  inlet_mm: string;
  /** Dry weight (kg) */
  weight_kg: number;
  /** Estimated purchase cost (USD) */
  estimated_cost_usd: number;
  /** Labor hours required for on-site deployment */
  man_hours_deploy: number;
  /** Plumbing and glycol fluid cost (USD) */
  plumbing_fluid_cost_usd: number;
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

/**
 * List all dry cooler models
 * @description Returns the catalog of industrial dry cooler models for hydro-cooled Bitcoin mining farms. Includes capacity ratings at 35°C ambient, physical dimensions, noise levels, and deployment costs.
 * @response DryCoolerItem[]
 * @openapi
 */
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const dryCoolers = await serverCache.getOrLoad(
      CACHE_KEYS.dryCoolers,
      CACHE_TTL.catalog,
      async () => getDryCoolers() satisfies DryCoolerItem[],
    );
    return NextResponse.json(dryCoolers, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load dry cooler catalog', detail: String(err) },
      { status: 500, headers }
    );
  }
}
