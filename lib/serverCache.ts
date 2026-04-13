/**
 * Minimal in-memory TTL cache for API route responses.
 *
 * Scope: one instance per server (serverless instances each get their own).
 * For globally coherent caching plug in Redis / Upstash / Vercel KV.
 *
 * Design:
 * - Lazy loader pattern: `cache.getOrLoad(key, ttlMs, loader)` runs the loader
 *   only if the cached entry is missing or expired.
 * - In-flight de-duplication: concurrent calls for the same key share the same
 *   pending promise, so a cold cache never thunders N parallel loaders.
 * - Async-aware: failed loads do NOT poison the cache — the pending promise is
 *   cleared on rejection so the next caller retries.
 */

type CachedEntry<T> = {
  value: T;
  expiresAt: number;
};

type PendingEntry<T> = {
  promise: Promise<T>;
};

export class ServerCache {
  private store = new Map<string, CachedEntry<unknown>>();
  private pending = new Map<string, PendingEntry<unknown>>();

  /** Read a fresh entry, or return null if missing or expired. */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CachedEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Write a value with an explicit TTL. */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Return the cached value for `key`; on miss, call `loader()`, cache its
   * result with `ttlMs`, and return it. Concurrent misses share one loader
   * call. A rejected loader is NOT cached and will be retried next time.
   */
  async getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const pending = this.pending.get(key) as PendingEntry<T> | undefined;
    if (pending) return pending.promise;

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, { promise });
    return promise;
  }

  /** Remove a single entry (used by tests and manual invalidation). */
  delete(key: string): void {
    this.store.delete(key);
    this.pending.delete(key);
  }

  /** Clear everything (used by tests). */
  clear(): void {
    this.store.clear();
    this.pending.clear();
  }

  /** Count of non-expired entries. For observability / tests. */
  size(): number {
    return this.store.size;
  }
}

// Shared singleton. Each server instance owns exactly one.
export const serverCache = new ServerCache();

// Canonical cache keys + TTLs. Centralised here so the values are easy
// to audit and adjust, and impossible to typo at the call sites.
export const CACHE_KEYS = {
  miners: 'catalog:miners',
  dryCoolers: 'catalog:dry-coolers',
  airFans: 'catalog:air-fans',
  updates: 'catalog:updates',
  networkData: 'network:data',
} as const;

export const CACHE_TTL = {
  /** 10 minutes for hardware catalogs — they are regenerated at build time. */
  catalog: 10 * 60 * 1000,
  /** 1 minute for live Bitcoin network data — matches upstream refresh cadence. */
  network: 60 * 1000,
} as const;
