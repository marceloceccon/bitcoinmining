/**
 * Cooling sizing — the **single** implementation used by the engine, the store's
 * auto-sizing, the Thermal tab, the REST API and MCP. Pure: no I/O, no catalogs
 * imported; callers pass the catalog rows they want to size from.
 */
import type { AirFanModel, AirFanSelection, DryCoolerModel, DryCoolerSelection, FarmConfig, LocationData } from '@/types';

/** Temperate, non-extreme fallback climate (roughly Central Europe / US Mid-Atlantic). */
export const DEFAULT_CLIMATE: LocationData = {
  lat: 40,
  lng: -80,
  city: "Default (temperate)",
  avgYearlyTempC: 25,
  maxTempC: 35,
  minTempC: 5,
  avgHumidityPercent: 60,
};

export type Climate = Pick<LocationData, 'maxTempC' | 'avgHumidityPercent'>;
export type CoolingKind = 'air' | 'hydro';

/** Air: ρ = 1.2 kg/m³, Cp = 1005 J/kg·K. */
const AIR_DENSITY = 1.2;
const AIR_SPECIFIC_HEAT = 1005;
/** Labor rate used when a caller has no farm config (e.g. a bare heat-load query). */
export const DEFAULT_HOURLY_LABOR_USD = 20;

/**
 * Heat the given cooling system must reject, in kW: the power of the miners it
 * cools (air-cooled or water-cooled), plus the farm's parasitic load share.
 * For a single-type farm this equals total farm power.
 */
export function coolingHeatLoadKw(config: Pick<FarmConfig, 'miners' | 'parasiticLoadPercent'>, kind: CoolingKind): number {
  const watts = config.miners
    .filter(({ miner }) => (kind === 'hydro' ? miner.watercooled : !miner.watercooled))
    .reduce((total, { miner, quantity }) => total + miner.power_watts * quantity, 0);
  return (watts * (1 + config.parasiticLoadPercent / 100)) / 1000;
}

/**
 * Dry cooler derating vs the 35 °C rating: −3 %/°C above (floor 50 %),
 * +2 %/°C below (cap 130 %). 1.0 at 35 °C, 0.7 at 45 °C, 1.1 at 30 °C.
 */
export function dryCoolerDeratingFactor(maxTempC: number): number {
  const deltaAbove35 = maxTempC - 35;
  if (deltaAbove35 > 0) return Math.max(0.5, 1 - deltaAbove35 * 0.03);
  return Math.min(1.3, 1 + Math.abs(deltaAbove35) * 0.02);
}

/**
 * Airflow needed to carry `heatKw` away: Q = P / (ρ·Cp·ΔT).
 * ΔT shrinks in hot climates (max(5, 50 − maxTempC): 15 °C at 35 °C ambient),
 * and humidity above 70 % adds +1 %/point (capped at +15 %).
 */
export function requiredAirflowM3h(heatKw: number, climate: Climate): number {
  const effectiveDeltaT = Math.max(5, 50 - climate.maxTempC);
  const baseM3h = (heatKw * 1000 * 3600) / (AIR_DENSITY * AIR_SPECIFIC_HEAT * effectiveDeltaT);
  const humidityExcess = Math.max(0, climate.avgHumidityPercent - 70);
  return baseM3h * (1 + Math.min(humidityExcess * 0.01, 0.15));
}

export function dryCoolerUnitCostUsd(model: DryCoolerModel, hourlyLaborCostUsd: number): number {
  return model.estimated_cost_usd + model.man_hours_deploy * hourlyLaborCostUsd + model.plumbing_fluid_cost_usd;
}

export function airFanUnitCostUsd(model: AirFanModel, hourlyLaborCostUsd: number): number {
  return model.cost_usd + model.man_hours_deploy * hourlyLaborCostUsd;
}

/** Units of `model` needed to reject `heatKw` at the given derating (at least 1). */
export function dryCoolerQuantity(heatKw: number, model: DryCoolerModel, derating: number): number {
  return Math.max(1, Math.ceil(heatKw / (model.kw_capacity_35c * derating)));
}

