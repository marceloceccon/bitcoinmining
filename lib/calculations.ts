import type { FarmConfig, FarmMetrics, Miner, LocationData } from '@/types';
import { DRY_COOLERS } from '@/lib/dryCoolerData';
import { AIR_FANS } from '@/lib/airFanData';
import { autoSelectTransformer } from '@/lib/transformerData';

// Constants
const HOURS_PER_MONTH = 730; // average
const WATTS_TO_BTU = 3.412; // BTU/h per Watt
const VOLTAGE = 220; // Standard industrial voltage
const SOLAR_PANEL_WATTS = 400;
const SQM_PER_KW_INSTALLED = 10; // ground-mounted solar with inter-row spacing
const SQM_TO_SQFT = 10.7639;

// Default climate: temperate, non-extreme (roughly Central Europe / US Mid-Atlantic)
const DEFAULT_CLIMATE: LocationData = {
  lat: 40,
  lng: -80,
  city: "Default (temperate)",
  avgYearlyTempC: 25,
  maxTempC: 35,
  minTempC: 5,
  avgHumidityPercent: 60,
};

/**
 * Returns the user-selected location or a temperate fallback.
 */
export function getEffectiveClimate(config: FarmConfig): LocationData {
  return config.temperature?.location ?? DEFAULT_CLIMATE;
}

// Infrastructure constants
export const RACK_COST_USD = 700;            // cost per rack unit (steel rack for 50 miners)
export const RACK_MINERS_CAPACITY = 50;      // miners per rack unit
export const CONTAINER_BASE_COST_USD = 6000; // bare 20ft container + steel flooring + foam insulation + basic electrical + ultra-white paint + averaged transport
export const CONTAINER_MINERS_CAPACITY = 250; // max miners per 20ft container

/**
 * Calculate total hash rate in TH/s
 */
export function calculateTotalHashRate(config: FarmConfig): number {
  return config.miners.reduce((total, { miner, quantity }) => {
    return total + (miner.hash_rate_ths * quantity);
  }, 0);
}

/**
 * Calculate total power consumption in kW
 */
export function calculateTotalPower(config: FarmConfig): number {
  const minerPower = config.miners.reduce((total, { miner, quantity }) => {
    return total + (miner.power_watts * quantity);
  }, 0);
  
  // Add parasitic load (cooling, networking, etc.)
  const totalWithParasitic = minerPower * (1 + config.parasiticLoadPercent / 100);
  
  return totalWithParasitic / 1000; // Convert to kW
}

/**
 * Calculate monthly energy consumption in kWh
 */
export function calculateMonthlyKwh(config: FarmConfig): number {
  const powerKw = calculateTotalPower(config);
  return powerKw * HOURS_PER_MONTH;
}

/**
 * Calculate heat output in BTU/h
 */
export function calculateHeatOutput(config: FarmConfig): number {
  const powerWatts = calculateTotalPower(config) * 1000;
  return powerWatts * WATTS_TO_BTU;
}

/**
 * Calculate electrical current in Amps
 */
export function calculateCurrent(config: FarmConfig): number {
  const powerKw = calculateTotalPower(config);
  const powerWatts = powerKw * 1000;
  return powerWatts / VOLTAGE;
}

/**
 * Calculate transformer kVA requirement
 */
export function calculateTransformerKva(config: FarmConfig): number {
  const powerKw = calculateTotalPower(config);
  // Add 20% overhead for power factor and surge protection
  return powerKw * 1.2;
}

/**
 * Calculate transformer cost from the lookup table.
 * Farms under 15 kVA don't need a dedicated transformer ($0).
 */
export function calculateTransformerCost(kva: number): number {
  const selection = autoSelectTransformer(kva);
  if (!selection) return 0;
  return selection.model.estimated_cost_usd * selection.quantity;
}

/**
 * Calculate copper cable cost
 */
