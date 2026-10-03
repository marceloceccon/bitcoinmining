import { NextResponse } from 'next/server';
import type { FarmConfig } from '@/types';
import { generateForecast } from '@/lib/forecasting';
import { getCachedNetworkData, toMarketSnapshot } from '@/lib/networkData';
import { corsHeaders, handleOptions } from '@/lib/cors';
import {
  validateFarmConfig,
  validateForecastParams,
  isWithinSizeLimit,
  MAX_REQUEST_BYTES,
} from '@/lib/validateFarmConfig';

// ── Request body type ────────────────────────────────────────────────

/** Parameters controlling the multi-year forecast simulation. */
type ForecastParamsBody = {
  /** Forecast duration in months — one of 12, 24, 36, 48, or 72 */
  months: 12 | 24 | 36 | 48 | 72;
  /** Revenue strategy: sell all BTC immediately, hold all BTC, or sell only enough to cover OPEX */
  revenueMode: "sell_all" | "hold_all" | "sell_opex";
  /** BTC price scenario (a choice, not a prediction): "flat" holds the starting price, "growth" compounds annualGrowthPercent per year, "target" is a straight line to finalBtcPrice at the last month. Removed values (stock_to_flow, stock_to_flow_pessimistic, fixed, custom) return 400 with validValues */
  btcPriceModel: "flat" | "growth" | "target";
  /** Annual BTC price change in percent for the growth scenario (e.g. 30 or -30). Required when btcPriceModel is "growth" */
  annualGrowthPercent?: number;
  /** BTC price in USD at the final month for the target scenario. Required when btcPriceModel is "target" */
  finalBtcPrice?: number | null;
  /** Starting BTC price override in USD. Defaults to the live market price */
  startingBtcPrice?: number;
  /** Annual network hashrate growth rate (percent, e.g. 25 for 25% YoY) */
  networkHashrateGrowthPercent: number;
  /** Annual ASIC performance degradation (percent, e.g. 5 for 5% YoY hashrate loss) */
  asicDegradationPercent: number;
  /** Annual discount rate for NPV / IRR calculations (percent, default 10) */
  discountRatePercent: number;
  /** Transaction fees per block in BTC. Defaults to the live average of the last 144 blocks */
  feesPerBlockBtc?: number;
};

/**
 * Request body for the forecast endpoint.
 *
 * NOTE: This type is referenced exclusively by the `@body ForecastBody` JSDoc
 * annotation that next-openapi-gen reads when generating openapi.json. Do not
 * delete it without removing the OpenAPI annotation above the POST handler.
 */
type ForecastBody = {
  /** Complete farm configuration (same shape as the /api/calculate body) */
  config: FarmConfig;
  /** Forecast simulation parameters */
  params: ForecastParamsBody;
};

// ── Response types ───────────────────────────────────────────────────

/** A single month in the forecast timeline. */
type ForecastPeriodResponse = {
  /** Month index (1-based) */
  month: number;
  /** ISO 8601 date string for this period */
  date: string;
  /** Projected BTC price in USD for this month */
  btcPrice: number;
  /** Projected total network hashrate in TH/s */
  networkHashrateThs: number;
  /** Projected mining difficulty */
  difficulty: number;
  /** Mean block subsidy over this month's block heights, BTC (block-weighted in the month a halving happens) */
  blockReward: number;
  /** Gross mining revenue in USD for this month */
  miningRevenueUsd: number;
  /** Electricity cost in USD for this month */
  electricityCostUsd: number;
  /** Total operating expenses in USD for this month */
  opexUsd: number;
  /** Net profit (revenue minus OPEX) in USD */
  profitUsd: number;
  /** BTC mined this month */
  btcMined: number;
  /** BTC sold this month (depends on revenueMode) */
  btcSold: number;
  /** Cumulative BTC balance held */
  btcBalance: number;
  /** Running total profit/loss in USD (includes CAPEX) */
  cumulativeProfitUsd: number;
  /** Return on investment to date (percent) */
  roi: number;
};

