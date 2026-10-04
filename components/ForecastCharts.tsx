"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  ComposedChart, LineChart, Line, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Bitcoin, ChevronDown, ChevronUp, Activity } from "lucide-react";
import BreakEvenHero from "./projections/BreakEvenHero";
import KeyDriversTornado from "./projections/KeyDriversTornado";
import { keyDrivers } from "@/lib/sensitivity";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Slider from "./ui/Slider";
import HelpTooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { scenarioBtcPrice } from "@/lib/forecasting";
import { defaultNetworkGrowthPercent, toMarketSnapshot } from "@/lib/networkData";
import { useForecastStore } from "@/lib/forecastStore";
import { useForecast, useMarket } from "@/lib/apiClient";
import { formatUsd, formatBtc, formatDate, formatPercent } from "@/lib/utils";
import type { ForecastParams, ForecastPeriod } from "@/types";

/** Compact USD formatter for chart axis ticks */
function tickUsd(v: number): string {
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

function tickBtcPrice(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/** Chart colors come from the design tokens, so both themes work. */
const C = {
  good: "rgb(var(--good))",
  bad: "rgb(var(--bad))",
  btc: "rgb(var(--btc))",
  fg: "rgb(var(--fg))",
  axis: "rgb(var(--muted))",
  grid: "rgb(var(--line))",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "rgb(var(--surface))",
    border: "1px solid rgb(var(--line-strong))",
    borderRadius: "6px",
    fontSize: "12px",
    color: "rgb(var(--fg))",
  },
  labelStyle: { color: "rgb(var(--muted))" },
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

  const { params, setParams, growthOverride, setGrowthOverride } = useForecastStore();

  const [btcDecimals, setBtcDecimals] = useState(8);
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [tableExpanded, setTableExpanded] = useState(false);

  // Market snapshot (live, or the labelled offline estimate). Start price and
  // fees follow it unless the user overrides them.
  const market = useMarket();
  const startPrice = params.startingBtcPrice ?? Math.round(market.btcPriceUsd);
  // Network growth defaults to the trailing 12-month rate (clamped 0–60 %) until the user moves the slider.
  const trailingGrowth = market.hashrateGrowth12mPercent;
  const effectiveParams = useMemo(
    () => ({ ...params, networkHashrateGrowthPercent: growthOverride ?? defaultNetworkGrowthPercent(trailingGrowth) }),
    [params, growthOverride, trailingGrowth],
  );
  const effectiveFinalPrice = scenarioBtcPrice(params, startPrice, params.months);

  const { data: forecast } = useForecast(config, effectiveParams);

  // Key drivers: NPV swing per input (tornado), computed in the browser
  const drivers = useMemo(
    () => (forecast ? keyDrivers(config, effectiveParams, toMarketSnapshot(market), new Date()) : null),
    [forecast, config, effectiveParams, market],
  );

  // Charts draw on first view only; recalculations update in place
  const drawnOnce = useRef(false);
  useEffect(() => {
    if (forecast) drawnOnce.current = true;
  }, [forecast]);
  const animateCharts = !drawnOnce.current;
  const scenarioKey = `${params.btcPriceModel}:${params.annualGrowthPercent}:${params.finalBtcPrice}`;

  if (config.miners.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="text-4xl mb-4 text-faint">--</div>
          <h3 className="text-lg font-semibold text-fg mb-2">
            No Farm Configured
          </h3>
          <p className="text-muted">
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
    opexPositive: p.opexUsd,
    cumulativeCash: forecast.periods.slice(0, i + 1).reduce((sum, q) => sum + q.miningRevenueUsd - q.opexUsd, -forecast.totalCapex),
    btc: p.btcBalance,
    btcMined: p.btcMined,
  }));

  // Aggregated table data
  const tableData = forecast ? aggregatePeriods(forecast.periods, granularity, forecast.totalCapex) : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <h2 className="text-lg font-bold text-fg mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-fg" />
          Forecast Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Time Range */}
          <div>
            <label className="text-sm font-medium text-fg-2 mb-2 flex items-center gap-1">
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
            <label className="text-sm font-medium text-fg-2 mb-2 flex items-center gap-1">
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
            <label className="text-sm font-medium text-fg-2 mb-2 flex items-center gap-1">
              Starting BTC Price
              <HelpTooltip content="Defaults to the live market price. Edit it to simulate a different starting point." />
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint text-sm">$</span>
              <input
                type="number"
                aria-label="Starting BTC price in USD"
                className="w-full bg-surface border border-line rounded py-2 pl-7 pr-3 text-sm font-mono text-fg-2 focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-line-strong transition-all"
                value={startPrice}
                min={0}
                step={100}
                onChange={(e) => setParams({ ...params, startingBtcPrice: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="text-xs text-faint mt-1">
              {params.startingBtcPrice === undefined ? (
                market.isLive ? "Live market price" : "Offline estimate (live data unavailable)"
              ) : (
                <button className="text-fg hover:underline" onClick={() => setParams({ ...params, startingBtcPrice: undefined })}>
                  Reset to market price ({formatUsd(market.btcPriceUsd)})
                </button>
              )}
            </div>
          </div>

          {/* BTC Price Scenario */}
          <div>
            <label className="text-sm font-medium text-fg-2 mb-2 flex items-center gap-1">
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint text-sm">$</span>
                <input
                  type="number"
                  aria-label="Target BTC price at the final month in USD"
                  className="w-full bg-surface border border-line rounded py-2 pl-7 pr-3 text-sm font-mono text-fg-2 focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-line-strong transition-all"
                  value={params.finalBtcPrice ?? startPrice}
                  min={0}
                  step={100}
                  onChange={(e) => setParams({ ...params, finalBtcPrice: Math.max(0, Number(e.target.value)) })}
                />
              </div>
            )}
            <div className="text-xs text-faint">
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
            <label className="text-sm font-medium text-fg-2 mb-2 flex items-center gap-1">
              Tx Fees per Block
              <HelpTooltip content="Average transaction fees miners collect per block, on top of the subsidy. Defaults to the average of the last 144 blocks." />
            </label>
            <div className="relative">
              <input
                type="number"
                aria-label="Transaction fees per block in BTC"
                className="w-full bg-surface border border-line rounded py-2 pl-3 pr-12 text-sm font-mono text-fg-2 focus:outline-none focus:ring-2 focus:ring-fg/20 focus:border-line-strong transition-all"
                value={params.feesPerBlockBtc ?? Number(market.avgFeesPerBlockBtc.toFixed(4))}
                min={0}
                step={0.001}
                onChange={(e) => setParams({ ...params, feesPerBlockBtc: Math.max(0, Number(e.target.value)) })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-faint text-sm">BTC</span>
            </div>
            <div className="text-xs text-faint mt-1">
              {params.feesPerBlockBtc === undefined ? (
                market.isLive ? "Live: average of the last 144 blocks" : "Offline estimate"
              ) : (
                <button className="text-fg hover:underline" onClick={() => setParams({ ...params, feesPerBlockBtc: undefined })}>
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
            <div className="text-xs text-faint mt-1">
              {trailingGrowth === null ? "trailing 12m: unavailable (default 10%)" : `trailing 12m: ${trailingGrowth > 0 ? "+" : ""}${trailingGrowth.toFixed(1)}%`}
              {growthOverride !== null && (
                <>
                  {" · "}
                  <button className="text-fg hover:underline" onClick={() => setGrowthOverride(null)}>
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

      {forecast && <BreakEvenHero forecast={forecast} startPrice={startPrice} months={params.months} discountRate={params.discountRatePercent} />}

      {/* Cash flow — draws on first view; scenario changes cross-fade */}
      {chartData && (
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-fg">Monthly cash flow</h3>
              <p className="text-sm text-muted">Revenue against OPEX, and the cumulative cash position after CAPEX</p>
            </div>
            <span className="label">{forecast!.assumptions.priceScenario}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={scenarioKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.good} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.good} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} minTickGap={24} />
                  <YAxis yAxisId="m" stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} tickFormatter={tickUsd} width={64} tickLine={false} />
                  <YAxis yAxisId="c" orientation="right" stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} tickFormatter={tickUsd} width={64} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value: number, name: string) => [formatUsd(value), name]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.axis }} />
                  <Area yAxisId="m" type="monotone" dataKey="grossRevenue" name="Revenue" stroke={C.good} fill="url(#revenueGrad)" strokeWidth={2} isAnimationActive={animateCharts} />
                  <Line yAxisId="m" type="monotone" dataKey="opexPositive" name="OPEX" stroke={C.bad} strokeWidth={2} dot={false} isAnimationActive={animateCharts} />
                  <Line yAxisId="c" type="monotone" dataKey="cumulativeCash" name="Cumulative cash (right)" stroke={C.fg} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={animateCharts} />
                </ComposedChart>
              </ResponsiveContainer>
            </m.div>
          </AnimatePresence>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* BTC price scenario */}
        {chartData && (
          <Card>
            <h3 className="text-base font-semibold text-fg">BTC price scenario</h3>
            <p className="mb-3 text-sm text-muted">A scenario you choose, not a prediction</p>
            <AnimatePresence mode="wait" initial={false}>
              <m.div key={scenarioKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} minTickGap={24} />
                    <YAxis stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} tickFormatter={tickBtcPrice} width={64} tickLine={false} domain={[(min: number) => Math.floor((min * 0.85) / 1000) * 1000, (max: number) => Math.ceil((max * 1.1) / 1000) * 1000]} tickCount={5} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatUsd(value), "BTC price"]} />
                    <Line type="monotone" dataKey="btcPrice" name="BTC price" stroke={C.btc} strokeWidth={2} dot={false} isAnimationActive={animateCharts} />
                  </LineChart>
                </ResponsiveContainer>
              </m.div>
            </AnimatePresence>
          </Card>
        )}

        {/* Key drivers tornado */}
        {drivers && <KeyDriversTornado drivers={drivers} />}
      </div>

      {/* BTC balance (when holding) */}
      {chartData && params.revenueMode !== "sell_all" && (
        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold text-fg">
              <Bitcoin className="h-4 w-4 text-btc" aria-hidden />
              BTC held
            </h3>
            <span className="font-mono text-sm text-fg">{formatBtc(forecast!.summary.finalBtcBalance, 4)} at month {params.months}</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} minTickGap={24} />
              <YAxis stroke={C.axis} tick={{ fontSize: 11, fill: C.axis }} width={64} tickLine={false} tickFormatter={(v: number) => v.toFixed(v < 10 ? 1 : 0)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatBtc(value, btcDecimals), "BTC held"]} />
              <Area type="monotone" dataKey="btc" name="BTC held" stroke={C.btc} fill={C.btc} fillOpacity={0.12} strokeWidth={2} isAnimationActive={animateCharts} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Period data table */}
      {forecast && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className="flex items-center gap-2 text-left"
              onClick={() => setTableExpanded(!tableExpanded)}
              aria-expanded={tableExpanded}
            >
              <Activity className="h-4 w-4 text-muted" aria-hidden />
              <h3 className="text-base font-semibold text-fg">Period data</h3>
              {tableExpanded ? <ChevronUp className="h-4 w-4 text-faint" aria-hidden /> : <ChevronDown className="h-4 w-4 text-faint" aria-hidden />}
            </button>
            <div className="flex gap-1.5" role="group" aria-label="Table granularity">
              {(["monthly", "quarterly", "yearly"] as const).map((g) => (
                <Button key={g} variant={granularity === g ? "primary" : "default"} size="sm" aria-pressed={granularity === g} onClick={() => setGranularity(g)}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {tableExpanded && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
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
                    <tr key={i} className="border-b border-line row-hover">
                      <td className="py-2 px-2 font-mono text-xs text-fg-2">{row.label}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-fg-2">{formatBtc(row.btcMined, btcDecimals)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-good">{formatUsd(row.revenue)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-bad">{formatUsd(row.opex)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-muted">{row.capex > 0 ? formatUsd(row.capex) : "—"}</td>
                      <td className={`py-2 px-2 text-right font-mono text-xs ${row.netCashFlow >= 0 ? 'text-cool' : 'text-bad'}`}>
                        {formatUsd(row.netCashFlow)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono text-xs ${row.cumulativeCash >= 0 ? 'text-good' : 'text-bad'}`}>
                        {formatUsd(row.cumulativeCash)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-warn">
                        {row.btcSold > 0 ? formatBtc(row.btcSold, btcDecimals) : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-fg">
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

    </div>
  );
}
