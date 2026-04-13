import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, __test__ } from '@/middleware';

const {
  resolveClientIp,
  isSameOriginRequest,
  pruneStaleEntries,
  evictOldestUntilUnderCap,
  rateLimitMap,
  WINDOW_MS,
  MAX_REQUESTS,
  MAX_TRACKED_IPS,
} = __test__;

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new Request('https://api.example.com/api/calculate'), {
    headers: new Headers(headers),
  });
}

beforeEach(() => {
  rateLimitMap.clear();
});

// ════════════════════════════════════════════════════════════════════════
// isSameOriginRequest — origin header parsing
// ════════════════════════════════════════════════════════════════════════

describe('isSameOriginRequest', () => {
  it('treats a missing Origin header as same-origin (server-to-server / curl)', () => {
    expect(isSameOriginRequest(null, 'api.example.com')).toBe(true);
  });

  it('treats an empty Origin header as same-origin', () => {
    expect(isSameOriginRequest('', 'api.example.com')).toBe(true);
  });

  it('treats matching origin host as same-origin', () => {
    expect(
      isSameOriginRequest('https://api.example.com', 'api.example.com'),
    ).toBe(true);
  });

  it('treats different origin host as cross-origin', () => {
    expect(
      isSameOriginRequest('https://attacker.com', 'api.example.com'),
    ).toBe(false);
  });

  it('does not crash on malformed Origin and treats it as cross-origin (regression: critical)', () => {
    expect(() => isSameOriginRequest('not-a-url', 'api.example.com')).not.toThrow();
    expect(isSameOriginRequest('not-a-url', 'api.example.com')).toBe(false);
  });

  it('does not crash on Origin with embedded null bytes', () => {
    expect(() =>
      isSameOriginRequest('http://\0evil', 'api.example.com'),
    ).not.toThrow();
  });

  it('treats Origin with non-matching port as cross-origin', () => {
    expect(
      isSameOriginRequest('https://api.example.com:8443', 'api.example.com'),
    ).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// resolveClientIp — never trusts the first x-forwarded-for hop
// ════════════════════════════════════════════════════════════════════════

describe('resolveClientIp', () => {
  it('prefers x-real-ip when present', () => {
    const request = makeRequest({
      'x-real-ip': '203.0.113.10',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });
    expect(resolveClientIp(request)).toBe('203.0.113.10');
  });

  it('falls back to the LAST entry of x-forwarded-for (the trusted hop)', () => {
    const request = makeRequest({
      'x-forwarded-for': '198.51.100.1, 198.51.100.2, 203.0.113.10',
    });
    // Critical: the last hop is appended by our trusted proxy.
    // The first hop is the client-claimed value and must NEVER be used,
    // otherwise an attacker can rotate fake x-forwarded-for values to
    // bypass the rate limiter.
    expect(resolveClientIp(request)).toBe('203.0.113.10');
  });

  it('handles single-entry x-forwarded-for', () => {
    const request = makeRequest({ 'x-forwarded-for': '203.0.113.10' });
    expect(resolveClientIp(request)).toBe('203.0.113.10');
  });

  it('trims whitespace around hops', () => {
    const request = makeRequest({ 'x-forwarded-for': '   1.2.3.4  ,   5.6.7.8   ' });
    expect(resolveClientIp(request)).toBe('5.6.7.8');
  });

  it('returns "unknown" when neither header is present', () => {
    const request = makeRequest();
    expect(resolveClientIp(request)).toBe('unknown');
  });

  it('ignores empty hops in the chain', () => {
    const request = makeRequest({ 'x-forwarded-for': ',,,, 1.2.3.4' });
    expect(resolveClientIp(request)).toBe('1.2.3.4');
  });
});

// ════════════════════════════════════════════════════════════════════════
// middleware end-to-end — rate limit enforcement
// ════════════════════════════════════════════════════════════════════════

describe('middleware rate limiting', () => {
  function externalRequest(ip: string): NextRequest {
    return makeRequest({
      origin: 'https://attacker.com',
      host: 'api.example.com',
      'x-real-ip': ip,
    });
  }

  it('allows the first request from a new external IP', () => {
    const response = middleware(externalRequest('1.1.1.1'));
    expect(response.status).toBe(200);
  });

  it('passes through internal (same-origin) requests without counting', () => {
    const request = makeRequest({
      origin: 'https://api.example.com',
      host: 'api.example.com',
      'x-real-ip': '1.1.1.1',
    });
    for (let i = 0; i < MAX_REQUESTS + 50; i++) {
      const response = middleware(request);
      expect(response.status).toBe(200);
    }
    // Same-origin must never appear in the bucket.
    expect(rateLimitMap.has('1.1.1.1')).toBe(false);
  });

  it('returns 429 with Retry-After after MAX_REQUESTS calls in the window', () => {
    const ip = '2.2.2.2';
    let lastResponse;
    for (let i = 0; i < MAX_REQUESTS; i++) {
      lastResponse = middleware(externalRequest(ip));
      expect(lastResponse.status).toBe(200);
    }
    const blocked = middleware(externalRequest(ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    const retry = Number(blocked.headers.get('Retry-After'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(60);
  });

  it('reflects the request Origin in 429 CORS header', () => {
    const ip = '3.3.3.3';
    for (let i = 0; i < MAX_REQUESTS; i++) middleware(externalRequest(ip));
    const blocked = middleware(externalRequest(ip));
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://attacker.com',
    );
  });

  it('isolates buckets per IP — bursts on IP A do not affect IP B', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) middleware(externalRequest('4.4.4.4'));
    const blockedA = middleware(externalRequest('4.4.4.4'));
    expect(blockedA.status).toBe(429);

    const allowedB = middleware(externalRequest('5.5.5.5'));
    expect(allowedB.status).toBe(200);
  });

  it('a malformed Origin header does not throw and is treated as cross-origin', () => {
    const request = makeRequest({
      origin: 'not-a-valid-url',
      host: 'api.example.com',
      'x-real-ip': '6.6.6.6',
    });
    expect(() => middleware(request)).not.toThrow();
    const response = middleware(request);
    expect([200, 429]).toContain(response.status);
    // Verify it landed in the rate-limit bucket (i.e. was treated as external).
    expect(rateLimitMap.has('6.6.6.6')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// pruneStaleEntries — sweeps timestamps outside the window
// ════════════════════════════════════════════════════════════════════════

describe('pruneStaleEntries', () => {
  it('removes entries whose timestamps are all outside the current window', () => {
    const now = Date.now();
    rateLimitMap.set('stale', [now - WINDOW_MS - 5_000, now - WINDOW_MS - 1_000]);
    rateLimitMap.set('fresh', [now - 1_000, now]);
    pruneStaleEntries(now);
    expect(rateLimitMap.has('stale')).toBe(false);
    expect(rateLimitMap.has('fresh')).toBe(true);
  });

  it('trims partially-stale buckets, keeping fresh timestamps', () => {
    const now = Date.now();
    rateLimitMap.set('mixed', [
      now - WINDOW_MS - 5_000, // stale
      now - WINDOW_MS - 1_000, // stale
      now - 30_000, // fresh
      now - 1_000, // fresh
    ]);
    pruneStaleEntries(now);
    expect(rateLimitMap.get('mixed')).toEqual([now - 30_000, now - 1_000]);
  });

  it('is a no-op when all buckets are fresh', () => {
    const now = Date.now();
    rateLimitMap.set('a', [now - 5_000]);
    rateLimitMap.set('b', [now - 10_000]);
    pruneStaleEntries(now);
    expect(rateLimitMap.size).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// evictOldestUntilUnderCap — bounded memory under attack
// ════════════════════════════════════════════════════════════════════════

describe('evictOldestUntilUnderCap', () => {
  it('does nothing when below the cap', () => {
    rateLimitMap.set('a', [Date.now()]);
    evictOldestUntilUnderCap();
    expect(rateLimitMap.has('a')).toBe(true);
  });

  it('evicts entries in insertion order until the cap is met', () => {
    // Seed past the cap deterministically with a small fake cap by direct map manipulation.
    // We can't change MAX_TRACKED_IPS at runtime, so seed cap+10 entries and verify it
    // evicts down to exactly the cap.
    const now = Date.now();
    for (let i = 0; i < MAX_TRACKED_IPS + 10; i++) {
      rateLimitMap.set(`ip-${i}`, [now]);
    }
    expect(rateLimitMap.size).toBe(MAX_TRACKED_IPS + 10);

    evictOldestUntilUnderCap();

    expect(rateLimitMap.size).toBe(MAX_TRACKED_IPS);
    // The first 10 entries (oldest by insertion order) should be gone.
    for (let i = 0; i < 10; i++) {
      expect(rateLimitMap.has(`ip-${i}`)).toBe(false);
    }
    // The newest survived.
    expect(rateLimitMap.has(`ip-${MAX_TRACKED_IPS + 9}`)).toBe(true);
  });
});
