/**
 * Tests for the strategy engine.
 *
 * Verifies leverage score calculations and pool-size-aware
 * recommendation logic across all four pool tiers.
 */

import { describe, it, expect } from "vitest";
import {
  calculateLeverageScore,
  getStrategyRecommendation,
  buildStrategyRecommendation,
  POOL_STRATEGY_CONFIGS,
} from "./strategy";

// ---------------------------------------------------------------------------
// Leverage Score
// ---------------------------------------------------------------------------

describe("calculateLeverageScore", () => {
  it("returns 1.0 when probability equals ownership", () => {
    // 50% win prob, 50% ownership → leverage = 1.0
    expect(calculateLeverageScore(0.5, 50)).toBeCloseTo(1.0, 5);
  });

  it("returns >1.0 for under-owned teams", () => {
    // 60% win prob, 30% ownership → leverage = 2.0
    expect(calculateLeverageScore(0.6, 30)).toBeCloseTo(2.0, 5);
  });

  it("returns <1.0 for over-owned teams", () => {
    // 30% win prob, 60% ownership → leverage = 0.5
    expect(calculateLeverageScore(0.3, 60)).toBeCloseTo(0.5, 5);
  });

  it("handles zero ownership gracefully", () => {
    // Should return max leverage (10) for non-zero probability
    expect(calculateLeverageScore(0.5, 0)).toBe(10);
    // Should return 0 for zero probability
    expect(calculateLeverageScore(0, 0)).toBe(0);
  });

  it("produces correct values for specific cases", () => {
    // 1-seed: 97% win prob, 98% ownership → leverage ~0.99
    expect(calculateLeverageScore(0.97, 98)).toBeCloseTo(0.9898, 2);

    // 12-seed upset: 35% win prob, 35% ownership → leverage = 1.0
    expect(calculateLeverageScore(0.35, 35)).toBeCloseTo(1.0, 5);

    // 12-seed with low ownership: 35% win prob, 20% ownership → leverage = 1.75
    expect(calculateLeverageScore(0.35, 20)).toBeCloseTo(1.75, 5);
  });
});

// ---------------------------------------------------------------------------
// Strategy Recommendations - Small Pool
// ---------------------------------------------------------------------------

describe("getStrategyRecommendation - small pool", () => {
  const config = POOL_STRATEGY_CONFIGS.small;

  it("always returns max_probability regardless of ownership", () => {
    const high = getStrategyRecommendation(0.95, 98, config);
    expect(high.type).toBe("max_probability");

    const low = getStrategyRecommendation(0.2, 80, config);
    expect(low.type).toBe("max_probability");

    const underOwned = getStrategyRecommendation(0.5, 10, config);
    expect(underOwned.type).toBe("max_probability");
  });

  it("still calculates leverage score correctly", () => {
    const result = getStrategyRecommendation(0.5, 25, config);
    expect(result.leverageScore).toBeCloseTo(2.0, 5);
  });
});

// ---------------------------------------------------------------------------
// Strategy Recommendations - Medium Pool
// ---------------------------------------------------------------------------

describe("getStrategyRecommendation - medium pool", () => {
  const config = POOL_STRATEGY_CONFIGS.medium;

  it("returns contrarian_value for high-leverage teams", () => {
    // 40% win prob, 20% ownership → leverage = 2.0, above 1.5 threshold
    const result = getStrategyRecommendation(0.4, 20, config);
    expect(result.type).toBe("contrarian_value");
  });

  it("returns avoid for low-leverage teams", () => {
    // 10% win prob, 50% ownership → leverage = 0.2, below 0.5 threshold
    const result = getStrategyRecommendation(0.1, 50, config);
    expect(result.type).toBe("avoid");
  });

  it("returns neutral for fair-value teams", () => {
    // 50% win prob, 50% ownership → leverage = 1.0
    const result = getStrategyRecommendation(0.5, 50, config);
    expect(result.type).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// Strategy Recommendations - Large Pool
// ---------------------------------------------------------------------------

describe("getStrategyRecommendation - large pool", () => {
  const config = POOL_STRATEGY_CONFIGS.large;

  it("returns contrarian_value for under-owned teams", () => {
    // 40% win prob, 25% ownership → leverage = 1.6, above 1.3 threshold
    const result = getStrategyRecommendation(0.4, 25, config);
    expect(result.type).toBe("contrarian_value");
  });

  it("returns avoid for heavily over-owned teams", () => {
    // 20% win prob, 50% ownership → leverage = 0.4, below 0.6 threshold
    const result = getStrategyRecommendation(0.2, 50, config);
    expect(result.type).toBe("avoid");
  });
});

// ---------------------------------------------------------------------------
// Strategy Recommendations - Very Large Pool
// ---------------------------------------------------------------------------

describe("getStrategyRecommendation - very large pool", () => {
  const config = POOL_STRATEGY_CONFIGS.very_large;

  it("has the most aggressive contrarian threshold", () => {
    // 30% win prob, 22% ownership → leverage ≈ 1.36, above 1.2 threshold
    const result = getStrategyRecommendation(0.3, 22, config);
    expect(result.type).toBe("contrarian_value");
  });

  it("flags more teams as avoid due to higher avoidThreshold", () => {
    // 25% win prob, 40% ownership → leverage = 0.625, below 0.7 threshold
    const result = getStrategyRecommendation(0.25, 40, config);
    expect(result.type).toBe("avoid");
  });
});

// ---------------------------------------------------------------------------
// buildStrategyRecommendation
// ---------------------------------------------------------------------------

describe("buildStrategyRecommendation", () => {
  it("builds a complete StrategyRecommendation object", () => {
    const config = POOL_STRATEGY_CONFIGS.large;
    const rec = buildStrategyRecommendation(
      "team-1",
      "R64-East-1",
      "R64",
      0.97,
      98,
      config
    );

    expect(rec.teamId).toBe("team-1");
    expect(rec.gameId).toBe("R64-East-1");
    expect(rec.round).toBe("R64");
    expect(rec.leverageScore).toBeCloseTo(0.9898, 2);
    expect(typeof rec.reason).toBe("string");
    expect(rec.reason.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Pool config structure validation
// ---------------------------------------------------------------------------

describe("POOL_STRATEGY_CONFIGS", () => {
  it("has all four bucket configs", () => {
    expect(POOL_STRATEGY_CONFIGS.small).toBeDefined();
    expect(POOL_STRATEGY_CONFIGS.medium).toBeDefined();
    expect(POOL_STRATEGY_CONFIGS.large).toBeDefined();
    expect(POOL_STRATEGY_CONFIGS.very_large).toBeDefined();
  });

  it("has increasing ownership factors from small to very_large", () => {
    const { small, medium, large, very_large } = POOL_STRATEGY_CONFIGS;
    expect(small.ownershipFactor).toBeLessThan(medium.ownershipFactor);
    expect(medium.ownershipFactor).toBeLessThan(large.ownershipFactor);
    expect(large.ownershipFactor).toBeLessThan(very_large.ownershipFactor);
  });

  it("has decreasing contrarian thresholds from small to very_large", () => {
    const { small, medium, large, very_large } = POOL_STRATEGY_CONFIGS;
    expect(small.contrarianThreshold).toBeGreaterThan(
      medium.contrarianThreshold
    );
    expect(medium.contrarianThreshold).toBeGreaterThan(
      large.contrarianThreshold
    );
    expect(large.contrarianThreshold).toBeGreaterThan(
      very_large.contrarianThreshold
    );
  });
});
