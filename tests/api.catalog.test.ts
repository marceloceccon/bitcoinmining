import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as getMiners, OPTIONS as optionsMiners } from '@/app/api/miners/route';
import { GET as getDryCoolers } from '@/app/api/dry-coolers/route';
import { GET as getAirFans } from '@/app/api/air-fans/route';
import { GET as getUpdates } from '@/app/api/updates/route';
import * as catalog from '@/lib/catalog';
import { serverCache } from '@/lib/serverCache';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/api/miners', {
    headers: { Origin: 'https://client.example', ...headers },
  });
}

beforeEach(() => {
  serverCache.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════
// /api/miners
// ════════════════════════════════════════════════════════════════════════

describe('GET /api/miners', () => {
  it('returns 200 with a non-empty miner array', async () => {
    const response = await getMiners(makeRequest());
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty('id');
    expect(json[0]).toHaveProperty('hash_rate_ths');
  });

  it('reflects the request Origin in CORS headers', async () => {
    const response = await getMiners(makeRequest());
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://client.example');
  });

  it('returns 500 with a JSON error body when the catalog cannot be loaded', async () => {
    vi.spyOn(catalog, 'getMiners').mockImplementation(() => {
      throw new Error('disk read failed');
    });
    const response = await getMiners(makeRequest());
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toMatch(/miner catalog/i);
    expect(json.detail).toMatch(/disk read failed/);
    // Critical: a JSON error shape (not an HTML 500) so the documented
    // contract is preserved even on failure.
    expect(response.headers.get('Content-Type')).toMatch(/application\/json/);
  });
});

describe('OPTIONS /api/miners', () => {
  it('returns 204 with CORS headers', async () => {
    const response = await optionsMiners(makeRequest({ Origin: 'https://x.example' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://x.example');
  });
});

// ════════════════════════════════════════════════════════════════════════
// /api/dry-coolers
// ════════════════════════════════════════════════════════════════════════

describe('GET /api/dry-coolers', () => {
  it('returns 200 with a non-empty dry cooler array', async () => {
    const response = await getDryCoolers(makeRequest());
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty('model');
    expect(json[0]).toHaveProperty('kw_capacity_35c');
  });

  it('returns 500 with a JSON error body when the catalog cannot be loaded', async () => {
    vi.spyOn(catalog, 'getDryCoolers').mockImplementation(() => {
      throw new Error('parse failed');
    });
    const response = await getDryCoolers(makeRequest());
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toMatch(/dry cooler/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// /api/air-fans
// ════════════════════════════════════════════════════════════════════════

describe('GET /api/air-fans', () => {
  it('returns 200 with a non-empty air fan array', async () => {
    const response = await getAirFans(makeRequest());
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty('model');
    expect(json[0]).toHaveProperty('airflow_m3h');
  });

  it('returns 500 with a JSON error body when the catalog cannot be loaded', async () => {
    vi.spyOn(catalog, 'getAirFans').mockImplementation(() => {
      throw new Error('file not found');
    });
    const response = await getAirFans(makeRequest());
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toMatch(/air fan/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// /api/updates
// ════════════════════════════════════════════════════════════════════════

describe('GET /api/updates', () => {
  it('returns 200 with update timestamps', async () => {
    const response = await getUpdates(makeRequest());
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(typeof json).toBe('object');
  });

  it('returns 500 with a JSON error body when the file cannot be loaded', async () => {
    vi.spyOn(catalog, 'getUpdates').mockImplementation(() => {
      throw new Error('updates.json missing');
    });
    const response = await getUpdates(makeRequest());
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toMatch(/update/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Cache behavior — catalogs use the 10-minute TTL cache
// ════════════════════════════════════════════════════════════════════════

describe('catalog routes are cached via serverCache', () => {
  it('GET /api/miners reads the catalog once, then serves from cache', async () => {
    const spy = vi.spyOn(catalog, 'getMiners');
    const first = await getMiners(makeRequest());
    const second = await getMiners(makeRequest());
    const third = await getMiners(makeRequest());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    // Only one catalog read across three requests.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/dry-coolers reads the catalog once, then serves from cache', async () => {
    const spy = vi.spyOn(catalog, 'getDryCoolers');
    await getDryCoolers(makeRequest());
    await getDryCoolers(makeRequest());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/air-fans reads the catalog once, then serves from cache', async () => {
    const spy = vi.spyOn(catalog, 'getAirFans');
    await getAirFans(makeRequest());
    await getAirFans(makeRequest());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/updates reads the catalog once, then serves from cache', async () => {
    const spy = vi.spyOn(catalog, 'getUpdates');
    await getUpdates(makeRequest());
    await getUpdates(makeRequest());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Single source — the engine and the API read the same catalog objects
// ════════════════════════════════════════════════════════════════════════

describe('catalog single source (data/*.json)', () => {
  it('the API serves exactly the rows the engine computes with', async () => {
    const [miners, dryCoolers, airFans] = await Promise.all([
      getMiners(makeRequest()).then((r) => r.json()),
      getDryCoolers(makeRequest()).then((r) => r.json()),
      getAirFans(makeRequest()).then((r) => r.json()),
    ]);
    expect(miners).toEqual(catalog.MINERS);
    expect(dryCoolers).toEqual(catalog.DRY_COOLERS);
    expect(airFans).toEqual(catalog.AIR_FANS);
  });

  it('engine cooling CAPEX is priced from the served JSON rows', async () => {
    const { calculateDryCoolerCapex, calculateAirFanCapex } = await import('@/lib/calculations');
    const dryCoolers = await getDryCoolers(makeRequest()).then((r) => r.json());
    const airFans = await getAirFans(makeRequest()).then((r) => r.json());
    const dc = dryCoolers[0];
    const fan = airFans[0];
    const rate = 20;
    const config = {
      labor: { hourlyLaborCostUsd: rate },
      temperature: {
        location: null,
        dryCoolerSelections: [{ model: dc.model, quantity: 2 }],
        airFanSelections: [{ model: fan.model, quantity: 3 }],
      },
    } as unknown as Parameters<typeof calculateDryCoolerCapex>[0];
    expect(calculateDryCoolerCapex(config)).toBeCloseTo(
      2 * (dc.estimated_cost_usd + dc.man_hours_deploy * rate + dc.plumbing_fluid_cost_usd),
    );
    expect(calculateAirFanCapex(config)).toBeCloseTo(3 * (fan.cost_usd + fan.man_hours_deploy * rate));
  });
});
