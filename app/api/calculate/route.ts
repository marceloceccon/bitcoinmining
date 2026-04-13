import { NextResponse } from 'next/server';
import {
  calculateFarmMetrics,
  calculateVentilation,
  calculateTotalPower,
  calculateTotalHashRate,
  calculateAirFanPowerKw,
  getEffectiveClimate,
  getDryCoolerDeratingFactor,
  calculateEffectiveDryCoolerCapacityKw,
} from '@/lib/calculations';
import { corsHeaders, handleOptions } from '@/lib/cors';
import {
  validateFarmConfig,
  isWithinSizeLimit,
  MAX_REQUEST_BYTES,
} from '@/lib/validateFarmConfig';

// ── Request body type ────────────────────────────────────────────────

/** Complete Bitcoin mining farm configuration used as the POST body. */
type CalculateBody = {
  /** Array of miner selections — at least one entry is required */
  miners: {
    /** The miner hardware specification */
    miner: {
      /** Unique miner identifier (e.g. "antminer-s21-pro") */
      id: string;
      /** Display name (e.g. "Antminer S21 Pro") */
      name: string;
      /** Manufacturer name (e.g. "Bitmain") */
      manufacturer: string;
      /** Mining algorithm (e.g. "SHA-256") */
      algorithm: string;
      /** Hash rate in terahashes per second */
      hash_rate_ths: number;
      /** Wall power consumption in watts */
      power_watts: number;
      /** Purchase price per unit in USD */
      price_usd: number;
      /** Energy efficiency in joules per terahash */
      efficiency_jth: number;
      /** Year the model was released */
      release_year: number;
      /** Whether this miner requires water cooling */
      watercooled: boolean;
      /** Hashrate degradation in year 1 (fraction, e.g. 0.02) */
      degradation_year1: number;
      /** Hashrate degradation in year 2 (fraction) */
      degradation_year2: number;
      /** Hashrate degradation in year 3+ (fraction per year) */
      degradation_year3plus: number;
      /** Optional notes about the miner model */
      notes?: string;
    };
    /** Number of units of this miner model to deploy */
    quantity: number;
  }[];
  /** Electrical infrastructure configuration */
  electrical: {
    /** Cable run length from transformer to miners (meters) */
    cableLength: number;
    /** Cable gauge (AWG) */
    cableGauge: number;
    /** Copper commodity price used for cable cost estimation (USD/kg) */
    copperPricePerKg: number;
  };
  /** Cooling system configuration */
  cooling: {
    /** Cooling method: "air" for ventilation fans, "hydro" for dry cooler loop */
    type: "air" | "hydro";
    /** Per-miner air cooling infrastructure cost in USD (used when type is "air") */
    airCost?: number;
    /** Per-miner hydro dry-cooler infrastructure cost in USD (used when type is "hydro") */
    hydroDryingCost?: number;
  };
  /** Solar power offset configuration */
  solar: {
    /** Percentage of total farm power offset by solar (0-100) */
    coveragePercent: number;
    /** Solar panel + inverter installation cost per kW (USD) */
    installationCostPerKw: number;
    /** Annual solar maintenance as a percent of solar CAPEX */
    maintenancePercentPerYear: number;
    /** Grid injection credit rate — 100 means full credit, 0 means no credit (0-100) */
    injectionRatePercent: number;
  };
  /** Regional electricity and tax settings */
  regional: {
    /** Region code for preset defaults */
    region: "BR" | "US" | "CN" | "EU" | "CUSTOM";
    /** Electricity price per kWh in USD */
    electricityPriceKwh: number;
    /** Additional tax on electricity as a percentage */
    taxAdderPercent: number;
    /** Annual energy price inflation percentage (default 3) */
    energyInflationPercent: number;
  };
  /** Parasitic load as a percentage of total miner power (lighting, networking, etc.) — default 5 */
  parasiticLoadPercent: number;
  /** Expected uptime percentage — default 98 */
  uptimePercent: number;
  /** Mining pool fee percentage — default 1-2 */
  poolFeePercent: number;
  /** Monthly maintenance OPEX as a percentage of total CAPEX — default 5 */
  maintenanceOpexPercent: number;
  /** Mining pool payout scheme — default "fpps" */
  payoutScheme: "pps" | "pplns" | "fpps" | "ppsplus";
  /** Labor cost parameters for deployment */
  labor: {
    /** Man-hours to deploy each miner — default 2.5 */
    manHoursPerMiner: number;
    /** Hourly labor rate in USD — default 35 */
    hourlyLaborCostUsd: number;
    /** Cable + dedicated fuse breaker cost per miner in USD — default 85 */
    cablesPerMinerUsd: number;
    /** Man-hours to install each transformer — default 8 */
    manHoursPerTransformer: number;
    /** Man-hours to assemble each rack — default 4 */
    manHoursPerRack: number;
    /** Man-hours to set up each container — default 40 */
    manHoursPerContainer: number;
  };
  /** Temperature management and cooling hardware selections (optional) */
  temperature?: {
    /** Geographic location for ambient temperature data (null if not set) */
    location: {
      /** Latitude */
      lat: number;
      /** Longitude */
      lng: number;
      /** City name */
      city: string;
      /** Average yearly temperature (°C) */
      avgYearlyTempC: number;
      /** Maximum recorded temperature (°C) */
      maxTempC: number;
      /** Minimum recorded temperature (°C) */
      minTempC: number;
      /** Average relative humidity (%) */
      avgHumidityPercent: number;
    } | null;
    /** Selected dry cooler models and quantities for hydro cooling */
    dryCoolerSelections: {
      /** Dry cooler model name */
      model: string;
      /** Number of units */
      quantity: number;
    }[];
    /** Selected air fan models and quantities for ventilation */
    airFanSelections: {
      /** Air fan model name */
      model: string;
      /** Number of units */
      quantity: number;
    }[];
  };
  /** Infrastructure housing type — "racks" or "containers" */
  infrastructureType: "racks" | "containers";
  /** Import tax percentages applied to hardware CAPEX by category */
  importTax: {
    /** Import tax on shipping containers (%) — default 10 */
    containers: number;
    /** Import tax on racks (%) */
    racks: number;
    /** Import tax on ASIC miners (%) */
    miners: number;
    /** Import tax on ventilation fans (%) */
    fans: number;
    /** Import tax on dry coolers (%) */
    dryCoolers: number;
  };
  /** Ongoing maintenance labor configuration */
  maintenanceLabor: {
    /** Hourly rate for maintenance technicians (USD) — default 35 */
    hourlyMaintenanceCostUsd: number;
  };
};