export function calculateCableCost(config: FarmConfig): number {
  const { cableLength, cableGauge, copperPricePerKg } = config.electrical;
  
  // Cable weight calculation (simplified)
  // AWG 6 = ~4kg/100m, scales with cross-sectional area
  const gaugeMultiplier = Math.pow(2, (6 - cableGauge) / 3);
  const weightKg = (cableLength / 100) * 4 * gaugeMultiplier;
  
  // Add installation cost (labor + materials)
  const materialCost = weightKg * copperPricePerKg;
  const installationCost = cableLength * 15; // $15/meter installation
  
  return materialCost + installationCost;
}

/**
 * Calculate rack/container costs based on selected infrastructure type.
 *
 * Racks:     $700 per 50 miners (rack units only)
 * Containers: $6,000 per 20ft container (shell) + $700 per 50 miners (rack space inside)
 *             Each container holds up to 250 miners.
 */
export function calculateInfrastructureCost(config: FarmConfig): { rack: number; container: number } {
  const totalMiners = config.miners.reduce((sum, { quantity }) => sum + quantity, 0);
  const rackUnits = Math.ceil(totalMiners / RACK_MINERS_CAPACITY);
  const rackCost = rackUnits * RACK_COST_USD;

  if (config.infrastructureType === "containers") {
    const containersNeeded = Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY);
    const containerCost = containersNeeded * CONTAINER_BASE_COST_USD;
    return { rack: rackCost, container: containerCost };
  }

  return { rack: rackCost, container: 0 };
}

/**
 * Returns true if any miner in the farm is water-cooled
 */
export function hasWatercooledMiners(config: FarmConfig): boolean {
  return config.miners.some(({ miner }) => miner.watercooled);
}

export function hasAircooledMiners(config: FarmConfig): boolean {
  return config.miners.some(({ miner }) => !miner.watercooled);
}

/**
 * Cooling CAPEX comes from explicit user configuration only:
 * - Hydro: dry cooler selections in the Temperature tab (calculateDryCoolerCapex)
 * - Air: future fan/HVAC config (not yet implemented)
 * Returning 0 here prevents an automatic per-kW estimate from appearing
 * whenever a miner is added.
 */
export function calculateCoolingCost(_config: FarmConfig): number {
  return 0;
}

/**
 * Calculate the installed solar capacity in kW (before injection rate)
 */
export function calculateSolarInstalledKw(config: FarmConfig): number {
  if (config.solar.coveragePercent === 0) return 0;
  const powerKw = calculateTotalPower(config);
  const solarKwNeeded = powerKw * (config.solar.coveragePercent / 100);
  // Solar needs 2x capacity for day/night averaging
  return solarKwNeeded * 2;
}

/**
 * Number of 400W panels needed
 */
export function calculateSolarPanelCount(config: FarmConfig): number {
  const installedKw = calculateSolarInstalledKw(config);
  return Math.ceil((installedKw * 1000) / SOLAR_PANEL_WATTS);
}

/**
 * Solar farm area in square meters (includes inter-row spacing)
 */
export function calculateSolarAreaSqm(config: FarmConfig): number {
  const installedKw = calculateSolarInstalledKw(config);
  return installedKw * SQM_PER_KW_INSTALLED;
}

/**
 * Solar farm area in square feet
 */
export function calculateSolarAreaSqft(config: FarmConfig): number {
  return calculateSolarAreaSqm(config) * SQM_TO_SQFT;
}

/**
 * Effective solar coverage percent after injection rate tax
 */
export function calculateEffectiveSolarCoverage(config: FarmConfig): number {
  return config.solar.coveragePercent * (config.solar.injectionRatePercent / 100);
}

/**
 * Calculate solar farm Capex
 */
export function calculateSolarCapex(config: FarmConfig): number {
  if (config.solar.coveragePercent === 0) return 0;
  const solarInstallKw = calculateSolarInstalledKw(config);
  return solarInstallKw * config.solar.installationCostPerKw;
}

