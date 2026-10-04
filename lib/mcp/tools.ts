/**
 * MineForge MCP tools. Every tool is read-only and calls the same pure engine
 * as the UI and the REST API — no duplicated math. Handlers are plain async
 * functions of (input, deps) so they can be unit-tested without a transport.
 */
import { z } from 'zod';
import type { FarmConfig, ForecastParams, LocationData, MarketSnapshot } from '@/types';
import type { NetworkData } from '@/lib/networkData';
import { MINERS, hardwarePricesAsOf } from '@/lib/catalog';
import { buildFarmConfig, suggestMinerIds, type FarmSpec } from '@/lib/farmSpec';
import { computeFarmReport } from '@/lib/farmReport';
import { generateForecast } from '@/lib/forecasting';
import { minerEconomics } from '@/lib/unitEconomics';
import { hashpriceUsdPerPhDay, nextHalving } from '@/lib/bitcoin';
import { coolingHeatLoadKw, DEFAULT_CLIMATE, dryCoolerDeratingFactor, requiredAirflowM3h, sizeAirCooling, sizeHydroCooling } from '@/lib/cooling';
import { AIR_FANS, DRY_COOLERS } from '@/lib/catalog';
import { defaultNetworkGrowthPercent } from '@/lib/networkData';
import { defaultConfig } from '@/lib/defaults';

export interface McpDeps {
  getMarket: () => Promise<MarketSnapshot>;
  getNetwork: () => Promise<NetworkData>;
  getClimate: (lat: number, lon: number) => Promise<LocationData>;
  now: () => Date;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;

function ok(summary: string[], data: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: summary.slice(0, 5).join('\n') }], structuredContent: data };
}

export function toolError(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// ── Schemas ──────────────────────────────────────────────────────────

const MarketSchema = z.looseObject({
  btcPriceUsd: z.number(),
  networkHashrateEh: z.number(),
  blockHeight: z.number(),
  blockReward: z.number(),
  avgFeesPerBlockBtc: z.number(),
  asOf: z.string(),
  isLive: z.boolean(),
  sources: z.array(z.string()),
});

const CoolingEnum = z.enum(['air', 'hydro', 'immersion']);
const SegmentEnum = z.enum(['industrial', 'home']);
const StatusEnum = z.enum(['current', 'legacy', 'announced']);

export const FarmSpecSchema = z.object({
  miners: z
    .array(z.object({ id: z.string().min(1).describe("Catalog id, e.g. 's21-xp' (see list_miners)"), quantity: z.number().int().min(1).max(100_000) }))
    .min(1)
    .max(50),
  electricityPriceKwh: z.number().min(0).max(2).describe('All-in electricity price, USD per kWh'),
  infrastructure: z.enum(['racks', 'containers']).optional().describe('Default: containers from 100 miners, racks below'),
  location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional().describe('Site; its ERA5 climate sizes cooling'),
  climate: z
    .object({ maxTempC: z.number().min(-40).max(60), avgHumidityPercent: z.number().min(0).max(100), avgYearlyTempC: z.number().optional(), minTempC: z.number().optional() })
    .optional()
    .describe('Use instead of location to give the design climate directly'),
  poolFeePercent: z.number().min(0).max(10).optional().describe('Default 2.5'),
  uptimePercent: z.number().min(50).max(100).optional().describe('Default 98'),
  parasiticLoadPercent: z.number().min(0).max(30).optional().describe('Overhead power for fans, networking, losses. Default 5'),
});

const PriceScenarioSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('flat') }),
  z.object({ type: z.literal('growth'), annualGrowthPercent: z.number().gt(-100).max(500).describe('e.g. 30 or -30') }),
  z.object({ type: z.literal('target'), finalBtcPrice: z.number().positive().describe('BTC price in USD at the last month') }),
]);

// ── Helpers ──────────────────────────────────────────────────────────

async function resolveClimate(spec: Pick<FarmSpec, 'location' | 'climate'>, deps: McpDeps): Promise<{ climate: LocationData | null; source: string }> {
  if (spec.climate) return { climate: null, source: 'provided climate' };
  if (spec.location) return { climate: await deps.getClimate(spec.location.lat, spec.location.lon), source: 'ERA5 reanalysis (Open-Meteo), previous calendar year' };
  return { climate: null, source: 'temperate default (max 35 °C, 60% humidity)' };
}

