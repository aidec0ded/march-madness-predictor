/**
 * Tests for the lever system — mean-adjusting and variance-adjusting levers.
 */

import { describe, it, expect } from "vitest";
import {
  calculateFourFactorsAdjustment,
  calculateExperienceAdjustment,
  calculateContinuityAdjustment,
  calculateCoachAdjustment,
  calculateOpponentAdjustment,
  calculateBenchDepthAdjustment,
  calculatePaceAdjustAdjustment,
  calculateSiteProximityAdjustment,
  calculateSosAdjustment,
  calculateLuckRegressionAdjustment,
  calculateTempoVarianceMultiplier,
  calculateThreePtVarianceMultiplier,
} from "@/lib/engine/levers";
import {
  createMockTeamSeason,
  createStrongTeam,
  createWeakTeam,
} from "@/lib/engine/test-helpers";
import { DEFAULT_FOUR_FACTORS_WEIGHTS } from "@/types/engine";

// ---------------------------------------------------------------------------
// Four Factors
// ---------------------------------------------------------------------------

describe("calculateFourFactorsAdjustment", () => {
  it("returns 0 for equal teams", () => {
    const teamA = createMockTeamSeason({ id: "a" });
    const teamB = createMockTeamSeason({ id: "b" });
    const result = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      DEFAULT_FOUR_FACTORS_WEIGHTS
    );
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns positive adjustment when team A has better offense", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      fourFactorsOffense: {
        efgPct: 56.0,
        toPct: 15.0,
        orbPct: 34.0,
        ftRate: 38.0,
      },
    });
    const teamB = createMockTeamSeason({ id: "b" });
    const result = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      DEFAULT_FOUR_FACTORS_WEIGHTS
    );
    expect(result).toBeGreaterThan(0);
  });

  it("returns negative adjustment when team B has better offense", () => {
    const teamA = createMockTeamSeason({ id: "a" });
    const teamB = createMockTeamSeason({
      id: "b",
      fourFactorsOffense: {
        efgPct: 56.0,
        toPct: 15.0,
        orbPct: 34.0,
        ftRate: 38.0,
      },
    });
    const result = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      DEFAULT_FOUR_FACTORS_WEIGHTS
    );
    expect(result).toBeLessThan(0);
  });

  it("returns 0 when team A defensive four factors are null", () => {
    const teamA = createMockTeamSeason({ id: "a", fourFactorsDefense: null });
    const teamB = createWeakTeam({ id: "b" });
    const result = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      DEFAULT_FOUR_FACTORS_WEIGHTS
    );
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns 0 when team B defensive four factors are null", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createMockTeamSeason({ id: "b", fourFactorsDefense: null });
    const result = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      DEFAULT_FOUR_FACTORS_WEIGHTS
    );
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns 0 when all weights are 0", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const zeroWeights = {
      efgPctOffense: 0,
      efgPctDefense: 0,
      toPctOffense: 0,
      toPctDefense: 0,
      orbPctOffense: 0,
      orbPctDefense: 0,
      ftRateOffense: 0,
      ftRateDefense: 0,
    };
    const result = calculateFourFactorsAdjustment(teamA, teamB, zeroWeights);
    expect(result).toBeCloseTo(0, 5);
  });

  it("doubles the adjustment when weights are 2", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });

    const defaultResult = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      DEFAULT_FOUR_FACTORS_WEIGHTS
    );

    const doubleWeights = {
      efgPctOffense: 2.0,
      efgPctDefense: 2.0,
      toPctOffense: 2.0,
      toPctDefense: 2.0,
      orbPctOffense: 2.0,
      orbPctDefense: 2.0,
      ftRateOffense: 2.0,
      ftRateDefense: 2.0,
    };
    const doubleResult = calculateFourFactorsAdjustment(
      teamA,
      teamB,
      doubleWeights
    );

    expect(doubleResult).toBeCloseTo(defaultResult * 2, 5);
  });

  it("correctly scales a 10-pct-point eFG% advantage to ~1.5 efficiency points", () => {
    // Create two teams that differ ONLY in offensive eFG% by 10 percentage points
    // Team A: eFG% offense = 55, Team B: eFG% offense = 45, everything else equal
    // With only eFG% offense weight = 1, all other weights = 0:
    // A's offense vs B's defense: (55 - 49.5) = 5.5
    // B's offense vs A's defense: (45 - 49.5) = -4.5
    // Net advantage = 5.5 - (-4.5) = 10.0 (but defense weight is 0 so only count offense)
    // With only offense weight:
    // efgAdvA = (55 - 49.5) * 1.0 = 5.5
    // efgAdvB = (45 - 49.5) * 0.0 = 0.0
    // total = (5.5 - 0.0) * 0.15 = 0.825
    //
    // Let's instead test with both offense and defense weights = 1 for the eFG factor:
    // A off eFG = 55, B off eFG = 45, both def eFG = 49.5
    // efgAdvA = (55 - 49.5) * 1 = 5.5
    // efgAdvB = (45 - 49.5) * 1 = -4.5
    // net = 5.5 - (-4.5) = 10.0
    // scaled = 10.0 * 0.15 = 1.5

    const teamA = createMockTeamSeason({
      id: "a",
      fourFactorsOffense: {
        efgPct: 55.0,
        toPct: 18.5,
        orbPct: 30.0,
        ftRate: 32.0,
      },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      fourFactorsOffense: {
        efgPct: 45.0,
        toPct: 18.5,
        orbPct: 30.0,
        ftRate: 32.0,
      },
    });

    const efgOnlyWeights = {
      efgPctOffense: 1.0,
      efgPctDefense: 1.0,
      toPctOffense: 0,
      toPctDefense: 0,
      orbPctOffense: 0,
      orbPctDefense: 0,
      ftRateOffense: 0,
      ftRateDefense: 0,
    };

    const result = calculateFourFactorsAdjustment(teamA, teamB, efgOnlyWeights);
    expect(result).toBeCloseTo(1.5, 1);
  });
});

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

