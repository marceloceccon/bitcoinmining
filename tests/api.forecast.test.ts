import { describe, it, expect } from 'vitest';
import { POST, OPTIONS } from '@/app/api/forecast/route';
import { MAX_REQUEST_BYTES } from '@/lib/validateFarmConfig';

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

function farmConfig(overrides: Record<string, unknown> = {}) {
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

const VALID_PARAMS = {
  months: 24 as const,
  revenueMode: 'sell_all' as const,
  btcPriceModel: 'fixed' as const,
  pessimisticAdjustPercent: 0,
  networkHashrateGrowthPercent: 25,
  asicDegradationPercent: 5,
  discountRatePercent: 10,
  startingBtcPrice: 65000,
  finalBtcPrice: null,
};

function postRequest(body: unknown | string, headers: Record<string, string> = {}): Request {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://api.example.com/api/forecast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://client.example',
      ...headers,
    },
    body: payload,
  });
}

// ════════════════════════════════════════════════════════════════════════
// OPTIONS preflight
// ════════════════════════════════════════════════════════════════════════

describe('OPTIONS /api/forecast', () => {
  it('returns 204 with CORS headers reflecting the Origin', async () => {
    const response = await OPTIONS(
      new Request('https://api.example.com/api/forecast', {
        method: 'OPTIONS',
        headers: { Origin: 'https://client.example' },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://client.example');
  });
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/forecast — happy path
// ════════════════════════════════════════════════════════════════════════

describe('POST /api/forecast — happy path', () => {
  it('returns 200 with periods and summary for a valid 24-month forecast', async () => {
    const response = await POST(postRequest({ config: farmConfig(), params: VALID_PARAMS }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.periods)).toBe(true);
    expect(json.periods.length).toBe(24);
    expect(json.summary).toBeTruthy();
    expect(json.summary.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(json.totalCapex).toBeGreaterThan(0);
  });

  it('serializes period dates as ISO strings (not Date objects)', async () => {
    const response = await POST(postRequest({ config: farmConfig(), params: VALID_PARAMS }));
    const json = await response.json();
    expect(typeof json.periods[0].date).toBe('string');
    expect(json.periods[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reflects the request Origin in CORS headers', async () => {
    const response = await POST(postRequest({ config: farmConfig(), params: VALID_PARAMS }));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://client.example');
  });
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/forecast — input validation
// ════════════════════════════════════════════════════════════════════════

describe('POST /api/forecast — input validation', () => {
  it('returns 400 on invalid JSON', async () => {
    const response = await POST(postRequest('{ broken'));
    expect(response.status).toBe(400);
  });

  it('returns 400 when the body is not an object', async () => {
    const response = await POST(postRequest([]));
    expect(response.status).toBe(400);
  });

  it('returns 400 when config is missing', async () => {
    const response = await POST(postRequest({ params: VALID_PARAMS }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toMatch(/^config/);
  });

  it('returns 400 when params is missing', async () => {
    const response = await POST(postRequest({ config: farmConfig() }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toMatch(/^params/);
  });

  it('prefixes config-level field paths with "config."', async () => {
    const config = farmConfig();
    delete (config as Record<string, unknown>).electrical;
    const response = await POST(postRequest({ config, params: VALID_PARAMS }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toBe('config.electrical');
  });

  it('returns 400 when params.months is invalid', async () => {
    const response = await POST(
      postRequest({ config: farmConfig(), params: { ...VALID_PARAMS, months: 7 } }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toBe('params.months');
  });

  it('returns 400 when params.btcPriceModel is unknown', async () => {
    const response = await POST(
      postRequest({
        config: farmConfig(),
        params: { ...VALID_PARAMS, btcPriceModel: 'random_walk' },
      }),
    );
    expect(response.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/forecast — adversarial inputs
// ════════════════════════════════════════════════════════════════════════

describe('POST /api/forecast — adversarial inputs', () => {
  it('returns 413 when content-length exceeds the cap', async () => {
    const response = await POST(
      postRequest(
        { config: farmConfig(), params: VALID_PARAMS },
        { 'content-length': String(MAX_REQUEST_BYTES + 1) },
      ),
    );
    expect(response.status).toBe(413);
  });
});
