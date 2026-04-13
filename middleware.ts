import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public-API rate limiter and same-origin pass-through.
 *
 * Lives at the edge layer: every request to /api/* hits this before any route handler.
 * Internal callers (browser opening this app's own UI) skip rate limiting entirely;
 * external callers (other websites, AI agents, scripts) get 60 requests/minute per IP.
 *
 * The limiter is **per-instance**: serverless deployments will get one bucket per warm
 * instance. For globally enforced quotas, plug in Upstash, Vercel KV, or Redis.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per window per IP
const CLEANUP_SAMPLE_RATE = 0.01; // ~1% of requests trigger a sweep
const MAX_TRACKED_IPS = 10_000; // hard cap to bound memory under attack

// In-memory rate limiter for external requests.
// Map of IP -> array of request timestamps within the current window.
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
 * Returns true when the request originates from the app's own UI (same-origin)
 * or has no Origin header at all (e.g. a curl from a script — we don't rate-limit
 * server-to-server, that's only for header-bearing browser callers).
 *
 * Tolerant of malformed Origin: a bad URL is treated as cross-origin, never crashes.
 */
function isSameOriginRequest(origin: string | null, host: string): boolean {
  if (!origin) return true;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost === host;
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
  const host = request.headers.get('host') ?? '';

  if (isSameOriginRequest(origin, host)) {
    return NextResponse.next();
  }

  const ip = resolveClientIp(request);
  const now = Date.now();

  if (Math.random() < CLEANUP_SAMPLE_RATE) {
    pruneStaleEntries(now);
  }

  const timestamps = rateLimitMap.get(ip) ?? [];
  const recentTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recentTimestamps.length >= MAX_REQUESTS) {
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
  rateLimitMap.set(ip, recentTimestamps);
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
  pruneStaleEntries,
  evictOldestUntilUnderCap,
  rateLimitMap,
  WINDOW_MS,
  MAX_REQUESTS,
  MAX_TRACKED_IPS,
  CLEANUP_SAMPLE_RATE,
};
