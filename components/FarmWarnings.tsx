"use client";

import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useFarmStore } from "@/lib/store";
import { useCalculation, useMarket } from "@/lib/apiClient";
import { monthlyBtcMined } from "@/lib/unitEconomics";
import { coolingHeatLoadKw } from "@/lib/cooling";
import { calculateMonthlyOpexBreakdown } from "@/lib/calculations";
import { formatNumber, formatUsd } from "@/lib/utils";

interface Warning {
  type: "error" | "warning" | "info";
  message: string;
}

export default function FarmWarnings() {
  const config = useFarmStore((state) => state.config);
  const market = useMarket();
  const { data: calcData } = useCalculation(config);
  const airFans = useFarmStore((state) => state.airFanCatalog);

  const warnings = useMemo(() => {
    const w: Warning[] = [];
    if (config.miners.length === 0 || !calcData) return w;

    const { metrics, ventilation } = calcData;
    const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };
    const isHydro = config.miners.some(({ miner }) => miner.watercooled);
    const isAir = config.miners.some(({ miner }) => !miner.watercooled);

    // Cooling checks for hydro miners (uses climate-derated capacity)
    if (isHydro) {
      if (temperature.dryCoolerSelections.length === 0) {
        w.push({ type: "error", message: "Water-cooled miners detected but no dry coolers configured. Go to the Thermal tab." });
      } else {
        const effectiveCapacity = calcData.effectiveDryCoolerCapacityKw;
        const hydroHeatKw = coolingHeatLoadKw(config, "hydro");
        const ratio = effectiveCapacity / hydroHeatKw;
        const derating = calcData.dryCoolerDeratingFactor;
        const deratingNote = derating < 1
          ? ` (derated to ${(derating * 100).toFixed(0)}% at ${calcData.climate.maxTempC}°C ambient)`
          : "";
        if (ratio < 1) {
          w.push({
            type: "error",
            message: `Effective dry cooler capacity (${formatNumber(effectiveCapacity, 1)} kW${deratingNote}) is ${((1 - ratio) * 100).toFixed(0)}% below your hydro heat load (${formatNumber(hydroHeatKw, 1)} kW).`,
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

    // Profitability at the current market: informative, not an error. Red is
    // reserved for real misconfigurations (e.g. undersized cooling).
    const btcPriceUsd = market.btcPriceUsd;
    if (btcPriceUsd > 0) {
      const monthlyRevenue = monthlyBtcMined(metrics.totalHashRateThs, market, config) * btcPriceUsd;
      const opex = calculateMonthlyOpexBreakdown(config, metrics.totalCapex);
      if (monthlyRevenue > 0 && opex.total > monthlyRevenue) {
        // Electricity cost is linear in the power price, so solve revenue = OPEX for $/kWh.
        const otherOpex = opex.total - opex.electricity;
        const priceKwh = config.regional.electricityPriceKwh;
        const breakEvenKwh = opex.electricity > 0 ? (priceKwh * (monthlyRevenue - otherOpex)) / opex.electricity : 0;
        const priceLabel = `$${priceKwh.toFixed(3)}/kWh`;
        w.push({
          type: "info",
          message:
            breakEvenKwh > 0
              ? `At ${priceLabel} this farm loses ${formatUsd(opex.total - monthlyRevenue)}/month at today's BTC price (${formatUsd(btcPriceUsd)}). Break-even power price: $${breakEvenKwh.toFixed(3)}/kWh.`
              : `At today's BTC price (${formatUsd(btcPriceUsd)}) this farm's non-electricity costs alone exceed its revenue, so it loses money even with free power.`,
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
  }, [config, market, calcData, airFans]);

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 px-4 py-3 rounded text-sm  ${
            w.type === "error"
              ? "note-bad text-bad"
              : w.type === "warning"
                ? "note-warn text-warn"
                : "note-info text-cool"
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
