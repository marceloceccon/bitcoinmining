/**
 * Everything the calculators show for a farm at a market snapshot — what the UI
 * computes in the browser and what POST /api/calculate returns. Pure.
 */
import type { FarmConfig, FarmMetrics, LocationData, MarketSnapshot } from '@/types';
import {
  calculateAirFanPowerKw,
  calculateEffectiveDryCoolerCapacityKw,
  calculateFarmMetrics,
  calculateTotalHashRate,
  calculateTotalPower,
  calculateVentilation,
  getDryCoolerDeratingFactor,
  getEffectiveClimate,
} from '@/lib/calculations';
import { calculateSpotEconomics, type SpotEconomics } from '@/lib/unitEconomics';

export interface FarmReport {
  metrics: FarmMetrics;
  ventilation: { m3h: number; cfm: number };
  totalHashRateThs: number;
  totalPowerKw: number;
  airFanPowerKw: number;
  climate: LocationData;
  dryCoolerDeratingFactor: number;
  effectiveDryCoolerCapacityKw: number;
  revenue: SpotEconomics;
  assumptions: { market: MarketSnapshot };
}

export function computeFarmReport(config: FarmConfig, market: MarketSnapshot): FarmReport {
  const metrics = calculateFarmMetrics(config);
  const totalHashRateThs = calculateTotalHashRate(config);
  return {
    metrics,
    ventilation: calculateVentilation(config),
    totalHashRateThs,
    totalPowerKw: calculateTotalPower(config),
    airFanPowerKw: calculateAirFanPowerKw(config),
    climate: getEffectiveClimate(config),
    dryCoolerDeratingFactor: getDryCoolerDeratingFactor(config),
    effectiveDryCoolerCapacityKw: calculateEffectiveDryCoolerCapacityKw(config),
    revenue: calculateSpotEconomics(totalHashRateThs, metrics.monthlyOpex, market, config),
    assumptions: { market },
  };
}
