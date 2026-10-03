import type { FarmConfig, ForecastParams, ForecastResult, ForecastPeriod, MarketSnapshot } from '@/types';
import {
  DAYS_PER_MONTH,
  calculateTotalHashRate,
  calculateFarmMetrics,
  calculateMonthlyOpexBreakdown,
} from './calculations';
import { BLOCKS_PER_DAY, averageSubsidy } from './bitcoin';
import { monthlyBtcMined } from './unitEconomics';

const SECONDS_PER_BLOCK = 600;
const BLOCKS_PER_MONTH = BLOCKS_PER_DAY * DAYS_PER_MONTH; // 4,383

/**
 * BTC price in month `month` for the chosen scenario. Scenarios are choices the
 * user makes, not predictions:
 * - flat:   the starting price throughout
 * - growth: compounds `annualGrowthPercent` per year
 * - target: straight line from the starting price to `finalBtcPrice` at the last month
 */
export function scenarioBtcPrice(params: ForecastParams, startPrice: number, month: number): number {
  switch (params.btcPriceModel) {
    case 'growth':
      return startPrice * Math.pow(1 + (params.annualGrowthPercent ?? 0) / 100, month / 12);
    case 'target': {
      const finalPrice = params.finalBtcPrice ?? startPrice;
      return startPrice + (finalPrice - startPrice) * (month / params.months);
    }
    default:
      return startPrice;
  }
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
 * Calculate ASIC degradation factor for a given year
 */
function getDegradationFactor(monthsElapsed: number, degradationPercent: number): number {
  const years = monthsElapsed / 12;
  return Math.pow(1 - degradationPercent / 100, years);
}

/**
 * Mining revenue for one month (see `monthlyBtcMined`): the degraded farm
 * hashrate at this month's network hashrate and mean subsidy, plus fees.
 */
function calculateMonthlyRevenue(
  farmHashrateThs: number,
  networkHashrateEh: number,
  blockReward: number,
  feesPerBlockBtc: number,
  btcPrice: number,
  poolFeePercent: number,
  uptimePercent: number,
  degradationFactor: number
): { btcMined: number; revenueUsd: number } {
  const btcMined = monthlyBtcMined(
    farmHashrateThs * degradationFactor,
    { networkHashrateEh, blockReward, avgFeesPerBlockBtc: feesPerBlockBtc },
    { uptimePercent, poolFeePercent },
  );
  return { btcMined, revenueUsd: btcMined * btcPrice };
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
 * Main forecasting engine. Market state and the clock are inputs: the same
 * (config, params, market, now) always produces the same forecast.
 *
 * Halvings come from block height: month m covers heights
 * [tip + (m−1)·B, tip + m·B) with B = 144 blocks/day × days/month, and its
 * reward is the mean subsidy over that range.
 */
export function generateForecast(
  config: FarmConfig,
  params: ForecastParams,
  market: MarketSnapshot,
  now: Date = new Date(),
): ForecastResult {
  const periods: ForecastPeriod[] = [];

  // Initial values
  const startDate = new Date(now);
  const farmHashrateThs = calculateTotalHashRate(config);
  const energyInflationPercent = config.regional.energyInflationPercent ?? 3;

  let networkHashrateEh = market.networkHashrateEh;
  let btcBalance = 0;
  let cumulativeProfitUsd = 0;
  let paybackMonths: number | null = null;

  const totalCapex = calculateFarmMetrics(config).totalCapex;
  // Same itemized OPEX as the dashboard; only electricity inflates over time.
  const baseOpex = calculateMonthlyOpexBreakdown(config, totalCapex);
  const fixedOpexUsd = baseOpex.maintenance + baseOpex.solarMaintenance + baseOpex.maintenanceLabor;
  const feesPerBlockBtc = params.feesPerBlockBtc ?? market.avgFeesPerBlockBtc;
  const monthlyCashFlows: number[] = [];

  // BTC price scenario starts at the market price unless the user overrides it
  const startPrice = params.startingBtcPrice ?? market.btcPriceUsd;

  for (let month = 1; month <= params.months; month++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + month);

    // Update network hashrate (exponential growth)
    const growthFactor = Math.pow(1 + params.networkHashrateGrowthPercent / 100, month / 12);
    networkHashrateEh = market.networkHashrateEh * growthFactor;

    // Mean block subsidy over this month's block heights (halvings by height)
    const blockReward = averageSubsidy(
      market.blockHeight + (month - 1) * BLOCKS_PER_MONTH,
      market.blockHeight + month * BLOCKS_PER_MONTH,
    );

    // Calculate difficulty
    const difficulty = calculateDifficulty(networkHashrateEh);

    const btcPrice = scenarioBtcPrice(params, startPrice, month);

    // Degradation factor
    const degradationFactor = getDegradationFactor(month, params.asicDegradationPercent);

    // Mining revenue
    const { btcMined, revenueUsd } = calculateMonthlyRevenue(
      farmHashrateThs,
      networkHashrateEh,
      blockReward,
      feesPerBlockBtc,
      btcPrice,
      config.poolFeePercent,
      config.uptimePercent,
      degradationFactor
    );

    // Costs — apply energy inflation compounded per year
    const inflationFactor = Math.pow(1 + energyInflationPercent / 100, month / 12);
    const electricityCostUsd = baseOpex.electricity * inflationFactor;
    const opexUsd = electricityCostUsd + fixedOpexUsd;

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
  const totalDays = params.months * DAYS_PER_MONTH;
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
