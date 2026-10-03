"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart, LineChart, Line, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Bitcoin, ChevronDown, ChevronUp, Activity } from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Slider from "./ui/Slider";
import HelpTooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { generateForecast, scenarioBtcPrice } from "@/lib/forecasting";
import { DEFAULT_NETWORK_GROWTH_PERCENT, defaultNetworkGrowthPercent, toMarketSnapshot } from "@/lib/networkData";
import { useForecast, useMarket } from "@/lib/apiClient";
import { formatUsd, formatBtc, formatDate, formatPercent } from "@/lib/utils";
import type { FarmConfig, ForecastParams, ForecastPeriod } from "@/types";

/** Compact USD formatter for chart axis ticks */
function tickUsd(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function tickBtcPrice(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(210,218,230,0.7)",
    borderRadius: "16px",
    fontSize: "13px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
  },
};

type Granularity = "monthly" | "quarterly" | "yearly";

interface AggregatedRow {
  label: string;
  btcMined: number;
  btcSold: number;
  revenue: number;
  opex: number;
  capex: number;
  netCashFlow: number;
  cumulativeCash: number;
  btcBalance: number;
}

function aggregatePeriods(
  periods: ForecastPeriod[],
  granularity: Granularity,
  totalCapex: number
): AggregatedRow[] {
  if (granularity === "monthly") {
    let cumCash = -totalCapex;
    return periods.map((p, i) => {
      const capex = i === 0 ? totalCapex : 0;
      const net = p.miningRevenueUsd - p.opexUsd - capex;
      cumCash += p.miningRevenueUsd - p.opexUsd;
      return {
        label: formatDate(new Date(p.date)),
        btcMined: p.btcMined,
        btcSold: p.btcSold,
        revenue: p.miningRevenueUsd,
        opex: p.opexUsd,
        capex,
        netCashFlow: net,
        cumulativeCash: cumCash,
        btcBalance: p.btcBalance,
      };
    });
  }

  const groupSize = granularity === "quarterly" ? 3 : 12;
  const groups: AggregatedRow[] = [];
  let cumCash = -totalCapex;

  for (let i = 0; i < periods.length; i += groupSize) {
    const chunk = periods.slice(i, i + groupSize);
    const capex = i === 0 ? totalCapex : 0;
    const revenue = chunk.reduce((s, p) => s + p.miningRevenueUsd, 0);
    const opex = chunk.reduce((s, p) => s + p.opexUsd, 0);
    const btcMined = chunk.reduce((s, p) => s + p.btcMined, 0);
    const btcSold = chunk.reduce((s, p) => s + p.btcSold, 0);
    cumCash += revenue - opex;
    const last = chunk[chunk.length - 1];

    const startDate = new Date(chunk[0].date);
    let label: string;
    if (granularity === "quarterly") {
      const q = Math.floor(startDate.getMonth() / 3) + 1;
      label = `Q${q} ${startDate.getFullYear()}`;
    } else {
      label = `${startDate.getFullYear()}`;
    }

    groups.push({
      label,
      btcMined,
      btcSold,
      revenue,
      opex,
      capex,
      netCashFlow: revenue - opex - capex,
      cumulativeCash: cumCash,
      btcBalance: last.btcBalance,
    });
  }
  return groups;
}

