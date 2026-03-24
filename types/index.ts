// Payout Scheme
export type PayoutScheme = "pps" | "pplns" | "fpps" | "ppsplus";

// Dry Cooler Types
export interface DryCoolerModel {
  model: string;
  kw_capacity_35c: number;
  water_flow_m3h: number;
  pressure_drop_kpa: number;
  air_flow_m3h: number;
  fan_motor_w: number;
  fan_motor_a: number;
  sound_dba: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  inlet_mm: string;
  weight_kg: number;
  estimated_cost_usd: number;
  man_hours_deploy: number;
  plumbing_fluid_cost_usd: number;
}

export interface DryCoolerSelection {
  model: string;
  quantity: number;
}

export interface LocationData {
  lat: number;
  lng: number;
  city: string;
  avgYearlyTempC: number;
  maxTempC: number;
  minTempC: number;
  avgHumidityPercent: number;
}

export interface AirFanModel {
  model: string;
  diameter_mm: number;
  hz: number;
  rpm: number;
  airflow_m3h: number;
  noise_db: number;
  power_w: number;
  height_mm: number;
  width_mm: number;
  cost_usd: number;
  man_hours_deploy: number;
}

export interface AirFanSelection {
  model: string;
  quantity: number;
}

export interface TemperatureConfig {
  location: LocationData | null;
  dryCoolerSelections: DryCoolerSelection[];
  airFanSelections: AirFanSelection[];
}

// Database Types
export interface Miner {
  id: string;
  name: string;
  manufacturer: string;
  algorithm: string;
  hash_rate_ths: number;
  power_watts: number;
  price_usd: number;
  efficiency_jth: number;
  release_year: number;
  watercooled: boolean;
  degradation_year1: number;
  degradation_year2: number;
  degradation_year3plus: number;
  notes?: string;
}

export interface SavedFarm {
  id: string;
  config: string;
  created_at: string;
  updated_at: string;
}

// Application Types
export interface FarmMiner {
  miner: Miner;
  quantity: number;
}

export interface ElectricalConfig {
  cableLength: number; // meters
  cableGauge: number; // AWG
  copperPricePerKg: number;
}

export interface CoolingConfig {
  type: "air" | "hydro";
  airCost?: number;
  hydroDryingCost?: number;
}

export interface SolarConfig {
  coveragePercent: number; // 0-100
  installationCostPerKw: number;
  maintenancePercentPerYear: number;
  injectionRatePercent: number; // 0-100, how much of daytime injection is credited (100 = no tax)
}

export interface LaborConfig {
  manHoursPerMiner: number;        // default 2.5
  hourlyLaborCostUsd: number;      // default 35
  cablesPerMinerUsd: number;       // default 85 — 6m copper cable + dedicated fuse breaker
  manHoursPerTransformer: number;  // default 8
  manHoursPerRack: number;         // default 4
  manHoursPerContainer: number;    // default 40
}

export interface RegionalConfig {
  region: "BR" | "US" | "CN" | "EU" | "CUSTOM";
  electricityPriceKwh: number;
  taxAdderPercent: number;
  energyInflationPercent: number; // annual energy price inflation, default 3%
}

export interface MaintenanceLaborConfig {
  hourlyMaintenanceCostUsd: number; // default 35
}

export interface ImportTaxConfig {
  containers: number; // percent, default 10
  racks: number;
  miners: number;
  fans: number;
  dryCoolers: number;
}

export type InfrastructureType = "racks" | "containers";

export interface FarmConfig {
  miners: FarmMiner[];
  electrical: ElectricalConfig;
  cooling: CoolingConfig;
  solar: SolarConfig;
  regional: RegionalConfig;
  parasiticLoadPercent: number; // default 5%
  uptimePercent: number; // default 98%
  poolFeePercent: number; // default 1-2%
  maintenanceOpexPercent: number; // default 5%
  payoutScheme: PayoutScheme; // default "fpps"
  labor: LaborConfig;
  temperature?: TemperatureConfig;
  infrastructureType: InfrastructureType; // default "racks"
  importTax: ImportTaxConfig;
  maintenanceLabor: MaintenanceLaborConfig;
}

// Calculation Results
export interface FarmMetrics {
  totalHashRateThs: number;
  totalPowerKw: number;
  monthlyKwh: number;
  heatOutputBtuPerHour: number;
  electricalCurrentAmps: number;
  transformerKva: number;
  transformerCost: number;
  cableCost: number;
  rackCost: number;
  containerCost: number;
  coolingCost: number;
  solarCapex: number;
  laborCost: number;
  cablesAndBreakers: number;
  dryCoolerCapex: number;
  airFanCapex: number;
  airFanPowerKw: number;
  minerCost: number;
  importTaxCapex: number;
  totalCapex: number;
  monthlyOpex: number;
  monthlySolarMaintenance: number;
  maintenanceLaborOpex: number;
}

// Forecasting Types
export interface ForecastParams {
  months: 12 | 24 | 36 | 48 | 72;
  revenueMode: "sell_all" | "hold_all" | "sell_opex";
  btcPriceModel: "fixed" | "stock_to_flow" | "stock_to_flow_pessimistic" | "custom";
  pessimisticAdjustPercent: number; // -10 to -50
  networkHashrateGrowthPercent: number; // annual
  asicDegradationPercent: number; // annual, 5-10%
  discountRatePercent: number; // annual, for NPV/IRR (default 10)
  startingBtcPrice: number; // current market price
  finalBtcPrice: number | null; // null = auto-calculate from S2F; number = user override
}

export interface ForecastPeriod {
  month: number;
  date: Date;
  btcPrice: number;
  networkHashrateThs: number;
  difficulty: number;
  blockReward: number;
  miningRevenueUsd: number;
  electricityCostUsd: number;
  opexUsd: number;
  profitUsd: number;
  btcMined: number;
  btcSold: number;
  btcBalance: number;
  cumulativeProfitUsd: number;
  roi: number;
}

export interface ForecastResult {
  periods: ForecastPeriod[];
  totalCapex: number;
  summary: {
    totalRevenue: number;
    totalCosts: number;
    totalProfit: number;
    finalBtcBalance: number;
    roiPercent: number;
    paybackMonths: number | null;
    irr: number;
    npv: number;
    breakEvenBtcPrice: number;
    breakEvenBtcPriceWithCapex: number;
    avgHashpriceUsd: number;
    totalBtcMined: number;
  };
}


