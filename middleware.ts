import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public-API rate limiter.
 *
 * Lives at the edge layer: every request to /api/* hits this before any route handler.
 * **Every** request is rate-limited per IP, in one of two tiers:
 *   - first-party (this app's own UI, which fires debounced bursts): 600 requests/minute
 *   - external (other websites, AI agents, MCP clients, curl, scripts): 60 requests/minute
 *
 * First-party is detected from `Sec-Fetch-Site: same-origin` (browsers send it on every
 * fetch, including same-origin GETs that omit `Origin`) or an `Origin` matching `Host`.
 * Both headers can be forged by non-browser clients; that only buys them the higher
 * bucket, never an unlimited one.
 *
 * The limiter is **best-effort and per-instance**: each warm serverless instance keeps its
 * own in-memory buckets. For globally enforced quotas, plug in Upstash, Vercel KV, or Redis.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per window per IP, external callers
const MAX_FIRST_PARTY_REQUESTS = 600; // per window per IP, this app's own UI
const CLEANUP_SAMPLE_RATE = 0.01; // ~1% of requests trigger a sweep
const MAX_TRACKED_IPS = 10_000; // hard cap to bound memory under attack

// In-memory rate limiter.
// Map of bucket key (`fp:<ip>` or `ext:<ip>`) -> request timestamps within the current window.
const rateLimitMap = new Map<string, number[]>();

/**
 * Resolve the *trusted* client IP from request headers.
 *
 * Why this is delicate: `x-forwarded-for` is a comma-separated chain `client, proxy1, proxy2`.
 * The **first** entry is whatever the client claimed — easily spoofed. The **last** entry is
 * appended by your most-recent trusted proxy. We prefer `x-real-ip` (set by a single trusted
 * proxy) and fall back to the last `x-forwarded-for` hop. Never trust the first hop.
 */
function resolveClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return 'unknown';
}

/**
 * Returns true when the Origin header names this host. A missing Origin is *not*
 * same-origin: curl, scripts and MCP clients send none.
 *
 * Tolerant of malformed Origin: a bad URL is treated as cross-origin, never crashes.
 */
function isSameOriginRequest(origin: string | null, host: string): boolean {
  if (!origin) return false;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost === host;
}

/** True when the request comes from this app's own UI (see the tiers above). */
function isFirstPartyRequest(request: NextRequest): boolean {
  if (request.headers.get('sec-fetch-site') === 'same-origin') return true;
  return isSameOriginRequest(request.headers.get('origin'), request.headers.get('host') ?? '');
}

function pruneStaleEntries(now: number): void {
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) {
      rateLimitMap.delete(ip);
    } else if (fresh.length !== timestamps.length) {
      rateLimitMap.set(ip, fresh);
    }
  }
}

/**
 * Best-effort eviction when the map exceeds its cap. Picks an arbitrary entry
 * (insertion order — Map iterates in insertion order) and drops it. This is not
 * strict LRU; it just guarantees we cannot grow unboundedly under a rotating-IP
 * attack between sweeps.
 */
function evictOldestUntilUnderCap(): void {
  while (rateLimitMap.size > MAX_TRACKED_IPS) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitMap.delete(oldestKey);
  }
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const firstParty = isFirstPartyRequest(request);
  const limit = firstParty ? MAX_FIRST_PARTY_REQUESTS : MAX_REQUESTS;
  // Separate buckets so a visitor using the UI doesn't eat into their own API quota.
  const key = `${firstParty ? 'fp' : 'ext'}:${resolveClientIp(request)}`;
  const now = Date.now();

  if (Math.random() < CLEANUP_SAMPLE_RATE) {
    pruneStaleEntries(now);
  }

  const timestamps = rateLimitMap.get(key) ?? [];
  const recentTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recentTimestamps.length >= limit) {
    const oldestInWindow = recentTimestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000));

    return new NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSec),
          'Access-Control-Allow-Origin': origin ?? '*',
        },
      }
    );
  }

  recentTimestamps.push(now);
  rateLimitMap.set(key, recentTimestamps);
  evictOldestUntilUnderCap();

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

// ── Test-only exports ────────────────────────────────────────────────
// These are exported so the unit suite can drive deterministic state in
// the limiter and exercise edge cases (origin parsing, IP resolution,
// eviction). Routes never import these.
export const __test__ = {
  resolveClientIp,
  isSameOriginRequest,
  isFirstPartyRequest,
  pruneStaleEntries,
  evictOldestUntilUnderCap,
  rateLimitMap,
  WINDOW_MS,
  MAX_REQUESTS,
  MAX_FIRST_PARTY_REQUESTS,
  MAX_TRACKED_IPS,
  CLEANUP_SAMPLE_RATE,
};
