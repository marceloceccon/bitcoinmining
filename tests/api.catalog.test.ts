import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as getMiners, OPTIONS as optionsMiners } from '@/app/api/miners/route';
import { GET as getDryCoolers } from '@/app/api/dry-coolers/route';
import { GET as getAirFans } from '@/app/api/air-fans/route';
import { GET as getUpdates } from '@/app/api/updates/route';
import * as serverData from '@/lib/serverData';
import { serverCache } from '@/lib/serverCache';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/api/miners', {
    headers: { Origin: 'https://client.example', ...headers },
  });
}

beforeEach(() => {
  serverData.__resetCacheForTests();
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
    vi.spyOn(serverData, 'getMiners').mockImplementation(() => {
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
    vi.spyOn(serverData, 'getDryCoolers').mockImplementation(() => {
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
    vi.spyOn(serverData, 'getAirFans').mockImplementation(() => {
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
    vi.spyOn(serverData, 'getUpdates').mockImplementation(() => {
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
  it('GET /api/miners reads from disk once, then serves from cache', async () => {
    const spy = vi.spyOn(serverData, 'getMiners');
    const first = await getMiners(makeRequest());
    const second = await getMiners(makeRequest());
    const third = await getMiners(makeRequest());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    // Only one disk read across three requests.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/dry-coolers reads from disk once, then serves from cache', async () => {
    const spy = vi.spyOn(serverData, 'getDryCoolers');
    await getDryCoolers(makeRequest());
    await getDryCoolers(makeRequest());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/air-fans reads from disk once, then serves from cache', async () => {
    const spy = vi.spyOn(serverData, 'getAirFans');
    await getAirFans(makeRequest());
    await getAirFans(makeRequest());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/updates reads from disk once, then serves from cache', async () => {
    const spy = vi.spyOn(serverData, 'getUpdates');
    await getUpdates(makeRequest());
    await getUpdates(makeRequest());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
