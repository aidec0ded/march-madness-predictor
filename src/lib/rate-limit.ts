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

// ---------------------------------------------------------------------------
// Private / reserved IP detection (RFC 1918, RFC 4193, loopback)
// ---------------------------------------------------------------------------

const PRIVATE_IP_PREFIXES = [
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
  "127.",
  "::1",
  "fc",
  "fd",
];

function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  return PRIVATE_IP_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Extract the real client IP from request headers.
 *
 * Checks infrastructure-set headers first (not user-spoofable), then
 * falls back to x-forwarded-for using the rightmost **public** IP
 * (the one added by the first trusted reverse proxy, harder to spoof
 * than leftmost). Private/reserved IPs in the chain are skipped.
 *
 * Header priority:
 * 1. x-real-ip        — set by nginx/Railway/Render infrastructure
 * 2. cf-connecting-ip  — set by Cloudflare
 * 3. x-forwarded-for   — rightmost public IP (closest to server)
 * 4. "unknown"
 */
export function getClientIp(request: Request): string {
  // Prefer infrastructure-set headers (not user-spoofable)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Fallback: x-forwarded-for — walk from rightmost to leftmost,
  // return the first public (non-private) IP. This skips internal
  // proxy IPs and finds the one appended by our trusted edge proxy.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!isPrivateIp(ips[i])) {
        return ips[i];
      }
    }
    // All IPs are private — use rightmost as best effort
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  return "unknown";
}
