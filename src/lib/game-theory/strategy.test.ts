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
  getMatchupEdgeAnalysis,
  POOL_STRATEGY_CONFIGS,
  ROUND_THRESHOLD_MULTIPLIER,
  PROBABILITY_FLOOR,
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

// ---------------------------------------------------------------------------
// Round Threshold Multiplier & Probability Floor
// ---------------------------------------------------------------------------

describe("ROUND_THRESHOLD_MULTIPLIER", () => {
  it("increases monotonically from FF to NCG", () => {
    const rounds = ["FF", "R64", "R32", "S16", "E8", "F4", "NCG"] as const;
    for (let i = 1; i < rounds.length; i++) {
      expect(ROUND_THRESHOLD_MULTIPLIER[rounds[i]]).toBeGreaterThan(
        ROUND_THRESHOLD_MULTIPLIER[rounds[i - 1]]
      );
    }
  });

  it("uses S16 as the baseline (1.0)", () => {
    expect(ROUND_THRESHOLD_MULTIPLIER.S16).toBe(1.0);
  });
});

describe("PROBABILITY_FLOOR", () => {
  it("decreases from small to very_large pools", () => {
    expect(PROBABILITY_FLOOR.small).toBeGreaterThan(PROBABILITY_FLOOR.medium);
    expect(PROBABILITY_FLOOR.medium).toBeGreaterThan(PROBABILITY_FLOOR.large);
    expect(PROBABILITY_FLOOR.large).toBeGreaterThan(
      PROBABILITY_FLOOR.very_large
    );
  });
});

// ---------------------------------------------------------------------------
// Matchup Edge Analysis
// ---------------------------------------------------------------------------

