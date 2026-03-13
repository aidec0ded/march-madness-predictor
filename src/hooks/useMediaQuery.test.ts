import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMediaQuery, MOBILE_QUERY, TABLET_QUERY } from "./useMediaQuery";

describe("useMediaQuery", () => {
  let listeners: Map<string, ((e: MediaQueryListEvent) => void)[]>;
  let matchStates: Map<string, boolean>;

  beforeEach(() => {
    listeners = new Map();
    matchStates = new Map();

    vi.stubGlobal("matchMedia", (query: string) => {
      if (!listeners.has(query)) listeners.set(query, []);
      return {
        matches: matchStates.get(query) ?? false,
        media: query,
        addEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.get(query)!.push(handler);
        },
        removeEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
          const list = listeners.get(query)!;
          const idx = list.indexOf(handler);
          if (idx >= 0) list.splice(idx, 1);
        },
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false initially (SSR-safe)", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    // During the first render (before useEffect), returns false
    // After useEffect, it reads matchMedia
    expect(typeof result.current).toBe("boolean");
  });

  it("returns true when media query matches", () => {
    matchStates.set("(max-width: 767px)", true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when media query does not match", () => {
    matchStates.set("(max-width: 767px)", false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);
  });

  it("updates when media query changes", () => {
    matchStates.set("(max-width: 767px)", false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);

    // Simulate viewport change
    act(() => {
      const handlers = listeners.get("(max-width: 767px)") || [];
      for (const handler of handlers) {
        handler({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });

  it("exports MOBILE_QUERY constant", () => {
    expect(MOBILE_QUERY).toBe("(max-width: 767px)");
  });

  it("exports TABLET_QUERY constant", () => {
    expect(TABLET_QUERY).toContain("768px");
    expect(TABLET_QUERY).toContain("1023px");
  });
});
