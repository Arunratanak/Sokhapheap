/**
 * Simple in-memory fixed-window rate limiter, per key (e.g. IP).
 * Fine for a single Render instance; resets when the service restarts or sleeps.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterS: 0 };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, retryAfterS: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  return { ok: true, remaining: limit - b.count, retryAfterS: 0 };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}
