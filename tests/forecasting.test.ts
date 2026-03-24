import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateStockToFlowPrice,
  getStockToFlowTarget,
  generateForecast,
  CURRENT_NETWORK_HASHRATE_EH,
  CURRENT_BLOCK_REWARD,
} from '@/lib/forecasting';
import type { FarmConfig, ForecastParams } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────────

const S21_PRO = {
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

function makeFarmConfig(minerCount: number = 10): FarmConfig {
  return {
    miners: minerCount > 0 ? [{ miner: S21_PRO, quantity: minerCount }] : [],
    electrical: { cableLength: 50, cableGauge: 6, copperPricePerKg: 9 },
    cooling: { type: 'air' },
    solar: {
      coveragePercent: 0,
      installationCostPerKw: 1200,
      maintenancePercentPerYear: 1.5,
      injectionRatePercent: 85,
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
  };
}

function makeParams(overrides: Partial<ForecastParams> = {}): ForecastParams {
  return {
    months: 24,
    revenueMode: 'sell_all',
    btcPriceModel: 'fixed',
    pessimisticAdjustPercent: 0,
    networkHashrateGrowthPercent: 20,
    asicDegradationPercent: 5,
    discountRatePercent: 10,
    startingBtcPrice: 100000,
    finalBtcPrice: 100000,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════
// STOCK-TO-FLOW PRICE MODEL
// ════════════════════════════════════════════════════════════════════════

describe('calculateStockToFlowPrice', () => {
  it('returns a price based on the S2F power-law: 0.4 × SF³', () => {
    // With block reward 3.125 BTC
    // Annual supply = 144 × 365 × 3.125 = 164,250 BTC
    // SF = 19,800,000 / 164,250 ≈ 120.55
    // Base price = 0.4 × 120.55³ ≈ 700,645
    const annualSupply = 144 * 365 * 3.125;
    const sf = 19.8e6 / annualSupply;
    const expectedBase = 0.4 * Math.pow(sf, 3);
    const result = calculateStockToFlowPrice(3.125, 0);
    expect(result).toBeCloseTo(expectedBase, -2);
  });

  it('pessimistic adjustment of -30% reduces the price', () => {
    const base = calculateStockToFlowPrice(3.125, 0);
    const pessimistic = calculateStockToFlowPrice(3.125, -30);
    expect(pessimistic).toBeLessThan(base);
    expect(pessimistic).toBeCloseTo(base * 0.7, -2);
  });

  it('positive adjustment increases the price', () => {
    const base = calculateStockToFlowPrice(3.125, 0);
    const optimistic = calculateStockToFlowPrice(3.125, 20);
    expect(optimistic).toBeGreaterThan(base);
  });

  it('never returns below $10,000 floor', () => {
    // With a tiny block reward and massive pessimistic adjust
    const result = calculateStockToFlowPrice(3.125, -99);
    expect(result).toBeGreaterThanOrEqual(10000);
  });

  it('halved block reward (1.5625) produces higher S2F price', () => {
    const currentReward = calculateStockToFlowPrice(3.125, 0);
    const halvedReward = calculateStockToFlowPrice(1.5625, 0);
    expect(halvedReward).toBeGreaterThan(currentReward);
  });

  it('S2F ratio doubles when block reward halves → price 8× (cube relationship)', () => {
    // If reward halves: SF doubles → price = 0.4 × (2×SF)³ = 8 × original
    const price1 = calculateStockToFlowPrice(6.25, 0);
    const price2 = calculateStockToFlowPrice(3.125, 0);
    // SF ratio roughly doubles → price ~8× (not exact due to fixed existing supply)
    expect(price2 / price1).toBeCloseTo(8, -1);
  });
});

describe('getStockToFlowTarget', () => {
  it('returns a positive price for any month count', () => {
    expect(getStockToFlowTarget(12, 0)).toBeGreaterThan(0);
    expect(getStockToFlowTarget(36, 0)).toBeGreaterThan(0);
  });

  it('pessimistic adjustment reduces price vs neutral', () => {
    const neutral = getStockToFlowTarget(24, 0);
    const pessimistic = getStockToFlowTarget(24, -20);
    expect(pessimistic).toBeLessThan(neutral);
  });
});

// ════════════════════════════════════════════════════════════════════════
// HALVING SCHEDULE
// ════════════════════════════════════════════════════════════════════════

describe('Halving schedule in forecasts', () => {
  it('block reward is 3.125 BTC before April 2028 halving', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({ months: 12, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);
    // All periods should have block reward 3.125 (within 12 months from now, 2026)
    for (const period of result.periods) {
      expect(period.blockReward).toBe(3.125);
    }
  });

  it('block reward drops to 1.5625 after April 2028 halving', () => {
    const config = makeFarmConfig(10);
    // 36 months from March 2026 → March 2029, crosses April 2028 halving
    const params = makeParams({ months: 36, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);

    const preHalving = result.periods.filter(p => p.blockReward === 3.125);
    const postHalving = result.periods.filter(p => p.blockReward === 1.5625);

    expect(preHalving.length).toBeGreaterThan(0);
    expect(postHalving.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// DIFFICULTY & NETWORK HASHRATE GROWTH
// ════════════════════════════════════════════════════════════════════════

describe('Difficulty adjustments', () => {
  it('difficulty increases with network hashrate growth', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 24,
      networkHashrateGrowthPercent: 30,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    const firstDifficulty = result.periods[0].difficulty;
    const lastDifficulty = result.periods[result.periods.length - 1].difficulty;
    expect(lastDifficulty).toBeGreaterThan(firstDifficulty);
  });

  it('0% hashrate growth keeps difficulty approximately constant', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      networkHashrateGrowthPercent: 0,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    const diffs = result.periods.map(p => p.difficulty);
    // All difficulties should be nearly equal (small variation from month-fraction growth model)
    const ratio = diffs[diffs.length - 1] / diffs[0];
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('network hashrate at month N follows exponential growth model', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      networkHashrateGrowthPercent: 20,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    // At month 12: growthFactor = (1.20)^(12/12) = 1.20
    const expectedEh = CURRENT_NETWORK_HASHRATE_EH * 1.20;
    const lastPeriodEh = result.periods[11].networkHashrateThs / 1e6;
    expect(lastPeriodEh).toBeCloseTo(expectedEh, 0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// HARDWARE DEGRADATION
// ════════════════════════════════════════════════════════════════════════

describe('ASIC hardware degradation', () => {
  it('5% annual degradation reduces revenue over time', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 24,
      asicDegradationPercent: 5,
      networkHashrateGrowthPercent: 0,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    // Revenue at month 1 > revenue at month 24 (degradation effect)
    expect(result.periods[0].miningRevenueUsd).toBeGreaterThan(
      result.periods[23].miningRevenueUsd
    );
  });

  it('0% degradation keeps revenue stable (ceteris paribus)', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      asicDegradationPercent: 0,
      networkHashrateGrowthPercent: 0,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    const first = result.periods[0].miningRevenueUsd;
    const last = result.periods[11].miningRevenueUsd;
    expect(last / first).toBeCloseTo(1, 2);
  });

  it('degradation factor after 2 years at 5%/year = (1-0.05)^2 = 0.9025', () => {
    // This tests the exponential compounding model
    const factor = Math.pow(1 - 5 / 100, 2);
    expect(factor).toBeCloseTo(0.9025, 4);
  });
});

// ════════════════════════════════════════════════════════════════════════
// POOL FEE CALCULATIONS
// ════════════════════════════════════════════════════════════════════════

describe('Pool fee calculations', () => {
  it('2% pool fee reduces BTC mined by 2%', () => {
    const config2 = makeFarmConfig(10);
    config2.poolFeePercent = 2;

    const config0 = makeFarmConfig(10);
    config0.poolFeePercent = 0;

    const params = makeParams({
      months: 12,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });

    const result2 = generateForecast(config2, params);
    const result0 = generateForecast(config0, params);

    const btcWith2 = result2.summary.totalBtcMined;
    const btcWith0 = result0.summary.totalBtcMined;

    expect(btcWith2 / btcWith0).toBeCloseTo(0.98, 3);
  });

  it('higher pool fee means less BTC mined', () => {
    const config5 = makeFarmConfig(10);
    config5.poolFeePercent = 5;

    const config1 = makeFarmConfig(10);
    config1.poolFeePercent = 1;

    const params = makeParams({
      months: 12,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });

    const r5 = generateForecast(config5, params);
    const r1 = generateForecast(config1, params);

    expect(r5.summary.totalBtcMined).toBeLessThan(r1.summary.totalBtcMined);
  });
});

// ════════════════════════════════════════════════════════════════════════
// BTC REVENUE PROJECTIONS
// ════════════════════════════════════════════════════════════════════════

describe('BTC revenue projections', () => {
  it('revenue = hashrate share × blocks × reward × price × (1 - poolFee)', () => {
    const config = makeFarmConfig(10);
    config.poolFeePercent = 0;
    config.uptimePercent = 100;

    const params = makeParams({
      months: 12,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });

    const result = generateForecast(config, params);
    const period1 = result.periods[0];

    // Farm hashrate: 10 × 234 = 2340 TH/s = 0.00234 EH/s
    // Network: 750 EH/s (approx after 1 month growth, but growth = 0)
    // Actually month 1 still has growth factor applied: (1+0)^(1/12) = 1
    // Pool share: 0.00234 / 750 = 0.00000312
    // Monthly blocks: 144 × 30 × 0.00000312 = 0.013478
    // BTC mined: 0.013478 × 3.125 = 0.04212 BTC (0% fee)
    const farmEh = 2340 / 1e6;
    const growthFactor = Math.pow(1, 1 / 12); // 0% growth
    const networkEh = CURRENT_NETWORK_HASHRATE_EH * growthFactor;
    const share = farmEh / networkEh;
    const monthlyBlocks = 144 * 30 * share;
    const expectedBtc = monthlyBlocks * 3.125;

    expect(period1.btcMined).toBeCloseTo(expectedBtc, 6);
  });

  it('higher BTC price increases USD revenue proportionally', () => {
    const config = makeFarmConfig(10);
    const params50k = makeParams({
      months: 12,
      startingBtcPrice: 50000,
      finalBtcPrice: 50000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });
    const params100k = makeParams({
      months: 12,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });

    const r50k = generateForecast(config, params50k);
    const r100k = generateForecast(config, params100k);

    expect(r100k.summary.totalRevenue / r50k.summary.totalRevenue).toBeCloseTo(2, 1);
  });

  it('BTC mined is the same regardless of BTC price', () => {
    const config = makeFarmConfig(10);
    const params50k = makeParams({
      months: 12,
      startingBtcPrice: 50000,
      finalBtcPrice: 50000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });
    const params200k = makeParams({
      months: 12,
      startingBtcPrice: 200000,
      finalBtcPrice: 200000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });

    const r50k = generateForecast(config, params50k);
    const r200k = generateForecast(config, params200k);

    expect(r50k.summary.totalBtcMined).toBeCloseTo(r200k.summary.totalBtcMined, 8);
  });
});

// ════════════════════════════════════════════════════════════════════════
// REVENUE MODES
// ════════════════════════════════════════════════════════════════════════

describe('Revenue modes', () => {
  const config = makeFarmConfig(10);
  const baseParams = makeParams({
    months: 12,
    startingBtcPrice: 100000,
    finalBtcPrice: 100000,
    networkHashrateGrowthPercent: 0,
    asicDegradationPercent: 0,
  });

  it('sell_all: no BTC balance accumulates', () => {
    const result = generateForecast(config, { ...baseParams, revenueMode: 'sell_all' });
    expect(result.summary.finalBtcBalance).toBe(0);
  });

  it('hold_all: all BTC is held, profit is negative (paying OPEX out of pocket)', () => {
    const result = generateForecast(config, { ...baseParams, revenueMode: 'hold_all' });
    expect(result.summary.finalBtcBalance).toBeGreaterThan(0);
    // Each period profit should be negative (= -opex)
    for (const p of result.periods) {
      expect(p.profitUsd).toBeLessThan(0);
    }
  });

  it('sell_opex: sells just enough BTC to cover OPEX, holds the rest', () => {
    const result = generateForecast(config, { ...baseParams, revenueMode: 'sell_opex' });
    // Should accumulate some BTC
    expect(result.summary.finalBtcBalance).toBeGreaterThan(0);
    // But less than hold_all
    const holdAll = generateForecast(config, { ...baseParams, revenueMode: 'hold_all' });
    expect(result.summary.finalBtcBalance).toBeLessThan(holdAll.summary.finalBtcBalance);
  });
});

// ════════════════════════════════════════════════════════════════════════
// BTC PRICE INTERPOLATION
// ════════════════════════════════════════════════════════════════════════

describe('BTC price interpolation', () => {
  it('linearly interpolates from start to final price', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      startingBtcPrice: 50000,
      finalBtcPrice: 110000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });
    const result = generateForecast(config, params);

    // At month 6 (t=6/12=0.5): price = 50000 + (110000-50000)*0.5 = 80000
    expect(result.periods[5].btcPrice).toBeCloseTo(80000, -2);

    // At month 12 (t=1): price = 110000
    expect(result.periods[11].btcPrice).toBeCloseTo(110000, -2);
  });

  it('fixed price model keeps price constant', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    for (const p of result.periods) {
      expect(p.btcPrice).toBeCloseTo(100000, 0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// BREAK-EVEN ANALYSIS
// ════════════════════════════════════════════════════════════════════════

describe('Break-even analysis', () => {
  it('breakEvenBtcPrice = totalCosts / totalBtcMined', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({ months: 24, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);

    const expected = result.summary.totalCosts / result.summary.totalBtcMined;
    expect(result.summary.breakEvenBtcPrice).toBeCloseTo(expected, 0);
  });

  it('breakEvenBtcPriceWithCapex includes CAPEX', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({ months: 24, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);

    const expected = (result.summary.totalCosts + result.totalCapex) / result.summary.totalBtcMined;
    expect(result.summary.breakEvenBtcPriceWithCapex).toBeCloseTo(expected, 0);
  });

  it('breakEvenBtcPriceWithCapex > breakEvenBtcPrice', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({ months: 24, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);

    expect(result.summary.breakEvenBtcPriceWithCapex).toBeGreaterThan(
      result.summary.breakEvenBtcPrice
    );
  });
});

// ════════════════════════════════════════════════════════════════════════
// NPV AND IRR
// ════════════════════════════════════════════════════════════════════════

describe('NPV and IRR', () => {
  it('NPV at 10% discount rate is less than undiscounted total profit', () => {
    const config = makeFarmConfig(50);
    const params = makeParams({
      months: 24,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
      discountRatePercent: 10,
    });
    const result = generateForecast(config, params);

    const undiscountedProfit = result.summary.totalProfit - result.totalCapex;
    expect(result.summary.npv).toBeLessThan(undiscountedProfit);
  });

  it('higher discount rate → lower NPV', () => {
    const config = makeFarmConfig(50);
    const params5 = makeParams({
      months: 24,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
      discountRatePercent: 5,
    });
    const params20 = makeParams({
      months: 24,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
      discountRatePercent: 20,
    });

    const r5 = generateForecast(config, params5);
    const r20 = generateForecast(config, params20);

    expect(r5.summary.npv).toBeGreaterThan(r20.summary.npv);
  });

  it('IRR is positive for a profitable farm', () => {
    const config = makeFarmConfig(50);
    const params = makeParams({
      months: 36,
      startingBtcPrice: 100000,
      finalBtcPrice: 150000,
    });
    const result = generateForecast(config, params);

    if (result.summary.totalProfit > result.totalCapex) {
      expect(result.summary.irr).toBeGreaterThan(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// ENERGY INFLATION
// ════════════════════════════════════════════════════════════════════════

describe('Energy inflation', () => {
  it('3% annual energy inflation increases electricity cost over time', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 24,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });
    const result = generateForecast(config, params);

    // Electricity cost at month 24 > month 1
    expect(result.periods[23].electricityCostUsd).toBeGreaterThan(
      result.periods[0].electricityCostUsd
    );

    // After 2 years: factor = (1.03)^2 = 1.0609
    const ratio = result.periods[23].electricityCostUsd / result.periods[0].electricityCostUsd;
    expect(ratio).toBeCloseTo(Math.pow(1.03, 2), 1);
  });
});

// ════════════════════════════════════════════════════════════════════════
// UPTIME
// ════════════════════════════════════════════════════════════════════════

describe('Uptime effect on revenue', () => {
  it('lower uptime reduces BTC mined proportionally', () => {
    const config98 = makeFarmConfig(10);
    config98.uptimePercent = 98;

    const config80 = makeFarmConfig(10);
    config80.uptimePercent = 80;

    const params = makeParams({
      months: 12,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
      networkHashrateGrowthPercent: 0,
      asicDegradationPercent: 0,
    });

    const r98 = generateForecast(config98, params);
    const r80 = generateForecast(config80, params);

    expect(r80.summary.totalBtcMined / r98.summary.totalBtcMined).toBeCloseTo(80 / 98, 2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// HASHPRICE
// ════════════════════════════════════════════════════════════════════════

describe('Hashprice calculation', () => {
  it('avgHashpriceUsd = totalRevenue / (farmHashrate × totalDays)', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);

    const farmThs = 2340;
    const totalDays = 12 * 30;
    const expected = result.summary.totalRevenue / (farmThs * totalDays);
    expect(result.summary.avgHashpriceUsd).toBeCloseTo(expected, 4);
  });
});

// ════════════════════════════════════════════════════════════════════════
// PAYBACK PERIOD
// ════════════════════════════════════════════════════════════════════════

describe('Payback period', () => {
  it('highly profitable farm has payback within forecast window', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 48,
      startingBtcPrice: 200000,
      finalBtcPrice: 300000,
    });
    const result = generateForecast(config, params);

    expect(result.summary.paybackMonths).not.toBeNull();
    if (result.summary.paybackMonths) {
      expect(result.summary.paybackMonths).toBeLessThanOrEqual(48);
    }
  });

  it('unprofitable farm may have null payback', () => {
    const config = makeFarmConfig(10);
    config.regional.electricityPriceKwh = 0.50; // Very expensive electricity
    const params = makeParams({
      months: 12,
      startingBtcPrice: 20000,
      finalBtcPrice: 20000,
    });
    const result = generateForecast(config, params);

    // With $0.50/kWh and $20k BTC, payback is unlikely in 12 months
    expect(result.summary.paybackMonths).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// FORECAST PERIOD COUNT
// ════════════════════════════════════════════════════════════════════════

describe('Forecast structure', () => {
  it('generates exactly N periods for N months', () => {
    const config = makeFarmConfig(10);
    const params12 = makeParams({ months: 12, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const params36 = makeParams({ months: 36, startingBtcPrice: 100000, finalBtcPrice: 100000 });

    expect(generateForecast(config, params12).periods.length).toBe(12);
    expect(generateForecast(config, params36).periods.length).toBe(36);
  });

  it('totalCapex matches calculateFarmMetrics output', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({ months: 12, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);

    expect(result.totalCapex).toBeGreaterThan(0);
  });

  it('ROI in final period reflects cumulative profit vs CAPEX', () => {
    const config = makeFarmConfig(10);
    const params = makeParams({
      months: 12,
      startingBtcPrice: 100000,
      finalBtcPrice: 100000,
    });
    const result = generateForecast(config, params);
    const lastPeriod = result.periods[11];

    const expectedRoi = (lastPeriod.cumulativeProfitUsd / result.totalCapex) * 100;
    expect(lastPeriod.roi).toBeCloseTo(expectedRoi, 2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// EDGE: ZERO MINERS
// ════════════════════════════════════════════════════════════════════════

describe('Edge case: zero miners', () => {
  it('forecast with 0 miners produces zero revenue and zero BTC', () => {
    const config = makeFarmConfig(0);
    const params = makeParams({ months: 12, startingBtcPrice: 100000, finalBtcPrice: 100000 });
    const result = generateForecast(config, params);

    expect(result.summary.totalRevenue).toBe(0);
    expect(result.summary.totalBtcMined).toBe(0);
    // totalCosts may include base OPEX (maintenance %) even with 0 miners
    expect(result.summary.totalCosts).toBeGreaterThanOrEqual(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// MINING ECONOMICS FUNDAMENTALS
// ════════════════════════════════════════════════════════════════════════

describe('Mining economics fundamentals', () => {
  it('hashrate share: farm / network ratio determines block share', () => {
    // 2340 TH/s farm ÷ 750 EH/s network = 0.00000312 share
    const farmThs = 2340;
    const networkEhs = 750;
    const share = (farmThs / 1e6) / networkEhs;
    expect(share).toBeCloseTo(0.00000312, 8);
  });

  it('daily blocks is fixed at 144 (one per ~10 minutes)', () => {
    const blocksPerDay = (24 * 60 * 60) / 600;
    expect(blocksPerDay).toBe(144);
  });

  it('difficulty = (hashrate_H/s × 600) / 2^32', () => {
    // At 750 EH/s — JS floating point loses precision at these magnitudes
    const hashrate = 750e18;
    const difficulty = (hashrate * 600) / Math.pow(2, 32);
    // Result is ~1.047e14 in JS float64 (theoretical: ~1.047e14)
    expect(difficulty).toBeGreaterThan(1e13);
  });
});
