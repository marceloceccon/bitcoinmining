/**
 * Live Bitcoin market state from public APIs (mempool.space, CoinGecko as a
 * price backup), with one clearly-labelled offline fallback.
 */
import type { MarketSnapshot } from '@/types';
import type { MarketOverride } from '@/lib/validateFarmConfig';
import { hashpriceUsdPerPhDay, nextHalving, subsidyAtHeight } from '@/lib/bitcoin';
import { serverCache, CACHE_KEYS, CACHE_TTL } from '@/lib/serverCache';

/** What /api/network serves: the market snapshot plus derived display values. */
export interface NetworkData extends MarketSnapshot {
  difficulty: number;
  /** $/PH/day including transaction fees */
  hashpriceUsdPhDay: number;
  /** Same instant as `asOf`; kept for API backward compatibility */
  lastUpdated: Date;
  nextHalving: { height: number; estimatedDate: string };
}

/**
 * The **only** hardcoded market values in the app. Used when the live sources
 * are unreachable, and always shown in the UI as an "offline estimate".
 * Snapshot of 2026-10-03 (mempool.space).
 */
export const FALLBACK_MARKET: MarketSnapshot = {
  btcPriceUsd: 84714,
  networkHashrateEh: 964,
  blockHeight: 969763,
  blockReward: subsidyAtHeight(969763),
  avgFeesPerBlockBtc: 0.027,
  asOf: '2026-10-03T00:00:00.000Z',
  isLive: false,
  sources: ['offline estimate (2026-10-03 snapshot)'],
};

const MEMPOOL = 'https://mempool.space/api';
const FETCH_TIMEOUT_MS = 5000;

/** Strip a NetworkData (or anything wider) down to the engine's MarketSnapshot. */
export function toMarketSnapshot(data: MarketSnapshot): MarketSnapshot {
  const { btcPriceUsd, networkHashrateEh, blockHeight, blockReward, avgFeesPerBlockBtc, asOf, isLive, sources } = data;
  return { btcPriceUsd, networkHashrateEh, blockHeight, blockReward, avgFeesPerBlockBtc, asOf, isLive, sources };
}

