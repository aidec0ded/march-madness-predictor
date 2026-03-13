interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  function check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + config.windowMs;
      store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: config.maxRequests - 1, resetAt };
    }

    if (entry.count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  function cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }

  // Auto-cleanup every 60 seconds to prevent unbounded memory growth.
  // unref() allows Node.js to exit even with the interval running.
  const cleanupInterval = setInterval(cleanup, 60_000);
  if (
    typeof cleanupInterval === "object" &&
    "unref" in cleanupInterval
  ) {
    cleanupInterval.unref();
  }

  return { check, cleanup, _store: store };
}

/**
 * Extract the real client IP from request headers.
 *
 * Checks infrastructure-set headers first (not user-spoofable), then
 * falls back to x-forwarded-for using the rightmost IP (the one added
 * by the first trusted reverse proxy, harder to spoof than leftmost).
 *
 * Header priority:
 * 1. x-real-ip        — set by nginx/Railway/Render infrastructure
 * 2. cf-connecting-ip  — set by Cloudflare
 * 3. x-forwarded-for   — rightmost entry (closest to server)
 * 4. "unknown"
 */
export function getClientIp(request: Request): string {
  // Prefer infrastructure-set headers (not user-spoofable)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Fallback: x-forwarded-for — use rightmost entry.
  // The rightmost IP is appended by our trusted reverse proxy, not the client.
  // The leftmost IP is user-supplied and trivially spoofable.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  return "unknown";
}
