/**
 * The agent-facing farm description: miners by catalog id plus a handful of
 * settings, resolved into a full FarmConfig with the same defaults and cooling
 * auto-sizing the UI uses. Used by the MCP tools.
 */
import type { FarmConfig, InfrastructureType, LocationData, Miner } from '@/types';
import { AIR_FANS, DRY_COOLERS, MINERS } from '@/lib/catalog';
import { recommendCoolingSelections } from '@/lib/cooling';
import { defaultConfig } from '@/lib/defaults';

export interface FarmSpec {
  miners: { id: string; quantity: number }[];
  electricityPriceKwh: number;
  infrastructure?: InfrastructureType;
  location?: { lat: number; lon: number };
  climate?: { maxTempC: number; avgHumidityPercent: number; avgYearlyTempC?: number; minTempC?: number };
  poolFeePercent?: number;
  uptimePercent?: number;
  parasiticLoadPercent?: number;
}

/** Farms this size and larger default to containers rather than open racks. */
export const CONTAINER_DEFAULT_FROM_MINERS = 100;

export type BuildResult = { ok: true; config: FarmConfig } | { ok: false; error: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Up to 3 catalog ids that look like `id` (normalized match, substring, then edit distance). */
export function suggestMinerIds(id: string, catalog: Miner[] = MINERS): string[] {
  const target = norm(id);
  const scored = catalog
    .map((m) => {
      const n = norm(m.id);
      const nameN = norm(m.name);
      const score =
        n === target || nameN === target ? 0 : n.includes(target) || target.includes(n) || nameN.includes(target) ? 1 : 2 + levenshtein(target, n);
      return { id: m.id, score };
    })
    .filter((s) => s.score <= 5)
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, 3).map((s) => s.id);
}

/**
 * Resolve a FarmSpec against the catalog. Unknown miner ids fail with
 * suggestions. `climate` (already resolved, e.g. from `location`) wins over the
 * temperate default; cooling is auto-sized for it.
 */
export function buildFarmConfig(spec: FarmSpec, opts: { catalog?: Miner[]; climate?: LocationData | null } = {}): BuildResult {
  const catalog = opts.catalog ?? MINERS;
  const miners = [];
  for (const { id, quantity } of spec.miners) {
    const miner = catalog.find((m) => m.id === id);
    if (!miner) {
      const suggestions = suggestMinerIds(id, catalog);
      return {
        ok: false,
        error: `Unknown miner id '${id}'.${suggestions.length ? ` Did you mean ${suggestions.map((s) => `'${s}'`).join(' or ')}?` : ''} Use list_miners to see valid ids.`,
      };
    }
    miners.push({ miner, quantity });
  }
  const totalMiners = miners.reduce((n, m) => n + m.quantity, 0);
  const location: LocationData | null =
    opts.climate ??
    (spec.climate
      ? {
          lat: spec.location?.lat ?? 0,
          lng: spec.location?.lon ?? 0,
          city: 'Provided climate',
          avgYearlyTempC: spec.climate.avgYearlyTempC ?? spec.climate.maxTempC - 12,
          maxTempC: spec.climate.maxTempC,
          minTempC: spec.climate.minTempC ?? spec.climate.maxTempC - 30,
          avgHumidityPercent: spec.climate.avgHumidityPercent,
        }
      : null);

  const config: FarmConfig = {
    ...defaultConfig,
    miners,
    infrastructureType: spec.infrastructure ?? (totalMiners >= CONTAINER_DEFAULT_FROM_MINERS ? 'containers' : 'racks'),
    regional: { ...defaultConfig.regional, electricityPriceKwh: spec.electricityPriceKwh },
    poolFeePercent: spec.poolFeePercent ?? defaultConfig.poolFeePercent,
    uptimePercent: spec.uptimePercent ?? defaultConfig.uptimePercent,
    parasiticLoadPercent: spec.parasiticLoadPercent ?? defaultConfig.parasiticLoadPercent,
    temperature: { location, dryCoolerSelections: [], airFanSelections: [] },
  };
  return {
    ok: true,
    config: { ...config, temperature: { location, ...recommendCoolingSelections(config, DRY_COOLERS, AIR_FANS) } },
  };
}
