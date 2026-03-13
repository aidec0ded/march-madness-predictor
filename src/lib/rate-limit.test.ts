import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter, getClientIp } from "./rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 10_000 });
    const result = limiter.check("user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests over the limit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 10_000 });
    limiter.check("user1");
    limiter.check("user1");
    const result = limiter.check("user1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count", () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });
    expect(limiter.check("user1").remaining).toBe(4);
    expect(limiter.check("user1").remaining).toBe(3);
    expect(limiter.check("user1").remaining).toBe(2);
    expect(limiter.check("user1").remaining).toBe(1);
    expect(limiter.check("user1").remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 5_000 });
    limiter.check("user1");
    const blocked = limiter.check("user1");
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(5_000);

    const afterReset = limiter.check("user1");
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("cleanup removes expired entries", () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 5_000 });
    limiter.check("user1");
    limiter.check("user2");

    vi.advanceTimersByTime(5_000);

    limiter.cleanup();
    expect(limiter._store.size).toBe(0);
  });
});

describe("getClientIp", () => {
  it("prefers x-real-ip header (infrastructure-set)", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-real-ip": "203.0.113.50",
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: {
        "cf-connecting-ip": "198.51.100.10",
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      },
    });
    expect(getClientIp(request)).toBe("198.51.100.10");
  });

  it("extracts rightmost IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
    });
    // Rightmost IP is added by the trusted proxy, harder to spoof
    expect(getClientIp(request)).toBe("10.0.0.1");
  });

  it("handles single IP in x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    expect(getClientIp(request)).toBe("192.168.1.1");
  });

  it('returns "unknown" when no header is present', () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("unknown");
  });
});
