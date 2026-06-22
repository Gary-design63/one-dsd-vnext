// =====================================================================
// One DSD vNext — in-process rate limiter (defense-in-depth).
// A fixed-window counter keyed by client + route. This is a SECOND line of
// defense; the FIRST should be an edge rule (Azure Front Door / WAF) that
// throttles before traffic reaches the app. In-memory + per-instance by
// design: simple, dependency-free, and safe (fails open only to the edge).
// =====================================================================
interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

export interface RateResult { ok: boolean; retryAfterSec: number; remaining: number; }

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - b.count };
}

/** Test/maintenance helper. */
export function _resetRateLimits(): void { buckets.clear(); }

// Tunable policy per protected route (generous; the edge is the real cap).
export const LIMITS = {
  signIn: { limit: 10, windowMs: 5 * 60_000 },   // 10 attempts / 5 min / IP
  ask: { limit: 30, windowMs: 60_000 },          // 30 questions / min / IP
} as const;