describe("getMatchupEdgeAnalysis", () => {
  it("surfaces actionable edge for a clear undervalued underdog in a large pool", () => {
    // Team A: favourite with 60% prob, 70% ownership → leverage = 0.857
    // Team B: underdog with 40% prob, 30% ownership → leverage = 1.333
    // Large pool threshold = 1.3, S16 multiplier = 1.0 → effective = 1.3
    // Team B leverage 1.333 > 1.3 and prob 0.40 > floor 0.30
    const result = getMatchupEdgeAnalysis(
      0.6,
      70,
      30,
      "S16",
      POOL_STRATEGY_CONFIGS.large
    );

    expect(result.leverageTeamId).toBe("B");
    expect(result.isActionable).toBe(true);
    expect(result.edgeLabel).toBe("Strategic Edge");
    expect(result.edgeDescription).not.toBeNull();
  });

  it("is almost never actionable in a small pool", () => {
    // Small pool contrarianThreshold is 999 → effective threshold is huge
    // Even a massively undervalued underdog won't trigger
    const result = getMatchupEdgeAnalysis(
      0.6,
      70,
      10,
      "NCG",
      POOL_STRATEGY_CONFIGS.small
    );

    expect(result.isActionable).toBe(false);
  });

  it("returns no edge when the favourite is also the higher-leverage team", () => {
    // Team A: favourite with 70% prob, 50% ownership → leverage = 1.4
    // Team B: underdog with 30% prob, 50% ownership → leverage = 0.6
    // Favourite has higher leverage — no contrarian edge
    const result = getMatchupEdgeAnalysis(
      0.7,
      50,
      50,
      "S16",
      POOL_STRATEGY_CONFIGS.large
    );

    expect(result.leverageTeamId).toBeNull();
    expect(result.isActionable).toBe(false);
    expect(result.edgeLabel).toBeNull();
  });

  it("lowers threshold for later rounds (R64 vs E8 vs NCG)", () => {
    // Same matchup tested across rounds
    // Team A: 55% prob, 65% ownership → leverage = 0.846
    // Team B: 45% prob, 35% ownership → leverage = 1.286
    // Large pool base threshold = 1.3
    //   R64: effective = 1.3 / 0.6  = 2.167 → NOT actionable (1.286 < 2.167)
    //   E8:  effective = 1.3 / 1.25 = 1.04  → actionable (1.286 > 1.04)
    //   NCG: effective = 1.3 / 2.0  = 0.65  → actionable (1.286 > 0.65)
    const config = POOL_STRATEGY_CONFIGS.large;

    const r64 = getMatchupEdgeAnalysis(0.55, 65, 35, "R64", config);
    expect(r64.isActionable).toBe(false);
    expect(r64.effectiveThreshold).toBeCloseTo(1.3 / 0.6, 2);

    const e8 = getMatchupEdgeAnalysis(0.55, 65, 35, "E8", config);
    expect(e8.isActionable).toBe(true);
    expect(e8.effectiveThreshold).toBeCloseTo(1.3 / 1.25, 2);

    const ncg = getMatchupEdgeAnalysis(0.55, 65, 35, "NCG", config);
    expect(ncg.isActionable).toBe(true);
    expect(ncg.effectiveThreshold).toBeCloseTo(1.3 / 2.0, 2);
  });

  it("is not actionable when underdog probability is below the floor", () => {
    // Team A: 80% prob, 85% ownership → leverage = 0.941
    // Team B: 20% prob, 15% ownership → leverage = 1.333
    // Large pool floor = 0.30, underdog prob = 0.20 < 0.30 → NOT actionable
    const result = getMatchupEdgeAnalysis(
      0.8,
      85,
      15,
      "S16",
      POOL_STRATEGY_CONFIGS.large
    );

    expect(result.leverageTeamId).toBe("B");
    expect(result.isActionable).toBe(false);
    expect(result.edgeLabel).toBeNull();
  });

  it("shows no contrarian edge with equal ownership", () => {
    // Team A: 60% prob, 50% ownership → leverage = 1.2
    // Team B: 40% prob, 50% ownership → leverage = 0.8
    // Favourite has higher leverage → no edge
    const result = getMatchupEdgeAnalysis(
      0.6,
      50,
      50,
      "S16",
      POOL_STRATEGY_CONFIGS.large
    );

    expect(result.leverageTeamId).toBeNull();
    expect(result.isActionable).toBe(false);
    expect(result.leverageA).toBeCloseTo(1.2, 5);
    expect(result.leverageB).toBeCloseTo(0.8, 5);
  });

  it("returns 'Strong Edge' when leverage is very high", () => {
    // Team A: 55% prob, 80% ownership → leverage = 0.6875
    // Team B: 45% prob, 20% ownership → leverage = 2.25
    // NCG effective threshold = 1.3 / 2.0 = 0.65
    // Strong threshold = 0.65 * 1.5 = 0.975; leverage 2.25 > 0.975 → Strong Edge
    const result = getMatchupEdgeAnalysis(
      0.55,
      80,
      20,
      "NCG",
      POOL_STRATEGY_CONFIGS.large
    );

    expect(result.isActionable).toBe(true);
    expect(result.edgeLabel).toBe("Strong Edge");
    expect(result.leverageTeamId).toBe("B");
  });

  it("calculates correct effective thresholds across pool sizes and rounds", () => {
    // Verify the threshold math for a few combos
    const medS16 = getMatchupEdgeAnalysis(0.5, 50, 50, "S16", POOL_STRATEGY_CONFIGS.medium);
    expect(medS16.effectiveThreshold).toBeCloseTo(1.5 / 1.0, 5);

    const veryLargeNCG = getMatchupEdgeAnalysis(0.5, 50, 50, "NCG", POOL_STRATEGY_CONFIGS.very_large);
    expect(veryLargeNCG.effectiveThreshold).toBeCloseTo(1.2 / 2.0, 5);

    const largeR32 = getMatchupEdgeAnalysis(0.5, 50, 50, "R32", POOL_STRATEGY_CONFIGS.large);
    expect(largeR32.effectiveThreshold).toBeCloseTo(1.3 / 0.75, 5);
  });
});
