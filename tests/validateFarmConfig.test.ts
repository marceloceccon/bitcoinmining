import { describe, it, expect } from 'vitest';
import {
  validateFarmConfig,
  validateForecastParams,
  isWithinSizeLimit,
  MAX_MINERS_ENTRIES,
  MAX_TOTAL_MINER_QUANTITY,
  MAX_REQUEST_BYTES,
} from '@/lib/validateFarmConfig';
import type { FarmConfig } from '@/types';

// ─── Fixture helpers ─────────────────────────────────────────────────

function validMinerEntry(quantity = 1) {
  return {
    miner: {
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
    },
    quantity,
  };
}

function validFarmConfig(overrides: Partial<FarmConfig> = {}): unknown {
  return {
    miners: [validMinerEntry(10)],
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

// ════════════════════════════════════════════════════════════════════════
// validateFarmConfig — happy path
// ════════════════════════════════════════════════════════════════════════

describe('validateFarmConfig — happy path', () => {
  it('accepts a fully-formed FarmConfig', () => {
    const result = validateFarmConfig(validFarmConfig());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.miners.length).toBe(1);
    }
  });

  it('accepts a config with multiple miner entries', () => {
    const config = validFarmConfig({
      miners: [
        validMinerEntry(5) as never,
        validMinerEntry(3) as never,
      ],
    });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(true);
  });

  it('accepts an empty miners array (zero miners is a valid farm-in-progress)', () => {
    const result = validateFarmConfig(validFarmConfig({ miners: [] }));
    expect(result.ok).toBe(true);
  });

  it('accepts a config with optional temperature object present', () => {
    const config = validFarmConfig({
      temperature: {
        location: null,
        dryCoolerSelections: [],
        airFanSelections: [],
      },
    });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(true);
  });

  it('accepts a config with no temperature key (it is optional)', () => {
    const config = validFarmConfig();
    delete (config as Record<string, unknown>).temperature;
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// validateFarmConfig — top-level shape
// ════════════════════════════════════════════════════════════════════════

describe('validateFarmConfig — top-level shape', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['string', 'hello'],
    ['array', []],
    ['boolean', true],
  ])('rejects a body that is %s', (_label, body) => {
    const result = validateFarmConfig(body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JSON object/i);
    }
  });

  it('rejects a body without a miners property', () => {
    const config = validFarmConfig() as Record<string, unknown>;
    delete config.miners;
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners');
  });

  it('rejects a body where miners is not an array', () => {
    const config = validFarmConfig({ miners: 'oops' as never });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners');
  });
});

// ════════════════════════════════════════════════════════════════════════
// validateFarmConfig — miner entries
// ════════════════════════════════════════════════════════════════════════