export default function ForecastCharts() {
  const config = useFarmStore((state) => state.config);

  const [params, setParams] = useState<ForecastParams>({
    months: 48,
    revenueMode: "sell_opex",
    btcPriceModel: "flat",
    annualGrowthPercent: 30,
    finalBtcPrice: null,
    networkHashrateGrowthPercent: DEFAULT_NETWORK_GROWTH_PERCENT, // replaced by effectiveParams below
    asicDegradationPercent: 4,
    discountRatePercent: 10,
  });

  const [btcDecimals, setBtcDecimals] = useState(8);
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [tableExpanded, setTableExpanded] = useState(false);

  // Market snapshot (live, or the labelled offline estimate). Start price and
  // fees follow it unless the user overrides them.
  const market = useMarket();
  const startPrice = params.startingBtcPrice ?? Math.round(market.btcPriceUsd);
  // Network growth defaults to the trailing 12-month rate (clamped 0–60 %) until the user moves the slider.
  const [growthOverride, setGrowthOverride] = useState<number | null>(null);
  const trailingGrowth = market.hashrateGrowth12mPercent;
  const effectiveParams = useMemo(
    () => ({ ...params, networkHashrateGrowthPercent: growthOverride ?? defaultNetworkGrowthPercent(trailingGrowth) }),
    [params, growthOverride, trailingGrowth],
  );
  const effectiveFinalPrice = scenarioBtcPrice(params, startPrice, params.months);

  const { data: forecast } = useForecast(config, effectiveParams);

  // Sensitivity analysis — 4 what-if scenarios, computed in the browser
  const sensitivity = useMemo(() => {
    if (!forecast || config.miners.length === 0) return null;
    const snapshot = toMarketSnapshot(market);
    const now = new Date();
    const run = (c: FarmConfig, p: ForecastParams) => generateForecast(c, p, snapshot, now);

    const base = forecast.summary.npv;
    const configElec = {
      ...config,
      regional: { ...config.regional, electricityPriceKwh: config.regional.electricityPriceKwh * 1.2 },
    };
    // Every price in the scenario 10% lower
    const paramsBear = {
      ...effectiveParams,
      startingBtcPrice: startPrice * 0.9,
      finalBtcPrice: effectiveParams.finalBtcPrice != null ? effectiveParams.finalBtcPrice * 0.9 : null,
    };
    const paramsNet = { ...effectiveParams, networkHashrateGrowthPercent: effectiveParams.networkHashrateGrowthPercent + 10 };
    const paramsNoDeg = { ...effectiveParams, asicDegradationPercent: 0 };

    const elecNpv = run(configElec, effectiveParams).summary.npv;
    const bearNpv = run(config, paramsBear).summary.npv;
    const netData = run(config, paramsNet);
    const noDegData = run(config, paramsNoDeg);

    const netLastRevenue = netData.periods[netData.periods.length - 1]?.miningRevenueUsd ?? 0;
    const baseLastRevenue = forecast.periods[forecast.periods.length - 1]?.miningRevenueUsd ?? 0;
    const revDeltaPct = baseLastRevenue > 0 ? ((netLastRevenue - baseLastRevenue) / baseLastRevenue) * 100 : 0;

    const baseBtc = forecast.summary.totalBtcMined;
    const noDegBtc = noDegData.summary.totalBtcMined;
    const btcDeltaPct = baseBtc > 0 ? ((noDegBtc - baseBtc) / baseBtc) * 100 : 0;

    return [
      { label: "Electricity +20%", value: `NPV ${formatUsd(elecNpv)}`, delta: elecNpv - base },
      { label: "BTC price −10%", value: `NPV ${formatUsd(bearNpv)}`, delta: bearNpv - base },
      { label: `Network growth +10%`, value: `Final month revenue ${revDeltaPct >= 0 ? "+" : ""}${revDeltaPct.toFixed(1)}%`, delta: revDeltaPct },
      { label: "Zero ASIC degradation", value: `+${btcDeltaPct.toFixed(1)}% total BTC mined`, delta: btcDeltaPct },
    ];
  }, [forecast, config, effectiveParams, startPrice, market]);

  if (config.miners.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="text-4xl mb-4 text-slate-300">--</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Farm Configured
          </h3>
          <p className="text-slate-500">
            Build your farm first to see forecasts
          </p>
        </div>
      </Card>
    );
  }

  // Chart data
  const chartData = forecast?.periods.map((p, i) => ({
    date: formatDate(new Date(p.date)),
    revenue: p.miningRevenueUsd,
    profit: p.profitUsd,
    btcPrice: p.btcPrice,
    capex: i === 0 ? -(forecast.totalCapex) : 0,
    opex: -p.opexUsd,
    grossRevenue: p.miningRevenueUsd,
    btcSoldForOpex: params.revenueMode === "sell_opex" ? Math.min(p.opexUsd, p.miningRevenueUsd) : 0,
    netCashFlow: p.miningRevenueUsd - p.opexUsd - (i === 0 ? forecast.totalCapex : 0),
    btc: p.btcBalance,
    btcMined: p.btcMined,
  }));

  // Aggregated table data
  const tableData = forecast ? aggregatePeriods(forecast.periods, granularity, forecast.totalCapex) : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blueprint-deep" />
          Forecast Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Time Range */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              Forecast Period
              <HelpTooltip content="The number of months to project forward. Longer periods capture more halving cycles but carry greater uncertainty in BTC price and network hashrate assumptions." />
            </label>
            <div className="grid grid-cols-5 gap-2">
              {([12, 24, 36, 48, 72] as const).map((m) => (
                <Button
                  key={m}
                  variant={params.months === m ? "primary" : "default"}
                  size="sm"
                  onClick={() => setParams({ ...params, months: m })}
                >
                  {m}m
                </Button>
              ))}
            </div>
          </div>

          {/* Revenue Mode */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              Revenue Strategy
              <HelpTooltip content="How you handle mined BTC. 'Sell All' converts everything to USD immediately. 'Hold All' accumulates BTC at market value. 'Sell OPEX' sells only enough to cover operating costs." />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={params.revenueMode === "sell_all" ? "primary" : "default"}
                size="sm"
                onClick={() => setParams({ ...params, revenueMode: "sell_all" })}
              >
                Sell All
              </Button>
              <Button
                variant={params.revenueMode === "hold_all" ? "primary" : "default"}
                size="sm"
                onClick={() => setParams({ ...params, revenueMode: "hold_all" })}
              >
                Hold All
              </Button>
              <Button
                variant={params.revenueMode === "sell_opex" ? "primary" : "default"}
                size="sm"
                onClick={() => setParams({ ...params, revenueMode: "sell_opex" })}
              >
                Sell OPEX
              </Button>
            </div>
          </div>

          {/* Starting BTC Price */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              Starting BTC Price
              <HelpTooltip content="Defaults to the live market price. Edit it to simulate a different starting point." />
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                aria-label="Starting BTC price in USD"
                className="w-full bg-white/50 border border-slate-200/60 rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 focus:border-blueprint-mid/50 transition-all"
                value={startPrice}
                min={0}
                step={100}
                onChange={(e) => setParams({ ...params, startingBtcPrice: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {params.startingBtcPrice === undefined ? (
                market.isLive ? "Live market price" : "Offline estimate (live data unavailable)"
              ) : (
                <button className="text-blueprint-deep hover:underline" onClick={() => setParams({ ...params, startingBtcPrice: undefined })}>
                  Reset to market price ({formatUsd(market.btcPriceUsd)})
                </button>
              )}
            </div>
          </div>

          {/* BTC Price Scenario */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              BTC Price Scenario
              <HelpTooltip content="Scenarios are choices you make, not predictions. Bear and Bull compound −30% or +30% per year from the starting price; Flat holds it; Target draws a straight line to the price you set for the final month." />
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {(
                [
                  { label: "Bear −30%/yr", active: params.btcPriceModel === "growth" && params.annualGrowthPercent === -30, next: { btcPriceModel: "growth", annualGrowthPercent: -30 } },
                  { label: "Flat", active: params.btcPriceModel === "flat", next: { btcPriceModel: "flat" } },
                  { label: "Bull +30%/yr", active: params.btcPriceModel === "growth" && params.annualGrowthPercent === 30, next: { btcPriceModel: "growth", annualGrowthPercent: 30 } },
                  { label: "Target", active: params.btcPriceModel === "target", next: { btcPriceModel: "target", finalBtcPrice: params.finalBtcPrice ?? startPrice } },
                ] as { label: string; active: boolean; next: Partial<ForecastParams> }[]
              ).map((chip) => (
                <Button
                  key={chip.label}
                  variant={chip.active ? "primary" : "default"}
                  size="sm"
                  aria-pressed={chip.active}
                  onClick={() => setParams({ ...params, ...chip.next })}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
            {params.btcPriceModel === "target" && (
              <div className="relative mb-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  aria-label="Target BTC price at the final month in USD"
                  className="w-full bg-white/50 border border-slate-200/60 rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 focus:border-blueprint-mid/50 transition-all"
                  value={params.finalBtcPrice ?? startPrice}
                  min={0}
                  step={100}
                  onChange={(e) => setParams({ ...params, finalBtcPrice: Math.max(0, Number(e.target.value)) })}
                />
              </div>
            )}
            <div className="text-xs text-slate-400">
              Final month: {formatUsd(effectiveFinalPrice)}
              {params.btcPriceModel === "flat" && " (same as starting)"}
              {params.btcPriceModel === "growth" && ` · ${params.annualGrowthPercent! >= 0 ? "+" : ""}${params.annualGrowthPercent}% per year`}
              {params.btcPriceModel === "target" && " · straight line to your target"}
              {" · a scenario you choose, not a prediction"}
            </div>
          </div>

          {/* Custom annual growth — visible for growth scenarios */}
          {params.btcPriceModel === "growth" && (
            <Slider
              label="BTC Price Change per Year"
              unit="%"
              min={-60}
              max={100}
              step={5}
              value={params.annualGrowthPercent ?? 0}
              onChange={(e) => setParams({ ...params, annualGrowthPercent: parseFloat(e.target.value) })}
              tooltip="Compound annual change applied to the starting price. Bear and Bull are −30% and +30%."
            />
          )}

          {/* Transaction fees */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              Tx Fees per Block
              <HelpTooltip content="Average transaction fees miners collect per block, on top of the subsidy. Defaults to the average of the last 144 blocks." />
            </label>
            <div className="relative">
              <input
                type="number"
                aria-label="Transaction fees per block in BTC"
                className="w-full bg-white/50 border border-slate-200/60 rounded-xl py-2 pl-3 pr-12 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 focus:border-blueprint-mid/50 transition-all"
                value={params.feesPerBlockBtc ?? Number(market.avgFeesPerBlockBtc.toFixed(4))}
                min={0}
                step={0.001}
                onChange={(e) => setParams({ ...params, feesPerBlockBtc: Math.max(0, Number(e.target.value)) })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">BTC</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {params.feesPerBlockBtc === undefined ? (
                market.isLive ? "Live: average of the last 144 blocks" : "Offline estimate"
              ) : (
                <button className="text-blueprint-deep hover:underline" onClick={() => setParams({ ...params, feesPerBlockBtc: undefined })}>
                  Reset to market average
                </button>
              )}
            </div>
          </div>

          {/* Network Growth */}
          <div>
            <Slider
              label="Annual Network Hashrate Growth"
              unit="%"
              min={0}
              max={60}
              step={1}
              value={effectiveParams.networkHashrateGrowthPercent}
              onChange={(e) => setGrowthOverride(parseFloat(e.target.value))}
              tooltip="The expected year-over-year growth rate of Bitcoin's total network hashrate. Higher growth means more competition, harder difficulty, and lower per-unit mining yields over time. Defaults to the trailing 12-month rate, clamped to 0–60%."
            />
            <div className="text-xs text-slate-400 mt-1">
              {trailingGrowth === null ? "trailing 12m: unavailable (default 10%)" : `trailing 12m: ${trailingGrowth > 0 ? "+" : ""}${trailingGrowth.toFixed(1)}%`}
              {growthOverride !== null && (
                <>
                  {" · "}
                  <button className="text-blueprint-deep hover:underline" onClick={() => setGrowthOverride(null)}>
                    use trailing rate
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ASIC Degradation */}
          <Slider
            label="Annual ASIC Degradation"
            unit="%"
            min={1}
            max={15}
            step={1}
            value={params.asicDegradationPercent}
            onChange={(e) =>
              setParams({ ...params, asicDegradationPercent: parseFloat(e.target.value) })
            }
            tooltip="The annual decline in your miners' effective hashrate due to hardware wear and aging. Typically 5-10% per year for ASIC miners operating in normal conditions."
          />

          {/* Discount Rate */}
          <Slider
            label="Discount Rate (for NPV/IRR)"
            unit="%"
            min={5}
            max={15}
            step={1}
            value={params.discountRatePercent}
            onChange={(e) =>
              setParams({ ...params, discountRatePercent: parseFloat(e.target.value) })
            }
            tooltip="Annual discount rate used for Net Present Value (NPV) calculation. Represents your required rate of return or opportunity cost of capital. Higher = more conservative valuation."
          />

        </div>
      </Card>

      {/* Summary Cards — row 1 */}
      {forecast && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <div className="text-sm text-slate-500 mb-1">Total Revenue</div>
            <div className="text-xl font-bold text-emerald-600 font-mono tabular-nums">
              {formatUsd(forecast.summary.totalRevenue)}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1">Total Costs</div>
            <div className="text-xl font-bold text-red-600 font-mono tabular-nums">
              {formatUsd(forecast.summary.totalCosts)}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1">Net Profit</div>
            <div className={`text-xl font-bold font-mono tabular-nums ${forecast.summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatUsd(forecast.summary.totalProfit)}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              BTC / Month
              <HelpTooltip content="Average Bitcoin mined per month over the forecast period, accounting for network growth and ASIC degradation." />
            </div>
            <div className="text-xl font-bold text-amber-600 font-mono tabular-nums">
              {formatBtc(forecast.summary.totalBtcMined / params.months, 6)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Total: {formatBtc(forecast.summary.totalBtcMined, 4)}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1">ROI</div>
            <div className="text-xl font-bold text-blueprint-deep font-mono tabular-nums">
              {formatPercent(forecast.summary.roiPercent)}
            </div>
            {forecast.summary.paybackMonths && (
              <div className="text-xs text-slate-400 mt-1">
                Payback: {forecast.summary.paybackMonths} months
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Financial Metric Cards — row 2 */}
      {forecast && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              IRR
              <HelpTooltip content="Internal Rate of Return — the annualized discount rate at which the project's NPV equals zero. Higher = better. Comparable across investments of different sizes." />
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums ${forecast.summary.irr !== null && forecast.summary.irr >= 0 ? 'text-blueprint-mid' : 'text-red-600'}`}>
              {forecast.summary.irr === null ? "n/a" : `${forecast.summary.irr.toFixed(1)}%`}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {forecast.summary.irr === null ? "cash flows never repay the CAPEX" : "annual"}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              NPV
              <HelpTooltip content="Net Present Value — the total value of future cash flows discounted to today's dollars, minus initial investment. Positive = project adds value above your required return." />
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums ${forecast.summary.npv >= 0 ? 'text-blueprint-mid' : 'text-red-600'}`}>
              {formatUsd(forecast.summary.npv)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              at {params.discountRatePercent}% discount rate
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              Break-even BTC Price
              <HelpTooltip content="The average BTC price needed for revenue to cover all costs. 'OPEX only' covers operating costs; 'With CAPEX' covers total investment including hardware." />
            </div>
            <div className="text-xl font-bold text-blueprint-deep font-mono tabular-nums">
              {formatUsd(forecast.summary.breakEvenBtcPriceWithCapex)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              OPEX only: {formatUsd(forecast.summary.breakEvenBtcPrice)}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              Avg Hashprice
              <HelpTooltip content="Average revenue per terahash per day over the forecast period. Key metric for comparing mining profitability across different hardware and time periods." />
            </div>
            <div className="text-xl font-bold text-blueprint-deep font-mono tabular-nums">
              ${forecast.summary.avgHashpriceUsd.toFixed(4)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              $/TH/day avg over {params.months}m
            </div>
          </Card>
        </div>
      )}

      {/* Revenue & Profit Chart */}
      {chartData && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Revenue & Profit</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={tickUsd} width={80} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [formatUsd(value), name]}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* BTC Price Forecast Chart */}
      {chartData && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">BTC Price Scenario</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={tickBtcPrice} width={80} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [formatUsd(value), name]}
              />
              <Line type="monotone" dataKey="btcPrice" name="BTC Price" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cash Flow Chart */}
      {chartData && forecast && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Cash Flow Analysis</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="opexGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={tickUsd} width={80} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => {
                  return [formatUsd(Math.abs(value)), name];
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="grossRevenue" name="Revenue" stroke="#059669" fill="url(#revenueGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="opex" name="OPEX" stroke="#dc2626" fill="url(#opexGrad)" strokeWidth={1.5} />
              <Bar dataKey="capex" name="CAPEX" fill="#7c3aed" opacity={0.8} />
              {params.revenueMode === "sell_opex" && (
                <Area type="monotone" dataKey="btcSoldForOpex" name="BTC Sold for OPEX" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 2" />
              )}
              <Line type="monotone" dataKey="netCashFlow" name="Net Cash Flow" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* BTC Balance Chart (if holding) */}
      {chartData && params.revenueMode !== "sell_all" && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bitcoin className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-slate-900">Bitcoin Balance</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [formatBtc(value, btcDecimals), name]}
              />
              <Area type="monotone" dataKey="btc" name="BTC Balance" stroke="#F59E0B" fillOpacity={1} fill="url(#btcGradient)" activeDot={{ r: 4, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Granularity Toggle + Expandable Data Table */}
      {forecast && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-slate-500">View:</span>
            {(["monthly", "quarterly", "yearly"] as const).map((g) => (
              <Button
                key={g}
                variant={granularity === g ? "primary" : "default"}
                size="sm"
                onClick={() => setGranularity(g)}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {forecast && (
        <Card>
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setTableExpanded(!tableExpanded)}
          >
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blueprint-deep" />
              Period Data ({granularity})
            </h3>
            {tableExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {tableExpanded && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/50 text-slate-500">
                    <th className="text-left py-2 px-2 font-medium">Period</th>
                    <th className="text-right py-2 px-2 font-medium">BTC Mined</th>
                    <th className="text-right py-2 px-2 font-medium">Revenue</th>
                    <th className="text-right py-2 px-2 font-medium">OPEX</th>
                    <th className="text-right py-2 px-2 font-medium">CAPEX</th>
                    <th className="text-right py-2 px-2 font-medium">Net Cash Flow</th>
                    <th className="text-right py-2 px-2 font-medium">Cumulative</th>
                    <th className="text-right py-2 px-2 font-medium">BTC Sold</th>
                    <th className="text-right py-2 px-2 font-medium">BTC Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100/50 row-hover">
                      <td className="py-2 px-2 font-mono text-xs text-slate-700">{row.label}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-slate-700">{formatBtc(row.btcMined, btcDecimals)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-emerald-600">{formatUsd(row.revenue)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-red-600">{formatUsd(row.opex)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-violet-600">{row.capex > 0 ? formatUsd(row.capex) : "—"}</td>
                      <td className={`py-2 px-2 text-right font-mono text-xs ${row.netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatUsd(row.netCashFlow)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono text-xs ${row.cumulativeCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatUsd(row.cumulativeCash)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-amber-600">
                        {row.btcSold > 0 ? formatBtc(row.btcSold, btcDecimals) : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-blueprint-deep">
                        {formatBtc(row.btcBalance, btcDecimals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Sensitivity Analysis */}
      {sensitivity && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blueprint-deep" />
            Key Drivers Impact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sensitivity.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 glass-inner"
              >
                <span className="text-sm text-slate-500">{s.label}</span>
                <span className={`text-sm font-mono font-semibold tabular-nums ${s.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
