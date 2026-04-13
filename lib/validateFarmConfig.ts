import type { FarmConfig, ForecastParams } from '@/types';

/**
 * Runtime validators for the public API request bodies.
 *
 * Why this exists: `await request.json()` returns `unknown`, but the calculation
 * engine assumes a fully-shaped FarmConfig. Without this layer a malformed body
 * dives into the engine and explodes inside a destructure, which the route
 * surfaces as a generic 500. Validating here lets us return a precise 400 that
 * names the offending field.
 *
 * Scope: this is a *minimal* shape check, not a full schema validator. It guards
 * against the realistic failure modes — missing nested objects, wrong primitive
 * types, oversized arrays — without pulling in zod just for two endpoints.
 */

// Hard caps protect the synchronous calculation path from adversarial inputs.
// 100k miners is ~3000× the largest plausible real farm — anything beyond is abuse.
export const MAX_MINERS_ENTRIES = 1_000;
export const MAX_TOTAL_MINER_QUANTITY = 1_000_000;
export const MAX_REQUEST_BYTES = 256 * 1024; // 256 KB

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fail(error: string, field?: string): ValidationResult<never> {
  return { ok: false, error, field };
}

function validateMiner(raw: unknown, index: number): ValidationResult<true> {
  if (!isPlainObject(raw)) {
    return fail(`miners[${index}] must be an object`, `miners[${index}]`);
  }
  const { miner, quantity } = raw;
  if (!isPlainObject(miner)) {
    return fail(`miners[${index}].miner must be an object`, `miners[${index}].miner`);
  }
  if (!isFiniteNumber(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return fail(
      `miners[${index}].quantity must be a positive integer`,
      `miners[${index}].quantity`,
    );
  }

  // Required miner fields used by the calculation engine.
  const required: ReadonlyArray<[string, (v: unknown) => boolean]> = [
    ['id', (v) => typeof v === 'string' && v.length > 0],
    ['hash_rate_ths', (v) => isFiniteNumber(v) && v >= 0],
    ['power_watts', (v) => isFiniteNumber(v) && v >= 0],
    ['price_usd', (v) => isFiniteNumber(v) && v >= 0],
    ['watercooled', (v) => typeof v === 'boolean'],
  ];
  for (const [key, check] of required) {
    if (!check((miner as Record<string, unknown>)[key])) {
      return fail(
        `miners[${index}].miner.${key} is missing or invalid`,
        `miners[${index}].miner.${key}`,
      );
    }
  }
  return { ok: true, value: true };
}

const NESTED_OBJECT_FIELDS = [
  'electrical',
  'cooling',
  'solar',
  'regional',
  'labor',
  'importTax',
  'maintenanceLabor',
] as const;

const NUMERIC_TOP_FIELDS = [
  'parasiticLoadPercent',
  'uptimePercent',
  'poolFeePercent',
  'maintenanceOpexPercent',
] as const;

/**
 * Validates a parsed JSON body and asserts it is a usable FarmConfig.
 * Returns a discriminated union — never throws on bad input.
 */
export function validateFarmConfig(body: unknown): ValidationResult<FarmConfig> {
  if (!isPlainObject(body)) {
    return fail('Request body must be a JSON object');
  }

  if (!Array.isArray(body.miners)) {
    return fail('miners must be an array', 'miners');
  }
  if (body.miners.length > MAX_MINERS_ENTRIES) {
    return fail(
      `miners array exceeds ${MAX_MINERS_ENTRIES} entries`,
      'miners',
    );
  }

  let totalQuantity = 0;
  for (let i = 0; i < body.miners.length; i++) {
    const result = validateMiner(body.miners[i], i);
    if (!result.ok) return result;
    totalQuantity += (body.miners[i] as { quantity: number }).quantity;
    if (totalQuantity > MAX_TOTAL_MINER_QUANTITY) {
      return fail(
        `total miner quantity exceeds ${MAX_TOTAL_MINER_QUANTITY}`,
        'miners',
      );
    }
  }

  for (const key of NESTED_OBJECT_FIELDS) {
    if (!isPlainObject(body[key])) {
      return fail(`${key} must be an object`, key);
    }
  }

  for (const key of NUMERIC_TOP_FIELDS) {
    if (!isFiniteNumber(body[key])) {
      return fail(`${key} must be a finite number`, key);
    }
  }

  if (typeof body.payoutScheme !== 'string') {
    return fail('payoutScheme must be a string', 'payoutScheme');
  }
  if (typeof body.infrastructureType !== 'string') {
    return fail('infrastructureType must be a string', 'infrastructureType');
  }

  // `temperature` is optional and may be undefined or null; if present it must be an object.
  if (body.temperature != null && !isPlainObject(body.temperature)) {
    return fail('temperature must be an object when provided', 'temperature');
  }

  return { ok: true, value: body as unknown as FarmConfig };
}

const FORECAST_MONTHS = new Set([12, 24, 36, 48, 72]);
const REVENUE_MODES = new Set(['sell_all', 'hold_all', 'sell_opex']);
const PRICE_MODELS = new Set([
  'fixed',
  'stock_to_flow',
  'stock_to_flow_pessimistic',
  'custom',
]);

/**
 * Validates the params half of a /api/forecast request body.
 */
export function validateForecastParams(
  body: unknown,
): ValidationResult<ForecastParams> {
  if (!isPlainObject(body)) {
    return fail('params must be a JSON object', 'params');
  }
  if (!isFiniteNumber(body.months) || !FORECAST_MONTHS.has(body.months)) {
    return fail('params.months must be one of 12, 24, 36, 48, 72', 'params.months');
  }
  if (typeof body.revenueMode !== 'string' || !REVENUE_MODES.has(body.revenueMode)) {
    return fail(
      'params.revenueMode must be sell_all, hold_all, or sell_opex',
      'params.revenueMode',
    );
  }
  if (typeof body.btcPriceModel !== 'string' || !PRICE_MODELS.has(body.btcPriceModel)) {
    return fail(
      'params.btcPriceModel must be fixed, stock_to_flow, stock_to_flow_pessimistic, or custom',
      'params.btcPriceModel',
    );
  }
  const numericFields: ReadonlyArray<keyof ForecastParams> = [
    'pessimisticAdjustPercent',
    'networkHashrateGrowthPercent',
    'asicDegradationPercent',
    'discountRatePercent',
    'startingBtcPrice',
  ];
  for (const key of numericFields) {
    if (!isFiniteNumber(body[key as string])) {
      return fail(`params.${key} must be a finite number`, `params.${key}`);
    }
  }
  if (body.finalBtcPrice !== null && !isFiniteNumber(body.finalBtcPrice)) {
    return fail('params.finalBtcPrice must be a number or null', 'params.finalBtcPrice');
  }
  return { ok: true, value: body as unknown as ForecastParams };
}

/**
 * Returns true if the request body is small enough to safely parse and process.
 * Rejecting at the boundary protects the synchronous calculation path from
 * memory pressure and pathological JSON parses.
 */
export function isWithinSizeLimit(contentLength: string | null): boolean {
  if (!contentLength) return true; // unknown size — let request.json() decide
  const n = Number(contentLength);
  if (!Number.isFinite(n) || n < 0) return false;
  return n <= MAX_REQUEST_BYTES;
}
