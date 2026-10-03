import { afterEach, beforeEach, vi } from 'vitest';

// Unit tests never touch the network. Code that fetches market data falls back
// to the dated offline snapshot; tests that need specific responses stub fetch
// themselves (their hooks run after this one).
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      throw new Error(`unit tests must not hit the network (${String(url)})`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