/**
 * Calculate deployment labor and per-miner cable/breaker costs.
 * Rack and container counts use the same capacity constants as calculateInfrastructureCost.
 * Container labor is only included when infrastructureType === "containers".
 */
export function calculateLaborCapex(config: FarmConfig): { laborCost: number; cablesAndBreakers: number } {
  const totalMiners = config.miners.reduce((sum, { quantity }) => sum + quantity, 0);
  if (totalMiners === 0) return { laborCost: 0, cablesAndBreakers: 0 };

  const rackUnits = Math.ceil(totalMiners / RACK_MINERS_CAPACITY);
  const {
    manHoursPerMiner,
    hourlyLaborCostUsd,
    cablesPerMinerUsd,
    manHoursPerTransformer,
    manHoursPerRack,
    manHoursPerContainer,
  } = config.labor;

  const kva = calculateTransformerKva(config);
  const needsTransformer = autoSelectTransformer(kva) !== null;

  let totalLaborHours =
    totalMiners * manHoursPerMiner +
    (needsTransformer ? manHoursPerTransformer : 0) +
    rackUnits * manHoursPerRack;

  if (config.infrastructureType === "containers") {
    const containersNeeded = Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY);
    totalLaborHours += containersNeeded * manHoursPerContainer;
  }

  const laborCost = totalLaborHours * hourlyLaborCostUsd;
  const cablesAndBreakers = totalMiners * cablesPerMinerUsd;

  return { laborCost, cablesAndBreakers };
}

/**
 * Calculate ventilation airflow needed for air-cooled miners.
 * Base formula: Q = P / (ρ × Cp × ΔT) where ρ=1.2 kg/m³, Cp=1005 J/kg·K
 *
 * Climate adjustments:
 * - ΔT (air temperature rise across miners) shrinks in hot climates.
 *   Base ΔT = 15°C at 35°C ambient. For hotter sites, effective ΔT = max(5, 50 - maxTempC).
 *   This means hotter ambient → smaller ΔT → more airflow needed.
 * - High humidity (>70%) reduces convective cooling efficiency.
 *   Apply a penalty: +1% airflow per % humidity above 70, capped at 15%.
 */
export function calculateVentilation(config: FarmConfig): { m3h: number; cfm: number } {
  const powerKw = calculateTotalPower(config);
  const climate = getEffectiveClimate(config);

  // Effective ΔT: at 35°C ambient → 15°C rise. At 45°C → 5°C rise (minimum).
  const effectiveDeltaT = Math.max(5, 50 - climate.maxTempC);

  // Base airflow: Q (m³/s) = P_W / (ρ × Cp × ΔT), convert to m³/h
  // ρ=1.2, Cp=1005 → Q (m³/h) = P_kW × 1000 / (1.2 × 1005 × ΔT) × 3600
  const baseM3h = (powerKw * 1000 * 3600) / (1.2 * 1005 * effectiveDeltaT);

  // Humidity penalty: +1% per % above 70%, capped at 15%
  const humidityExcess = Math.max(0, climate.avgHumidityPercent - 70);
  const humidityPenalty = 1 + Math.min(humidityExcess * 0.01, 0.15);

  const m3h = baseM3h * humidityPenalty;
  const cfm = m3h * 0.5886;
  return { m3h, cfm };
}

/**
 * Dry cooler derating factor based on ambient temperature.
 * Capacity is rated at 35°C. Above that, capacity drops ~3% per °C.
 * Below 35°C, capacity improves ~2% per °C (less aggressive — manufacturers
 * don't guarantee linear gains below rating).
 * Returns a multiplier: 1.0 at 35°C, 0.7 at 45°C, 1.1 at 30°C, etc.
 */
export function getDryCoolerDeratingFactor(config: FarmConfig): number {
  const climate = getEffectiveClimate(config);
  const deltaAbove35 = climate.maxTempC - 35;
  if (deltaAbove35 > 0) {
    // 3% loss per °C above 35, floor at 50% capacity
    return Math.max(0.5, 1 - deltaAbove35 * 0.03);
  }
  // 2% gain per °C below 35, cap at 130%
  return Math.min(1.3, 1 + Math.abs(deltaAbove35) * 0.02);
}