/** Summary statistics for the entire forecast horizon. */
type ForecastSummaryResponse = {
  /** Total mining revenue over the forecast (USD) */
  totalRevenue: number;
  /** Total costs including CAPEX and OPEX (USD) */
  totalCosts: number;
  /** Net profit over the full forecast horizon (USD) */
  totalProfit: number;
  /** BTC remaining in wallet at the end of the forecast */
  finalBtcBalance: number;
  /** Overall return on investment (percent) */
  roiPercent: number;
  /** Months until cumulative profit turns positive — null if never reached */
  paybackMonths: number | null;
  /** Internal rate of return (annualized, as a decimal) */
  irr: number;
  /** Net present value of all cash flows (USD) */
  npv: number;
  /** BTC price at which monthly mining revenue equals monthly OPEX (USD) */
  breakEvenBtcPrice: number;
  /** BTC price at which total revenue covers CAPEX + all OPEX (USD) */
  breakEvenBtcPriceWithCapex: number;
  /** Average hashprice over the forecast ($/PH/day) */
  avgHashpriceUsd: number;
  /** Total BTC mined over the full forecast */
  totalBtcMined: number;
};

/**
 * Full response from the forecast endpoint.
 *
 * Referenced by the `@response ForecastResponse` JSDoc annotation that
 * next-openapi-gen reads when generating openapi.json.
 */
type ForecastResponse = {
  /** Month-by-month forecast data */
  periods: ForecastPeriodResponse[];
  /** Total upfront capital expenditure (USD) */
  totalCapex: number;
  /** Aggregated forecast summary metrics */
  summary: ForecastSummaryResponse;
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

/**
 * Generate multi-year revenue forecast
 * @description Generates a month-by-month Bitcoin mining revenue forecast from the live market snapshot (network hashrate, block height, subsidy and fees per block), with a user-chosen BTC price scenario (flat, annual growth or target), network hashrate growth, ASIC degradation, energy inflation, and halvings computed from block height. Returns NPV, IRR, break-even BTC price, payback period, and cumulative profit/loss for each period. Supports three revenue strategies: sell all BTC, hold all BTC, or sell only enough to cover OPEX.
 * @body ForecastBody
 * @response ForecastResponse
 * @openapi
 */
export async function POST(request: Request) {
  const headers = corsHeaders(request);

  if (!isWithinSizeLimit(request.headers.get('content-length'))) {
    return NextResponse.json(
      { error: `Request body exceeds ${MAX_REQUEST_BYTES} bytes` },
      { status: 413, headers }
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers }
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400, headers }
    );
  }

  const { config: rawConfig, params: rawParams } = parsed as {
    config?: unknown;
    params?: unknown;
  };

  const configResult = validateFarmConfig(rawConfig);
  if (!configResult.ok) {
    return NextResponse.json(
      {
        error: configResult.error,
        field: configResult.field ? `config.${configResult.field}` : 'config',
      },
      { status: 400, headers }
    );
  }

  const paramsResult = validateForecastParams(rawParams);
  if (!paramsResult.ok) {
    return NextResponse.json(
      {
        error: paramsResult.error,
        field: paramsResult.field,
        ...(paramsResult.validValues ? { validValues: paramsResult.validValues } : {}),
      },
      { status: 400, headers }
    );
  }

  try {
    const market = toMarketSnapshot(await getCachedNetworkData());
    const result = generateForecast(configResult.value, paramsResult.value, market);

    // Serialize Date objects to ISO strings for clean JSON output
    const serialized = {
      ...result,
      periods: result.periods.map((p) => ({
        ...p,
        date: p.date instanceof Date ? p.date.toISOString() : p.date,
      })),
    };

    return NextResponse.json(serialized, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Forecast generation failed', detail: String(err) },
      { status: 500, headers }
    );
  }
}
