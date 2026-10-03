/**
 * P1.9 — OPEX investigation. The old screenshot showed the Industrial preset at
 * ~$231k/month OPEX vs ~$157k revenue, with ~$100k unexplained. Itemizing the
 * current engine shows every dollar: there is no unexplained remainder.
 */
import { describe, it, expect } from 'vitest';
import { calculateFarmMetrics, calculateMonthlyOpexBreakdown } from '@/lib/calculations';
import { generateForecast } from '@/lib/forecasting';
import { GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW, GOLDEN_PRESETS, buildPresetConfig } from './golden/cases';

const industrial = () => buildPresetConfig(GOLDEN_PRESETS.find((p) => p.slug === 'industrial')!);

describe('monthly OPEX, itemized (Industrial preset: 500 × S21 Hyd)', () => {
  it('electricity + maintenance + maintenance labor account for the whole total', () => {
    const config = industrial();
    const metrics = calculateFarmMetrics(config);
    const opex = calculateMonthlyOpexBreakdown(config, metrics.totalCapex);
    console.info('[P1.9] Industrial monthly OPEX breakdown', {
      powerKw: metrics.totalPowerKw,
      electricity: Math.round(opex.electricity),
      maintenance: Math.round(opex.maintenance),
      maintenanceLabor: Math.round(opex.maintenanceLabor),
      solarMaintenance: Math.round(opex.solarMaintenance),
      total: Math.round(opex.total),
      totalCapex: Math.round(metrics.totalCapex),
    });

    // 500 × 5,360 W × 1.05 parasitic = 2,814 kW × 730.5 h × $0.05
    expect(metrics.totalPowerKw).toBeCloseTo(2814, 6);
    expect(opex.electricity).toBeCloseTo(2814 * 730.5 * 0.05, 4);
    // 5 %/yr of CAPEX, monthly
    expect(opex.maintenance).toBeCloseTo((metrics.totalCapex * 0.05) / 12, 4);
    // (30 + 0.2 × 500 + 0 fans) h × $35
    expect(opex.maintenanceLabor).toBe((30 + 100) * 35);
    expect(opex.solarMaintenance).toBe(0);
    expect(opex.total).toBeCloseTo(opex.electricity + opex.maintenance + opex.maintenanceLabor, 6);
    expect(metrics.monthlyOpex).toBeCloseTo(opex.total, 6);
    // Nowhere near the ~$231k of the old screenshot.
    expect(opex.total).toBeLessThan(130_000);
  });
});

describe('forecast OPEX matches the dashboard OPEX', () => {
  it.each(GOLDEN_PRESETS.map((p) => p.slug))('%s: month-1 OPEX without energy inflation = metrics.monthlyOpex', (slug) => {
    const config = buildPresetConfig(GOLDEN_PRESETS.find((p) => p.slug === slug)!);
    config.regional.energyInflationPercent = 0;
    const forecast = generateForecast(config, GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW);
    expect(forecast.periods[0].opexUsd).toBeCloseTo(calculateFarmMetrics(config).monthlyOpex, 6);
  });

  it('only electricity inflates: month-13 OPEX grows by the inflation rate on electricity alone', () => {
    const config = industrial();
    const metrics = calculateFarmMetrics(config);
    const opex = calculateMonthlyOpexBreakdown(config, metrics.totalCapex);
    const forecast = generateForecast(config, GOLDEN_FORECAST_PARAMS, GOLDEN_MARKET, GOLDEN_NOW);
    const inflation = 1 + config.regional.energyInflationPercent / 100;
    expect(forecast.periods[11].electricityCostUsd).toBeCloseTo(opex.electricity * inflation, 4);
    expect(forecast.periods[11].opexUsd).toBeCloseTo(
      opex.electricity * inflation + opex.maintenance + opex.maintenanceLabor,
      4,
    );
  });
});