async function buildFromSpec(spec: FarmSpec, deps: McpDeps): Promise<{ config: FarmConfig; climateSource: string } | { error: string }> {
  const { climate, source } = await resolveClimate(spec, deps);
  const built = buildFarmConfig(spec, { climate });
  return built.ok ? { config: built.config, climateSource: source } : { error: built.error };
}

function minerRow(m: (typeof MINERS)[number]) {
  return {
    id: m.id,
    name: m.name,
    manufacturer: m.manufacturer,
    hashRateThs: m.hash_rate_ths,
    powerWatts: m.power_watts,
    efficiencyJth: m.efficiency_jth,
    cooling: m.cooling,
    status: m.status,
    segment: m.segment,
    priceUsd: m.price_usd,
    priceBasis: m.price_basis,
    priceAsOf: m.price_as_of,
  };
}

const MinerRowSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  hashRateThs: z.number(),
  powerWatts: z.number(),
  efficiencyJth: z.number(),
  priceUsd: z.number(),
  priceAsOf: z.string(),
});

const MinerFilterSchema = z.object({
  manufacturer: z.string().optional().describe('e.g. Bitmain, MicroBT, Canaan, Bitdeer'),
  cooling: CoolingEnum.optional(),
  segment: SegmentEnum.optional(),
  status: z.array(StatusEnum).optional().describe("Default ['current', 'legacy'] (announced = not yet shipping)"),
  maxEfficiencyJth: z.number().positive().optional(),
  minHashrateThs: z.number().nonnegative().optional(),
});

function filterMiners(f: z.infer<typeof MinerFilterSchema>) {
  const statuses = f.status ?? ['current', 'legacy'];
  return MINERS.filter(
    (m) =>
      statuses.includes(m.status) &&
      (!f.manufacturer || m.manufacturer.toLowerCase() === f.manufacturer.toLowerCase()) &&
      (!f.cooling || m.cooling === f.cooling) &&
      (!f.segment || m.segment === f.segment) &&
      (f.maxEfficiencyJth === undefined || m.efficiency_jth <= f.maxEfficiencyJth) &&
      (f.minHashrateThs === undefined || m.hash_rate_ths >= f.minHashrateThs),
  );
}

// ── Tool definitions ─────────────────────────────────────────────────

