// Lightweight in-memory rate limiter for device + admin endpoints.
//
// NOTE: this is a per-process guard, not a distributed one. On a single Next
// server it is adequate for abuse-of-the-demo; production deployments in
// front of multiple instances should back this with Redis or a WAF. It is a
// defence-in-depth control, not the primary authentication boundary.

import { env } from "./env";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  now: number = Date.now(),
  limit: number = env.RATE_LIMIT_MAX,
  windowMs: number = env.RATE_LIMIT_WINDOW_MS
): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/** Extract a client IP from request headers (best-effort, proxy-aware). */
export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export function _resetBuckets(): void {
  buckets.clear();
}
