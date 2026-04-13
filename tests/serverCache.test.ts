import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerCache, CACHE_TTL, CACHE_KEYS } from '@/lib/serverCache';

let cache: ServerCache;

beforeEach(() => {
  cache = new ServerCache();
});

describe('ServerCache.get / set', () => {
  it('returns null for a missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('returns the stored value before expiration', () => {
    cache.set('k', { v: 1 }, 10_000);
    expect(cache.get('k')).toEqual({ v: 1 });
  });

  it('returns null after expiration and evicts the entry', () => {
    vi.useFakeTimers();
    cache.set('k', 'fresh', 1_000);
    expect(cache.get('k')).toBe('fresh');

    vi.advanceTimersByTime(1_001);
    expect(cache.get('k')).toBeNull();
    expect(cache.size()).toBe(0);
    vi.useRealTimers();
  });

  it('size reports the current entry count', () => {
    cache.set('a', 1, 10_000);
    cache.set('b', 2, 10_000);
    expect(cache.size()).toBe(2);
    cache.delete('a');
    expect(cache.size()).toBe(1);
  });

  it('clear drops every entry', () => {
    cache.set('a', 1, 10_000);
    cache.set('b', 2, 10_000);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe('ServerCache.getOrLoad', () => {
  it('invokes the loader on a cache miss and returns its result', async () => {
    const loader = vi.fn().mockResolvedValue('loaded');
    const result = await cache.getOrLoad('k', 10_000, loader);
    expect(result).toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns the cached value on the second call without invoking the loader again', async () => {
    const loader = vi.fn().mockResolvedValue({ n: 1 });
    await cache.getOrLoad('k', 10_000, loader);
    const second = await cache.getOrLoad('k', 10_000, loader);
    expect(second).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('re-invokes the loader after TTL expiration', async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    const first = await cache.getOrLoad('k', 1_000, loader);
    expect(first).toBe('first');

    vi.advanceTimersByTime(1_001);

    const second = await cache.getOrLoad('k', 1_000, loader);
    expect(second).toBe('second');
    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('de-duplicates concurrent misses: N parallel callers share ONE loader invocation', async () => {
    let resolveLoad: ((value: string) => void) | null = null;
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    // Kick off five parallel getOrLoad calls for the same key.
    const promises = Array.from({ length: 5 }, () =>
      cache.getOrLoad('k', 10_000, loader),
    );

    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoad!('the-value');

    const results = await Promise.all(promises);
    expect(results).toEqual(['the-value', 'the-value', 'the-value', 'the-value', 'the-value']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache a rejected loader result — next call retries', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.getOrLoad('k', 10_000, loader)).rejects.toThrow('boom');
    // After rejection, the cache must be empty and the next call re-invokes the loader.
    expect(cache.size()).toBe(0);

    const second = await cache.getOrLoad('k', 10_000, loader);
    expect(second).toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('isolates distinct keys', async () => {
    const loaderA = vi.fn().mockResolvedValue('a');
    const loaderB = vi.fn().mockResolvedValue('b');
    expect(await cache.getOrLoad('A', 10_000, loaderA)).toBe('a');
    expect(await cache.getOrLoad('B', 10_000, loaderB)).toBe('b');
    expect(loaderA).toHaveBeenCalledTimes(1);
    expect(loaderB).toHaveBeenCalledTimes(1);
  });

  it('delete invalidates a cached entry so the next getOrLoad re-invokes the loader', async () => {
    const loader = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    expect(await cache.getOrLoad('k', 10_000, loader)).toBe('v1');
    cache.delete('k');
    expect(await cache.getOrLoad('k', 10_000, loader)).toBe('v2');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('CACHE constants', () => {
  it('catalog TTL is 10 minutes', () => {
    expect(CACHE_TTL.catalog).toBe(10 * 60 * 1000);
  });

  it('network TTL is 1 minute', () => {
    expect(CACHE_TTL.network).toBe(60 * 1000);
  });

  it('exposes distinct keys for each catalog', () => {
    const keys = Object.values(CACHE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
