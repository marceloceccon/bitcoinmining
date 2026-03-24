import type { FarmConfig, ForecastParams, ForecastResult, ForecastPeriod } from '@/types';
import { calculateTotalHashRate, calculateMonthlyKwh, calculateEffectiveSolarCoverage, calculateFarmMetrics } from './calculations';

// Bitcoin network constants
const BLOCKS_PER_DAY = 144;
const SECONDS_PER_BLOCK = 600;
export const CURRENT_NETWORK_HASHRATE_EH = 750; // Exahash/s (approximate 2026)
const CURRENT_DIFFICULTY = 108e12; // Approximate
export const CURRENT_BLOCK_REWARD = 3.125; // Post-2024 halving

// Halving schedule (approximate dates)
const HALVINGS = [
  { date: new Date('2028-04-01'), reward: 1.5625 },
  { date: new Date('2032-04-01'), reward: 0.78125 },
  { date: new Date('2036-04-01'), reward: 0.390625 },
  { date: new Date('2040-04-01'), reward: 0.1953125 },
];

/**
 * Stock-to-Flow Bitcoin price model
 * Formula: Price = 0.4 * SF^3 (simplified power law)
 * Exported so the UI can compute default final price.
 */
export function calculateStockToFlowPrice(blockReward: number, pessimisticAdjust: number): number {
  const blocksPerYear = BLOCKS_PER_DAY * 365;
  const annualSupply = blocksPerYear * blockReward;
  const existingSupply = 19.8e6; // Approximate circulating supply 2026
  const sf = existingSupply / annualSupply;
  const basePrice = 0.4 * Math.pow(sf, 3);
  const adjustedPrice = basePrice * (1 + pessimisticAdjust / 100);
  return Math.max(adjustedPrice, 10000);
}

/**
 * Compute the S2F target price for a date N months from now.
 */
export function getStockToFlowTarget(months: number, pessimisticAdjust: number): number {
  const target = new Date();
  target.setMonth(target.getMonth() + months);
  const reward = getBlockReward(target);
  return calculateStockToFlowPrice(reward, pessimisticAdjust);
}

/**
 * Calculate network difficulty based on hashrate
 */
function calculateDifficulty(networkHashrateEh: number): number {
  // Difficulty = (hashrate in H/s * seconds per block) / 2^32
  const hashrateHs = networkHashrateEh * 1e18;
  return (hashrateHs * SECONDS_PER_BLOCK) / Math.pow(2, 32);
}

/**
 * Calculate block reward for a given date
 */
function getBlockReward(date: Date): number {
  for (const halving of HALVINGS) {
    if (date < halving.date) {
      // Check previous halving
      const idx = HALVINGS.indexOf(halving);
      if (idx === 0) return CURRENT_BLOCK_REWARD;
      return HALVINGS[idx - 1].reward;
    }
  }
  return HALVINGS[HALVINGS.length - 1].reward;
}

/**
 * Calculate ASIC degradation factor for a given year
 */
function getDegradationFactor(monthsElapsed: number, degradationPercent: number): number {
  const years = monthsElapsed / 12;
  return Math.pow(1 - degradationPercent / 100, years);
}

/**
 * Calculate mining revenue for one month
 */
function calculateMonthlyRevenue(
  farmHashrateThs: number,
  networkHashrateEh: number,
  blockReward: number,
  btcPrice: number,
  poolFeePercent: number,
  uptimePercent: number,
  degradationFactor: number
): { btcMined: number; revenueUsd: number } {
  // Effective hashrate after degradation and uptime
  const effectiveHashrateThs = farmHashrateThs * degradationFactor * (uptimePercent / 100);

  // Convert to same units (EH/s)
  const effectiveHashrateEh = effectiveHashrateThs / 1e6;

  // Pool share of network
  const poolShare = effectiveHashrateEh / networkHashrateEh;

  // Monthly blocks mined
  const monthlyBlocks = BLOCKS_PER_DAY * 30 * poolShare;

  // BTC mined before pool fee
  const btcMinedGross = monthlyBlocks * blockReward;

  // BTC after pool fee
  const btcMined = btcMinedGross * (1 - poolFeePercent / 100);

  // Revenue in USD
  const revenueUsd = btcMined * btcPrice;

  return { btcMined, revenueUsd };
}

