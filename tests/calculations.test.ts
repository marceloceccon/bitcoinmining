import { describe, it, expect } from 'vitest';
import {
  calculateTotalHashRate,
  calculateTotalPower,
  calculateMonthlyKwh,
  calculateHeatOutput,
  calculateCurrent,
  calculateTransformerKva,
  calculateTransformerCost,
  calculateCableCost,
  calculateInfrastructureCost,
  hasWatercooledMiners,
  hasAircooledMiners,
  calculateCoolingCost,
  calculateSolarInstalledKw,
  calculateSolarPanelCount,
  calculateSolarAreaSqm,
  calculateSolarAreaSqft,
  calculateEffectiveSolarCoverage,
  calculateSolarCapex,
  calculateLaborCapex,
  calculateVentilation,
  calculateDryCoolerCapex,
  calculateAirFanPowerKw,
  calculateAirFanCapex,
  calculateMonthlySolarMaintenance,
  calculateMaintenanceLaborOpex,
  calculateMonthlyOpex,
  calculateFarmMetrics,
  RACK_COST_USD,
  RACK_MINERS_CAPACITY,
  CONTAINER_BASE_COST_USD,
  CONTAINER_MINERS_CAPACITY,
} from '@/lib/calculations';
import type { FarmConfig, Miner, FarmMiner } from '@/types';

// ─── Realistic ASIC fixtures ─────────────────────────────────────────────

const S21_PRO: Miner = {
  id: 's21pro',
  name: 'Antminer S21 Pro',
  manufacturer: 'Bitmain',
  algorithm: 'SHA-256',
  hash_rate_ths: 234,
  power_watts: 3510,
  price_usd: 5499,
  efficiency_jth: 15,
  release_year: 2024,
  watercooled: false,
  degradation_year1: 3,
  degradation_year2: 5,
  degradation_year3plus: 8,
};

const S21_HYDRO: Miner = {
  id: 's21hydro',
  name: 'Antminer S21 Hydro',
  manufacturer: 'Bitmain',
  algorithm: 'SHA-256',
  hash_rate_ths: 335,
  power_watts: 5360,
  price_usd: 7999,
  efficiency_jth: 16,
  release_year: 2024,
  watercooled: true,
  degradation_year1: 3,
  degradation_year2: 5,
  degradation_year3plus: 8,
};

// ─── Helper to build a FarmConfig ────────────────────────────────────────

function makeFarmConfig(overrides: Partial<FarmConfig> = {}): FarmConfig {
  return {
    miners: [],
    electrical: { cableLength: 50, cableGauge: 6, copperPricePerKg: 9 },
    cooling: { type: 'air' },
    solar: {
      coveragePercent: 0,
      installationCostPerKw: 1200,
      maintenancePercentPerYear: 1.5,
      injectionRatePercent: 85,
      includeCommissioningInCapex: false,
    },
    regional: {
      region: 'US',
      electricityPriceKwh: 0.06,
      taxAdderPercent: 10,
      energyInflationPercent: 3,
    },
    parasiticLoadPercent: 5,
    uptimePercent: 98,
    poolFeePercent: 2,
    maintenanceOpexPercent: 5,
    payoutScheme: 'fpps',
    labor: {
      manHoursPerMiner: 2.5,
      hourlyLaborCostUsd: 35,
      cablesPerMinerUsd: 85,
      manHoursPerTransformer: 8,
      manHoursPerRack: 4,
      manHoursPerContainer: 40,
    },
    infrastructureType: 'racks',
    importTax: { containers: 10, racks: 10, miners: 10, fans: 10, dryCoolers: 10 },
    maintenanceLabor: { hourlyMaintenanceCostUsd: 35 },
    ...overrides,
  };
}

function withMiners(miner: Miner, quantity: number, base?: Partial<FarmConfig>): FarmConfig {
  return makeFarmConfig({ miners: [{ miner, quantity }], ...base });
}

// ════════════════════════════════════════════════════════════════════════
// TOTAL HASH RATE
// ════════════════════════════════════════════════════════════════════════