export const TOOLS = {
  get_network_stats: {
    title: 'Bitcoin network stats',
    description:
      'Live Bitcoin market snapshot used by every calculation: BTC price, network hashrate, tip height, block subsidy, average fees per block, hashprice ($/PH/day, including fees), the next halving and the trailing 12-month hashrate growth.',
    inputSchema: z.object({}),
    outputSchema: z.looseObject({
      market: MarketSchema,
      hashpriceUsdPhDay: z.number(),
      nextHalving: z.object({ height: z.number(), estimatedDate: z.string() }),
      hashrateGrowth12mPercent: z.number().nullable(),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (_input: Record<string, never>, deps: McpDeps): Promise<ToolResult> => {
      const net = await deps.getNetwork();
      const { difficulty: _d, hashpriceUsdPhDay, lastUpdated: _l, nextHalving: halving, hashrateGrowth12mPercent, ...market } = net;
      return ok(
        [
          `BTC ${usd(market.btcPriceUsd)} · ${market.networkHashrateEh.toFixed(0)} EH/s · hashprice $${hashpriceUsdPhDay.toFixed(2)}/PH/day (incl. fees)`,
          `Tip ${market.blockHeight.toLocaleString('en-US')}, subsidy ${market.blockReward} BTC + ${market.avgFeesPerBlockBtc.toFixed(4)} BTC fees/block`,
          `Next halving: block ${halving.height.toLocaleString('en-US')} ≈ ${halving.estimatedDate.slice(0, 10)}`,
          market.isLive ? `Live as of ${market.asOf}` : `Offline estimate (${market.asOf.slice(0, 10)})`,
        ],
        { market, hashpriceUsdPhDay, nextHalving: halving, hashrateGrowth12mPercent },
      );
    },
  },

  list_miners: {
    title: 'List ASIC miners',
    description: `List SHA-256 ASIC miners from the MineForge catalog with specs and prices (as of ${hardwarePricesAsOf()}). Filter by manufacturer, cooling, segment, status, efficiency and hashrate.`,
    inputSchema: MinerFilterSchema.extend({
      sortBy: z.enum(['efficiency', 'hashrate', 'price', 'pricePerTh']).optional().describe('Default efficiency (best first)'),
      limit: z.number().int().min(1).max(100).optional().describe('Default 20'),
    }),
    outputSchema: z.looseObject({ count: z.number(), total: z.number(), miners: z.array(MinerRowSchema) }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input: z.infer<typeof MinerFilterSchema> & { sortBy?: string; limit?: number }): Promise<ToolResult> => {
      const sorters: Record<string, (a: (typeof MINERS)[number], b: (typeof MINERS)[number]) => number> = {
        efficiency: (a, b) => a.efficiency_jth - b.efficiency_jth,
        hashrate: (a, b) => b.hash_rate_ths - a.hash_rate_ths,
        price: (a, b) => a.price_usd - b.price_usd,
        pricePerTh: (a, b) => a.price_usd / a.hash_rate_ths - b.price_usd / b.hash_rate_ths,
      };
      const all = filterMiners(input).sort(sorters[input.sortBy ?? 'efficiency']);
      const miners = all.slice(0, input.limit ?? 20).map(minerRow);
      return ok(
        [
          `${all.length} miners match; showing ${miners.length}.`,
          ...miners.slice(0, 3).map((m) => `${m.id}: ${m.name}, ${m.hashRateThs} TH/s, ${m.efficiencyJth} J/TH, ${usd(m.priceUsd)}`),
        ],
        { count: miners.length, total: all.length, miners },
      );
    },
  },

  get_miner: {
    title: 'Get one miner',
    description: 'Full catalog row for one miner, including price provenance (basis, date, source) and the spec source URL.',
    inputSchema: z.object({ id: z.string().min(1).describe("Catalog id, e.g. 's21-xp'") }),
    outputSchema: z.looseObject({ miner: z.looseObject({ id: z.string(), name: z.string() }) }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async ({ id }: { id: string }): Promise<ToolResult> => {
      const miner = MINERS.find((m) => m.id === id);
      if (!miner) {
        const s = suggestMinerIds(id);
        return toolError(`Unknown miner id '${id}'.${s.length ? ` Did you mean ${s.map((x) => `'${x}'`).join(' or ')}?` : ''} Use list_miners to see valid ids.`);
      }
      return ok(
        [`${miner.name} (${miner.manufacturer}): ${miner.hash_rate_ths} TH/s, ${miner.power_watts} W, ${miner.efficiency_jth} J/TH, ${miner.cooling}, ${miner.status}`, `Price ${usd(miner.price_usd)} (${miner.price_basis}, ${miner.price_as_of})`],
        { miner },
      );
    },
  },

  compare_miners: {
    title: 'Compare miner economics',
    description:
      "Daily revenue, power cost and profit per miner at your electricity price and today's market, plus break-even $/kWh, $/TH and simple payback. Pass minerIds, or filters (same as list_miners). Sorted by profit per day.",
    inputSchema: MinerFilterSchema.extend({
      electricityPriceKwh: z.number().min(0).max(2),
      minerIds: z.array(z.string()).max(50).optional(),
      poolFeePercent: z.number().min(0).max(10).optional().describe('Default 2.5'),
      uptimePercent: z.number().min(50).max(100).optional().describe('Default 98'),
      limit: z.number().int().min(1).max(100).optional().describe('Default 20'),
    }),
    outputSchema: z.looseObject({ miners: z.array(z.looseObject({ id: z.string(), profitPerDayUsd: z.number() })), assumptions: z.looseObject({ market: MarketSchema }) }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (
      input: z.infer<typeof MinerFilterSchema> & { electricityPriceKwh: number; minerIds?: string[]; poolFeePercent?: number; uptimePercent?: number; limit?: number },
      deps: McpDeps,
    ): Promise<ToolResult> => {
      let candidates = filterMiners(input);
      if (input.minerIds?.length) {
        const unknown = input.minerIds.filter((id) => !MINERS.some((m) => m.id === id));
        if (unknown.length) {
          const s = suggestMinerIds(unknown[0]);
          return toolError(`Unknown miner id '${unknown[0]}'.${s.length ? ` Did you mean ${s.map((x) => `'${x}'`).join(' or ')}?` : ''}`);
        }
        candidates = MINERS.filter((m) => input.minerIds!.includes(m.id));
      }
      const market = await deps.getMarket();
      const econInput = {
        electricityPriceKwh: input.electricityPriceKwh,
        poolFeePercent: input.poolFeePercent ?? defaultConfig.poolFeePercent,
        uptimePercent: input.uptimePercent ?? defaultConfig.uptimePercent,
      };
      const miners = candidates
        .map((m) => ({ ...minerRow(m), ...minerEconomics(m, market, econInput) }))
        .sort((a, b) => b.profitPerDayUsd - a.profitPerDayUsd)
        .slice(0, input.limit ?? 20);
      return ok(
        [
          `At $${input.electricityPriceKwh}/kWh and BTC ${usd(market.btcPriceUsd)} (${market.isLive ? 'live' : 'offline estimate'}):`,
          ...miners.slice(0, 3).map((m) => `${m.id}: ${usd(m.profitPerDayUsd)}/day profit, break-even $${m.breakEvenKwh.toFixed(3)}/kWh, payback ${m.paybackDays === null ? 'never' : `${Math.round(m.paybackDays)} d`}`),
        ],
        { miners, assumptions: { market, ...econInput, note: 'Wall power only; payback = price ÷ today’s profit/day (no difficulty growth, halvings or wear)' } },
      );
    },
  },

  calculate_farm: {
    title: 'Calculate a farm',
    description:
      'Engineer a farm from a FarmSpec: power, transformer kVA, cooling auto-sized at the site climate, itemized CAPEX, monthly OPEX and spot revenue/profit at the live market. Echoes the assumptions used.',
    inputSchema: FarmSpecSchema,
    outputSchema: z.looseObject({
      metrics: z.looseObject({ totalCapex: z.number(), monthlyOpex: z.number(), totalPowerKw: z.number(), transformerKva: z.number() }),
      revenue: z.looseObject({ monthlyRevenueUsd: z.number(), monthlyProfitUsd: z.number() }),
      cooling: z.looseObject({}),
      assumptions: z.looseObject({ market: MarketSchema }),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (spec: FarmSpec, deps: McpDeps): Promise<ToolResult> => {
      const built = await buildFromSpec(spec, deps);
      if ('error' in built) return toolError(built.error);
      const market = await deps.getMarket();
      const report = computeFarmReport(built.config, market);
      const m = report.metrics;
      return ok(
        [
          `${(report.totalHashRateThs / 1000).toFixed(2)} PH/s · ${report.totalPowerKw.toFixed(0)} kW · transformer ${m.transformerKva.toFixed(0)} kVA`,
          `CAPEX ${usd(m.totalCapex)} · OPEX ${usd(m.monthlyOpex)}/month`,
          `Revenue ${usd(report.revenue.monthlyRevenueUsd)}/month → profit ${usd(report.revenue.monthlyProfitUsd)}/month at BTC ${usd(market.btcPriceUsd)}`,
          `Cooling: ${[...(built.config.temperature?.dryCoolerSelections ?? []), ...(built.config.temperature?.airFanSelections ?? [])].map((s) => `${s.quantity} × ${s.model}`).join(', ') || 'none'} (${built.climateSource})`,
        ],
        {
          metrics: m,
          revenue: report.revenue,
          cooling: {
            dryCoolers: built.config.temperature?.dryCoolerSelections ?? [],
            airFans: built.config.temperature?.airFanSelections ?? [],
            ventilationM3h: report.ventilation.m3h,
            dryCoolerDeratingFactor: report.dryCoolerDeratingFactor,
            climate: report.climate,
          },
          assumptions: { market, climateSource: built.climateSource, infrastructure: built.config.infrastructureType, electricityPriceKwh: spec.electricityPriceKwh },
        },
      );
    },
  },

  forecast_farm: {
    title: 'Forecast a farm',
    description:
      'Multi-year forecast for a FarmSpec: halvings by block height, network growth (default: trailing 12-month rate clamped 0–60%), ASIC wear and a BTC price scenario you choose (flat, annual growth or target — scenarios, not predictions). Returns payback, IRR, NPV, break-even BTC price and yearly periods.',
    inputSchema: FarmSpecSchema.extend({
      months: z.union([z.literal(12), z.literal(24), z.literal(36), z.literal(48), z.literal(72)]).optional().describe('Default 48'),
      priceScenario: PriceScenarioSchema.optional().describe("Default { type: 'flat' }"),
      startingBtcPrice: z.number().positive().optional().describe('Default: live BTC price'),
      networkHashrateGrowthPercent: z.number().min(0).max(200).optional(),
      asicDegradationPercent: z.number().min(0).max(30).optional().describe('Default 4'),
      revenueMode: z.enum(['sell_all', 'hold_all', 'sell_opex']).optional().describe('Default sell_all'),
      discountRatePercent: z.number().min(0).max(50).optional().describe('Default 10'),
    }),
    outputSchema: z.looseObject({
      summary: z.looseObject({ npv: z.number(), irr: z.number().nullable(), paybackMonths: z.number().nullable(), breakEvenBtcPrice: z.number() }),
      years: z.array(z.looseObject({ year: z.number() })),
      totalCapex: z.number(),
      assumptions: z.looseObject({ market: MarketSchema }),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (
      input: FarmSpec & {
        months?: ForecastParams['months'];
        priceScenario?: z.infer<typeof PriceScenarioSchema>;
        startingBtcPrice?: number;
        networkHashrateGrowthPercent?: number;
        asicDegradationPercent?: number;
        revenueMode?: ForecastParams['revenueMode'];
        discountRatePercent?: number;
      },
      deps: McpDeps,
    ): Promise<ToolResult> => {
      const built = await buildFromSpec(input, deps);
      if ('error' in built) return toolError(built.error);
      const [market, net] = await Promise.all([deps.getMarket(), deps.getNetwork()]);
      const scenario = input.priceScenario ?? { type: 'flat' as const };
      const params: ForecastParams = {
        months: input.months ?? 48,
        revenueMode: input.revenueMode ?? 'sell_all',
        btcPriceModel: scenario.type,
        annualGrowthPercent: scenario.type === 'growth' ? scenario.annualGrowthPercent : undefined,
        finalBtcPrice: scenario.type === 'target' ? scenario.finalBtcPrice : null,
        startingBtcPrice: input.startingBtcPrice,
        networkHashrateGrowthPercent: input.networkHashrateGrowthPercent ?? defaultNetworkGrowthPercent(net.hashrateGrowth12mPercent),
        asicDegradationPercent: input.asicDegradationPercent ?? 4,
        discountRatePercent: input.discountRatePercent ?? 10,
      };
      const f = generateForecast(built.config, params, market, deps.now());
      let cumulative = -f.totalCapex;
      const years = [];
      for (let i = 0; i < f.periods.length; i += 12) {
        const chunk = f.periods.slice(i, i + 12);
        const revenueUsd = chunk.reduce((s, p) => s + p.miningRevenueUsd, 0);
        const opexUsd = chunk.reduce((s, p) => s + p.opexUsd, 0);
        cumulative += revenueUsd - opexUsd;
        years.push({
          year: i / 12 + 1,
          revenueUsd,
          opexUsd,
          cashFlowUsd: revenueUsd - opexUsd,
          cumulativeCashUsd: cumulative,
          btcMined: chunk.reduce((s, p) => s + p.btcMined, 0),
          avgBtcPriceUsd: chunk.reduce((s, p) => s + p.btcPrice, 0) / chunk.length,
          avgBlockReward: chunk.reduce((s, p) => s + p.blockReward, 0) / chunk.length,
        });
      }
      const s = f.summary;
      return ok(
        [
          `${params.months} months, ${f.assumptions.priceScenario}, network +${params.networkHashrateGrowthPercent}%/yr:`,
          `Break-even BTC ${usd(s.breakEvenBtcPrice)} (incl. CAPEX ${usd(s.breakEvenBtcPriceWithCapex)}) vs start ${usd(f.assumptions.startingBtcPrice)}`,
          `Payback ${s.paybackMonths === null ? `not within ${params.months} months` : `${s.paybackMonths} months`} · IRR ${s.irr === null ? 'n/a' : `${s.irr.toFixed(1)}%`} · NPV ${usd(s.npv)} at ${params.discountRatePercent}%`,
          `CAPEX ${usd(f.totalCapex)} · cash after OPEX ${usd(s.totalProfit)} · ${s.totalBtcMined.toFixed(3)} BTC mined`,
        ],
        {
          summary: s,
          years,
          totalCapex: f.totalCapex,
          assumptions: {
            ...f.assumptions,
            networkHashrateGrowthPercent: params.networkHashrateGrowthPercent,
            asicDegradationPercent: params.asicDegradationPercent,
            revenueMode: params.revenueMode,
            discountRatePercent: params.discountRatePercent,
            climateSource: built.climateSource,
          },
        },
      );
    },
  },

  size_cooling: {
    title: 'Size cooling for a site',
    description:
      'Size dry coolers (hydro/immersion) or exhaust fans (air) for a heat load at a site: design temperature, dry-cooler derating, the recommended model × quantity, fan power and CAPEX. Give location or climate, and heatLoadKw or a FarmSpec.',
    inputSchema: z.object({
      cooling: z.enum(['air', 'hydro']),
      location: FarmSpecSchema.shape.location,
      climate: FarmSpecSchema.shape.climate,
      heatLoadKw: z.number().positive().max(200_000).optional(),
      farm: FarmSpecSchema.optional().describe('Alternative to heatLoadKw: the heat of its miners of this cooling type'),
    }),
    outputSchema: z.looseObject({
      designMaxTempC: z.number(),
      recommendation: z.looseObject({ model: z.string(), quantity: z.number(), capexUsd: z.number() }).nullable(),
      assumptions: z.looseObject({ climateSource: z.string() }),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (
      input: { cooling: 'air' | 'hydro'; location?: FarmSpec['location']; climate?: FarmSpec['climate']; heatLoadKw?: number; farm?: FarmSpec },
      deps: McpDeps,
    ): Promise<ToolResult> => {
      const { climate: fetched, source } = await resolveClimate(input, deps);
      const climate = fetched ?? (input.climate ? { ...DEFAULT_CLIMATE, ...input.climate } : DEFAULT_CLIMATE);
      let heatKw = input.heatLoadKw;
      if (heatKw === undefined && input.farm) {
        const built = buildFarmConfig(input.farm, { climate: fetched });
        if (!built.ok) return toolError(built.error);
        heatKw = coolingHeatLoadKw(built.config, input.cooling);
      }
      if (!heatKw) return toolError('Give heatLoadKw, or a farm whose miners include this cooling type.');
      const sized = input.cooling === 'hydro' ? sizeHydroCooling(heatKw, climate, DRY_COOLERS) : sizeAirCooling(heatKw, climate, AIR_FANS);
      const recommendation = sized
        ? { model: sized.model.model, quantity: sized.quantity, required: sized.required, effectiveCapacity: sized.effectiveCapacity, powerKw: sized.powerKw, capexUsd: sized.capexUsd }
        : null;
      const derating = dryCoolerDeratingFactor(climate.maxTempC);
      return ok(
        [
          `Design max ${climate.maxTempC} °C, humidity ${climate.avgHumidityPercent}% (${source})`,
          input.cooling === 'hydro'
            ? `Dry coolers derated to ${(derating * 100).toFixed(0)}% of their 35 °C rating`
            : `Airflow needed: ${Math.round(requiredAirflowM3h(heatKw, climate)).toLocaleString('en-US')} m³/h`,
          recommendation ? `${recommendation.quantity} × ${recommendation.model} for ${heatKw.toFixed(0)} kW · ${usd(recommendation.capexUsd)} CAPEX · ${recommendation.powerKw.toFixed(1)} kW fans` : 'No recommendation',
        ],
        {
          designMaxTempC: climate.maxTempC,
          avgHumidityPercent: climate.avgHumidityPercent,
          heatLoadKw: heatKw,
          dryCoolerDeratingFactor: derating,
          requiredAirflowM3h: input.cooling === 'air' ? requiredAirflowM3h(heatKw, climate) : undefined,
          recommendation,
          assumptions: { climateSource: source, hourlyLaborCostUsd: 20 },
        },
      );
    },
  },
} as const;

export type ToolName = keyof typeof TOOLS;

/** Run a tool with an error boundary: never throw raw errors at the client. */
export async function runTool(name: ToolName, input: unknown, deps: McpDeps): Promise<ToolResult> {
  try {
    return await (TOOLS[name].handler as (i: any, d: McpDeps) => Promise<ToolResult>)(input, deps);
  } catch (err) {
    return toolError(`${name} failed: ${err instanceof Error ? err.message : String(err)}. Try again; if it persists, check the inputs.`);
  }
}
