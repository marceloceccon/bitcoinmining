"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Zap, Flame, Gauge, DollarSign, TrendingUp, Factory, Volume2, CircuitBoard } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { useNetworkStore } from "@/lib/networkStore";
import { calculateFarmMetrics, calculateTotalHashRate, calculateTotalPower } from "@/lib/calculations";
import { DRY_COOLERS } from "@/lib/dryCoolerData";
import { AIR_FANS } from "@/lib/airFanData";
import { CURRENT_NETWORK_HASHRATE_EH, CURRENT_BLOCK_REWARD } from "@/lib/forecasting";
import { autoSelectTransformer, NO_TRANSFORMER_THRESHOLD_KVA } from "@/lib/transformerData";
import {
  formatHashRate,
  formatPower,
  formatUsd,
  formatNumber,
  formatBtc,
} from "@/lib/utils";

const BLOCKS_PER_DAY = 144;

export default function MetricsDashboard() {
  const config = useFarmStore((state) => state.config);
  const networkData = useNetworkStore((state) => state.data);

  // Use live data when available, fall back to hardcoded constants
  const networkHashrateEh = networkData?.networkHashrateEh ?? CURRENT_NETWORK_HASHRATE_EH;
  const blockReward = networkData?.blockReward ?? CURRENT_BLOCK_REWARD;
  const btcPriceUsd = networkData?.btcPriceUsd ?? 0;
  const marketHashprice = networkData?.hashpriceUsdPhDay ?? 0;

  const metrics = useMemo(() => {
    if (config.miners.length === 0) return null;
    return calculateFarmMetrics(config);
  }, [config]);

  if (!metrics) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="text-4xl mb-4 text-slate-300">--</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Metrics Yet
          </h3>
          <p className="text-slate-500">
            Add miners to see farm calculations
          </p>
        </div>
      </Card>
    );
  }

  const metricItems = [
    {
      icon: Zap,
      label: "Total Hash Rate",
      value: formatHashRate(metrics.totalHashRateThs),
      color: "text-blueprint-deep",
    },
    {
      icon: Gauge,
      label: "Power Draw",
      value: formatPower(metrics.totalPowerKw),
      color: "text-amber-600",
    },
    {
      icon: Zap,
      label: "Monthly kWh",
      value: formatNumber(metrics.monthlyKwh),
      color: "text-blue-600",
    },
    {
      icon: Flame,
      label: "Heat Output",
      value: `${formatNumber(metrics.heatOutputBtuPerHour)} BTU/h`,
      color: "text-red-600",
    },
    {
      icon: Gauge,
      label: "Electrical Current",
      value: `${metrics.electricalCurrentAmps.toFixed(1)} A @ 220V`,
      color: "text-violet-600",
    },
    {
      icon: Factory,
      label: "Transformer",
      value: metrics.transformerKva < NO_TRANSFORMER_THRESHOLD_KVA
        ? `${metrics.transformerKva.toFixed(0)} kVA (not needed)`
        : `${metrics.transformerKva.toFixed(0)} kVA`,
      color: "text-emerald-600",
    },
  ];

  // BTC mining estimate using live network data
  const farmHashrateThs = calculateTotalHashRate(config);
  const farmHashrateEh = farmHashrateThs / 1e6;
  const poolShare = networkHashrateEh > 0 ? farmHashrateEh / networkHashrateEh : 0;
  const monthlyBtcMined = BLOCKS_PER_DAY * 30 * poolShare * blockReward * (1 - config.poolFeePercent / 100) * (config.uptimePercent / 100);
  const costPerBtc = monthlyBtcMined > 0 ? metrics.monthlyOpex / monthlyBtcMined : 0;

  // Farm hashprice: daily revenue per PH
  const farmPh = farmHashrateThs / 1e3;
  const farmDailyBtc = BLOCKS_PER_DAY * poolShare * blockReward * (1 - config.poolFeePercent / 100) * (config.uptimePercent / 100);
  const farmHashprice = farmPh > 0 && btcPriceUsd > 0 ? (farmDailyBtc * btcPriceUsd) / farmPh : 0;

  const isContainerSetup = config.infrastructureType === "containers";
  const transformerInfo = autoSelectTransformer(metrics.transformerKva);

  const costBreakdown = [
    { label: "Miners (hardware)", value: metrics.minerCost },
    { label: transformerInfo
        ? `Transformer: ${transformerInfo.model.kva_rating} kVA ${transformerInfo.model.phase === 3 ? '3-Ph' : '1-Ph'}${transformerInfo.quantity > 1 ? ` x${transformerInfo.quantity}` : ''}`
        : "Transformer (not needed)", value: metrics.transformerCost },
    { label: "Cables & Wiring", value: metrics.cableCost },
    { label: isContainerSetup ? "Steel Racks (inside containers)" : "Steel Racks", value: metrics.rackCost },
    ...(metrics.containerCost > 0 ? [{ label: "Container Shells", value: metrics.containerCost }] : []),
    ...(metrics.coolingCost > 0 ? [{ label: "Cooling", value: metrics.coolingCost }] : []),
    { label: "Solar (if any)", value: metrics.solarCapex },
    { label: "Deployment Labor", value: metrics.laborCost },
    { label: "Cables & Breakers", value: metrics.cablesAndBreakers },
    ...(metrics.dryCoolerCapex > 0 ? [{ label: "Dry Coolers", value: metrics.dryCoolerCapex }] : []),
    ...(metrics.airFanCapex > 0 ? [{ label: "Air Cooling Fans", value: metrics.airFanCapex }] : []),
    ...(metrics.importTaxCapex > 0 ? [{ label: "Import Taxes", value: metrics.importTaxCapex }] : []),
  ];

  // CAPEX pie chart data (only include items with value > 0)
  const PIE_COLORS = ["#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#7c3aed", "#a78bfa", "#c4b5fd", "#f59e0b", "#fbbf24", "#fcd34d"];
  const pieData = costBreakdown
    .filter((item) => item.value > 0)
    .map((item) => ({ name: item.label, value: item.value }));

  // Profitability: compare cost per BTC vs market price
  const isProfitable = btcPriceUsd > 0 && costPerBtc > 0 && costPerBtc < btcPriceUsd;
  const isMarginal = btcPriceUsd > 0 && costPerBtc > 0 && costPerBtc >= btcPriceUsd * 0.8 && costPerBtc < btcPriceUsd;
  const isUnprofitable = btcPriceUsd > 0 && costPerBtc > 0 && costPerBtc >= btcPriceUsd;

  const networkLabel = networkData?.isLive
    ? `Live: ${formatNumber(networkHashrateEh, 1)} EH/s`
    : `Est: ${formatNumber(networkHashrateEh, 0)} EH/s`;

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <Card>
        <CardIllustration theme="gauge" />
        <h2 className="text-lg font-bold text-slate-900 mb-4">Live Metrics</h2>
        <div className="space-y-2">
          {metricItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 glass-inner"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-sm text-slate-500">{item.label}</span>
                </div>
                <span className="font-mono font-semibold text-slate-900 text-sm tabular-nums">{item.value}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardIllustration theme="chart" />
        <h2 className="text-lg font-bold text-slate-900 mb-4">Cost Breakdown</h2>
        <div className="space-y-1">
          {costBreakdown.map((item) => (
            <div key={item.label} className="flex justify-between text-sm px-2 py-1.5 rounded row-hover">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-mono font-medium text-slate-700 tabular-nums">{formatUsd(item.value)}</span>
            </div>
          ))}
          {/* Donut Chart */}
          {pieData.length > 1 && (
            <div className="py-3 mt-3 border-t border-slate-200/50">
              <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => formatUsd(value)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">CAPEX</div>
                    <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">{formatUsd(metrics.totalCapex)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-slate-200/50 flex justify-between font-semibold">
            <span className="text-slate-900">Total CAPEX</span>
            <span className="text-blueprint-deep font-mono text-lg tabular-nums">
              {formatUsd(metrics.totalCapex)}
            </span>
          </div>
        </div>
      </Card>

      {/* Bitcoin Mined */}
      <Card>
        <CardIllustration theme="bitcoin" />
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-1">
          Price of Bitcoin Mined
          <Tooltip content={`Estimated monthly BTC at current network conditions (${networkLabel}, ${blockReward} BTC reward). Does not account for future difficulty growth or ASIC degradation.`} />
        </h2>
        <div className="text-center py-3 mb-3 glass-inner">
          <div className="text-2xl font-bold text-amber-600 font-mono tabular-nums">
            {formatBtc(monthlyBtcMined, 6)}
          </div>
          <div className="text-sm text-slate-500 mt-1">BTC / month</div>
        </div>
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-sm px-2 py-1.5 rounded row-hover">
            <span className="text-slate-500">Yearly BTC Mined</span>
            <span className="font-mono font-medium text-amber-600 tabular-nums">{formatBtc(monthlyBtcMined * 12, 6)}</span>
          </div>
          {marketHashprice > 0 && (
            <>
              <div className="flex justify-between text-sm px-2 py-1.5 rounded row-hover">
                <span className="text-slate-500 flex items-center gap-1">
                  Market Hashprice
                  <Tooltip content="Daily revenue per PH/s at current network conditions. This is the industry benchmark miners use to evaluate profitability." />
                </span>
                <span className="font-mono font-medium text-slate-700 tabular-nums">${marketHashprice.toFixed(2)}/PH/day</span>
              </div>
              {farmHashprice > 0 && (
                <div className="flex justify-between text-sm px-2 py-1.5 rounded row-hover">
                  <span className="text-slate-500 flex items-center gap-1">
                    Your Hashprice
                    <Tooltip content="Your farm's effective daily revenue per PH/s, accounting for pool fees and uptime." />
                  </span>
                  <span className="font-mono font-medium text-blueprint-deep tabular-nums">${farmHashprice.toFixed(2)}/PH/day</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="pt-3 border-t border-slate-200/50">
          <div className="flex justify-between font-semibold">
            <span className="text-slate-900">Cost per BTC</span>
            <span className="text-blueprint-deep font-mono text-lg tabular-nums">
              {formatUsd(costPerBtc)}
            </span>
          </div>
          {btcPriceUsd > 0 && costPerBtc > 0 && (
            <div className={`mt-2 text-center text-sm font-semibold py-2 rounded-2xl ${
              isUnprofitable
                ? "glass-danger text-red-700"
                : isMarginal
                  ? "glass-warning text-amber-700"
                  : "glass-success text-emerald-700"
            }`}>
              {isUnprofitable
                ? `Unprofitable at ${formatUsd(btcPriceUsd)}/BTC`
                : isMarginal
                  ? `Marginal at ${formatUsd(btcPriceUsd)}/BTC (${((1 - costPerBtc / btcPriceUsd) * 100).toFixed(0)}% margin)`
                  : `Profitable at ${formatUsd(btcPriceUsd)}/BTC (${((1 - costPerBtc / btcPriceUsd) * 100).toFixed(0)}% margin)`
              }
            </div>
          )}
        </div>
      </Card>

      {/* OPEX */}
      <Card>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly OPEX</h2>
        {(metrics.monthlySolarMaintenance > 0 || metrics.maintenanceLaborOpex > 0) && (
          <div className="space-y-1 mb-3">
            {metrics.monthlySolarMaintenance > 0 && (
              <div className="flex justify-between text-sm px-2 py-1.5 rounded row-hover">
                <span className="text-slate-500">Solar Maintenance</span>
                <span className="font-mono font-medium text-slate-700 tabular-nums">{formatUsd(metrics.monthlySolarMaintenance)}</span>
              </div>
            )}
            {metrics.maintenanceLaborOpex > 0 && (
              <div className="flex justify-between text-sm px-2 py-1.5 rounded row-hover">
                <span className="text-slate-500">Maintenance Labor</span>
                <span className="font-mono font-medium text-slate-700 tabular-nums">{formatUsd(metrics.maintenanceLaborOpex)}</span>
              </div>
            )}
          </div>
        )}
        <div className="text-center py-4">
          <div className="text-3xl font-bold text-blueprint-deep font-mono tabular-nums">
            {formatUsd(metrics.monthlyOpex)}
          </div>
          <div className="text-sm text-slate-500 mt-2 font-mono tabular-nums">
            = {formatUsd(metrics.monthlyOpex * 12)}/year
          </div>
        </div>
      </Card>

      {/* Noise Level */}
      <NoiseCard config={config} />

      {/* Electrical Panel */}
      <BreakerCard totalPowerKw={metrics.totalPowerKw} totalAmps={metrics.electricalCurrentAmps} transformerKva={metrics.transformerKva} />
    </div>
  );
}

// ─── Noise Calculator ─────────────────────────────────────────────────────────

const NOISE_REFS = [
  { db: 30, label: "Quiet library" },
  { db: 50, label: "Normal conversation" },
  { db: 60, label: "Busy office" },
  { db: 70, label: "Vacuum cleaner" },
  { db: 75, label: "Busy traffic" },
  { db: 80, label: "Factory floor" },
  { db: 85, label: "OSHA 8h limit" },
  { db: 90, label: "Lawn mower" },
  { db: 100, label: "Chainsaw" },
  { db: 110, label: "Rock concert" },
];

function NoiseCard({ config }: { config: ReturnType<typeof useFarmStore.getState>["config"] }) {
  // Estimate miner noise: typical ASIC is 75 dB per unit
  const MINER_DB = 75;
  const totalMiners = config.miners.reduce((sum, { quantity }) => sum + quantity, 0);
  if (totalMiners === 0) return null;

  const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };

  // dB addition: Ltotal = Lref + 10*log10(N)
  const minerNoise = totalMiners > 0 ? MINER_DB + 10 * Math.log10(totalMiners) : 0;

  // Fan noise
  let maxFanDb = 0;
  let totalFans = 0;
  for (const sel of temperature.airFanSelections) {
    const model = AIR_FANS.find((m) => m.model === sel.model);
    if (model) {
      maxFanDb = Math.max(maxFanDb, model.noise_db);
      totalFans += sel.quantity;
    }
  }
  const fanNoise = totalFans > 0 && maxFanDb > 0 ? maxFanDb + 10 * Math.log10(totalFans) : 0;

  // Dry cooler noise
  let maxCoolerDb = 0;
  let totalCoolers = 0;
  for (const sel of temperature.dryCoolerSelections) {
    const model = DRY_COOLERS.find((m) => m.model === sel.model);
    if (model) {
      maxCoolerDb = Math.max(maxCoolerDb, model.sound_dba);
      totalCoolers += sel.quantity;
    }
  }
  const coolerNoise = totalCoolers > 0 && maxCoolerDb > 0 ? maxCoolerDb + 10 * Math.log10(totalCoolers) : 0;

  // Combined: sum of powers → dB
  const sources = [minerNoise, fanNoise, coolerNoise].filter((n) => n > 0);
  const totalNoise = sources.length > 0
    ? 10 * Math.log10(sources.reduce((sum, db) => sum + Math.pow(10, db / 10), 0))
    : 0;

  const closestRef = NOISE_REFS.reduce((prev, curr) =>
    Math.abs(curr.db - totalNoise) < Math.abs(prev.db - totalNoise) ? curr : prev
  );

  const noiseColor = totalNoise >= 85 ? "text-red-600" : totalNoise >= 75 ? "text-amber-600" : "text-emerald-600";

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-slate-600" />
        Noise Level
        <Tooltip content="Estimated combined noise from all miners (~75 dB each), fans, and dry coolers using logarithmic dB addition. Actual levels depend on enclosure and distance." />
      </h2>
      <div className="text-center py-2 mb-3">
        <div className={`text-3xl font-bold font-mono tabular-nums ${noiseColor}`}>
          {totalNoise.toFixed(0)} dB
        </div>
        <div className="text-sm text-slate-500 mt-1">
          Similar to: {closestRef.label} ({closestRef.db} dB)
        </div>
      </div>
      <div className="space-y-1 text-sm">
        {minerNoise > 0 && (
          <div className="flex justify-between px-2 py-1 rounded row-hover">
            <span className="text-slate-500">Miners ({totalMiners} units)</span>
            <span className="font-mono text-slate-700 tabular-nums">{minerNoise.toFixed(0)} dB</span>
          </div>
        )}
        {fanNoise > 0 && (
          <div className="flex justify-between px-2 py-1 rounded row-hover">
            <span className="text-slate-500">Air Fans ({totalFans} units)</span>
            <span className="font-mono text-slate-700 tabular-nums">{fanNoise.toFixed(0)} dB</span>
          </div>
        )}
        {coolerNoise > 0 && (
          <div className="flex justify-between px-2 py-1 rounded row-hover">
            <span className="text-slate-500">Dry Coolers ({totalCoolers} units)</span>
            <span className="font-mono text-slate-700 tabular-nums">{coolerNoise.toFixed(0)} dB</span>
          </div>
        )}
      </div>
      {totalNoise >= 85 && (
        <div className="mt-3 p-2 glass-danger rounded-2xl text-xs text-red-700">
          Above OSHA 85 dB 8-hour limit. Hearing protection required.
        </div>
      )}
    </Card>
  );
}

// ─── Electrical Panel / Breaker Planner ───────────────────────────────────────

const BREAKER_SIZES = [20, 30, 40, 50, 60, 100, 200] as const;

function BreakerCard({ totalPowerKw, totalAmps, transformerKva }: { totalPowerKw: number; totalAmps: number; transformerKva: number }) {
  if (totalPowerKw <= 0) return null;

  const VOLTAGE = 220;
  // NEC 80% rule: continuous load must not exceed 80% of breaker rating
  const mainBreakerAmps = totalAmps / 0.8;
  const mainBreakerSize = BREAKER_SIZES.find((s) => s >= mainBreakerAmps) ?? Math.ceil(mainBreakerAmps / 100) * 100;

  // Branch circuits: assume 30A breakers for mining (typical PDU breaker)
  const branchBreakerAmps = 30;
  const usableAmpsPerCircuit = branchBreakerAmps * 0.8; // NEC 80%
  const circuitsNeeded = Math.ceil(totalAmps / usableAmpsPerCircuit);

  // Panel capacity
  const panelSlots = Math.ceil(circuitsNeeded / 2) * 2; // panels have even slot counts
  const panelSize = panelSlots <= 20 ? 20 : panelSlots <= 30 ? 30 : panelSlots <= 42 ? 42 : Math.ceil(panelSlots / 42) * 42;
  const panelCount = Math.ceil(panelSlots / 42);

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <CircuitBoard className="h-4 w-4 text-slate-600" />
        Electrical Panel
        <Tooltip content="Estimated panel sizing based on NEC 80% continuous load rule. Uses 220V single/three-phase and 30A branch breakers. Verify with a licensed electrician." />
      </h2>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between px-2 py-1.5 rounded row-hover">
          <span className="text-slate-500">Total Load</span>
          <span className="font-mono font-medium text-slate-700 tabular-nums">{totalAmps.toFixed(0)} A @ {VOLTAGE}V</span>
        </div>
        <div className="flex justify-between px-2 py-1.5 rounded row-hover">
          <span className="text-slate-500 flex items-center gap-1">
            Main Breaker
            <Tooltip content="Minimum main breaker size per NEC 80% rule: continuous load / 0.8. Round up to nearest standard size." />
          </span>
          <span className="font-mono font-medium text-slate-700 tabular-nums">{mainBreakerSize} A</span>
        </div>
        <div className="flex justify-between px-2 py-1.5 rounded row-hover">
          <span className="text-slate-500 flex items-center gap-1">
            Branch Circuits (30A)
            <Tooltip content="Number of 30A branch circuits needed. Each circuit supports 24A continuous (80% of 30A) at 220V = 5.28 kW per circuit." />
          </span>
          <span className="font-mono font-medium text-slate-700 tabular-nums">{circuitsNeeded} circuits</span>
        </div>
        <div className="flex justify-between px-2 py-1.5 rounded row-hover">
          <span className="text-slate-500">Panel Size</span>
          <span className="font-mono font-medium text-slate-700 tabular-nums">
            {panelCount > 1 ? `${panelCount}x ` : ""}{panelSize}-slot
          </span>
        </div>
        {transformerKva >= 75 && (
          <div className="flex justify-between px-2 py-1.5 rounded row-hover">
            <span className="text-slate-500">Recommended</span>
            <span className="font-mono font-medium text-slate-700 tabular-nums">3-phase 480V service</span>
          </div>
        )}
      </div>
    </Card>
  );
}