/** Network difficulty implied by a hashrate: H/s × 600 s / 2^32. */
function impliedDifficulty(networkHashrateEh: number): number {
  return (networkHashrateEh * 1e18 * 600) / 2 ** 32;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Display values derived from a snapshot (hashprice incl. fees, next halving, difficulty). */
export function withDerived(market: MarketSnapshot, difficulty?: number): NetworkData {
  const asOf = new Date(market.asOf);
  return {
    ...market,
    difficulty: difficulty ?? impliedDifficulty(market.networkHashrateEh),
    hashpriceUsdPhDay: hashpriceUsdPerPhDay(market),
    lastUpdated: asOf,
    nextHalving: nextHalving(market.blockHeight, asOf),
  };
}

/**
 * Fetch live market state. Each value falls back independently; `isLive` is
 * true only when price, hashrate and tip height all came from a live source.
 */
export async function fetchNetworkData(now: Date = new Date()): Promise<NetworkData> {
  const [prices, hashrate, tipHeight, rewards] = await Promise.all([
    getJson<{ USD?: number }>(`${MEMPOOL}/v1/prices`),
    getJson<{ currentHashrate?: number; currentDifficulty?: number }>(`${MEMPOOL}/v1/mining/hashrate/1m`),
    getJson<number>(`${MEMPOOL}/blocks/tip/height`),
    getJson<{ startBlock?: number; endBlock?: number; totalFee?: string | number }>(
      `${MEMPOOL}/v1/mining/reward-stats/144`,
    ),
  ]);

  const sources: string[] = [];
  const fallbackNote = 'offline estimate';

  let btcPriceUsd = prices?.USD && prices.USD > 0 ? prices.USD : 0;
  if (btcPriceUsd > 0) {
    sources.push('price: mempool.space');
  } else {
    const cg = await getJson<{ bitcoin?: { usd?: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    );
    btcPriceUsd = cg?.bitcoin?.usd && cg.bitcoin.usd > 0 ? cg.bitcoin.usd : 0;
    sources.push(btcPriceUsd > 0 ? 'price: CoinGecko' : `price: ${fallbackNote}`);
  }
  const priceLive = btcPriceUsd > 0;
  if (!priceLive) btcPriceUsd = FALLBACK_MARKET.btcPriceUsd;

  const hashrateLive = !!hashrate?.currentHashrate && hashrate.currentHashrate > 0;
  const networkHashrateEh = hashrateLive ? hashrate!.currentHashrate! / 1e18 : FALLBACK_MARKET.networkHashrateEh;
  sources.push(hashrateLive ? 'hashrate: mempool.space' : `hashrate: ${fallbackNote}`);

  const heightLive = typeof tipHeight === 'number' && Number.isFinite(tipHeight) && tipHeight > 0;
  const blockHeight = heightLive ? tipHeight : FALLBACK_MARKET.blockHeight;
  sources.push(heightLive ? 'tip height: mempool.space' : `tip height: ${fallbackNote}`);

  const blockCount = rewards?.startBlock != null && rewards.endBlock != null ? rewards.endBlock - rewards.startBlock + 1 : 0;
  const totalFeeSats = Number(rewards?.totalFee);
  const feesLive = blockCount > 0 && Number.isFinite(totalFeeSats) && totalFeeSats >= 0;
  const avgFeesPerBlockBtc = feesLive ? totalFeeSats / blockCount / 1e8 : FALLBACK_MARKET.avgFeesPerBlockBtc;
  sources.push(feesLive ? `fees: mempool.space (avg of last ${blockCount} blocks)` : `fees: ${fallbackNote}`);

  const difficulty =
    hashrate?.currentDifficulty && hashrate.currentDifficulty > 0 ? hashrate.currentDifficulty : undefined;

  return withDerived(
    {
      btcPriceUsd,
      networkHashrateEh,
      blockHeight,
      blockReward: subsidyAtHeight(blockHeight),
      avgFeesPerBlockBtc,
      asOf: now.toISOString(),
      isLive: priceLive && hashrateLive && heightLive,
      sources,
    },
    difficulty,
  );
}

/** Server-side: the live snapshot, cached for 60 s and de-duplicated across concurrent requests. */
export function getCachedNetworkData(): Promise<NetworkData> {
  return serverCache.getOrLoad(CACHE_KEYS.networkData, CACHE_TTL.network, () => fetchNetworkData());
}

/**
 * Server-side: the snapshot a calculation should use. Values the caller pinned
 * in `override` win; everything else comes from the cached live snapshot. When
 * the caller pins all four inputs, no network request is made.
 */
export async function resolveMarket(override: MarketOverride = {}, now: Date = new Date()): Promise<MarketSnapshot> {
  const pinned = Object.keys(override) as (keyof MarketOverride)[];
  const complete =
    override.btcPriceUsd !== undefined &&
    override.networkHashrateEh !== undefined &&
    override.blockHeight !== undefined &&
    override.avgFeesPerBlockBtc !== undefined;
  const base: MarketSnapshot = complete
    ? { ...FALLBACK_MARKET, asOf: now.toISOString(), sources: [] }
    : toMarketSnapshot(await getCachedNetworkData());
  if (pinned.length === 0) return base;

  const blockHeight = override.blockHeight ?? base.blockHeight;
  return {
    ...base,
    ...override,
    blockHeight,
    blockReward: subsidyAtHeight(blockHeight),
    isLive: false,
    sources: [
      ...base.sources.filter((src) => !pinned.some((key) => src.startsWith(SOURCE_LABEL[key]))),
      ...pinned.map((key) => `${SOURCE_LABEL[key]}: request override`),
    ],
  };
}

const SOURCE_LABEL: Record<keyof MarketOverride, string> = {
  btcPriceUsd: 'price',
  networkHashrateEh: 'hashrate',
  blockHeight: 'tip height',
  avgFeesPerBlockBtc: 'fees',
};
