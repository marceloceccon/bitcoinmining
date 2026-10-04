import { describe, it, expect } from 'vitest';
import { layoutSchematic, schematicInputFromFarm, MAX_HOUSING_DRAWN, type SchematicInput } from '@/lib/schematicLayout';
import { buildPresetConfig, getPreset } from '@/lib/presets';
import { computeFarmReport } from '@/lib/farmReport';
import { FALLBACK_MARKET } from '@/lib/networkData';

const base: SchematicInput = {
  totalMiners: 100, totalPowerKw: 383, infrastructure: 'containers', transformer: { kvaRating: 500, quantity: 1 },
  fans: 2, dryCoolers: 0, airHeatKw: 383, hydroHeatKw: 0, ventilationM3h: 76164, maxTempC: 35,
};

describe('layoutSchematic', () => {
  it('is deterministic', () => {
    expect(layoutSchematic(base)).toEqual(layoutSchematic({ ...base }));
  });

  it('draws the Small Farm preset: 500 kVA, one container 40% full, two fans', () => {
    const config = buildPresetConfig(getPreset('small-farm'));
    const layout = layoutSchematic(schematicInputFromFarm(config, computeFarmReport(config, FALLBACK_MARKET)));
    expect(layout.transformer).toMatchObject({ present: true, label: '500 kVA' });
    expect(layout.housing.units).toHaveLength(1);
    expect(layout.housing.units[0].fill).toBeCloseTo(100 / 250);
    expect(layout.housing.label).toBe('1 × 20 ft container · 100 miners');
    expect(layout.coolers.map((c) => c.kind)).toEqual(['fan', 'fan']);
    expect(layout.exhaustLabel).toBe('76,164 m³/h');
  });

  it('a small home farm has no transformer, just a service panel', () => {
    const layout = layoutSchematic({ ...base, totalMiners: 1, transformer: null, infrastructure: 'racks', fans: 1 });
    expect(layout.transformer).toMatchObject({ present: false, label: 'Service panel' });
    expect(layout.housing.label).toBe('1 × rack · 1 miners');
  });

  it('groups very large farms into "×N" instead of drawing every container', () => {
    const layout = layoutSchematic({ ...base, totalMiners: 3000, totalPowerKw: 11000, transformer: { kvaRating: 2500, quantity: 6 } });
    expect(layout.housing.units).toHaveLength(MAX_HOUSING_DRAWN);
    expect(layout.housing.units.at(-1)!.groupCount).toBe(12 - (MAX_HOUSING_DRAWN - 1));
    expect(layout.transformer.label).toBe('6 × 2,500 kVA');
  });

  it('power flows faster for bigger farms, and the plume grows with heat and climate', () => {
    const small = layoutSchematic({ ...base, totalPowerKw: 50 });
    const big = layoutSchematic({ ...base, totalPowerKw: 10000 });
    expect(big.flowSeconds).toBeLessThan(small.flowSeconds);
    const cold = layoutSchematic({ ...base, maxTempC: 20 });
    const hot = layoutSchematic({ ...base, maxTempC: 45 });
    expect(hot.plume).toBeGreaterThan(cold.plume);
  });

  it('hydro farms show dry coolers and the heat they reject', () => {
    const config = buildPresetConfig(getPreset('industrial'));
    const layout = layoutSchematic(schematicInputFromFarm(config, computeFarmReport(config, FALLBACK_MARKET)));
    expect(layout.coolers.every((c) => c.kind === 'dryCooler')).toBe(true);
    expect(layout.exhaustLabel).toMatch(/kW rejected$/);
  });
});
