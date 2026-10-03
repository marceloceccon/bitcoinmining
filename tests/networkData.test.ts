import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  FALLBACK_MARKET,
  defaultNetworkGrowthPercent,
  fetchNetworkData,
  toMarketSnapshot,
  trailingHashrateGrowthPercent,
} from '@/lib/networkData';

const NOW = new Date('2026-10-03T12:00:00Z');

function mockFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((k) => url.includes(k));
      if (!key || routes[key] === undefined) return new Response('nope', { status: 503 });
      return new Response(JSON.stringify(routes[key]), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const LIVE = {
  '/v1/prices': { USD: 84766 },
  '/v1/mining/hashrate/1m': { currentHashrate: 962.0e18, currentDifficulty: 132.7e12 },
  '/blocks/tip/height': 969770,
  '/v1/mining/reward-stats/144': { startBlock: 969627, endBlock: 969770, totalReward: '45385080294', totalFee: '385080294' },
};

describe('fetchNetworkData', () => {
  it('assembles a live snapshot: height-derived subsidy, fees per block, hashprice incl. fees', async () => {
    mockFetch(LIVE);
    const data = await fetchNetworkData(NOW);
    expect(data.isLive).toBe(true);
    expect(data.btcPriceUsd).toBe(84766);
    expect(data.networkHashrateEh).toBeCloseTo(962, 6);
    expect(data.blockHeight).toBe(969770);
    expect(data.blockReward).toBe(3.125);
    expect(data.avgFeesPerBlockBtc).toBeCloseTo(385080294 / 144 / 1e8, 12);
    expect(data.hashpriceUsdPhDay).toBeCloseTo((144 * (3.125 + data.avgFeesPerBlockBtc) * 84766) / 962000, 9);
    expect(data.difficulty).toBe(132.7e12);
    expect(data.nextHalving.height).toBe(1_050_000);
    expect(data.asOf).toBe(NOW.toISOString());
    expect(data.sources.every((s) => !s.includes('offline'))).toBe(true);
  });

  it('falls back to CoinGecko for the price when mempool prices fail', async () => {
    mockFetch({ ...LIVE, '/v1/prices': undefined, 'coingecko.com': { bitcoin: { usd: 84000 } } });
    const data = await fetchNetworkData(NOW);
    expect(data.btcPriceUsd).toBe(84000);
    expect(data.sources).toContain('price: CoinGecko');
    expect(data.isLive).toBe(true);
  });

  it('labels a fully offline result as an offline estimate built from FALLBACK_MARKET', async () => {
    mockFetch({});
    const data = await fetchNetworkData(NOW);
    expect(data.isLive).toBe(false);
    expect(toMarketSnapshot(data)).toEqual({ ...FALLBACK_MARKET, asOf: NOW.toISOString(), sources: data.sources });
    expect(data.sources.every((s) => s.includes('offline estimate'))).toBe(true);
  });

  it('a live price with a failed tip height is not "live"', async () => {
    mockFetch({ ...LIVE, '/blocks/tip/height': undefined });
    const data = await fetchNetworkData(NOW);
    expect(data.isLive).toBe(false);
    expect(data.blockHeight).toBe(FALLBACK_MARKET.blockHeight);
  });
});

describe('trailing 12-month hashrate growth', () => {
  const DAY = 86400;
  const series = (from: number, to: number) =>
    Array.from({ length: 365 }, (_, i) => ({ timestamp: 1_759_536_000 + i * DAY, avgHashrate: (from + ((to - from) * i) / 364) * 1e18 }));

  it('annualizes the change between 7-day means a year apart', () => {
    const growth = trailingHashrateGrowthPercent(series(800, 1000))!;
    expect(growth).toBeGreaterThan(20);
    expect(growth).toBeLessThan(27);
  });

  it('can be negative, and returns null for too-short series', () => {
    expect(trailingHashrateGrowthPercent(series(1000, 980))!).toBeLessThan(0);
    expect(trailingHashrateGrowthPercent(series(800, 1000).slice(0, 10))).toBeNull();
  });

  it('the forecast default clamps it to 0–60 % (10 % when unavailable)', () => {
    expect(defaultNetworkGrowthPercent(-1.3)).toBe(0);
    expect(defaultNetworkGrowthPercent(24.4)).toBe(24);
    expect(defaultNetworkGrowthPercent(140)).toBe(60);
    expect(defaultNetworkGrowthPercent(null)).toBe(10);
  });

  it('is part of the live snapshot', async () => {
    mockFetch({ ...LIVE, '/v1/mining/hashrate/1y': { hashrates: series(800, 1000) } });
    const data = await fetchNetworkData(NOW);
    expect(data.hashrateGrowth12mPercent).toBeGreaterThan(20);
  });
});