/**
 * Effective total dry cooler capacity in kW after climate derating.
 */
export function calculateEffectiveDryCoolerCapacityKw(config: FarmConfig): number {
  const selections = config.temperature?.dryCoolerSelections;
  if (!selections?.length) return 0;
  const derating = getDryCoolerDeratingFactor(config);
  return selections.reduce((total, sel) => {
    const model = DRY_COOLERS.find((m) => m.model === sel.model);
    if (!model || sel.quantity <= 0) return total;
    return total + model.kw_capacity_35c * sel.quantity * derating;
  }, 0);
}

/**
 * Calculate dry cooler CAPEX for hydro-cooled farms.
 * Cost per unit = hardware + (man_hours × hourlyRate) + plumbing/fluid
 */
export function calculateDryCoolerCapex(config: FarmConfig): number {
  const selections = config.temperature?.dryCoolerSelections;
  if (!selections?.length) return 0;
  const hourlyRate = config.labor.hourlyLaborCostUsd;
  return selections.reduce((total, sel) => {
    const model = DRY_COOLERS.find((m) => m.model === sel.model);
    if (!model || sel.quantity <= 0) return total;
    const unitCost = model.estimated_cost_usd + model.man_hours_deploy * hourlyRate + model.plumbing_fluid_cost_usd;
    return total + sel.quantity * unitCost;
  }, 0);
}

/**
 * Total electrical power drawn by selected air fans in kW.
 * Added to the farm's parasitic / total power draw.
 */
export function calculateAirFanPowerKw(config: FarmConfig): number {
  const selections = config.temperature?.airFanSelections;
  if (!selections?.length) return 0;
  return selections.reduce((total, sel) => {
    const model = AIR_FANS.find((m) => m.model === sel.model);
    return total + (model ? model.power_w * sel.quantity / 1000 : 0);
  }, 0);
}

/**
 * CAPEX for air cooling fans: hardware + deployment labor.
 */
export function calculateAirFanCapex(config: FarmConfig): number {
  const selections = config.temperature?.airFanSelections;
  if (!selections?.length) return 0;
  const hourlyRate = config.labor.hourlyLaborCostUsd;
  return selections.reduce((total, sel) => {
    const model = AIR_FANS.find((m) => m.model === sel.model);
    if (!model || sel.quantity <= 0) return total;
    const unitCost = model.cost_usd + model.man_hours_deploy * hourlyRate;
    return total + sel.quantity * unitCost;
  }, 0);
}

/**
 * Calculate monthly solar maintenance cost
 */
export function calculateMonthlySolarMaintenance(config: FarmConfig): number {
  const solarCapex = calculateSolarCapex(config);
  if (solarCapex <= 0) return 0;
  return (solarCapex * (config.solar.maintenancePercentPerYear / 100)) / 12;
}

/**
 * Calculate monthly maintenance labor cost.
 * Farms ≤ 20 miners: 8 man-hours/month.
 * Farms > 20 miners: 30 + (miners × 0.2) hours/month + (air fan units × 1 hour/month).
 */
export function calculateMaintenanceLaborOpex(config: FarmConfig): number {
  const totalMiners = config.miners.reduce((sum, { quantity }) => sum + quantity, 0);
  if (totalMiners === 0) return 0;

  const totalFans = (config.temperature?.airFanSelections ?? [])
    .reduce((sum, sel) => sum + sel.quantity, 0);

  let hours: number;
  if (totalMiners <= 20) {
    hours = 8;
  } else {
    hours = 30 + totalMiners * 0.2 + totalFans * 1;
  }

  return hours * config.maintenanceLabor.hourlyMaintenanceCostUsd;
}

/**
 * Calculate monthly OPEX
 */