/**
 * Calculate NPV given monthly cash flows and annual discount rate
 */
function calculateNpv(monthlyCashFlows: number[], annualDiscountRate: number, initialInvestment: number): number {
  const monthlyRate = Math.pow(1 + annualDiscountRate / 100, 1 / 12) - 1;
  let npv = -initialInvestment;
  for (let i = 0; i < monthlyCashFlows.length; i++) {
    npv += monthlyCashFlows[i] / Math.pow(1 + monthlyRate, i + 1);
  }
  return npv;
}

/**
 * Calculate IRR using bisection method
 */
function calculateIrr(monthlyCashFlows: number[], initialInvestment: number): number {
  let lo = -50; // -50% annual
  let hi = 500; // 500% annual

  // Check if IRR exists (does NPV at 0% start positive?)
  const npvAtZero = calculateNpv(monthlyCashFlows, 0, initialInvestment);
  if (npvAtZero < 0) {
    // Project never pays back even at 0% discount — negative IRR
    // Try extending range
    lo = -99;
  }

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npv = calculateNpv(monthlyCashFlows, mid, initialInvestment);
    if (Math.abs(npv) < 0.01) return mid;
    if (npv > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Main forecasting engine
 */
export function generateForecast(config: FarmConfig, params: ForecastParams): ForecastResult {
  const periods: ForecastPeriod[] = [];

  // Initial values
  const startDate = new Date();
  const farmHashrateThs = calculateTotalHashRate(config);
  const monthlyKwh = calculateMonthlyKwh(config);
  const baseElectricityCostPerKwh = config.regional.electricityPriceKwh *
                                    (1 + config.regional.taxAdderPercent / 100);
  const energyInflationPercent = config.regional.energyInflationPercent ?? 3;

  // Solar offset (injection rate reduces effective coverage)
  const effectiveSolarCoverage = calculateEffectiveSolarCoverage(config) / 100;
  const gridKwh = monthlyKwh * (1 - effectiveSolarCoverage);

  let networkHashrateEh = CURRENT_NETWORK_HASHRATE_EH;
  let btcBalance = 0;
  let cumulativeProfitUsd = 0;
  let paybackMonths: number | null = null;

  const totalCapex = calculateFarmMetrics(config).totalCapex;
  const monthlyCashFlows: number[] = [];

  // BTC price progression: interpolate from starting price to final S2F target
  const startPrice = params.startingBtcPrice;
  const finalPrice = params.finalBtcPrice ?? getStockToFlowTarget(params.months, params.pessimisticAdjustPercent);

  for (let month = 1; month <= params.months; month++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + month);

    // Update network hashrate (exponential growth)
    const growthFactor = Math.pow(1 + params.networkHashrateGrowthPercent / 100, month / 12);
    networkHashrateEh = CURRENT_NETWORK_HASHRATE_EH * growthFactor;

    // Get block reward (check for halvings)
    const blockReward = getBlockReward(currentDate);

    // Calculate difficulty
    const difficulty = calculateDifficulty(networkHashrateEh);

    // BTC price: linear interpolation from starting to final price over the forecast
    const t = month / params.months; // 0→1
    const btcPrice = startPrice + (finalPrice - startPrice) * t;

    // Degradation factor
    const degradationFactor = getDegradationFactor(month, params.asicDegradationPercent);

    // Mining revenue
    const { btcMined, revenueUsd } = calculateMonthlyRevenue(
      farmHashrateThs,
      networkHashrateEh,
      blockReward,
      btcPrice,
      config.poolFeePercent,
      config.uptimePercent,
      degradationFactor
    );

    // Costs — apply energy inflation compounded per year
    const inflationFactor = Math.pow(1 + energyInflationPercent / 100, month / 12);
    const electricityCostUsd = gridKwh * baseElectricityCostPerKwh * inflationFactor;
    const maintenanceUsd = totalCapex > 0 ? (totalCapex * (config.maintenanceOpexPercent / 100)) / 12 : 500;
    const opexUsd = electricityCostUsd + maintenanceUsd;

    // Profit calculation based on revenue mode
    let profitUsd = 0;
    let btcSold = 0;

    if (params.revenueMode === "sell_all") {
      btcSold = btcMined;
      profitUsd = revenueUsd - opexUsd;
    } else if (params.revenueMode === "hold_all") {
      // Assume operating capital covers OPEX
      profitUsd = -opexUsd; // Negative cash flow
      btcBalance += btcMined;
    } else {
      // sell_opex: Sell just enough to cover OPEX
      const btcNeededForOpex = opexUsd / btcPrice;
      if (btcMined >= btcNeededForOpex) {
        btcSold = btcNeededForOpex;
        btcBalance += (btcMined - btcNeededForOpex);
        profitUsd = 0; // Break-even
      } else {
        // Not enough to cover OPEX
        btcSold = btcMined;
        profitUsd = revenueUsd - opexUsd; // Negative
      }
    }

    // Cash flow for NPV/IRR (always revenue - opex regardless of strategy)
    monthlyCashFlows.push(revenueUsd - opexUsd);

    cumulativeProfitUsd += profitUsd;

    // Check for payback
    if (paybackMonths === null && cumulativeProfitUsd >= totalCapex) {
      paybackMonths = month;
    }

    // ROI calculation
    const roi = totalCapex > 0 ? (cumulativeProfitUsd / totalCapex) * 100 : 0;

    periods.push({
      month,
      date: currentDate,
      btcPrice,
      networkHashrateThs: networkHashrateEh * 1e6,
      difficulty,
      blockReward,
      miningRevenueUsd: revenueUsd,
      electricityCostUsd,
      opexUsd,
      profitUsd,
      btcMined,
      btcSold,
      btcBalance,
      cumulativeProfitUsd,
      roi,
    });
  }

  // Summary
  const totalRevenue = periods.reduce((sum, p) => sum + p.miningRevenueUsd, 0);
  const totalCosts = periods.reduce((sum, p) => sum + p.opexUsd, 0);
  const totalProfit = totalRevenue - totalCosts;
  const totalBtcMined = periods.reduce((sum, p) => sum + p.btcMined, 0);
  const finalBtcBalance = periods[periods.length - 1]?.btcBalance || 0;
  const roiPercent = totalCapex > 0 ? (totalProfit / totalCapex) * 100 : 0;

  // NPV & IRR
  const discountRate = params.discountRatePercent ?? 10;
  const npv = calculateNpv(monthlyCashFlows, discountRate, totalCapex);
  const irr = totalCapex > 0 ? calculateIrr(monthlyCashFlows, totalCapex) : 0;

  // Break-even BTC price: price at which total revenue = total costs
  // Revenue = totalBtcMined × price, so price = totalCosts / totalBtcMined
  const breakEvenBtcPrice = totalBtcMined > 0 ? totalCosts / totalBtcMined : 0;
  const breakEvenBtcPriceWithCapex = totalBtcMined > 0 ? (totalCosts + totalCapex) / totalBtcMined : 0;

  // Hashprice: $/TH/day average
  const totalDays = params.months * 30;
  const avgHashpriceUsd = farmHashrateThs > 0 ? totalRevenue / (farmHashrateThs * totalDays) : 0;

  return {
    periods,
    totalCapex,
    summary: {
      totalRevenue,
      totalCosts,
      totalProfit,
      finalBtcBalance,
      roiPercent,
      paybackMonths,
      irr,
      npv,
      breakEvenBtcPrice,
      breakEvenBtcPriceWithCapex,
      avgHashpriceUsd,
      totalBtcMined,
    },
  };
}
