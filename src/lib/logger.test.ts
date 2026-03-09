import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("info produces correct JSON structure", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test message");

    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("info");
    expect(output.message).toBe("test message");
    expect(output.timestamp).toBeDefined();
    expect(() => new Date(output.timestamp).toISOString()).not.toThrow();
  });

  it("error serializes error object with stack and digest", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("something broke") as Error & { digest?: string };
    err.digest = "abc123";

    logger.error("request failed", err);

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("error");
    expect(output.message).toBe("request failed");
    expect(output.error.message).toBe("something broke");
    expect(output.error.stack).toBeDefined();
    expect(output.error.digest).toBe("abc123");
  });

  it("debug is suppressed when NODE_ENV is not development", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

    logger.debug("should not appear");

    expect(spy).not.toHaveBeenCalled();
  });

  it("warn uses console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("warning message");

    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("warn");
    expect(output.message).toBe("warning message");
  });

  it("context is included in output", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("with context", { userId: "42", action: "login" });

    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.context).toEqual({ userId: "42", action: "login" });
  });
});