// ── Response type ────────────────────────────────────────────────────

/** Comprehensive farm metrics returned by the calculation engine. */
type FarmMetricsResponse = {
  /** Total hash rate across all miners (TH/s) */
  totalHashRateThs: number;
  /** Total wall power draw of all miners (kW) */
  totalPowerKw: number;
  /** Estimated monthly energy consumption (kWh) */
  monthlyKwh: number;
  /** Total heat output (BTU/h) */
  heatOutputBtuPerHour: number;
  /** Total electrical current draw (A) */
  electricalCurrentAmps: number;
  /** Required transformer capacity (kVA) */
  transformerKva: number;
  /** Transformer purchase cost (USD) */
  transformerCost: number;
  /** Total copper cable cost (USD) */
  cableCost: number;
  /** Rack hardware cost (USD, 0 if using containers) */
  rackCost: number;
  /** Container hardware cost (USD, 0 if using racks) */
  containerCost: number;
  /** Cooling infrastructure cost (USD) */
  coolingCost: number;
  /** Solar panel system CAPEX (USD) */
  solarCapex: number;
  /** Total deployment labor cost (USD) */
  laborCost: number;
  /** Total cables and breakers cost (USD) */
  cablesAndBreakers: number;
  /** Dry cooler equipment CAPEX (USD) */
  dryCoolerCapex: number;
  /** Air fan equipment CAPEX (USD) */
  airFanCapex: number;
  /** Total power consumed by air fans (kW) */
  airFanPowerKw: number;
  /** Total miner hardware cost (USD) */
  minerCost: number;
  /** Total import tax on all hardware (USD) */
  importTaxCapex: number;
  /** Grand total capital expenditure (USD) */
  totalCapex: number;
  /** Total monthly operating expenditure (USD) */
  monthlyOpex: number;
  /** Monthly solar maintenance cost (USD) */
  monthlySolarMaintenance: number;
  /** Monthly maintenance labor cost (USD) */
  maintenanceLaborOpex: number;
};

/** Full response from the calculate endpoint. */
type CalculateResponse = {
  /** Detailed farm financial and operational metrics */
  metrics: FarmMetricsResponse;
  /** Required ventilation airflow */
  ventilation: {
    /** Airflow in cubic meters per hour */
    m3h: number;
    /** Airflow in cubic feet per minute */
    cfm: number;
  };
  /** Combined hash rate of all miners (TH/s) */
  totalHashRateThs: number;
  /** Combined wall power of all miners (kW) */
  totalPowerKw: number;
  /** Total power consumed by air cooling fans (kW) */
  airFanPowerKw: number;
};

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

/**
 * Calculate farm metrics
 * @description Calculates comprehensive CAPEX, OPEX, and operational metrics for a Bitcoin mining farm configuration. Accepts a complete FarmConfig and returns all derived values including total hash rate, power draw, heat output, transformer sizing, infrastructure costs, and monthly operating expenses. This is the primary calculation endpoint — send your full farm configuration and receive all metrics in one call.
 * @body CalculateBody
 * @response CalculateResponse
 * @openapi
 */
export async function POST(request: Request) {
  const headers = corsHeaders(request);

  if (!isWithinSizeLimit(request.headers.get('content-length'))) {
    return NextResponse.json(
      { error: `Request body exceeds ${MAX_REQUEST_BYTES} bytes` },
      { status: 413, headers }
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers }
    );
  }

  const validation = validateFarmConfig(parsed);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, field: validation.field },
      { status: 400, headers }
    );
  }
  const config = validation.value;

  try {
    const metrics = calculateFarmMetrics(config);
    const ventilation = calculateVentilation(config);
    const totalHashRateThs = calculateTotalHashRate(config);
    const totalPowerKw = calculateTotalPower(config);
    const airFanPowerKw = calculateAirFanPowerKw(config);
    const climate = getEffectiveClimate(config);
    const dryCoolerDeratingFactor = getDryCoolerDeratingFactor(config);
    const effectiveDryCoolerCapacityKw = calculateEffectiveDryCoolerCapacityKw(config);

    return NextResponse.json(
      {
        metrics,
        ventilation,
        totalHashRateThs,
        totalPowerKw,
        airFanPowerKw,
        climate,
        dryCoolerDeratingFactor,
        effectiveDryCoolerCapacityKw,
      },
      { headers }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Calculation failed', detail: String(err) },
      { status: 500, headers }
    );
  }
}
