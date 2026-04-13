"use client";

import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useFarmStore } from "@/lib/store";
import { useCalculation, useNetworkData, useAirFans } from "@/lib/apiClient";
import { formatNumber, formatUsd } from "@/lib/utils";

const BLOCKS_PER_DAY = 144;
const CURRENT_NETWORK_HASHRATE_EH = 750;
const CURRENT_BLOCK_REWARD = 3.125;

interface Warning {
  type: "error" | "warning" | "info";
  message: string;
}

export default function FarmWarnings() {
  const config = useFarmStore((state) => state.config);
  const { data: networkData } = useNetworkData();
  const { data: calcData } = useCalculation(config);
  const { airFans } = useAirFans();

  const warnings = useMemo(() => {
    const w: Warning[] = [];
    if (config.miners.length === 0 || !calcData) return w;

    const { metrics, ventilation, totalPowerKw } = calcData;
    const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };
    const isHydro = config.miners.some(({ miner }) => miner.watercooled);
    const isAir = config.miners.some(({ miner }) => !miner.watercooled);

    // Cooling checks for hydro miners (uses climate-derated capacity)
    if (isHydro) {
      if (temperature.dryCoolerSelections.length === 0) {
        w.push({ type: "error", message: "Water-cooled miners detected but no dry coolers configured. Go to the Thermal tab." });
      } else {
        const effectiveCapacity = calcData.effectiveDryCoolerCapacityKw;
        const ratio = effectiveCapacity / totalPowerKw;
        const derating = calcData.dryCoolerDeratingFactor;
        const deratingNote = derating < 1
          ? ` (derated to ${(derating * 100).toFixed(0)}% at ${calcData.climate.maxTempC}°C ambient)`
          : "";
        if (ratio < 1) {
          w.push({
            type: "error",
            message: `Effective dry cooler capacity (${formatNumber(effectiveCapacity, 1)} kW${deratingNote}) is ${((1 - ratio) * 100).toFixed(0)}% below your heat load (${formatNumber(totalPowerKw, 1)} kW).`,
          });
        } else if (ratio > 1.5) {
          w.push({
            type: "info",
            message: `Dry coolers are oversized by ${((ratio - 1) * 100).toFixed(0)}%${deratingNote}. Consider downsizing to save on CAPEX.`,
          });
        }
      }
    }

    // Cooling checks for air-cooled miners
    if (isAir) {
      if (temperature.airFanSelections.length === 0) {
        w.push({ type: "warning", message: "Air-cooled miners detected but no ventilation fans configured. Go to the Thermal tab." });
      } else {
        const totalAirflow = temperature.airFanSelections.reduce((sum, sel) => {
          const model = airFans.find((m) => m.model === sel.model);
          return sum + (model ? model.airflow_m3h * sel.quantity : 0);
        }, 0);
        if (totalAirflow < ventilation.m3h) {
          w.push({
            type: "warning",
            message: `Fan airflow (${formatNumber(totalAirflow)} m3/h) is below the ${formatNumber(Math.round(ventilation.m3h))} m3/h needed. Add more fans or increase quantity.`,
          });
        }
      }
    }

    // Profitability check with live data
    const networkHashrateEh = networkData?.networkHashrateEh ?? CURRENT_NETWORK_HASHRATE_EH;
    const blockReward = networkData?.blockReward ?? CURRENT_BLOCK_REWARD;
    const btcPriceUsd = networkData?.btcPriceUsd ?? 0;

    if (btcPriceUsd > 0) {
      const farmHashrateEh = metrics.totalHashRateThs / 1e6;
      const poolShare = networkHashrateEh > 0 ? farmHashrateEh / networkHashrateEh : 0;
      const monthlyBtc = BLOCKS_PER_DAY * 30 * poolShare * blockReward * (1 - config.poolFeePercent / 100) * (config.uptimePercent / 100);
      const monthlyRevenue = monthlyBtc * btcPriceUsd;

      if (monthlyRevenue > 0 && metrics.monthlyOpex > monthlyRevenue) {
        w.push({
          type: "error",
          message: `Monthly OPEX (${formatUsd(metrics.monthlyOpex)}) exceeds mining revenue (${formatUsd(monthlyRevenue)}). This farm loses money at current BTC price.`,
        });
      }
    }

    // Transformer size info
    if (metrics.transformerKva > 0 && metrics.transformerKva < 15) {
      w.push({
        type: "info",
        message: `Your farm draws ${metrics.transformerKva.toFixed(1)} kVA — no dedicated transformer needed. Standard residential/commercial supply is sufficient.`,
      });
    }

    return w;
  }, [config, networkData, calcData, airFans]);

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl text-sm backdrop-blur-sm ${
            w.type === "error"
              ? "glass-danger text-red-800"
              : w.type === "warning"
                ? "glass-warning text-amber-800"
                : "glass-info text-blue-800"
          }`}
        >
          {w.type === "info" ? (
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
