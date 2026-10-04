/**
 * Key drivers (tornado chart): how the forecast's NPV moves when one input
 * swings down and up while everything else stays at the base case. Pure.
 */
import type { FarmConfig, ForecastParams, MarketSnapshot } from '@/types';
import { generateForecast } from '@/lib/forecasting';

export interface DriverSwing {
  driver: string;
  low: { label: string; npv: number };
  high: { label: string; npv: number };
}

export interface KeyDrivers {
  baseNpv: number;
  /** Sorted by total swing, largest first (the tornado shape) */
  drivers: DriverSwing[];
}

export function keyDrivers(config: FarmConfig, params: ForecastParams, market: MarketSnapshot, now: Date): KeyDrivers {
  const npv = (c: FarmConfig, p: ForecastParams) => generateForecast(c, p, market, now).summary.npv;
  const baseNpv = npv(config, params);
  const startPrice = params.startingBtcPrice ?? market.btcPriceUsd;
  const withPower = (factor: number): FarmConfig => ({
    ...config,
    regional: { ...config.regional, electricityPriceKwh: config.regional.electricityPriceKwh * factor },
  });
  // Every price in the scenario moves by the same factor
  const withBtc = (factor: number): ForecastParams => ({
    ...params,
    startingBtcPrice: startPrice * factor,
    finalBtcPrice: params.finalBtcPrice != null ? params.finalBtcPrice * factor : params.finalBtcPrice,
  });
  const growth = params.networkHashrateGrowthPercent;
  const wear = params.asicDegradationPercent;

  const drivers: DriverSwing[] = [
    {
      driver: 'BTC price',
      low: { label: '−10%', npv: npv(config, withBtc(0.9)) },
      high: { label: '+10%', npv: npv(config, withBtc(1.1)) },
    },
    {
      driver: 'Electricity price',
      low: { label: '+20%', npv: npv(withPower(1.2), params) },
      high: { label: '−20%', npv: npv(withPower(0.8), params) },
    },
    {
      driver: 'Network hashrate growth',
      low: { label: `${growth + 10}%/yr`, npv: npv(config, { ...params, networkHashrateGrowthPercent: growth + 10 }) },
      high: {
        label: `${Math.max(0, growth - 10)}%/yr`,
        npv: npv(config, { ...params, networkHashrateGrowthPercent: Math.max(0, growth - 10) }),
      },
    },
    {
      driver: 'ASIC wear',
      low: { label: `${wear * 2}%/yr`, npv: npv(config, { ...params, asicDegradationPercent: wear * 2 }) },
      high: { label: '0%/yr', npv: npv(config, { ...params, asicDegradationPercent: 0 }) },
    },
  ];

  const swing = (d: DriverSwing) => Math.abs(d.high.npv - d.low.npv);
  return { baseNpv, drivers: drivers.sort((a, b) => swing(b) - swing(a)) };
}