describe("calculateExperienceAdjustment", () => {
  it("returns ~1.5 efficiency points for a 2-year experience difference at default weight", () => {
    const teamA = createMockTeamSeason({ id: "a", experience: 3.0 });
    const teamB = createMockTeamSeason({ id: "b", experience: 1.0 });
    const result = calculateExperienceAdjustment(teamA, teamB, 1.0);
    // 2.0 * 0.75 * 1.0 = 1.5
    expect(result).toBeCloseTo(1.5, 5);
  });

  it("returns 0 for equal experience", () => {
    const teamA = createMockTeamSeason({ id: "a", experience: 2.0 });
    const teamB = createMockTeamSeason({ id: "b", experience: 2.0 });
    const result = calculateExperienceAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", experience: 4.0 });
    const teamB = createMockTeamSeason({ id: "b", experience: 1.0 });
    const result = calculateExperienceAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns negative when team B is more experienced", () => {
    const teamA = createMockTeamSeason({ id: "a", experience: 1.0 });
    const teamB = createMockTeamSeason({ id: "b", experience: 3.0 });
    const result = calculateExperienceAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(-1.5, 5);
  });
});

// ---------------------------------------------------------------------------
// Continuity
// ---------------------------------------------------------------------------

describe("calculateContinuityAdjustment", () => {
  it("returns ~1.0 efficiency point for a 20 percentage point continuity difference", () => {
    const teamA = createMockTeamSeason({ id: "a", minutesContinuity: 70.0 });
    const teamB = createMockTeamSeason({ id: "b", minutesContinuity: 50.0 });
    const result = calculateContinuityAdjustment(teamA, teamB, 1.0);
    // 20 * 0.05 * 1.0 = 1.0
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for equal continuity", () => {
    const teamA = createMockTeamSeason({ id: "a", minutesContinuity: 55.0 });
    const teamB = createMockTeamSeason({ id: "b", minutesContinuity: 55.0 });
    const result = calculateContinuityAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", minutesContinuity: 80.0 });
    const teamB = createMockTeamSeason({ id: "b", minutesContinuity: 40.0 });
    const result = calculateContinuityAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// Coach Adjustment
// ---------------------------------------------------------------------------

describe("calculateCoachAdjustment", () => {
  it("returns positive for a coach with strong tournament record", () => {
    const teamA = createStrongTeam({ id: "a" });
    // Strong coach: 40/60 wins = 0.667 win rate, 5 Final Fours
    const teamB = createWeakTeam({ id: "b" });
    // Weak coach: 3 games < 5 minimum → defaults to 0.5 win rate, 0 Final Fours
    const result = calculateCoachAdjustment(teamA, teamB, 1.0);
    expect(result).toBeGreaterThan(0);
  });

  it("defaults to 0.5 win rate when coach has fewer than 5 games", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      coach: {
        name: "New Coach",
        tournamentGames: 3,
        tournamentWins: 3,
        finalFours: 0,
        championships: 0,
        yearsHeadCoach: 2,
      },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      coach: {
        name: "Other New Coach",
        tournamentGames: 3,
        tournamentWins: 0,
        finalFours: 0,
        championships: 0,
        yearsHeadCoach: 2,
      },
    });
    // Both should default to 0.5 win rate since < 5 games
    // Both have 0 Final Fours, so scores are equal
    const result = calculateCoachAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const result = calculateCoachAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("caps Final Four bonus at 1.0 efficiency points", () => {
    // A coach with 15 Final Fours should still only get 1.0 bonus (capped)
    const teamA = createMockTeamSeason({
      id: "a",
      coach: {
        name: "Legend Coach",
        tournamentGames: 100,
        tournamentWins: 70,
        finalFours: 15,
        championships: 5,
        yearsHeadCoach: 30,
      },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      coach: {
        name: "Zero Coach",
        tournamentGames: 100,
        tournamentWins: 70,
        finalFours: 0,
        championships: 0,
        yearsHeadCoach: 30,
      },
    });
    // Same win rates (70/100 = 0.7) so win rate component cancels out
    // Difference should be capped at 1.0 (15*0.1=1.5 capped to 1.0, minus 0)
    const result = calculateCoachAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// Opponent Adjustment
// ---------------------------------------------------------------------------

describe("calculateOpponentAdjustment", () => {
  it("returns 0 for equal opponent adjust values", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaOpponentAdjust: 10 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaOpponentAdjust: 10 });
    const result = calculateOpponentAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns positive when team A plays up better", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaOpponentAdjust: 30 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaOpponentAdjust: -10 });
    const result = calculateOpponentAdjustment(teamA, teamB, 1.0);
    // (30 - (-10)) * 0.02 * 1.0 = 40 * 0.02 = 0.8
    expect(result).toBeCloseTo(0.8, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaOpponentAdjust: 50 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaOpponentAdjust: -20 });
    const result = calculateOpponentAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("scales correctly: 60-point diff → 1.2 eff pts at default weight", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaOpponentAdjust: 30 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaOpponentAdjust: -30 });
    const result = calculateOpponentAdjustment(teamA, teamB, 1.0);
    // 60 * 0.02 * 1.0 = 1.2
    expect(result).toBeCloseTo(1.2, 5);
  });
});

// ---------------------------------------------------------------------------
// Bench Depth
// ---------------------------------------------------------------------------

describe("calculateBenchDepthAdjustment", () => {
  it("returns 0 for equal bench minutes", () => {
    const teamA = createMockTeamSeason({ id: "a", benchMinutesPct: 30 });
    const teamB = createMockTeamSeason({ id: "b", benchMinutesPct: 30 });
    const result = calculateBenchDepthAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns positive when team A has deeper bench", () => {
    const teamA = createMockTeamSeason({ id: "a", benchMinutesPct: 38 });
    const teamB = createMockTeamSeason({ id: "b", benchMinutesPct: 25 });
    const result = calculateBenchDepthAdjustment(teamA, teamB, 1.0);
    // (38 - 25) * 0.08 * 1.0 = 13 * 0.08 = 1.04
    expect(result).toBeCloseTo(1.04, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", benchMinutesPct: 40 });
    const teamB = createMockTeamSeason({ id: "b", benchMinutesPct: 20 });
    const result = calculateBenchDepthAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("scales correctly: 10pp diff → 0.8 eff pts at default weight", () => {
    const teamA = createMockTeamSeason({ id: "a", benchMinutesPct: 35 });
    const teamB = createMockTeamSeason({ id: "b", benchMinutesPct: 25 });
    const result = calculateBenchDepthAdjustment(teamA, teamB, 1.0);
    // 10 * 0.08 * 1.0 = 0.8
    expect(result).toBeCloseTo(0.8, 5);
  });
});

// ---------------------------------------------------------------------------
// Pace Adjustment
// ---------------------------------------------------------------------------

describe("calculatePaceAdjustAdjustment", () => {
  it("returns 0 for equal pace adjust values", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaPaceAdjust: 5 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaPaceAdjust: 5 });
    const result = calculatePaceAdjustAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns positive when team A adapts better to pace", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaPaceAdjust: 20 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaPaceAdjust: -15 });
    const result = calculatePaceAdjustAdjustment(teamA, teamB, 1.0);
    // (20 - (-15)) * 0.03 * 1.0 = 35 * 0.03 = 1.05
    expect(result).toBeCloseTo(1.05, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaPaceAdjust: 30 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaPaceAdjust: -10 });
    const result = calculatePaceAdjustAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("scales correctly: 40-point diff → 1.2 eff pts at default weight", () => {
    const teamA = createMockTeamSeason({ id: "a", evanmiyaPaceAdjust: 20 });
    const teamB = createMockTeamSeason({ id: "b", evanmiyaPaceAdjust: -20 });
    const result = calculatePaceAdjustAdjustment(teamA, teamB, 1.0);
    // 40 * 0.03 * 1.0 = 1.2
    expect(result).toBeCloseTo(1.2, 5);
  });
});

// ---------------------------------------------------------------------------
// Tempo Variance
// ---------------------------------------------------------------------------

describe("calculateTempoVarianceMultiplier", () => {
  it("returns ~1.0 for baseline tempo (68)", () => {
    const teamA = createMockTeamSeason({ id: "a", adjTempo: 68.0 });
    const teamB = createMockTeamSeason({ id: "b", adjTempo: 68.0 });
    const result = calculateTempoVarianceMultiplier(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("returns multiplier < 1 for slow game (avg tempo 60)", () => {
    const teamA = createMockTeamSeason({ id: "a", adjTempo: 60.0 });
    const teamB = createMockTeamSeason({ id: "b", adjTempo: 60.0 });
    const result = calculateTempoVarianceMultiplier(teamA, teamB, 1.0);
    // 1.0 + (60 - 68) * 0.015 * 1.0 = 1.0 + (-8 * 0.015) = 1.0 - 0.12 = 0.88
    expect(result).toBeCloseTo(0.88, 2);
    expect(result).toBeLessThan(1.0);
  });

  it("returns multiplier > 1 for fast game (avg tempo 75)", () => {
    const teamA = createMockTeamSeason({ id: "a", adjTempo: 75.0 });
    const teamB = createMockTeamSeason({ id: "b", adjTempo: 75.0 });
    const result = calculateTempoVarianceMultiplier(teamA, teamB, 1.0);
    // 1.0 + (75 - 68) * 0.015 * 1.0 = 1.0 + 0.105 = 1.105
    expect(result).toBeCloseTo(1.105, 2);
    expect(result).toBeGreaterThan(1.0);
  });

  it("clamps at 0.7 for extremely slow games", () => {
    const teamA = createMockTeamSeason({ id: "a", adjTempo: 40.0 });
    const teamB = createMockTeamSeason({ id: "b", adjTempo: 40.0 });
    const result = calculateTempoVarianceMultiplier(teamA, teamB, 1.0);
    // 1.0 + (40 - 68) * 0.015 = 1.0 - 0.42 = 0.58 → clamped to 0.7
    expect(result).toBeCloseTo(0.7, 5);
  });

  it("clamps at 1.4 for extremely fast games", () => {
    const teamA = createMockTeamSeason({ id: "a", adjTempo: 100.0 });
    const teamB = createMockTeamSeason({ id: "b", adjTempo: 100.0 });
    const result = calculateTempoVarianceMultiplier(teamA, teamB, 1.0);
    // 1.0 + (100 - 68) * 0.015 = 1.0 + 0.48 = 1.48 → clamped to 1.4
    expect(result).toBeCloseTo(1.4, 5);
  });

  it("returns 1.0 when weight is 0 regardless of tempo", () => {
    const teamA = createMockTeamSeason({ id: "a", adjTempo: 55.0 });
    const teamB = createMockTeamSeason({ id: "b", adjTempo: 55.0 });
    const result = calculateTempoVarianceMultiplier(teamA, teamB, 0);
    expect(result).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// Three-Point Variance
// ---------------------------------------------------------------------------

describe("calculateThreePtVarianceMultiplier", () => {
  it("returns ~1.0 at baseline 3PT rate (35%)", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      shootingOffense: { threePtPct: 34.5, threePtRate: 35.0, ftPct: 72.0 },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      shootingOffense: { threePtPct: 34.5, threePtRate: 35.0, ftPct: 72.0 },
    });
    const result = calculateThreePtVarianceMultiplier(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("returns multiplier > 1 for high 3PT rate", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      shootingOffense: { threePtPct: 36.0, threePtRate: 45.0, ftPct: 72.0 },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      shootingOffense: { threePtPct: 36.0, threePtRate: 45.0, ftPct: 72.0 },
    });
    const result = calculateThreePtVarianceMultiplier(teamA, teamB, 1.0);
    // avg = 45, 1.0 + (45 - 35) * 0.02 * 1.0 = 1.0 + 0.2 = 1.2
    expect(result).toBeCloseTo(1.2, 2);
    expect(result).toBeGreaterThan(1.0);
  });

  it("returns multiplier < 1 for low 3PT rate", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      shootingOffense: { threePtPct: 34.0, threePtRate: 25.0, ftPct: 72.0 },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      shootingOffense: { threePtPct: 34.0, threePtRate: 25.0, ftPct: 72.0 },
    });
    const result = calculateThreePtVarianceMultiplier(teamA, teamB, 1.0);
    // avg = 25, 1.0 + (25 - 35) * 0.02 = 1.0 - 0.2 = 0.8
    expect(result).toBeCloseTo(0.8, 2);
    expect(result).toBeLessThan(1.0);
  });

  it("clamps at 0.8 for extremely low 3PT rate", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      shootingOffense: { threePtPct: 30.0, threePtRate: 15.0, ftPct: 72.0 },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      shootingOffense: { threePtPct: 30.0, threePtRate: 15.0, ftPct: 72.0 },
    });
    const result = calculateThreePtVarianceMultiplier(teamA, teamB, 1.0);
    // avg = 15, 1.0 + (15-35)*0.02 = 1.0 - 0.4 = 0.6 → clamped to 0.8
    expect(result).toBeCloseTo(0.8, 5);
  });

  it("clamps at 1.5 for extremely high 3PT rate", () => {
    const teamA = createMockTeamSeason({
      id: "a",
      shootingOffense: { threePtPct: 38.0, threePtRate: 65.0, ftPct: 72.0 },
    });
    const teamB = createMockTeamSeason({
      id: "b",
      shootingOffense: { threePtPct: 38.0, threePtRate: 65.0, ftPct: 72.0 },
    });
    const result = calculateThreePtVarianceMultiplier(teamA, teamB, 1.0);
    // avg = 65, 1.0 + (65-35)*0.02 = 1.0 + 0.6 = 1.6 → clamped to 1.5
    expect(result).toBeCloseTo(1.5, 5);
  });
});

// ---------------------------------------------------------------------------
// SoS Adjustment
// ---------------------------------------------------------------------------

describe("calculateSosAdjustment", () => {
  it("returns 0 for equal SoS", () => {
    const teamA = createMockTeamSeason({ id: "a", sosNetRating: 5.0 });
    const teamB = createMockTeamSeason({ id: "b", sosNetRating: 5.0 });
    const result = calculateSosAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("returns positive when team A has harder schedule", () => {
    const teamA = createMockTeamSeason({ id: "a", sosNetRating: 14.0 });
    const teamB = createMockTeamSeason({ id: "b", sosNetRating: -2.0 });
    const result = calculateSosAdjustment(teamA, teamB, 1.0);
    // (14 - (-2)) * 0.10 * 1.0 = 16 * 0.10 = 1.6
    expect(result).toBeCloseTo(1.6, 5);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", sosNetRating: 15.0 });
    const teamB = createMockTeamSeason({ id: "b", sosNetRating: -5.0 });
    const result = calculateSosAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("scales by weight", () => {
    const teamA = createMockTeamSeason({ id: "a", sosNetRating: 10.0 });
    const teamB = createMockTeamSeason({ id: "b", sosNetRating: 0 });
    const result1 = calculateSosAdjustment(teamA, teamB, 1.0);
    const result2 = calculateSosAdjustment(teamA, teamB, 2.0);
    expect(result2).toBeCloseTo(result1 * 2, 5);
  });

  it("returns negative when team B has harder schedule", () => {
    const teamA = createMockTeamSeason({ id: "a", sosNetRating: -5.0 });
    const teamB = createMockTeamSeason({ id: "b", sosNetRating: 10.0 });
    const result = calculateSosAdjustment(teamA, teamB, 1.0);
    expect(result).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Luck Regression
// ---------------------------------------------------------------------------

describe("calculateLuckRegressionAdjustment", () => {
  it("returns 0 for equal luck", () => {
    const teamA = createMockTeamSeason({ id: "a", luck: 0.05 });
    const teamB = createMockTeamSeason({ id: "b", luck: 0.05 });
    const result = calculateLuckRegressionAdjustment(teamA, teamB, 1.0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("penalizes team A when A is luckier (negative adjustment)", () => {
    const teamA = createMockTeamSeason({ id: "a", luck: 0.10 });
    const teamB = createMockTeamSeason({ id: "b", luck: -0.05 });
    const result = calculateLuckRegressionAdjustment(teamA, teamB, 1.0);
    // (luckB - luckA) * 8.0 * 1.0 = (-0.05 - 0.10) * 8.0 = -0.15 * 8.0 = -1.2
    expect(result).toBeCloseTo(-1.2, 5);
    expect(result).toBeLessThan(0);
  });

  it("rewards team A when B is luckier (positive adjustment)", () => {
    const teamA = createMockTeamSeason({ id: "a", luck: -0.05 });
    const teamB = createMockTeamSeason({ id: "b", luck: 0.10 });
    const result = calculateLuckRegressionAdjustment(teamA, teamB, 1.0);
    // (0.10 - (-0.05)) * 8.0 = 0.15 * 8.0 = 1.2
    expect(result).toBeCloseTo(1.2, 5);
    expect(result).toBeGreaterThan(0);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createMockTeamSeason({ id: "a", luck: 0.15 });
    const teamB = createMockTeamSeason({ id: "b", luck: -0.08 });
    const result = calculateLuckRegressionAdjustment(teamA, teamB, 0);
    expect(result).toBeCloseTo(0, 5);
  });

  it("scales by weight", () => {
    const teamA = createMockTeamSeason({ id: "a", luck: 0.08 });
    const teamB = createMockTeamSeason({ id: "b", luck: 0.0 });
    const result1 = calculateLuckRegressionAdjustment(teamA, teamB, 1.0);
    const result2 = calculateLuckRegressionAdjustment(teamA, teamB, 2.0);
    expect(result2).toBeCloseTo(result1 * 2, 5);
  });

  it("matches expected magnitude for realistic values", () => {
    // Florida: luck = -0.051, Liberty: luck = 0.157
    const florida = createMockTeamSeason({ id: "florida", luck: -0.051 });
    const liberty = createMockTeamSeason({ id: "liberty", luck: 0.157 });
    const result = calculateLuckRegressionAdjustment(florida, liberty, 1.0);
    // (0.157 - (-0.051)) * 8.0 = 0.208 * 8.0 = 1.664
    // Florida (unlucky) benefits → positive for Florida (team A)
    expect(result).toBeCloseTo(1.664, 2);
    expect(result).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Site Proximity
// ---------------------------------------------------------------------------

describe("calculateSiteProximityAdjustment", () => {
  it("returns 0 when siteCoordinates is undefined", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const result = calculateSiteProximityAdjustment(teamA, teamB, 1.0);
    expect(result).toBe(0);
  });

  it("returns 0 when weight is 0", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const siteCoords = { latitude: 38.97, longitude: -95.24 };
    const result = calculateSiteProximityAdjustment(teamA, teamB, 0, siteCoords);
    expect(result).toBe(0);
  });

  it("returns positive when team A is closer to the venue", () => {
    // Strong team is in Lawrence, KS (38.97, -95.24)
    // Weak team is in Norfolk, VA (36.85, -76.29)
    // Place venue near Lawrence → A is ~0mi, B is ~1200mi
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const siteCoords = { latitude: 38.97, longitude: -95.24 };
    const result = calculateSiteProximityAdjustment(teamA, teamB, 1.0, siteCoords);
    // A gets large proximity bonus (near 0 miles), B gets penalty (>1000mi)
    expect(result).toBeGreaterThan(2.0);
  });

  it("returns 0 when both teams are at the same location", () => {
    const teamA = createMockTeamSeason({ id: "a" });
    const teamB = createMockTeamSeason({ id: "b" });
    // Both default mock teams are in Springfield, IL (39.78, -89.65)
    // Venue doesn't matter — both teams have same distance
    const siteCoords = { latitude: 25.0, longitude: -80.0 }; // Miami area
    const result = calculateSiteProximityAdjustment(teamA, teamB, 1.0, siteCoords);
    // Both teams are equidistant → difference is 0
    expect(result).toBe(0);
  });

  it("returns non-zero for teams at different distances even in the same general area", () => {
    // This tests the continuous model — previously bucketed teams at similar distances
    // would show 0, but now any distance difference produces a non-zero value
    const teamA = createStrongTeam({ id: "a" }); // Lawrence, KS
    const teamB = createWeakTeam({ id: "b" }); // Norfolk, VA
    // Place venue equidistant-ish from both but slightly different distances
    const siteCoords = { latitude: 37.5, longitude: -85.0 }; // Kentucky area
    const result = calculateSiteProximityAdjustment(teamA, teamB, 1.0, siteCoords);
    expect(result).not.toBe(0);
  });

  it("scales adjustment by weight", () => {
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const siteCoords = { latitude: 38.97, longitude: -95.24 };
    const result1 = calculateSiteProximityAdjustment(teamA, teamB, 1.0, siteCoords);
    const result2 = calculateSiteProximityAdjustment(teamA, teamB, 2.0, siteCoords);
    expect(result2).toBeCloseTo(result1 * 2, 5);
  });

  it("returns negative when team B is closer to the venue", () => {
    // Place venue near Norfolk, VA (weak team)
    const teamA = createStrongTeam({ id: "a" });
    const teamB = createWeakTeam({ id: "b" });
    const siteCoords = { latitude: 36.85, longitude: -76.29 };
    const result = calculateSiteProximityAdjustment(teamA, teamB, 1.0, siteCoords);
    expect(result).toBeLessThan(0);
  });
});
