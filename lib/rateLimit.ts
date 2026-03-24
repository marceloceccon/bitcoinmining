/**
 * Client-side rate limiter for save operations.
 *
 * Limits:
 *   - Max 1 save per 20 seconds
 *   - Max 5 saves per minute (60 seconds)
 *   - Max 20 saves per hour (3600 seconds)
 *
 * Tracks timestamps in memory — resets on page refresh.
 */

const LIMITS = [
  { max: 1, windowMs: 20_000 },   // 1 per 20s
  { max: 5, windowMs: 60_000 },   // 5 per minute
  { max: 20, windowMs: 3_600_000 }, // 20 per hour
] as const;

const timestamps: number[] = [];

/**
 * Check whether a save action is allowed right now.
 * Returns `{ allowed: true }` if under all limits,
 * or `{ allowed: false }` if any limit is exceeded.
 */
export function checkSaveRateLimit(): { allowed: boolean } {
  const now = Date.now();

  for (const { max, windowMs } of LIMITS) {
    const windowStart = now - windowMs;
    const count = timestamps.filter((t) => t > windowStart).length;
    if (count >= max) {
      return { allowed: false };
    }
  }

  return { allowed: true };
}

/**
 * Record a successful save. Call this AFTER the save succeeds.
 */
export function recordSave(): void {
  const now = Date.now();
  timestamps.push(now);

  // Prune entries older than 1 hour to prevent unbounded growth
  const oneHourAgo = now - 3_600_000;
  while (timestamps.length > 0 && timestamps[0] <= oneHourAgo) {
    timestamps.shift();
  }
}
