"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Thermometer, Wind, Droplets, Fan } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Input from "./ui/Input";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { DRY_COOLERS } from "@/lib/dryCoolerData";
import { AIR_FANS } from "@/lib/airFanData";
import { calculateVentilation, calculateTotalPower, hasWatercooledMiners, hasAircooledMiners } from "@/lib/calculations";
import { formatNumber, formatUsd } from "@/lib/utils";
import type { DryCoolerSelection, AirFanSelection, LocationData } from "@/types";

// Dynamically import the map modal (no SSR — leaflet requires window)
const LocationMapModal = dynamic(() => import("./LocationMapModal"), { ssr: false });

function cToF(c: number) { return parseFloat((c * 9 / 5 + 32).toFixed(1)); }

export default function TemperatureControl() {
  const { config, updateTemperature } = useFarmStore();
  const temperature = config.temperature ?? { location: null, dryCoolerSelections: [], airFanSelections: [] };
  const { location, dryCoolerSelections, airFanSelections } = temperature;

  const [showMap, setShowMap] = useState(false);

  const isHydro = hasWatercooledMiners(config);
  const isAir = hasAircooledMiners(config);
  const totalPowerKw = calculateTotalPower(config);
  const ventilation = useMemo(() => calculateVentilation(config), [config]);

  // Dry cooler logic (auto-selection happens in store when miners change)
  const dryCoolerCapexRows = useMemo(() => {
    const hourlyRate = config.labor.hourlyLaborCostUsd;
    return dryCoolerSelections.map((sel) => {
      const model = DRY_COOLERS.find((m) => m.model === sel.model);
      if (!model) return null;
      const unitCost = model.estimated_cost_usd + model.man_hours_deploy * hourlyRate + model.plumbing_fluid_cost_usd;
      return { ...sel, model, unitCost, totalCost: sel.quantity * unitCost };
    }).filter(Boolean) as Array<{ model: typeof DRY_COOLERS[0]; quantity: number; unitCost: number; totalCost: number }>;
  }, [dryCoolerSelections, config.labor.hourlyLaborCostUsd]);

  const totalDryCoolerCapex = dryCoolerCapexRows.reduce((s, r) => s + r.totalCost, 0);
  const totalDryCoolerKw = dryCoolerCapexRows.reduce((s, r) => s + r.quantity * r.model.kw_capacity_35c, 0);
  const totalDryCoolerNoise = dryCoolerCapexRows.length
    ? Math.max(...dryCoolerCapexRows.map((r) => r.model.sound_dba))
    : 0;
  const totalDryCoolerFanW = dryCoolerCapexRows.reduce((s, r) => s + r.quantity * r.model.fan_motor_w, 0);

  function handleLocationConfirm(loc: LocationData) {
    updateTemperature({ location: loc });
    setShowMap(false);
  }

  function handleLocationFieldChange<K extends keyof LocationData>(key: K, value: LocationData[K]) {
    if (!location) return;
    updateTemperature({ location: { ...location, [key]: value } });
  }

  function handleAddDryCooler(model: string) {
    const exists = dryCoolerSelections.find((s) => s.model === model);
    if (exists) return;
    const m = DRY_COOLERS.find((d) => d.model === model);
    if (!m) return;
    const autoQty = Math.max(1, Math.ceil(totalPowerKw / m.kw_capacity_35c));
    updateTemperature({
      dryCoolerSelections: [...dryCoolerSelections, { model, quantity: autoQty }],
    });
  }

  function handleQtyChange(model: string, qty: number) {
    updateTemperature({
      dryCoolerSelections: dryCoolerSelections.map((s) =>
        s.model === model ? { ...s, quantity: Math.max(1, qty) } : s
      ),
    });
  }

  function handleRemoveDryCooler(model: string) {
    updateTemperature({
      dryCoolerSelections: dryCoolerSelections.filter((s) => s.model !== model),
    });
  }

  // ─── Air fan state & handlers ────────────────────────────────────────────
  const airFanRows = useMemo(() => {
    const hourlyRate = config.labor.hourlyLaborCostUsd;
    return airFanSelections.map((sel) => {
      const model = AIR_FANS.find((m) => m.model === sel.model);
      if (!model) return null;
      const unitCost = model.cost_usd + model.man_hours_deploy * hourlyRate;
      return { ...sel, model, unitCost, totalCost: sel.quantity * unitCost };
    }).filter(Boolean) as Array<{ model: typeof AIR_FANS[0]; quantity: number; unitCost: number; totalCost: number }>;
  }, [airFanSelections, config.labor.hourlyLaborCostUsd]);

  const totalFanAirflow = airFanRows.reduce((s, r) => s + r.quantity * r.model.airflow_m3h, 0);
  const totalFanPowerW  = airFanRows.reduce((s, r) => s + r.quantity * r.model.power_w, 0);
  const totalFanCapex   = airFanRows.reduce((s, r) => s + r.totalCost, 0);
  const totalFanNoise   = airFanRows.length ? Math.max(...airFanRows.map((r) => r.model.noise_db)) : 0;
  const totalFanManHours = airFanRows.reduce((s, r) => s + r.quantity * r.model.man_hours_deploy, 0);
  const airflowSufficient = totalFanAirflow >= ventilation.m3h;

  const [selectedFanModel, setSelectedFanModel] = useState(AIR_FANS[0].model);
  const addedFanModels = new Set(airFanSelections.map((s) => s.model));

  function handleAddFan(model: string) {
    if (addedFanModels.has(model)) return;
    const m = AIR_FANS.find((f) => f.model === model);
    if (!m) return;
    const autoQty = Math.max(1, Math.ceil(ventilation.m3h / m.airflow_m3h));
    updateTemperature({ airFanSelections: [...airFanSelections, { model, quantity: autoQty }] });
  }

  function handleFanQtyChange(model: string, qty: number) {
    updateTemperature({
      airFanSelections: airFanSelections.map((s) =>
        s.model === model ? { ...s, quantity: Math.max(1, qty) } : s
      ),
    });
  }

  function handleRemoveFan(model: string) {
    updateTemperature({ airFanSelections: airFanSelections.filter((s) => s.model !== model) });
  }

  const previewFanModel = AIR_FANS.find((m) => m.model === selectedFanModel);

  // ─── Dry cooler dropdown state ────────────────────────────────────────────
  const [selectedModel, setSelectedModel] = useState(DRY_COOLERS[0].model);
  const addedModels = new Set(dryCoolerSelections.map((s) => s.model));
  const availableModels = DRY_COOLERS.filter((m) => !addedModels.has(m.model));
  const previewModel = DRY_COOLERS.find((m) => m.model === selectedModel);

  return (
    <div className="space-y-6">
      {/* Location Card */}
      <Card>
        <CardIllustration theme="thermal" />
        <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-blueprint-deep" />
          Site Location & Climate
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Climate data affects cooling sizing and dry cooler derating. All fields are editable after map pick.
        </p>

        <button
          onClick={() => setShowMap(true)}
          className="mb-6 px-5 py-2.5 text-sm font-semibold bg-blueprint-deep text-white rounded-xl hover:bg-blue-800 transition-all shadow-md"
        >
          Choose Location
        </button>

        {location ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                City / Location
                <Tooltip content="Nearest city or region name resolved from map click. Editable." />
              </label>
              <Input
                value={location.city}
                onChange={(e) => handleLocationFieldChange("city", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                Avg Yearly Temp
                <Tooltip content="Annual mean temperature (average of daily max+min) for the selected site. Sourced from ERA5 reanalysis via Open-Meteo. Used to derate dry cooler capacity above 35 C baseline." />
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step="0.1"
                  value={location.avgYearlyTempC}
                  onChange={(e) => handleLocationFieldChange("avgYearlyTempC", parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-slate-400 whitespace-nowrap font-mono tabular-nums">{cToF(location.avgYearlyTempC)} F</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                Max Temp
                <Tooltip content="Hottest day recorded during the reference year. Design your cooling for worst-case ambient — dry cooler capacity drops ~3% per C above 35 C." />
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step="0.1"
                  value={location.maxTempC}
                  onChange={(e) => handleLocationFieldChange("maxTempC", parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-slate-400 whitespace-nowrap font-mono tabular-nums">{cToF(location.maxTempC)} F</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                Min Temp
                <Tooltip content="Coldest day recorded. Relevant for glycol/antifreeze mix sizing in hydro loops." />
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step="0.1"
                  value={location.minTempC}
                  onChange={(e) => handleLocationFieldChange("minTempC", parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-slate-400 whitespace-nowrap font-mono tabular-nums">{cToF(location.minTempC)} F</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                Avg Humidity
                <Tooltip content="Annual mean relative humidity. High humidity (>80%) increases thermal stress on air-cooled ASICs and affects corrosion risk. Source: ERA5 hourly mean." />
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={location.avgHumidityPercent}
                  onChange={(e) => handleLocationFieldChange("avgHumidityPercent", parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-slate-400 font-mono">%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No location set. Click &quot;Choose Location&quot; to pick from the map.</p>
        )}
      </Card>

      {/* Air Cooling Ventilation Card */}
      {isAir && config.miners.length > 0 && (
        <Card>
          <CardIllustration theme="thermal" />
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Wind className="h-5 w-5 text-blueprint-deep" />
            Air Ventilation Requirement
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Minimum airflow to exhaust heat from air-cooled miners.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 glass-inner rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-slate-500">Airflow needed</span>
                <Tooltip content={
                  <div className="space-y-1">
                    <p><strong>Formula:</strong></p>
                    <p>Q = P / (rho x Cp x dT)</p>
                    <p>rho = 1.2 kg/m3 (air density)</p>
                    <p>Cp = 1005 J/kg K (specific heat)</p>
                    <p>dT = 15 C (assumed air rise)</p>
                    <p>= Q (m3/h) = P_kW x 200</p>
                  </div>
                } />
              </div>
              <div className="text-2xl font-bold font-mono text-blueprint-deep tabular-nums">
                {formatNumber(Math.round(ventilation.m3h))} m3/h
              </div>
            </div>
            <div className="p-4 glass-inner rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-slate-500">Airflow needed</span>
                <Tooltip content="1 m3/h = 0.5886 CFM. CFM (Cubic Feet per Minute) is the standard used by HVAC vendors in North America." />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
                {formatNumber(Math.round(ventilation.cfm))} CFM
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Based on {formatNumber(totalPowerKw, 1)} kW total heat load (miners + {config.parasiticLoadPercent}% parasitic).
            Assumes 15 C air temperature rise across the miners. Add 20-30% margin for actual system design.
          </p>
        </Card>
      )}

      {/* Air Cooling Fans Card */}
      {isAir && config.miners.length > 0 && (
        <Card>
          <CardIllustration theme="thermal" />
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Fan className="h-5 w-5 text-blueprint-deep" />
            Air Cooling Fans
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Select industrial wall/exhaust fans to meet the ventilation requirement. Quantity auto-suggests based on required airflow.
            Cost includes hardware + deployment labor (at the hourly rate from the Labor tab).
          </p>

          {/* Model selector */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-48">
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                Fan model
                <Tooltip content="Select an industrial axial fan model. Airflow is rated at free-delivery (no static back-pressure). Real installations typically achieve 80-90% of rated flow — add margin." />
              </label>
              <select
                className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 focus:border-blueprint-mid/50 transition-all"
                value={selectedFanModel}
                onChange={(e) => setSelectedFanModel(e.target.value)}
              >
                {AIR_FANS.map((m) => (
                  <option key={m.model} value={m.model} disabled={addedFanModels.has(m.model)}>
                    {m.model} — {formatNumber(m.airflow_m3h)} m3/h · {m.power_w} W
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => handleAddFan(selectedFanModel)}
                disabled={addedFanModels.has(selectedFanModel)}
                className="px-4 py-2 text-sm font-semibold bg-blueprint-deep text-white rounded-xl hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Preview specs of selected model */}
          {previewFanModel && (
            <div className="mb-5 p-3 glass-inner rounded-2xl text-xs text-slate-500 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><span className="text-slate-700 font-medium">Diameter:</span> {previewFanModel.diameter_mm} mm</div>
              <div><span className="text-slate-700 font-medium">Airflow:</span> {formatNumber(previewFanModel.airflow_m3h)} m3/h</div>
              <div><span className="text-slate-700 font-medium">Power:</span> {previewFanModel.power_w} W</div>
              <div><span className="text-slate-700 font-medium">Noise:</span> {previewFanModel.noise_db} dB</div>
              <div><span className="text-slate-700 font-medium">Speed:</span> {previewFanModel.rpm} RPM · {previewFanModel.hz} Hz</div>
              <div><span className="text-slate-700 font-medium">Dims (mm):</span> {previewFanModel.width_mm}x{previewFanModel.height_mm}</div>
              <div><span className="text-slate-700 font-medium">Hardware cost:</span> {formatUsd(previewFanModel.cost_usd)}</div>
              <div><span className="text-slate-700 font-medium">Deploy:</span> {previewFanModel.man_hours_deploy} h/unit</div>
            </div>
          )}

          {/* Selected fans list */}
          {airFanRows.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected Fans</p>
              {airFanRows.map((row) => (
                <div key={row.model.model} className="flex flex-wrap items-center gap-3 p-3 glass-inner rounded-2xl text-sm">
                  <div className="flex-1 min-w-32">
                    <p className="font-medium text-slate-900">{row.model.model}</p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(row.model.airflow_m3h)} m3/h · {row.model.power_w} W · {row.model.noise_db} dB
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 flex items-center gap-1">
                      Qty
                      <Tooltip content={`Auto-suggested: ceil(${formatNumber(Math.round(ventilation.m3h))} m3/h / ${formatNumber(row.model.airflow_m3h)} m3/h) = ${Math.ceil(ventilation.m3h / row.model.airflow_m3h)} units to meet required airflow.`} />
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => handleFanQtyChange(row.model.model, parseInt(e.target.value) || 1)}
                      className="w-16 bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 transition-all"
                    />
                  </div>

                  <div className="text-right min-w-28">
                    <p className="font-mono font-medium text-blueprint-deep tabular-nums">{formatUsd(row.totalCost)}</p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">{formatUsd(row.unitCost)}/unit</p>
                  </div>

                  <button
                    onClick={() => handleRemoveFan(row.model.model)}
                    className="text-slate-400 hover:text-red-500 transition-colors text-sm"
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              ))}

              {/* Totals */}
              <div className="mt-2 pt-3 border-t border-slate-200/50 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    Airflow supplied
                    <Tooltip content="Sum of (quantity x model airflow) for all selected fans. Must exceed the ventilation requirement calculated from your farm heat load. A 20-30% margin above the minimum is recommended." />
                  </span>
                  <span className={`font-mono font-medium tabular-nums ${airflowSufficient ? "text-emerald-600" : "text-red-600"}`}>
                    {formatNumber(Math.round(totalFanAirflow))} m3/h
                    {airflowSufficient ? " OK" : ` — need ${formatNumber(Math.round(ventilation.m3h))}`}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    Total fan power draw
                    <Tooltip content="Electrical power consumed by all fans combined. This is added to your farm's total power draw and monthly electricity cost." />
                  </span>
                  <span className="font-mono tabular-nums">{formatNumber(totalFanPowerW / 1000, 2)} kW</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    Max noise level
                    <Tooltip content="Highest dB rating across selected fan models at full speed. Industrial facilities typically require <85 dB at 1 m distance." />
                  </span>
                  <span className="font-mono tabular-nums">{totalFanNoise} dB</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    Total deployment labor
                    <Tooltip content="Sum of (quantity x man_hours_deploy) for all selected fans. These hours are factored into the total labor CAPEX shown in the Deploy & Labor tab." />
                  </span>
                  <span className="font-mono tabular-nums">{formatNumber(totalFanManHours, 1)} h</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-slate-200/50">
                  <span className="text-slate-900 flex items-center gap-1">
                    Total Fan CAPEX
                    <Tooltip content="Hardware cost + deployment labor (man_hours x hourly rate from the Labor tab). Added to your farm's total CAPEX." />
                  </span>
                  <span className="text-blueprint-deep font-mono text-lg tabular-nums">{formatUsd(totalFanCapex)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No fans added yet. Select a model above and click Add.
            </p>
          )}
        </Card>
      )}

      {/* Hydro Dry Cooler Card */}
      {isHydro && config.miners.length > 0 && (
        <Card>
          <CardIllustration theme="thermal" />
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blueprint-deep" />
            Dry Cooler Sizing
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Select dry cooler models for your hydro loop. Quantity auto-suggests based on total heat load ({formatNumber(totalPowerKw, 1)} kW).
            Costs include hardware + deployment labor + plumbing/fluid.
          </p>

          {/* Model selector */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-48">
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                Add model
                <Tooltip content="kW capacity rated at 35 C ambient. Pick a model, then add it. Quantity auto-fills based on your farm's heat load." />
              </label>
              <select
                className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 focus:border-blueprint-mid/50 transition-all"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {DRY_COOLERS.map((m) => (
                  <option key={m.model} value={m.model} disabled={addedModels.has(m.model)}>
                    {m.model} — {m.kw_capacity_35c} kW @ 35 C
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => handleAddDryCooler(selectedModel)}
                disabled={addedModels.has(selectedModel)}
                className="px-4 py-2 text-sm font-semibold bg-blueprint-deep text-white rounded-xl hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Preview selected model specs */}
          {previewModel && (
            <div className="mb-5 p-3 glass-inner rounded-2xl text-xs text-slate-500 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><span className="text-slate-700 font-medium">Airflow:</span> {formatNumber(previewModel.air_flow_m3h)} m3/h</div>
              <div><span className="text-slate-700 font-medium">Fan power:</span> {previewModel.fan_motor_w} W / {previewModel.fan_motor_a} A</div>
              <div><span className="text-slate-700 font-medium">Noise:</span> {previewModel.sound_dba} dBA</div>
              <div><span className="text-slate-700 font-medium">Dims (mm):</span> {previewModel.length_mm}x{previewModel.width_mm}x{previewModel.height_mm}</div>
              <div><span className="text-slate-700 font-medium">Water flow:</span> {previewModel.water_flow_m3h} m3/h</div>
              <div><span className="text-slate-700 font-medium">Pressure drop:</span> {previewModel.pressure_drop_kpa} kPa</div>
              <div><span className="text-slate-700 font-medium">Inlet:</span> {previewModel.inlet_mm}</div>
              <div><span className="text-slate-700 font-medium">Weight:</span> {previewModel.weight_kg} kg</div>
            </div>
          )}

          {/* Selected models table */}
          {dryCoolerCapexRows.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected Models</p>
              {dryCoolerCapexRows.map((row) => (
                <div key={row.model.model} className="flex flex-wrap items-center gap-3 p-3 glass-inner rounded-2xl text-sm">
                  <div className="flex-1 min-w-32">
                    <p className="font-medium text-slate-900">{row.model.model}</p>
                    <p className="text-xs text-slate-500">
                      {row.model.kw_capacity_35c} kW · {row.model.sound_dba} dBA · {row.model.fan_motor_w} W fan
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 flex items-center gap-1">
                      Qty
                      <Tooltip content={`Auto-suggested: ceil(${formatNumber(totalPowerKw, 1)} kW / ${row.model.kw_capacity_35c} kW) = ${Math.ceil(totalPowerKw / row.model.kw_capacity_35c)} units. Override as needed.`} />
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => handleQtyChange(row.model.model, parseInt(e.target.value) || 1)}
                      className="w-16 bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20 transition-all"
                    />
                  </div>

                  <div className="text-right min-w-28">
                    <p className="font-mono font-medium text-blueprint-deep tabular-nums">{formatUsd(row.totalCost)}</p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">{formatUsd(row.unitCost)}/unit</p>
                  </div>

                  <button
                    onClick={() => handleRemoveDryCooler(row.model.model)}
                    className="text-slate-400 hover:text-red-500 transition-colors text-sm"
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              ))}

              {/* Totals */}
              <div className="mt-2 pt-3 border-t border-slate-200/50 text-sm space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    Total cooling capacity
                    <Tooltip content="Sum of all dry cooler kW capacities at 35 C ambient. Should exceed your farm heat load. For hot climates, derate ~3% per C above 35 C." />
                  </span>
                  <span className="font-mono tabular-nums">{formatNumber(totalDryCoolerKw, 1)} kW {totalDryCoolerKw < totalPowerKw ? "— undersized" : "OK"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    Max noise level
                    <Tooltip content="Highest dBA rating across selected models at full fan speed. Industrial sites: <70 dBA typical limit." />
                  </span>
                  <span className="font-mono tabular-nums">{totalDryCoolerNoise} dBA</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    Total fan power
                    <Tooltip content="Total electrical power consumed by all dry cooler fans. Included in your farm's parasitic load estimate." />
                  </span>
                  <span className="font-mono tabular-nums">{formatNumber(totalDryCoolerFanW / 1000, 2)} kW</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-slate-200/50">
                  <span className="text-slate-900 flex items-center gap-1">
                    Total Dry Cooler CAPEX
                    <Tooltip content="Hardware cost + deployment labor (man_hours x hourly rate from Labor tab) + plumbing & coolant fluid." />
                  </span>
                  <span className="text-blueprint-deep font-mono text-lg tabular-nums">{formatUsd(totalDryCoolerCapex)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No dry coolers added. Select a model above and click Add.</p>
          )}
        </Card>
      )}

      {/* Map Modal */}
      {showMap && (
        <LocationMapModal
          onConfirm={handleLocationConfirm}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
