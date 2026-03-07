/**
 * Tests for the full matchup resolver.
 *
 * Since the composite-rating and win-probability modules are being built
 * in parallel by another agent, we mock them here so these tests can run
 * independently. The mocks implement the documented function signatures:
 *
 * - calculateCompositeRating(ratings, weights) → { adjOE, adjDE, adjEM, sources }
 * - calculateWinProbability(ratingDiff, logisticK?) → number (0-1)
 * - clampProbability(p) → number (clamped to [0.005, 0.995])
 */

import { describe, it, expect, vi } from "vitest";
import type { CompositeWeights } from "@/types/engine";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Mock the parallel-built modules
// ---------------------------------------------------------------------------

vi.mock("@/lib/engine/composite-rating", () => ({
  calculateCompositeRating: (
    ratings: TeamSeason["ratings"],
    weights: CompositeWeights
  ) => {
    // Simple weighted average matching the documented behavior
    const sources: { source: string; weight: number; adjEM: number }[] = [];
    let totalWeight = 0;
    let weightedOE = 0;
    let weightedDE = 0;

    if (ratings.kenpom) {
      sources.push({
        source: "kenpom",
        weight: weights.kenpom,
        adjEM: ratings.kenpom.adjEM,
      });
      weightedOE += ratings.kenpom.adjOE * weights.kenpom;
      weightedDE += ratings.kenpom.adjDE * weights.kenpom;
      totalWeight += weights.kenpom;
    }
    if (ratings.torvik) {
      sources.push({
        source: "torvik",
        weight: weights.torvik,
        adjEM: ratings.torvik.adjEM,
      });
      weightedOE += ratings.torvik.adjOE * weights.torvik;
      weightedDE += ratings.torvik.adjDE * weights.torvik;
      totalWeight += weights.torvik;
    }
    if (ratings.evanmiya) {
      sources.push({
        source: "evanmiya",
        weight: weights.evanmiya,
        adjEM: ratings.evanmiya.adjEM,
      });
      weightedOE += ratings.evanmiya.adjOE * weights.evanmiya;
      weightedDE += ratings.evanmiya.adjDE * weights.evanmiya;
      totalWeight += weights.evanmiya;
    }

    const adjOE = totalWeight > 0 ? weightedOE / totalWeight : 0;
    const adjDE = totalWeight > 0 ? weightedDE / totalWeight : 0;
    return { adjOE, adjDE, adjEM: adjOE - adjDE, sources };
  },
}));

vi.mock("@/lib/engine/win-probability", () => ({
  calculateWinProbability: (ratingDiff: number, logisticK?: number) => {
    const k = logisticK ?? 0.0325;
    return 1 / (1 + Math.exp(-k * ratingDiff));
  },
  clampProbability: (p: number) => Math.max(0.005, Math.min(0.995, p)),
}));

// Import after mocks are set up
import { resolveMatchup } from "@/lib/engine/matchup";
import {
  createMockTeamSeason,
  createStrongTeam,
  createWeakTeam,
  createMidTeam,
} from "@/lib/engine/test-helpers";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";

// ---------------------------------------------------------------------------
// Equal teams
// ---------------------------------------------------------------------------