describe('validateFarmConfig — miner entries', () => {
  it('rejects a miner entry that is not an object', () => {
    const config = validFarmConfig({ miners: ['nope'] as never });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0]');
  });

  it('rejects a miner entry missing the inner miner object', () => {
    const config = validFarmConfig({
      miners: [{ quantity: 1 } as never],
    });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0].miner');
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['string', '10'],
    ['missing', undefined],
  ])('rejects a miner entry with %s quantity', (_label, quantity) => {
    const entry = validMinerEntry();
    if (quantity === undefined) {
      delete (entry as Record<string, unknown>).quantity;
    } else {
      (entry as Record<string, unknown>).quantity = quantity;
    }
    const result = validateFarmConfig(validFarmConfig({ miners: [entry as never] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0].quantity');
  });

  it('rejects a miner missing required hash_rate_ths', () => {
    const entry = validMinerEntry();
    delete (entry.miner as Record<string, unknown>).hash_rate_ths;
    const result = validateFarmConfig(validFarmConfig({ miners: [entry as never] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0].miner.hash_rate_ths');
  });

  it('rejects a miner with negative power_watts', () => {
    const entry = validMinerEntry();
    entry.miner.power_watts = -100;
    const result = validateFarmConfig(validFarmConfig({ miners: [entry as never] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0].miner.power_watts');
  });

  it('rejects a miner with non-string id', () => {
    const entry = validMinerEntry();
    (entry.miner as Record<string, unknown>).id = 123;
    const result = validateFarmConfig(validFarmConfig({ miners: [entry as never] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0].miner.id');
  });

  it('rejects a miner with non-boolean watercooled flag', () => {
    const entry = validMinerEntry();
    (entry.miner as Record<string, unknown>).watercooled = 'no';
    const result = validateFarmConfig(validFarmConfig({ miners: [entry as never] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('miners[0].miner.watercooled');
  });
});

// ════════════════════════════════════════════════════════════════════════
// validateFarmConfig — limits
// ════════════════════════════════════════════════════════════════════════

describe('validateFarmConfig — limits', () => {
  it(`rejects a miners array exceeding ${MAX_MINERS_ENTRIES} entries`, () => {
    const miners = Array.from({ length: MAX_MINERS_ENTRIES + 1 }, () => validMinerEntry(1));
    const result = validateFarmConfig(validFarmConfig({ miners: miners as never }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/exceeds/);
      expect(result.field).toBe('miners');
    }
  });

  it(`accepts a miners array exactly at the ${MAX_MINERS_ENTRIES}-entry limit`, () => {
    const miners = Array.from({ length: MAX_MINERS_ENTRIES }, () => validMinerEntry(1));
    const result = validateFarmConfig(validFarmConfig({ miners: miners as never }));
    expect(result.ok).toBe(true);
  });

  it(`rejects when total miner quantity exceeds ${MAX_TOTAL_MINER_QUANTITY}`, () => {
    const result = validateFarmConfig(
      validFarmConfig({
        miners: [validMinerEntry(MAX_TOTAL_MINER_QUANTITY + 1) as never],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/total miner quantity/);
  });
});

// ════════════════════════════════════════════════════════════════════════
// validateFarmConfig — nested objects and numeric fields
// ════════════════════════════════════════════════════════════════════════

describe('validateFarmConfig — nested objects', () => {
  it.each([
    'electrical',
    'cooling',
    'solar',
    'regional',
    'labor',
    'importTax',
    'maintenanceLabor',
  ])('rejects when %s is missing', (field) => {
    const config = validFarmConfig();
    delete (config as Record<string, unknown>)[field];
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(field);
  });

  it.each([
    'electrical',
    'cooling',
    'solar',
    'regional',
    'labor',
    'importTax',
    'maintenanceLabor',
  ])('rejects when %s is not an object', (field) => {
    const config = validFarmConfig();
    (config as Record<string, unknown>)[field] = 'oops';
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(field);
  });

  it.each([
    'parasiticLoadPercent',
    'uptimePercent',
    'poolFeePercent',
    'maintenanceOpexPercent',
  ])('rejects when %s is not a finite number', (field) => {
    const config = validFarmConfig();
    (config as Record<string, unknown>)[field] = 'forty';
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(field);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects %s in numeric top-level fields',
    (value) => {
      const config = validFarmConfig();
      (config as Record<string, unknown>).parasiticLoadPercent = value;
      const result = validateFarmConfig(config);
      expect(result.ok).toBe(false);
    },
  );

  it('rejects when temperature is a non-object truthy value', () => {
    const config = validFarmConfig({ temperature: 'invalid' as never });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('temperature');
  });

  it('accepts temperature: null as if absent', () => {
    const config = validFarmConfig({ temperature: null as never });
    const result = validateFarmConfig(config);
    expect(result.ok).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// validateForecastParams
// ════════════════════════════════════════════════════════════════════════

const VALID_FORECAST_PARAMS = {
  months: 24 as const,
  revenueMode: 'sell_all' as const,
  btcPriceModel: 'stock_to_flow' as const,
  pessimisticAdjustPercent: -30,
  networkHashrateGrowthPercent: 25,
  asicDegradationPercent: 5,
  discountRatePercent: 10,
  startingBtcPrice: 65000,
  finalBtcPrice: null,
};

describe('validateForecastParams', () => {
  it('accepts a fully-formed params object', () => {
    expect(validateForecastParams(VALID_FORECAST_PARAMS).ok).toBe(true);
  });

  it('accepts finalBtcPrice as a number', () => {
    expect(
      validateForecastParams({ ...VALID_FORECAST_PARAMS, finalBtcPrice: 200000 }).ok,
    ).toBe(true);
  });

  it.each([null, undefined, 'string', 42, []])(
    'rejects non-object body (%p)',
    (body) => {
      expect(validateForecastParams(body).ok).toBe(false);
    },
  );

  it.each([6, 18, 100, '12'])('rejects invalid months (%p)', (months) => {
    const result = validateForecastParams({ ...VALID_FORECAST_PARAMS, months });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('params.months');
  });

  it('rejects unknown revenueMode', () => {
    const result = validateForecastParams({ ...VALID_FORECAST_PARAMS, revenueMode: 'sell_some' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('params.revenueMode');
  });

  it('rejects unknown btcPriceModel', () => {
    const result = validateForecastParams({ ...VALID_FORECAST_PARAMS, btcPriceModel: 'random_walk' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('params.btcPriceModel');
  });

  it.each([
    'pessimisticAdjustPercent',
    'networkHashrateGrowthPercent',
    'asicDegradationPercent',
    'discountRatePercent',
    'startingBtcPrice',
  ])('rejects non-finite %s', (key) => {
    const result = validateForecastParams({ ...VALID_FORECAST_PARAMS, [key]: 'NaN' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(`params.${key}`);
  });

  it('rejects finalBtcPrice that is neither number nor null', () => {
    const result = validateForecastParams({ ...VALID_FORECAST_PARAMS, finalBtcPrice: 'maybe' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('params.finalBtcPrice');
  });
});

// ════════════════════════════════════════════════════════════════════════
// isWithinSizeLimit
// ════════════════════════════════════════════════════════════════════════

describe('isWithinSizeLimit', () => {
  it('returns true when content-length is missing (unknown)', () => {
    expect(isWithinSizeLimit(null)).toBe(true);
  });

  it('returns true at the exact byte cap', () => {
    expect(isWithinSizeLimit(String(MAX_REQUEST_BYTES))).toBe(true);
  });

  it('returns false one byte over the cap', () => {
    expect(isWithinSizeLimit(String(MAX_REQUEST_BYTES + 1))).toBe(false);
  });

  it('returns false on a non-numeric content-length', () => {
    expect(isWithinSizeLimit('not-a-number')).toBe(false);
  });

  it('returns false on a negative content-length', () => {
    expect(isWithinSizeLimit('-1')).toBe(false);
  });
});
