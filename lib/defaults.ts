/**
 * The default farm configuration: an empty farm with sensible regional, labor,
 * electrical and tax defaults. Isomorphic, so the store, presets, tests and
 * (later) MCP can all build on it.
 */
import type { FarmConfig, InfrastructureType, PayoutScheme } from '@/types';

export const defaultConfig: FarmConfig = {
  miners: [],
  electrical: {
    cableLength: 50,
    cableGauge: 6,
    copperPricePerKg: 9.5,
  },
  cooling: {
    type: "air",
    airCost: 5000,
  },
  solar: {
    coveragePercent: 0,
    installationCostPerKw: 1200,
    maintenancePercentPerYear: 1,
    injectionRatePercent: 100,
    includeCommissioningInCapex: false,
  },
  regional: {
    region: "CUSTOM",
    electricityPriceKwh: 0.05,
    taxAdderPercent: 0,
    energyInflationPercent: 3,
  },
  parasiticLoadPercent: 5,
  uptimePercent: 98,
  poolFeePercent: 2.5,
  maintenanceOpexPercent: 5,
  payoutScheme: "fpps" as PayoutScheme,
  labor: {
    manHoursPerMiner: 1,
    hourlyLaborCostUsd: 20,
    cablesPerMinerUsd: 40,
    manHoursPerTransformer: 8,
    manHoursPerRack: 4,
    manHoursPerContainer: 80,
  },
  temperature: {
    location: null,
    dryCoolerSelections: [],
    airFanSelections: [],
  },
  infrastructureType: "racks" as InfrastructureType,
  importTax: {
    containers: 10,
    racks: 10,
    miners: 10,
    fans: 10,
    dryCoolers: 10,
  },
  maintenanceLabor: {
    hourlyMaintenanceCostUsd: 35,
  },
};
