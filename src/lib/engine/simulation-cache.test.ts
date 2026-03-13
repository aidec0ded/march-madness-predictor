/**
 * Tests for the matchup probability cache.
 */

import { describe, it, expect } from "vitest";
import { createMatchupCache } from "@/lib/engine/simulation-cache";

describe("MatchupCache", () => {
  it("returns undefined for uncached entries", () => {
    const cache = createMatchupCache();

    expect(cache.get("teamA", "teamB")).toBeUndefined();
  });

  it("stores and retrieves a cached probability", () => {
    const cache = createMatchupCache();

    cache.set("duke", "unc", 0.65);

    expect(cache.get("duke", "unc")).toBe(0.65);
  });

  it("treats key order as significant (A vs B ≠ B vs A)", () => {
    const cache = createMatchupCache();

    cache.set("duke", "unc", 0.65);
    cache.set("unc", "duke", 0.35);

    expect(cache.get("duke", "unc")).toBe(0.65);
    expect(cache.get("unc", "duke")).toBe(0.35);
  });

  it("reports correct size after insertions", () => {
    const cache = createMatchupCache();

    expect(cache.size()).toBe(0);

    cache.set("duke", "unc", 0.65);
    expect(cache.size()).toBe(1);

    cache.set("kansas", "kentucky", 0.55);
    expect(cache.size()).toBe(2);
  });

  it("overwrites existing entries", () => {
    const cache = createMatchupCache();

    cache.set("duke", "unc", 0.65);
    cache.set("duke", "unc", 0.70);

    expect(cache.get("duke", "unc")).toBe(0.70);
    expect(cache.size()).toBe(1);
  });

  it("handles many entries efficiently", () => {
    const cache = createMatchupCache();

    // Simulate 64 teams × 63 opponents = up to 4,032 ordered pairs
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 64; j++) {
        if (i !== j) {
          cache.set(`team-${i}`, `team-${j}`, (i + j) / 128);
        }
      }
    }

    expect(cache.size()).toBe(64 * 63);

    // Verify a specific entry
    expect(cache.get("team-0", "team-1")).toBeCloseTo(1 / 128, 10);
    expect(cache.get("team-63", "team-62")).toBeCloseTo(125 / 128, 10);
  });
});