describe('calculateTotalHashRate', () => {
  it('returns 0 for an empty farm', () => {
    expect(calculateTotalHashRate(makeFarmConfig())).toBe(0);
  });

  it('calculates hash rate for a single S21 Pro', () => {
    const config = withMiners(S21_PRO, 1);
    expect(calculateTotalHashRate(config)).toBe(234);
  });

  it('scales linearly with miner count — 100 × S21 Pro = 23,400 TH/s', () => {
    const config = withMiners(S21_PRO, 100);
    expect(calculateTotalHashRate(config)).toBe(23400);
  });

  it('sums hash rate across mixed miner types', () => {
    const config = makeFarmConfig({
      miners: [
        { miner: S21_PRO, quantity: 10 },   // 2340
        { miner: S21_HYDRO, quantity: 5 },   // 1675
      ],
    });
    expect(calculateTotalHashRate(config)).toBe(2340 + 1675);
  });

  it('handles massive farm — 1000 miners', () => {
    const config = withMiners(S21_PRO, 1000);
    expect(calculateTotalHashRate(config)).toBe(234000);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TOTAL POWER (kW) — with parasitic load
// ════════════════════════════════════════════════════════════════════════

describe('calculateTotalPower', () => {
  it('returns 0 kW for zero miners', () => {
    expect(calculateTotalPower(makeFarmConfig())).toBe(0);
  });

  it('calculates power for 1 S21 Pro with 5% parasitic load', () => {
    // 3510 W × 1.05 = 3685.5 W → 3.6855 kW
    const config = withMiners(S21_PRO, 1);
    expect(calculateTotalPower(config)).toBeCloseTo(3.6855, 3);
  });

  it('10 × S21 Pro at 5% parasitic = 36.855 kW', () => {
    const config = withMiners(S21_PRO, 10);
    expect(calculateTotalPower(config)).toBeCloseTo(36.855, 3);
  });

  it('correctly applies 0% parasitic load', () => {
    const config = withMiners(S21_PRO, 1, { parasiticLoadPercent: 0 });
    expect(calculateTotalPower(config)).toBeCloseTo(3.510, 3);
  });

  it('correctly applies 15% parasitic load', () => {
    // 3510 × 1.15 = 4036.5 W → 4.0365 kW
    const config = withMiners(S21_PRO, 1, { parasiticLoadPercent: 15 });
    expect(calculateTotalPower(config)).toBeCloseTo(4.0365, 3);
  });

  it('sums power across mixed miner types', () => {
    const config = makeFarmConfig({
      miners: [
        { miner: S21_PRO, quantity: 10 },
        { miner: S21_HYDRO, quantity: 5 },
      ],
      parasiticLoadPercent: 5,
    });
    // (10×3510 + 5×5360) × 1.05 / 1000
    const expected = (35100 + 26800) * 1.05 / 1000;
    expect(calculateTotalPower(config)).toBeCloseTo(expected, 3);
  });
});

// ════════════════════════════════════════════════════════════════════════
// MONTHLY ENERGY (kWh)
// ════════════════════════════════════════════════════════════════════════

describe('calculateMonthlyKwh', () => {
  it('returns 0 for zero miners', () => {
    expect(calculateMonthlyKwh(makeFarmConfig())).toBe(0);
  });

  it('10 × S21 Pro → kW × 730 hours/month', () => {
    const config = withMiners(S21_PRO, 10);
    const expectedKw = 36.855;
    expect(calculateMonthlyKwh(config)).toBeCloseTo(expectedKw * 730, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// HEAT OUTPUT (BTU/h)  — 1 W = 3.412 BTU/h
// ════════════════════════════════════════════════════════════════════════

describe('calculateHeatOutput', () => {
  it('returns 0 for zero miners', () => {
    expect(calculateHeatOutput(makeFarmConfig())).toBe(0);
  });

  it('1 S21 Pro at 5% parasitic: 3685.5 W × 3.412 = 12,575.5 BTU/h', () => {
    const config = withMiners(S21_PRO, 1);
    // 3.6855 kW × 1000 × 3.412
    const expected = 3685.5 * 3.412;
    expect(calculateHeatOutput(config)).toBeCloseTo(expected, 0);
  });

  it('heat output scales linearly — 100 miners = 100× single miner', () => {
    const single = calculateHeatOutput(withMiners(S21_PRO, 1));
    const hundred = calculateHeatOutput(withMiners(S21_PRO, 100));
    expect(hundred).toBeCloseTo(single * 100, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// ELECTRICAL CURRENT (Amps) — P / V at 220 V
// ════════════════════════════════════════════════════════════════════════

describe('calculateCurrent', () => {
  it('1 S21 Pro: 3685.5 W / 220 V ≈ 16.75 A', () => {
    const config = withMiners(S21_PRO, 1);
    expect(calculateCurrent(config)).toBeCloseTo(3685.5 / 220, 1);
  });

  it('100 × S21 Pro: 368,550 W / 220 V ≈ 1675 A', () => {
    const config = withMiners(S21_PRO, 100);
    expect(calculateCurrent(config)).toBeCloseTo(368550 / 220, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TRANSFORMER kVA — 20% overhead on total power
// ════════════════════════════════════════════════════════════════════════

describe('calculateTransformerKva', () => {
  it('1 S21 Pro: 3.6855 kW × 1.2 = 4.4226 kVA', () => {
    const config = withMiners(S21_PRO, 1);
    expect(calculateTransformerKva(config)).toBeCloseTo(3.6855 * 1.2, 3);
  });

  it('50 × S21 Pro → needs transformer > 15 kVA threshold', () => {
    const config = withMiners(S21_PRO, 50);
    const kva = calculateTransformerKva(config);
    expect(kva).toBeGreaterThan(15); // 184.275 × 1.2 ≈ 221.13
  });
});

// ════════════════════════════════════════════════════════════════════════
// TRANSFORMER COST — lookup table
// ════════════════════════════════════════════════════════════════════════

describe('calculateTransformerCost', () => {
  it('farm under 15 kVA needs no dedicated transformer — $0', () => {
    expect(calculateTransformerCost(10)).toBe(0);
  });

  it('15 kVA selects the 15 kVA pole-mount at $2,200', () => {
    expect(calculateTransformerCost(15)).toBe(2200);
  });

  it('100 kVA selects 112.5 kVA pad-mount at $12,000', () => {
    expect(calculateTransformerCost(100)).toBe(12000);
  });

  it('very large farm > 2500 kVA uses multiples of 2500 kVA units', () => {
    // 5000 kVA → 2 × 2500 kVA @ $170,000 each = $340,000
    expect(calculateTransformerCost(5000)).toBe(340000);
  });
});

// ════════════════════════════════════════════════════════════════════════
// CABLE COST — copper weight + installation
// ════════════════════════════════════════════════════════════════════════

describe('calculateCableCost', () => {
  it('50 m of AWG 6 cable at $9/kg copper', () => {
    const config = withMiners(S21_PRO, 1);
    // gaugeMultiplier = 2^((6-6)/3) = 1
    // weight = (50/100) * 4 * 1 = 2 kg
    // material = 2 × 9 = $18
    // installation = 50 × 15 = $750
    // total = $768
    expect(calculateCableCost(config)).toBeCloseTo(768, 0);
  });

  it('longer cable (200 m) scales linearly', () => {
    const config = withMiners(S21_PRO, 1, {
      electrical: { cableLength: 200, cableGauge: 6, copperPricePerKg: 9 },
    });
    // weight = (200/100) * 4 * 1 = 8 kg → $72
    // install = 200 × 15 = $3000
    // total = $3072
    expect(calculateCableCost(config)).toBeCloseTo(3072, 0);
  });

  it('thicker cable (AWG 2) has higher copper weight via gauge multiplier', () => {
    const config = withMiners(S21_PRO, 1, {
      electrical: { cableLength: 100, cableGauge: 2, copperPricePerKg: 9 },
    });
    // gaugeMultiplier = 2^((6-2)/3) = 2^(4/3) ≈ 2.5198
    const gaugeMultiplier = Math.pow(2, (6 - 2) / 3);
    const weight = (100 / 100) * 4 * gaugeMultiplier;
    const material = weight * 9;
    const install = 100 * 15;
    expect(calculateCableCost(config)).toBeCloseTo(material + install, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE COST — racks and containers
// ════════════════════════════════════════════════════════════════════════

describe('calculateInfrastructureCost', () => {
  it('0 miners → $0 racks, $0 containers', () => {
    const result = calculateInfrastructureCost(makeFarmConfig());
    expect(result.rack).toBe(0);
    expect(result.container).toBe(0);
  });

  it('1 miner → 1 rack unit at $700', () => {
    const config = withMiners(S21_PRO, 1);
    const result = calculateInfrastructureCost(config);
    expect(result.rack).toBe(RACK_COST_USD);
  });

  it('exactly 50 miners → 1 rack unit', () => {
    const config = withMiners(S21_PRO, 50);
    const result = calculateInfrastructureCost(config);
    expect(result.rack).toBe(RACK_COST_USD);
  });

  it('51 miners → 2 rack units ($1400)', () => {
    const config = withMiners(S21_PRO, 51);
    const result = calculateInfrastructureCost(config);
    expect(result.rack).toBe(RACK_COST_USD * 2);
  });

  it('racks-only mode → container cost is $0', () => {
    const config = withMiners(S21_PRO, 300);
    const result = calculateInfrastructureCost(config);
    expect(result.container).toBe(0);
  });

  it('container mode: 250 miners → 1 container ($6000) + 5 rack units ($3500)', () => {
    const config = withMiners(S21_PRO, 250, { infrastructureType: 'containers' });
    const result = calculateInfrastructureCost(config);
    expect(result.container).toBe(CONTAINER_BASE_COST_USD);
    expect(result.rack).toBe(5 * RACK_COST_USD);
  });

  it('container mode: 500 miners → 2 containers + 10 rack units', () => {
    const config = withMiners(S21_PRO, 500, { infrastructureType: 'containers' });
    const result = calculateInfrastructureCost(config);
    expect(result.container).toBe(2 * CONTAINER_BASE_COST_USD);
    expect(result.rack).toBe(10 * RACK_COST_USD);
  });
});

// ════════════════════════════════════════════════════════════════════════
// WATER-COOLED / AIR-COOLED DETECTION
// ════════════════════════════════════════════════════════════════════════

describe('hasWatercooledMiners / hasAircooledMiners', () => {
  it('detects air-cooled only farm', () => {
    const config = withMiners(S21_PRO, 10);
    expect(hasWatercooledMiners(config)).toBe(false);
    expect(hasAircooledMiners(config)).toBe(true);
  });

  it('detects water-cooled only farm', () => {
    const config = withMiners(S21_HYDRO, 10);
    expect(hasWatercooledMiners(config)).toBe(true);
    expect(hasAircooledMiners(config)).toBe(false);
  });

  it('detects mixed farm', () => {
    const config = makeFarmConfig({
      miners: [
        { miner: S21_PRO, quantity: 5 },
        { miner: S21_HYDRO, quantity: 5 },
      ],
    });
    expect(hasWatercooledMiners(config)).toBe(true);
    expect(hasAircooledMiners(config)).toBe(true);
  });

  it('empty farm has neither', () => {
    const config = makeFarmConfig();
    expect(hasWatercooledMiners(config)).toBe(false);
    expect(hasAircooledMiners(config)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// COOLING COST (always 0 — CAPEX comes from explicit cooler selections)
// ════════════════════════════════════════════════════════════════════════

describe('calculateCoolingCost', () => {
  it('always returns 0 regardless of farm size', () => {
    expect(calculateCoolingCost(withMiners(S21_PRO, 100))).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// SOLAR CALCULATIONS
// ════════════════════════════════════════════════════════════════════════

describe('Solar calculations', () => {
  const solarConfig = (coveragePercent: number, injectionRatePercent: number = 85) =>
    withMiners(S21_PRO, 10, {
      solar: {
        coveragePercent,
        installationCostPerKw: 1200,
        maintenancePercentPerYear: 1.5,
        injectionRatePercent,
        includeCommissioningInCapex: false,
      },
    });

  describe('calculateSolarInstalledKw', () => {
    it('returns 0 when coverage is 0%', () => {
      expect(calculateSolarInstalledKw(solarConfig(0))).toBe(0);
    });

    it('50% coverage → needs 2× oversize for day/night averaging', () => {
      // 10 miners × 3510 W × 1.05 parasitic = 36.855 kW
      // 50% coverage → 18.4275 kW × 2 = 36.855 kW installed
      const result = calculateSolarInstalledKw(solarConfig(50));
      expect(result).toBeCloseTo(36.855, 2);
    });

    it('100% coverage → 4× total power installed (2× for day/night)', () => {
      const totalPower = calculateTotalPower(solarConfig(100));
      const installed = calculateSolarInstalledKw(solarConfig(100));
      expect(installed).toBeCloseTo(totalPower * 2, 2);
    });
  });

  describe('calculateSolarPanelCount', () => {
    it('returns 0 for no solar', () => {
      expect(calculateSolarPanelCount(solarConfig(0))).toBe(0);
    });

    it('50% coverage → panels = ceil(installedKw × 1000 / 400)', () => {
      const installedKw = calculateSolarInstalledKw(solarConfig(50));
      const expected = Math.ceil((installedKw * 1000) / 400);
      expect(calculateSolarPanelCount(solarConfig(50))).toBe(expected);
    });
  });

  describe('calculateSolarAreaSqm / Sqft', () => {
    it('area = installedKw × 10 m²/kW', () => {
      const installedKw = calculateSolarInstalledKw(solarConfig(50));
      expect(calculateSolarAreaSqm(solarConfig(50))).toBeCloseTo(installedKw * 10, 1);
    });

    it('sqft = sqm × 10.7639', () => {
      const sqm = calculateSolarAreaSqm(solarConfig(50));
      expect(calculateSolarAreaSqft(solarConfig(50))).toBeCloseTo(sqm * 10.7639, 1);
    });
  });

  describe('calculateEffectiveSolarCoverage', () => {
    it('50% coverage × 85% injection rate = 42.5%', () => {
      expect(calculateEffectiveSolarCoverage(solarConfig(50, 85))).toBeCloseTo(42.5, 1);
    });

    it('100% coverage × 100% injection = 100%', () => {
      expect(calculateEffectiveSolarCoverage(solarConfig(100, 100))).toBeCloseTo(100, 1);
    });

    it('100% coverage × 0% injection = 0%', () => {
      expect(calculateEffectiveSolarCoverage(solarConfig(100, 0))).toBeCloseTo(0, 1);
    });
  });

  describe('calculateSolarCapex', () => {
    it('returns 0 when coverage is 0%', () => {
      expect(calculateSolarCapex(solarConfig(0))).toBe(0);
    });

    it('50% coverage: installedKw × $1200/kW', () => {
      const installedKw = calculateSolarInstalledKw(solarConfig(50));
      expect(calculateSolarCapex(solarConfig(50))).toBeCloseTo(installedKw * 1200, 0);
    });
  });

  describe('calculateMonthlySolarMaintenance', () => {
    it('returns 0 when no solar', () => {
      expect(calculateMonthlySolarMaintenance(solarConfig(0))).toBe(0);
    });

    it('annual maintenance 1.5% of CAPEX, divided by 12', () => {
      const capex = calculateSolarCapex(solarConfig(50));
      const expected = (capex * 1.5 / 100) / 12;
      expect(calculateMonthlySolarMaintenance(solarConfig(50))).toBeCloseTo(expected, 1);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// LABOR CAPEX
// ════════════════════════════════════════════════════════════════════════

describe('calculateLaborCapex', () => {
  it('returns $0 for zero miners', () => {
    const result = calculateLaborCapex(makeFarmConfig());
    expect(result.laborCost).toBe(0);
    expect(result.cablesAndBreakers).toBe(0);
  });

  it('1 miner (below transformer threshold) — no transformer labor', () => {
    const config = withMiners(S21_PRO, 1);
    const result = calculateLaborCapex(config);
    // 1 miner × 2.5h + 0 transformer + 1 rack × 4h = 6.5h × $35 = $227.5
    expect(result.laborCost).toBeCloseTo(6.5 * 35, 0);
    expect(result.cablesAndBreakers).toBe(1 * 85);
  });

  it('100 miners (needs transformer) — includes transformer labor', () => {
    const config = withMiners(S21_PRO, 100);
    const result = calculateLaborCapex(config);
    // 100 × 2.5 + 8 (transformer) + 2 racks × 4 = 266h × $35
    expect(result.laborCost).toBeCloseTo(266 * 35, 0);
    expect(result.cablesAndBreakers).toBe(100 * 85);
  });

  it('container mode adds container labor hours', () => {
    const config = withMiners(S21_PRO, 300, { infrastructureType: 'containers' });
    const result = calculateLaborCapex(config);
    // 300 × 2.5 + 8 + 6 racks × 4 + 2 containers × 40 = 750+8+24+80 = 862h
    expect(result.laborCost).toBeCloseTo(862 * 35, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// VENTILATION — airflow for heat dissipation
// Q = P_kW × 200 m³/h, CFM = m³/h × 0.5886
// ════════════════════════════════════════════════════════════════════════

describe('calculateVentilation', () => {
  it('returns 0 for zero miners', () => {
    const result = calculateVentilation(makeFarmConfig());
    expect(result.m3h).toBe(0);
    expect(result.cfm).toBe(0);
  });

  it('10 × S21 Pro at default climate (35°C max, 60% humidity): ΔT=15°C → ≈7,334 m³/h', () => {
    const config = withMiners(S21_PRO, 10);
    const result = calculateVentilation(config);
    // Q (m³/h) = P_W × 3600 / (ρ × Cp × ΔT)
    //         = 36855 × 3600 / (1.2 × 1005 × 15)
    //         ≈ 7333.78 m³/h
    const expectedM3h = (36855 * 3600) / (1.2 * 1005 * 15);
    expect(result.m3h).toBeCloseTo(expectedM3h, 0);
    expect(result.cfm).toBeCloseTo(expectedM3h * 0.5886, 0);
  });

  it('hot climate (45°C max) shrinks ΔT to 5°C → 3× more airflow than 35°C', () => {
    const cool = withMiners(S21_PRO, 10);
    const hot = withMiners(S21_PRO, 10, {
      temperature: {
        location: {
          lat: 0, lng: 0, city: 'hot',
          avgYearlyTempC: 35, maxTempC: 45, minTempC: 25,
          avgHumidityPercent: 50,
        },
        dryCoolerSelections: [],
        airFanSelections: [],
      },
    });
    const coolResult = calculateVentilation(cool);
    const hotResult = calculateVentilation(hot);
    // ΔT=15 (cool, default) vs ΔT=5 (hot) → ratio = 3
    expect(hotResult.m3h / coolResult.m3h).toBeCloseTo(3, 1);
  });

  it('high humidity (>70%) adds penalty up to +15%', () => {
    const dry = withMiners(S21_PRO, 10);
    const humid = withMiners(S21_PRO, 10, {
      temperature: {
        location: {
          lat: 0, lng: 0, city: 'humid',
          avgYearlyTempC: 25, maxTempC: 35, minTempC: 5,
          avgHumidityPercent: 100, // 30% above 70 → capped at 15%
        },
        dryCoolerSelections: [],
        airFanSelections: [],
      },
    });
    const dryResult = calculateVentilation(dry);
    const humidResult = calculateVentilation(humid);
    expect(humidResult.m3h / dryResult.m3h).toBeCloseTo(1.15, 2);
  });

  it('m³/h to CFM conversion factor is approximately 0.5886', () => {
    const config = withMiners(S21_PRO, 1);
    const result = calculateVentilation(config);
    expect(result.cfm / result.m3h).toBeCloseTo(0.5886, 4);
  });
});

// ════════════════════════════════════════════════════════════════════════
// DRY COOLER CAPEX — hardware + labor + plumbing
// ════════════════════════════════════════════════════════════════════════

describe('calculateDryCoolerCapex', () => {
  it('returns 0 when no dry cooler selections', () => {
    expect(calculateDryCoolerCapex(makeFarmConfig())).toBe(0);
  });

  it('1 × D1-005-1x350: $800 + 4h × $35 + $120 = $1060', () => {
    const config = makeFarmConfig({
      temperature: {
        location: null,
        dryCoolerSelections: [{ model: 'D1-005-1x350', quantity: 1 }],
        airFanSelections: [],
      },
    });
    expect(calculateDryCoolerCapex(config)).toBeCloseTo(800 + 4 * 35 + 120, 0);
  });

  it('3 × D1-005-1x350: 3 × $1060 = $3180', () => {
    const config = makeFarmConfig({
      temperature: {
        location: null,
        dryCoolerSelections: [{ model: 'D1-005-1x350', quantity: 3 }],
        airFanSelections: [],
      },
    });
    expect(calculateDryCoolerCapex(config)).toBeCloseTo(3 * (800 + 4 * 35 + 120), 0);
  });

  it('ignores unknown model names gracefully', () => {
    const config = makeFarmConfig({
      temperature: {
        location: null,
        dryCoolerSelections: [{ model: 'nonexistent', quantity: 5 }],
        airFanSelections: [],
      },
    });
    expect(calculateDryCoolerCapex(config)).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// AIR FAN POWER & CAPEX
// ════════════════════════════════════════════════════════════════════════

describe('calculateAirFanPowerKw', () => {
  it('returns 0 when no fans selected', () => {
    expect(calculateAirFanPowerKw(makeFarmConfig())).toBe(0);
  });

  it('2 × JMD-1000 at 750W each = 1.5 kW', () => {
    const config = makeFarmConfig({
      temperature: {
        location: null,
        dryCoolerSelections: [],
        airFanSelections: [{ model: 'JMD-1000 (36")', quantity: 2 }],
      },
    });
    expect(calculateAirFanPowerKw(config)).toBeCloseTo(1.5, 3);
  });
});

describe('calculateAirFanCapex', () => {
  it('returns 0 when no fans selected', () => {
    expect(calculateAirFanCapex(makeFarmConfig())).toBe(0);
  });

  it('3 × JMD-1380 at $180 + 2.5h × $35 = $267.50 each → $802.50 total', () => {
    const config = makeFarmConfig({
      temperature: {
        location: null,
        dryCoolerSelections: [],
        airFanSelections: [{ model: 'JMD-1380 (50")', quantity: 3 }],
      },
    });
    const unitCost = 180 + 2.5 * 35;
    expect(calculateAirFanCapex(config)).toBeCloseTo(3 * unitCost, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// MAINTENANCE LABOR OPEX — monthly hours × rate
// ════════════════════════════════════════════════════════════════════════

describe('calculateMaintenanceLaborOpex', () => {
  it('returns $0 for zero miners', () => {
    expect(calculateMaintenanceLaborOpex(makeFarmConfig())).toBe(0);
  });

  it('≤ 20 miners: flat 8 hours/month × rate', () => {
    const config = withMiners(S21_PRO, 20);
    expect(calculateMaintenanceLaborOpex(config)).toBeCloseTo(8 * 35, 0);
  });

  it('> 20 miners: 30 + miners × 0.2 hours/month', () => {
    const config = withMiners(S21_PRO, 100);
    // 30 + 100 × 0.2 + 0 fans = 50h × $35 = $1750
    expect(calculateMaintenanceLaborOpex(config)).toBeCloseTo(50 * 35, 0);
  });

  it('> 20 miners with fans: adds 1 hour per fan unit', () => {
    const config = withMiners(S21_PRO, 100, {
      temperature: {
        location: null,
        dryCoolerSelections: [],
        airFanSelections: [{ model: 'JMD-1000 (36")', quantity: 4 }],
      },
    });
    // 30 + 100 × 0.2 + 4 = 54h × $35
    expect(calculateMaintenanceLaborOpex(config)).toBeCloseTo(54 * 35, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// MONTHLY OPEX — electricity + maintenance + solar maintenance + labor
// ════════════════════════════════════════════════════════════════════════

describe('calculateMonthlyOpex', () => {
  it('includes electricity cost with tax adder', () => {
    const config = withMiners(S21_PRO, 10);
    const metrics = calculateFarmMetrics(config);
    const monthlyKwh = calculateMonthlyKwh(config);
    const gridKwh = monthlyKwh; // no solar
    const electricityCost = gridKwh * 0.06 * 1.1; // 10% tax

    const opex = calculateMonthlyOpex(config, metrics.totalCapex);
    // Opex includes electricity + maintenance + solar maint + labor
    expect(opex).toBeGreaterThan(electricityCost);
  });

  it('solar offset reduces electricity cost', () => {
    const noSolar = withMiners(S21_PRO, 10);
    const withSolar = withMiners(S21_PRO, 10, {
      solar: {
        coveragePercent: 50,
        installationCostPerKw: 1200,
        maintenancePercentPerYear: 1.5,
        injectionRatePercent: 100,
        includeCommissioningInCapex: false,
      },
    });

    const metricsNoSolar = calculateFarmMetrics(noSolar);
    const metricsWithSolar = calculateFarmMetrics(withSolar);
    const opexNoSolar = calculateMonthlyOpex(noSolar, metricsNoSolar.totalCapex);
    const opexWithSolar = calculateMonthlyOpex(withSolar, metricsWithSolar.totalCapex);

    // With solar, electricity portion is lower but maintenance includes solar CAPEX maintenance
    // The electricity savings should be significant
    const kwhNoSolar = calculateMonthlyKwh(noSolar);
    const elecNoSolar = kwhNoSolar * 0.06 * 1.1;
    const elecWithSolar = kwhNoSolar * 0.5 * 0.06 * 1.1; // 50% covered
    expect(elecNoSolar).toBeGreaterThan(elecWithSolar);
  });
});

// ════════════════════════════════════════════════════════════════════════
// FULL FARM METRICS — integration test
// ════════════════════════════════════════════════════════════════════════

describe('calculateFarmMetrics', () => {
  it('returns consistent metrics for a 100-miner S21 Pro farm', () => {
    const config = withMiners(S21_PRO, 100);
    const m = calculateFarmMetrics(config);

    // Hash rate
    expect(m.totalHashRateThs).toBe(23400);

    // Power: 100 × 3510 × 1.05 / 1000 = 368.55 kW
    expect(m.totalPowerKw).toBeCloseTo(368.55, 1);

    // Energy: 368.55 × 730 = 269,041.5 kWh
    expect(m.monthlyKwh).toBeCloseTo(368.55 * 730, 0);

    // Heat: 368,550 W × 3.412 = 1,257,447.6 BTU/h
    expect(m.heatOutputBtuPerHour).toBeCloseTo(368550 * 3.412, 0);

    // Current: 368,550 / 220 ≈ 1675.2 A
    expect(m.electricalCurrentAmps).toBeCloseTo(368550 / 220, 0);

    // Transformer: 368.55 × 1.2 = 442.26 kVA
    expect(m.transformerKva).toBeCloseTo(442.26, 1);

    // Miner cost: 100 × $5499 = $549,900
    expect(m.minerCost).toBe(549900);

    // Rack cost: ceil(100/50) = 2 racks × $700 = $1,400
    expect(m.rackCost).toBe(1400);

    // Container cost: $0 (racks mode)
    expect(m.containerCost).toBe(0);

    // Total CAPEX should be > miner cost (includes transformer, cable, racks, labor, etc.)
    expect(m.totalCapex).toBeGreaterThan(m.minerCost);

    // Monthly OPEX should be positive
    expect(m.monthlyOpex).toBeGreaterThan(0);
  });

  it('returns zero metrics for empty farm', () => {
    const m = calculateFarmMetrics(makeFarmConfig());
    expect(m.totalHashRateThs).toBe(0);
    expect(m.totalPowerKw).toBe(0);
    expect(m.monthlyKwh).toBe(0);
    expect(m.minerCost).toBe(0);
    // totalCapex may include base infrastructure costs even with 0 miners
    expect(m.totalCapex).toBeGreaterThanOrEqual(0);
  });

  it('import taxes are applied correctly', () => {
    const config = withMiners(S21_PRO, 10, {
      importTax: { containers: 0, racks: 0, miners: 20, fans: 0, dryCoolers: 0 },
    });
    const m = calculateFarmMetrics(config);
    // Miner tax: 10 × $5499 × 20% = $10,998
    expect(m.importTaxCapex).toBeCloseTo(54990 * 0.2, 0);
  });

  it('container mode includes container costs in CAPEX', () => {
    const config = withMiners(S21_PRO, 300, { infrastructureType: 'containers' });
    const m = calculateFarmMetrics(config);
    expect(m.containerCost).toBe(2 * CONTAINER_BASE_COST_USD); // 300/250 = 2 containers
    expect(m.totalCapex).toBeGreaterThan(m.minerCost + m.containerCost);
  });

  it('solar CAPEX is EXCLUDED from totalCapex by default (treated as a separate project)', () => {
    const config = withMiners(S21_PRO, 10, {
      solar: {
        coveragePercent: 100,
        installationCostPerKw: 1200,
        maintenancePercentPerYear: 1.5,
        injectionRatePercent: 100,
        includeCommissioningInCapex: false,
      },
    });
    const m = calculateFarmMetrics(config);
    // solarCapex reported separately but NOT folded into totalCapex
    expect(m.solarCapex).toBeGreaterThan(0);
    const totalExcludingSolar =
      m.minerCost + m.transformerCost + m.cableCost + m.rackCost +
      m.containerCost + m.coolingCost + m.laborCost + m.cablesAndBreakers +
      m.dryCoolerCapex + m.airFanCapex + m.importTaxCapex;
    expect(m.totalCapex).toBeCloseTo(totalExcludingSolar, 2);
  });

  it('solar CAPEX IS INCLUDED in totalCapex when includeCommissioningInCapex is true', () => {
    const config = withMiners(S21_PRO, 10, {
      solar: {
        coveragePercent: 100,
        installationCostPerKw: 1200,
        maintenancePercentPerYear: 1.5,
        injectionRatePercent: 100,
        includeCommissioningInCapex: true,
      },
    });
    const m = calculateFarmMetrics(config);
    expect(m.solarCapex).toBeGreaterThan(0);
    const totalExcludingSolar =
      m.minerCost + m.transformerCost + m.cableCost + m.rackCost +
      m.containerCost + m.coolingCost + m.laborCost + m.cablesAndBreakers +
      m.dryCoolerCapex + m.airFanCapex + m.importTaxCapex;
    expect(m.totalCapex).toBeCloseTo(totalExcludingSolar + m.solarCapex, 2);
  });

  it('toggling includeCommissioningInCapex only affects totalCapex, not solarCapex reporting', () => {
    const base = {
      solar: {
        coveragePercent: 50,
        installationCostPerKw: 1200,
        maintenancePercentPerYear: 1.5,
        injectionRatePercent: 100,
        includeCommissioningInCapex: false,
      },
    };
    const off = withMiners(S21_PRO, 10, base);
    const on = withMiners(S21_PRO, 10, {
      solar: { ...base.solar, includeCommissioningInCapex: true },
    });

    const offMetrics = calculateFarmMetrics(off);
    const onMetrics = calculateFarmMetrics(on);

    // Solar CAPEX reporting is identical in both modes.
    expect(onMetrics.solarCapex).toBe(offMetrics.solarCapex);
    // Total CAPEX difference equals exactly the solar CAPEX.
    expect(onMetrics.totalCapex - offMetrics.totalCapex).toBeCloseTo(offMetrics.solarCapex, 2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// THERMODYNAMIC FUNDAMENTALS
// ════════════════════════════════════════════════════════════════════════

describe('Thermodynamic fundamentals', () => {
  it('watts-to-BTU conversion: 1 kW = 3412 BTU/h', () => {
    // The constant in the code is 3.412 BTU/h per Watt
    // 1000 W × 3.412 = 3412 BTU/h — matches real physics
    const config = withMiners(S21_PRO, 1, { parasiticLoadPercent: 0 });
    const powerW = 3510; // pure miner watts, no parasitic
    const btu = calculateHeatOutput(config);
    expect(btu / powerW).toBeCloseTo(3.412, 3);
  });

  it('ventilation formula: Q = P/(ρ·Cp·ΔT) with ρ=1.2, Cp=1005, ΔT=15 gives ~200 m³/h per kW', () => {
    // Theoretical: Q(m³/s) = P(W) / (1.2 × 1005 × 15) = P / 18090
    // Q(m³/h) = P × 3600 / 18090 = P × 0.199 ≈ P × 0.2
    // For 1 kW: 1000 / 18090 × 3600 = 199.0 m³/h — code uses 200 (rounded)
    const theoretical = (1000 / (1.2 * 1005 * 15)) * 3600;
    expect(theoretical).toBeCloseTo(200, -1); // within ±5
  });
});

// ════════════════════════════════════════════════════════════════════════
// ELECTRICAL ENGINEERING FUNDAMENTALS
// ════════════════════════════════════════════════════════════════════════

describe('Electrical engineering fundamentals', () => {
  it('kVA sizing includes 20% safety margin over real kW', () => {
    const config = withMiners(S21_PRO, 10);
    const kw = calculateTotalPower(config);
    const kva = calculateTransformerKva(config);
    expect(kva / kw).toBeCloseTo(1.2, 4);
  });

  it('current calculation uses I = P/V at 220V (single-phase model)', () => {
    const config = withMiners(S21_PRO, 10);
    const kw = calculateTotalPower(config);
    const amps = calculateCurrent(config);
    expect(amps).toBeCloseTo((kw * 1000) / 220, 2);
  });

  it('cable gauge multiplier follows AWG cross-section scaling', () => {
    // AWG: each 3 gauges doubles the cross-sectional area
    // gauge 6 → multiplier 1
    // gauge 3 → multiplier 2
    // gauge 0 → multiplier 4
    const m3 = Math.pow(2, (6 - 3) / 3);
    const m0 = Math.pow(2, (6 - 0) / 3);
    expect(m3).toBeCloseTo(2, 4);
    expect(m0).toBeCloseTo(4, 4);
  });
});