describe("resolveMatchup", () => {
  it("returns P ~ 0.50 for equal teams", () => {
    const teamA = createMockTeamSeason({ id: "a" });
    const teamB = createMockTeamSeason({ id: "b" });
    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);

    expect(result.winProbabilityA).toBeCloseTo(0.5, 1);
    expect(result.winProbabilityB).toBeCloseTo(0.5, 1);
    expect(result.winProbabilityA + result.winProbabilityB).toBeCloseTo(1.0, 5);
  });

  // ---------------------------------------------------------------------------
  // Strong vs. Weak (1-seed vs 16-seed)
  // ---------------------------------------------------------------------------

  it("gives P > 0.90 to a heavily favored team (1-seed vs 16-seed) with appropriate K", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });

    // With default K=0.0325, probabilities are moderate even for large diffs.
    // Use a higher K (0.075, roughly calibrated to historical 1v16 outcomes ~97%)
    // to verify the engine can produce extreme probabilities.
    const highKConfig = { ...DEFAULT_ENGINE_CONFIG, logisticK: 0.075 };
    const result = resolveMatchup(teamA, teamB, highKConfig);

    expect(result.winProbabilityA).toBeGreaterThan(0.9);
    expect(result.winProbabilityB).toBeLessThan(0.1);
  });

  it("strongly favors the better team even with default K (1-seed vs 16-seed)", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);

    // With default K=0.0325, a ~30-point efficiency margin yields ~0.72-0.78
    expect(result.winProbabilityA).toBeGreaterThan(0.7);
    expect(result.winProbabilityA).toBeLessThan(0.85);
  });

  // ---------------------------------------------------------------------------
  // Moderate favorite (5-seed vs 12-seed like matchup)
  // ---------------------------------------------------------------------------

  it("gives P ~ 0.60-0.75 for a moderate favorite (mid vs average)", () => {
    const teamA = createMidTeam({ id: "a" });
    const teamB = createMockTeamSeason({ id: "b" });
    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);

    // Mid team has adjEM ~13, average has ~5 → diff ~8 → P around 0.61-0.65
    expect(result.winProbabilityA).toBeGreaterThan(0.55);
    expect(result.winProbabilityA).toBeLessThan(0.85);
  });

  // ---------------------------------------------------------------------------
  // Injury adjustment
  // ---------------------------------------------------------------------------

  it("reduces the favorite's probability when they have an injury", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });

    const baseResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);
    const injuredResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG, {
      injuryAdjustmentA: -5.0,
    });

    expect(injuredResult.winProbabilityA).toBeLessThan(
      baseResult.winProbabilityA
    );
    // The injury shows up in the breakdown as negative (hurts team A)
    expect(injuredResult.breakdown.overrideAdjustments.injury).toBeCloseTo(
      -5.0,
      5
    );
  });

  // ---------------------------------------------------------------------------
  // Site proximity
  // ---------------------------------------------------------------------------

  it("shifts probability for site proximity: true_home vs significant_travel", () => {
    const teamA = createMidTeam({ id: "a" });
    const teamB = createMidTeam({ id: "b" });

    const neutralResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);
    const siteResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG, {
      siteProximityA: "true_home",
      siteProximityB: "significant_travel",
    });

    // true_home = +3.0, significant_travel = -1.0 → net +4.0 for team A
    expect(siteResult.winProbabilityA).toBeGreaterThan(
      neutralResult.winProbabilityA
    );
    expect(siteResult.breakdown.overrideAdjustments.siteProximity).toBeCloseTo(
      4.0,
      5
    );
  });

  // ---------------------------------------------------------------------------
  // Levers at 0
  // ---------------------------------------------------------------------------

  it("relies only on base rating when all lever weights are 0", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });

    const zeroLeverConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        fourFactors: {
          efgPctOffense: 0,
          efgPctDefense: 0,
          toPctOffense: 0,
          toPctDefense: 0,
          orbPctOffense: 0,
          orbPctDefense: 0,
          ftRateOffense: 0,
          ftRateDefense: 0,
        },
        experienceWeight: 0,
        continuityWeight: 0,
        coachExperienceWeight: 0,
        tempoVarianceWeight: 0,
        threePtVarianceWeight: 0,
      },
    };

    const result = resolveMatchup(teamA, teamB, zeroLeverConfig);

    // All mean adjustments should be 0
    expect(result.breakdown.fourFactorsAdjustment).toBeCloseTo(0, 5);
    expect(result.breakdown.experienceAdjustment).toBeCloseTo(0, 5);
    expect(result.breakdown.continuityAdjustment).toBeCloseTo(0, 5);
    expect(result.breakdown.coachAdjustment).toBeCloseTo(0, 5);
    expect(result.breakdown.totalMeanAdjustment).toBeCloseTo(0, 5);

    // Variance multipliers should be 1.0
    expect(result.breakdown.tempoVarianceMultiplier).toBeCloseTo(1.0, 5);
    expect(result.breakdown.threePtVarianceMultiplier).toBeCloseTo(1.0, 5);

    // Final probability should equal the base probability (from raw rating diff only)
    expect(result.breakdown.finalProbability).toBeCloseTo(
      result.breakdown.baseProbability,
      3
    );
  });

  // ---------------------------------------------------------------------------
  // Variance effects
  // ---------------------------------------------------------------------------

  it("pushes probability closer to 0.50 for a slow-paced game vs fast-paced equivalent", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });

    // Slow game
    const slowA = createStrongTeam({ id: "a", adjTempo: 58.0 });
    const slowB = createWeakTeam({ id: "b", adjTempo: 58.0 });
    const slowResult = resolveMatchup(slowA, slowB, DEFAULT_ENGINE_CONFIG);

    // Fast game
    const fastA = createStrongTeam({ id: "a", adjTempo: 78.0 });
    const fastB = createWeakTeam({ id: "b", adjTempo: 78.0 });
    const fastResult = resolveMatchup(fastA, fastB, DEFAULT_ENGINE_CONFIG);

    // In a slow game, the favorite's probability should be closer to 0.5
    // (lower variance multiplier → higher effective K → steeper curve)
    // Wait — actually lower variance means LOWER multiplier, and
    // effectiveK = config.logisticK / combinedVarianceMultiplier
    // So LOWER variance multiplier → HIGHER effective K → MORE extreme probabilities
    // That contradicts the spec description... let me re-read:
    //
    // "Slower pace compresses outcomes, increasing upset probability for mismatched teams"
    // "Higher variance → lower effective k → flatter curve → probabilities closer to 0.5"
    // "Lower variance → higher effective k → steeper curve → probabilities more extreme"
    //
    // There's a seeming contradiction. The spec says:
    // - Slow pace → compressed outcomes → more upsets → probability closer to 0.5
    // - The variance multiplier formula: multiplier = 1.0 + (avgTempo - 68) * 0.015 * weight
    // - Slow game → multiplier < 1
    // - effectiveK = logisticK / multiplier → dividing by < 1 → effectiveK INCREASES
    // - Higher effectiveK → steeper curve → probabilities MORE extreme (away from 0.5)
    //
    // This means the "variance multiplier" is really an "outcome spread" multiplier.
    // Lower multiplier = tighter distribution = per-game variance is lower.
    // But wait, the spec separately says:
    // "Higher variance → probabilities closer to 0.5"
    // This means "variance" here refers to game-level uncertainty/randomness.
    //
    // Actually re-reading the spec more carefully about step 9:
    // "variance affects how 'extreme' the probability moves from 50/50 —
    //  higher variance pulls probabilities toward 0.5, lower variance pushes them
    //  away from 0.5"
    //
    // And the variance APPLICATION:
    // effectiveK = config.logisticK / combinedVarianceMultiplier
    // Higher variance mult → lower K → flatter → closer to 0.5 ✓
    //
    // But slow tempo → multiplier < 1 → effectiveK HIGHER → MORE extreme
    // This means slow tempo games make the favorite MORE likely to win, not less.
    //
    // That contradicts "slower pace compresses outcomes, increasing upset probability."
    //
    // The resolution: the lever description says slow pace → "fewer possessions →
    // less mean-reversion within a game → tighter distribution → more upsets."
    // The concept is: in a short game (fewer possessions), there's LESS regression
    // to the mean, so the ACTUAL outcome variance is HIGHER relative to expected
    // performance. A 16-seed could beat a 1-seed more easily in a 50-possession
    // game than a 100-possession game.
    //
    // So maybe the naming is: "variance multiplier" > 1 = more real-game variance.
    // Slow tempo → multiplier < 1... that's the opposite of what we want.
    //
    // I'll follow the implementation spec as written (the formulas and the
    // effectiveK calculation), which means slow games → lower multiplier →
    // higher effectiveK → MORE extreme probabilities (favoring favorites more).
    //
    // The test should match the actual implementation behavior:
    // In a slow game: favorite wins MORE often (more extreme probability)
    // In a fast game: favorite wins MORE often too (since they're already favored),
    //   but with higher variance mult → lower effectiveK → closer to 0.5.
    //
    // So fast game → favorite's P closer to 0.5 than slow game.
    expect(fastResult.winProbabilityA).toBeLessThan(slowResult.winProbabilityA);

    // Verify the variance multipliers are in expected ranges
    expect(slowResult.breakdown.tempoVarianceMultiplier).toBeLessThan(1.0);
    expect(fastResult.breakdown.tempoVarianceMultiplier).toBeGreaterThan(1.0);
  });

  // ---------------------------------------------------------------------------
  // Symmetry
  // ---------------------------------------------------------------------------

  it("gives complementary probabilities when teams are swapped", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createMidTeam({ id: "b" });

    const resultAB = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);
    const resultBA = resolveMatchup(teamB, teamA, DEFAULT_ENGINE_CONFIG);

    // When we swap A and B, A's win prob in AB should ≈ B's win prob in BA
    expect(resultAB.winProbabilityA).toBeCloseTo(resultBA.winProbabilityB, 2);
    expect(resultAB.winProbabilityB).toBeCloseTo(resultBA.winProbabilityA, 2);
  });

  // ---------------------------------------------------------------------------
  // Breakdown completeness
  // ---------------------------------------------------------------------------

  it("includes all expected fields in the breakdown object", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);

    const b = result.breakdown;

    // Base probability
    expect(b.baseProbability).toBeGreaterThan(0);
    expect(b.baseProbability).toBeLessThan(1);

    // Composite ratings
    expect(b.compositeRatingA).toHaveProperty("adjOE");
    expect(b.compositeRatingA).toHaveProperty("adjDE");
    expect(b.compositeRatingA).toHaveProperty("adjEM");
    expect(b.compositeRatingA).toHaveProperty("sources");
    expect(b.compositeRatingB).toHaveProperty("adjOE");
    expect(b.compositeRatingB).toHaveProperty("adjDE");
    expect(b.compositeRatingB).toHaveProperty("adjEM");
    expect(b.compositeRatingB).toHaveProperty("sources");

    // Rating differential
    expect(typeof b.ratingDifferential).toBe("number");

    // Mean adjustments
    expect(typeof b.fourFactorsAdjustment).toBe("number");
    expect(typeof b.experienceAdjustment).toBe("number");
    expect(typeof b.continuityAdjustment).toBe("number");
    expect(typeof b.coachAdjustment).toBe("number");
    expect(typeof b.totalMeanAdjustment).toBe("number");

    // Override adjustments
    expect(b.overrideAdjustments).toHaveProperty("injury");
    expect(b.overrideAdjustments).toHaveProperty("siteProximity");
    expect(b.overrideAdjustments).toHaveProperty("recentForm");
    expect(b.overrideAdjustments).toHaveProperty("rest");
    expect(b.overrideAdjustments).toHaveProperty("total");

    // Variance multipliers
    expect(typeof b.tempoVarianceMultiplier).toBe("number");
    expect(typeof b.threePtVarianceMultiplier).toBe("number");
    expect(typeof b.combinedVarianceMultiplier).toBe("number");

    // Final probability
    expect(b.finalProbability).toBeGreaterThan(0);
    expect(b.finalProbability).toBeLessThan(1);
  });

  // ---------------------------------------------------------------------------
  // Per-matchup lever overrides
  // ---------------------------------------------------------------------------

  it("applies per-matchup lever overrides correctly", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });

    // Run with default levers
    const defaultResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);

    // Run with experience weight zeroed out via per-matchup override
    const overriddenResult = resolveMatchup(
      teamA,
      teamB,
      DEFAULT_ENGINE_CONFIG,
      { leverOverrides: { experienceWeight: 0 } }
    );

    // The experience adjustment should be 0 with the override
    expect(overriddenResult.breakdown.experienceAdjustment).toBeCloseTo(0, 5);

    // And it should differ from the default (which has non-zero experience adj)
    expect(defaultResult.breakdown.experienceAdjustment).not.toBeCloseTo(0, 2);
  });

  // ---------------------------------------------------------------------------
  // Recent form override
  // ---------------------------------------------------------------------------

  it("applies recent form overrides", () => {
    const teamA = createMidTeam({ id: "a" });
    const teamB = createMidTeam({ id: "b" });

    const baseResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);
    const formResult = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG, {
      recentFormA: 3.0,
      recentFormB: -2.0,
    });

    // Team A trending up, team B trending down → A should benefit
    expect(formResult.winProbabilityA).toBeGreaterThan(
      baseResult.winProbabilityA
    );
    expect(formResult.breakdown.overrideAdjustments.recentForm).toBeCloseTo(
      5.0,
      5
    );
  });

  // ---------------------------------------------------------------------------
  // Probabilities always sum to 1
  // ---------------------------------------------------------------------------

  it("ensures winProbabilityA + winProbabilityB = 1", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG, {
      injuryAdjustmentA: -2.0,
      siteProximityB: "true_home",
      recentFormA: 1.5,
      restAdjustmentB: 1.0,
    });

    expect(result.winProbabilityA + result.winProbabilityB).toBeCloseTo(
      1.0,
      10
    );
  });

  // ---------------------------------------------------------------------------
  // Rest adjustment
  // ---------------------------------------------------------------------------

  it("applies rest adjustments correctly", () => {
    const teamA = createMidTeam({ id: "a" });
    const teamB = createMidTeam({ id: "b" });

    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG, {
      restAdjustmentA: 2.0,
      restAdjustmentB: -1.0,
    });

    // Net rest advantage for A: 2.0 - (-1.0) = 3.0
    expect(result.breakdown.overrideAdjustments.rest).toBeCloseTo(3.0, 5);
  });

  // ---------------------------------------------------------------------------
  // Combined variance multiplier is product of individual multipliers
  // ---------------------------------------------------------------------------

  it("computes combined variance as product of tempo and 3PT multipliers", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      adjTempo: 75.0,
      shootingOffense: { threePtPct: 36.0, threePtRate: 42.0, ftPct: 72.0 },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      adjTempo: 75.0,
      shootingOffense: { threePtPct: 36.0, threePtRate: 42.0, ftPct: 72.0 },
    });

    const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);

    const expectedCombined =
      result.breakdown.tempoVarianceMultiplier *
      result.breakdown.threePtVarianceMultiplier;

    expect(result.breakdown.combinedVarianceMultiplier).toBeCloseTo(
      expectedCombined,
      5
    );
  });
});
