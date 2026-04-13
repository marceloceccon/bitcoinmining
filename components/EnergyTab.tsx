"use client";

import { Sun, Settings, Calculator } from "lucide-react";
import { useState, useMemo } from "react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Slider from "./ui/Slider";
import Input from "./ui/Input";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";
import {
  calculateSolarPanelCount,
  calculateSolarAreaSqm,
  calculateSolarAreaSqft,
  calculateEffectiveSolarCoverage,
  calculateSolarInstalledKw,
} from "@/lib/calculations";

export default function EnergyTab() {
  const { config, updateSolar, updateRegional } = useFarmStore();
  const [showCalc, setShowCalc] = useState(false);
  const [billAmount, setBillAmount] = useState("");
  const [billKwh, setBillKwh] = useState("");

  const solarStats = useMemo(() => {
    if (config.solar.coveragePercent === 0) return null;
    return {
      panelCount: calculateSolarPanelCount(config),
      areaSqm: calculateSolarAreaSqm(config),
      areaSqft: calculateSolarAreaSqft(config),
      effectiveCoverage: calculateEffectiveSolarCoverage(config),
      installedKw: calculateSolarInstalledKw(config),
    };
  }, [config]);

  return (
    <div className="space-y-6">
      {/* Regional Settings */}
      <Card>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-600" />
          Regional Settings
        </h2>

        <div className="space-y-4">
          {/* Electricity Price */}
          <Slider
            label="Electricity Price"
            unit=" $/kWh"
            min={0.01}
            max={2}
            step={0.01}
            value={config.regional.electricityPriceKwh}
            onChange={(e) =>
              updateRegional({
                electricityPriceKwh: parseFloat(e.target.value),
                region: "CUSTOM",
              })
            }
            tooltip="The cost you pay per kilowatt-hour of grid electricity. This is your primary operating cost driver. Industrial miners typically negotiate bulk rates of $0.03–$0.08/kWh."
          />
          <button
            onClick={() => setShowCalc(!showCalc)}
            className="-mt-1 text-xs text-blueprint-deep hover:underline flex items-center gap-1"
          >
            <Calculator className="h-3 w-3" />
            {showCalc ? "Hide calculator" : "Don't know your $/kWh? Calculate from your bill"}
          </button>

          {/* Bill-based calculator */}
          {showCalc && (
            <div className="p-4 glass-info rounded-2xl space-y-3">
              <p className="text-sm font-medium text-blue-800">Electricity Rate Calculator</p>
              <p className="text-xs text-blue-600">Enter your monthly electricity bill and kWh usage to calculate your rate.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Monthly Bill ($)</label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 150"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Monthly Usage (kWh)</label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 1200"
                    value={billKwh}
                    onChange={(e) => setBillKwh(e.target.value)}
                  />
                </div>
              </div>
              {billAmount && billKwh && parseFloat(billKwh) > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-blue-200/50">
                  <div>
                    <span className="text-sm text-blue-800">Your rate: </span>
                    <span className="text-sm font-bold text-blue-900 font-mono">
                      ${(parseFloat(billAmount) / parseFloat(billKwh)).toFixed(4)}/kWh
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const rate = parseFloat(billAmount) / parseFloat(billKwh);
                      // Clamp to the slider bounds so the bill-derived rate is always representable.
                      const clamped = Math.min(2, Math.max(0.01, parseFloat(rate.toFixed(2))));
                      updateRegional({ electricityPriceKwh: clamped, region: "CUSTOM" });
                      setShowCalc(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-blueprint-deep text-white rounded-xl hover:bg-blue-800 transition-all shadow-sm"
                  >
                    Apply Rate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tax */}
          <Slider
            label="Tax"
            unit="%"
            min={0}
            max={50}
            step={1}
            value={config.regional.taxAdderPercent}
            onChange={(e) =>
              updateRegional({ taxAdderPercent: parseFloat(e.target.value) })
            }
            tooltip="An additional percentage applied on top of your electricity price to account for local taxes, grid fees, or regulatory surcharges. Increases your effective electricity cost."
          />

          {/* Energy Inflation */}
          <Slider
            label="Yearly Energy Inflation"
            unit="%"
            min={0}
            max={15}
            step={0.5}
            value={config.regional.energyInflationPercent}
            onChange={(e) =>
              updateRegional({ energyInflationPercent: parseFloat(e.target.value) })
            }
            tooltip="Annual rate at which electricity prices increase. Applied as compound inflation in the projections engine. Historical average is ~2–4% globally."
          />
        </div>
      </Card>

      {/* Solar Configuration */}
      <Card>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Sun className="h-5 w-5 text-amber-500" />
          Solar Power
        </h2>

        <div className="space-y-4">
          {/* Solar Coverage */}
          <Slider
            label="Solar Coverage"
            unit="%"
            min={0}
            max={100}
            step={5}
            value={config.solar.coveragePercent}
            onChange={(e) =>
              updateSolar({ coveragePercent: parseFloat(e.target.value) })
            }
            tooltip="The percentage of your farm's electricity demand covered by solar generation on an annualized basis. At 100%, your farm runs entirely on solar during peak hours but may rely on the grid at night."
          />

          {config.solar.coveragePercent > 0 && (
            <>
              {/* Daytime Injection Rate */}
              <Slider
                label="Daytime Injection Rate"
                unit="%"
                min={0}
                max={100}
                step={5}
                value={config.solar.injectionRatePercent}
                onChange={(e) =>
                  updateSolar({ injectionRatePercent: parseFloat(e.target.value) })
                }
                tooltip="How much of the surplus solar energy sent back to the grid is credited by your utility. At 100%, there is no injection tax. Lower values mean you lose some credit for excess energy."
              />
              <p className="text-xs text-slate-500 -mt-2">
                How much of injected solar energy is credited by the grid. Lower = higher injection tax.
              </p>

              {/* Commission in CAPEX toggle */}
              <label className="flex items-start gap-3 p-3 glass-inner rounded-2xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.solar.includeCommissioningInCapex}
                  onChange={(e) =>
                    updateSolar({ includeCommissioningInCapex: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blueprint-deep focus:ring-blueprint-deep cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-sm font-medium text-slate-700">
                    Include Solar Farm Commissioning on Capex
                    <Tooltip content="Enable this if you are commissioning the solar farm as part of the mining farm build. When on, the solar installation cost is added to the project's total CAPEX alongside miners, racks, and cabling. When off, the solar farm is treated as a separate project and only its monthly maintenance affects your mining farm's OPEX." />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rolls the full solar build estimate into the mining farm&apos;s total CAPEX.
                  </p>
                </div>
              </label>

              {/* Installation Cost */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  Installation Cost ($/kW)
                  <Tooltip content="The upfront capital cost per kilowatt of solar capacity installed. Includes panels, inverters, mounting, and labor. Typical range for commercial installations is $800–$1,500/kW." />
                </label>
                <Input
                  type="number"
                  step="100"
                  value={config.solar.installationCostPerKw}
                  onChange={(e) =>
                    updateSolar({
                      installationCostPerKw: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-slate-500 mt-1">
                  Typical range: $800-$1,500/kW
                </p>
              </div>

              {/* Maintenance */}
              <Slider
                label="Annual Solar Maintenance"
                unit="% of Capex"
                min={0}
                max={10}
                step={0.5}
                value={config.solar.maintenancePercentPerYear}
                onChange={(e) =>
                  updateSolar({
                    maintenancePercentPerYear: parseFloat(e.target.value),
                  })
                }
                tooltip="Annual maintenance and servicing cost expressed as a percentage of the total solar installation cost. Covers panel cleaning, inverter servicing, and minor repairs. This cost is included in your monthly OPEX."
              />

              {/* Solar Stats Info Box */}
              <div className="p-4 glass-warning rounded-2xl">
                <div className="text-sm space-y-2">
                  <p className="font-semibold text-amber-600">
                    Solar reduces grid electricity by{" "}
                    {solarStats ? solarStats.effectiveCoverage.toFixed(1) : config.solar.coveragePercent}%
                    {config.solar.injectionRatePercent < 100 && (
                      <span className="text-amber-500 font-normal">
                        {" "}(nominal {config.solar.coveragePercent}%, after injection tax)
                      </span>
                    )}
                  </p>
                  {solarStats && (
                    <>
                      <p className="text-slate-500">
                        • Approximately{" "}
                        <span className="font-semibold text-slate-900">
                          {formatNumber(solarStats.panelCount)} solar panels
                        </span>{" "}
                        (400W each) — {formatNumber(solarStats.installedKw)} kW installed
                      </p>
                      <p className="text-slate-500">
                        • Solar Farm area:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatNumber(solarStats.areaSqm)} m²
                        </span>{" "}
                        ({formatNumber(solarStats.areaSqft)} ft²)
                      </p>
                    </>
                  )}
                  <p className="text-slate-500">
                    • 10-year straight-line depreciation
                  </p>
                  <p className="text-slate-500">
                    • Daytime injection + grid fallback
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