/** Units of `model` needed to move `airflowM3h` (at least 1). */
export function airFanQuantity(airflowM3h: number, model: AirFanModel): number {
  return Math.max(1, Math.ceil(airflowM3h / model.airflow_m3h));
}

export interface CoolingSizing<TModel> {
  model: TModel;
  quantity: number;
  /** kW of heat (hydro) or m³/h of airflow (air) the system must handle */
  required: number;
  /** Total capacity of the selection in the same unit, after climate derating */
  effectiveCapacity: number;
  /** Electrical draw of the units' fans, kW */
  powerKw: number;
  /** Hardware + deployment labor (+ plumbing and fluid for dry coolers) */
  capexUsd: number;
}

/**
 * Recommend dry coolers for a hydro heat load: the model whose 35 °C rating is
 * closest to the load, in enough units to cover it after derating.
 */
export function sizeHydroCooling(
  heatKw: number,
  climate: Climate,
  coolers: DryCoolerModel[],
  hourlyLaborCostUsd = DEFAULT_HOURLY_LABOR_USD,
): CoolingSizing<DryCoolerModel> | null {
  if (heatKw <= 0 || coolers.length === 0) return null;
  const model = coolers.reduce((best, m) =>
    Math.abs(m.kw_capacity_35c - heatKw) < Math.abs(best.kw_capacity_35c - heatKw) ? m : best,
  );
  const derating = dryCoolerDeratingFactor(climate.maxTempC);
  const quantity = dryCoolerQuantity(heatKw, model, derating);
  return {
    model,
    quantity,
    required: heatKw,
    effectiveCapacity: model.kw_capacity_35c * derating * quantity,
    powerKw: (model.fan_motor_w * quantity) / 1000,
    capexUsd: dryCoolerUnitCostUsd(model, hourlyLaborCostUsd) * quantity,
  };
}

/** Recommend exhaust fans for an air-cooled heat load: the highest-airflow model, in enough units. */
export function sizeAirCooling(
  heatKw: number,
  climate: Climate,
  fans: AirFanModel[],
  hourlyLaborCostUsd = DEFAULT_HOURLY_LABOR_USD,
): CoolingSizing<AirFanModel> | null {
  if (heatKw <= 0 || fans.length === 0) return null;
  const model = fans.reduce((best, m) => (m.airflow_m3h > best.airflow_m3h ? m : best));
  const required = requiredAirflowM3h(heatKw, climate);
  const quantity = airFanQuantity(required, model);
  return {
    model,
    quantity,
    required,
    effectiveCapacity: model.airflow_m3h * quantity,
    powerKw: (model.power_w * quantity) / 1000,
    capexUsd: airFanUnitCostUsd(model, hourlyLaborCostUsd) * quantity,
  };
}

/**
 * Auto-sized cooling selections for a farm: dry coolers for its water-cooled
 * miners and fans for its air-cooled ones, at the farm's site climate.
 */
export function recommendCoolingSelections(
  config: Pick<FarmConfig, 'miners' | 'parasiticLoadPercent' | 'temperature' | 'labor'>,
  coolers: DryCoolerModel[],
  fans: AirFanModel[],
): { dryCoolerSelections: DryCoolerSelection[]; airFanSelections: AirFanSelection[] } {
  const climate = config.temperature?.location ?? DEFAULT_CLIMATE;
  const rate = config.labor?.hourlyLaborCostUsd ?? DEFAULT_HOURLY_LABOR_USD;
  const hydro = sizeHydroCooling(coolingHeatLoadKw(config, 'hydro'), climate, coolers, rate);
  const air = sizeAirCooling(coolingHeatLoadKw(config, 'air'), climate, fans, rate);
  return {
    dryCoolerSelections: hydro ? [{ model: hydro.model.model, quantity: hydro.quantity }] : [],
    airFanSelections: air ? [{ model: air.model.model, quantity: air.quantity }] : [],
  };
}
