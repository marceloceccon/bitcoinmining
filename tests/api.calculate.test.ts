import { describe, it, expect } from 'vitest';
import { POST, OPTIONS } from '@/app/api/calculate/route';
import { MAX_REQUEST_BYTES, MAX_MINERS_ENTRIES } from '@/lib/validateFarmConfig';

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

function postRequest(body: unknown | string, headers: Record<string, string> = {}): Request {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://api.example.com/api/calculate', {
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

describe('OPTIONS /api/calculate', () => {
  it('returns 204 with CORS headers reflecting the Origin', async () => {
    const response = await OPTIONS(
      new Request('https://api.example.com/api/calculate', {
        method: 'OPTIONS',
        headers: { Origin: 'https://client.example' },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://client.example');
  });
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/calculate — happy path
// ════════════════════════════════════════════════════════════════════════

describe('POST /api/calculate — happy path', () => {
  it('returns 200 with metrics for a valid 10-miner farm', async () => {
    const response = await POST(postRequest(farmConfig()));
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.metrics).toBeTruthy();
    expect(json.metrics.totalHashRateThs).toBe(234 * 10);
    // Power = 3510 W × 10 × 1.05 parasitic / 1000 = 36.855 kW
    expect(json.metrics.totalPowerKw).toBeCloseTo(36.855, 3);
    expect(json.totalHashRateThs).toBe(2340);
    expect(json.ventilation).toBeTruthy();
    expect(json.ventilation.m3h).toBeGreaterThan(0);
    expect(json.climate).toBeTruthy();
    expect(json.dryCoolerDeratingFactor).toBeGreaterThan(0);
  });

  it('reflects the request Origin in the response CORS header', async () => {
    const response = await POST(postRequest(farmConfig()));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://client.example',
    );
  });

  it('handles an empty miners array (returns zero metrics)', async () => {
    const response = await POST(postRequest(farmConfig({ miners: [] })));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.metrics.totalHashRateThs).toBe(0);
    expect(json.metrics.totalPowerKw).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/calculate — input validation
// ════════════════════════════════════════════════════════════════════════

describe('POST /api/calculate — input validation', () => {
  it('returns 400 on invalid JSON', async () => {
    const response = await POST(postRequest('{ broken json'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/JSON/i);
  });

  it('returns 400 on a non-object body (array)', async () => {
    const response = await POST(postRequest([]));
    expect(response.status).toBe(400);
  });

  it('returns 400 on a body missing the miners array', async () => {
    const config = farmConfig();
    delete (config as Record<string, unknown>).miners;
    const response = await POST(postRequest(config));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toBe('miners');
  });

  it('returns 400 with the offending field path on a malformed miner', async () => {
    const config = farmConfig({
      miners: [{ miner: { id: 's21' }, quantity: 1 }],
    });
    const response = await POST(postRequest(config));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toMatch(/miners\[0\].miner\./);
  });

  it('returns 400 when a nested object is missing', async () => {
    const config = farmConfig();
    delete (config as Record<string, unknown>).electrical;
    const response = await POST(postRequest(config));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.field).toBe('electrical');
  });
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/calculate — adversarial inputs
// ════════════════════════════════════════════════════════════════════════

describe('POST /api/calculate — adversarial inputs', () => {
  it('returns 413 when content-length exceeds the cap', async () => {
    const response = await POST(
      postRequest(farmConfig(), { 'content-length': String(MAX_REQUEST_BYTES + 1) }),
    );
    expect(response.status).toBe(413);
    const json = await response.json();
    expect(json.error).toMatch(/exceeds/i);
  });

  it('rejects an oversized miners array', async () => {
    const config = farmConfig({
      miners: Array.from({ length: MAX_MINERS_ENTRIES + 1 }, () => validMinerEntry(1)),
    });
    const response = await POST(postRequest(config));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/exceeds/i);
  });

  it('runs to completion at the 1000-entry cap (perf smoke test)', async () => {
    const config = farmConfig({
      miners: Array.from({ length: MAX_MINERS_ENTRIES }, () => validMinerEntry(1)),
    });
    const response = await POST(postRequest(config));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.metrics.totalHashRateThs).toBe(234 * MAX_MINERS_ENTRIES);
  });

  it('does not echo internal stack traces in 400 responses', async () => {
    const response = await POST(postRequest('{not json'));
    const json = await response.json();
    expect(JSON.stringify(json)).not.toMatch(/at \w+\./); // no stack frames
  });
});