export function calculateMonthlyOpex(config: FarmConfig, totalCapex: number): number {
  const monthlyKwh = calculateMonthlyKwh(config);
  const { electricityPriceKwh, taxAdderPercent } = config.regional;

  // Electricity cost (injection rate reduces effective solar offset)
  const effectiveSolarCoverage = calculateEffectiveSolarCoverage(config) / 100;
  const gridKwh = monthlyKwh * (1 - effectiveSolarCoverage);
  const electricityCost = gridKwh * electricityPriceKwh * (1 + taxAdderPercent / 100);

  // Maintenance cost (annual divided by 12)
  const maintenanceCost = (totalCapex * (config.maintenanceOpexPercent / 100)) / 12;

  // Solar maintenance
  const solarMaintenance = calculateMonthlySolarMaintenance(config);

  // Maintenance labor
  const maintenanceLaborOpex = calculateMaintenanceLaborOpex(config);

  return electricityCost + maintenanceCost + solarMaintenance + maintenanceLaborOpex;
}

/**
 * Calculate complete farm metrics
 */
export function calculateFarmMetrics(config: FarmConfig): FarmMetrics {
  const totalHashRateThs = calculateTotalHashRate(config);
  const totalPowerKw = calculateTotalPower(config);
  const monthlyKwh = calculateMonthlyKwh(config);
  const heatOutputBtuPerHour = calculateHeatOutput(config);
  const electricalCurrentAmps = calculateCurrent(config);
  const transformerKva = calculateTransformerKva(config);
  const transformerCost = calculateTransformerCost(transformerKva);
  const cableCost = calculateCableCost(config);
  const { rack: rackCost, container: containerCost } = calculateInfrastructureCost(config);
  const coolingCost = calculateCoolingCost(config);
  const solarCapex = calculateSolarCapex(config);
  const { laborCost, cablesAndBreakers } = calculateLaborCapex(config);
  const dryCoolerCapex = calculateDryCoolerCapex(config);
  const airFanCapex = calculateAirFanCapex(config);
  const airFanPowerKw = calculateAirFanPowerKw(config);

  // Total hardware cost
  const minerCost = config.miners.reduce((total, { miner, quantity }) => {
    return total + (miner.price_usd * quantity);
  }, 0);

  // Solar CAPEX is only rolled into totalCapex when the user opts in via
  // `includeCommissioningInCapex`. The raw `solarCapex` metric is always
  // reported so downstream UIs can still show the standalone project cost.
  const solarCapexInTotal = config.solar.includeCommissioningInCapex ? solarCapex : 0;

  // Import taxes on hardware components
  const tax = config.importTax;
  const importTaxCapex =
    minerCost * (tax.miners / 100) +
    rackCost * (tax.racks / 100) +
    containerCost * (tax.containers / 100) +
    airFanCapex * (tax.fans / 100) +
    dryCoolerCapex * (tax.dryCoolers / 100);

  const totalCapex = minerCost + transformerCost + cableCost + rackCost +
                     containerCost + coolingCost + solarCapexInTotal + laborCost + cablesAndBreakers + dryCoolerCapex + airFanCapex + importTaxCapex;

  const monthlyOpex = calculateMonthlyOpex(config, totalCapex);
  const monthlySolarMaintenance = calculateMonthlySolarMaintenance(config);
  const maintenanceLaborOpex = calculateMaintenanceLaborOpex(config);

  return {
    totalHashRateThs,
    totalPowerKw,
    monthlyKwh,
    heatOutputBtuPerHour,
    electricalCurrentAmps,
    transformerKva,
    transformerCost,
    cableCost,
    rackCost,
    containerCost,
    coolingCost,
    solarCapex,
    laborCost,
    cablesAndBreakers,
    dryCoolerCapex,
    airFanCapex,
    airFanPowerKw,
    minerCost,
    importTaxCapex,
    totalCapex,
    monthlyOpex,
    monthlySolarMaintenance,
    maintenanceLaborOpex,
  };
}
