/**
 * Exhaustive parity tests: resolveMatchup() vs resolveMatchupFast()
 *
 * These tests exist to catch **divergence** between the two matchup resolvers.
 * matchup.ts is the full diagnostic version (used in the matchup view UI);
 * matchup-fast.ts is the allocation-free hot path (used in Monte Carlo simulation).
 *
 * Both must produce identical win probabilities. If a new lever is added to
 * matchup.ts but not matchup-fast.ts (or vice versa), these tests will fail.
 *
 * Strategy: for each lever, crank its weight to 5x (or set relevant team data
 * to extreme values) so any omission produces a visible probability divergence
 * rather than hiding in rounding noise.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { resolveMatchup } from "@/lib/engine/matchup";
import { resolveMatchupFast } from "@/lib/engine/matchup-fast";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { EngineConfig, MatchupOverrides, GlobalLevers } from "@/types/engine";
import {
  createStrongTeam,
  createWeakTeam,
  createMidTeam,
} from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Shared fixtures — teams with non-zero SOS/luck data so those levers fire
// ---------------------------------------------------------------------------

const teamA = createStrongTeam({
  sosNetRating: 8.5,
  sosOffRating: 4.2,
  sosDefRating: 4.3,
  luck: 0.04,
});

const teamB = createWeakTeam({
  sosNetRating: -2.0,
  sosOffRating: -1.5,
  sosDefRating: -0.5,
  luck: -0.03,
});

const midTeam = createMidTeam({
  sosNetRating: 3.0,
  sosOffRating: 1.5,
  sosDefRating: 1.5,
  luck: 0.01,
});

// Game site near team A (should produce a meaningful site proximity effect)
const siteNearA = { latitude: 38.97, longitude: -95.24 };

// ---------------------------------------------------------------------------
// Helper: assert parity between full and fast resolvers
// ---------------------------------------------------------------------------

function assertParity(
  a: typeof teamA,
  b: typeof teamB,
  config: EngineConfig,
  overrides?: MatchupOverrides,
  site?: { latitude: number; longitude: number },
  label?: string
) {
  const full = resolveMatchup(a, b, config, overrides, site);
  const fast = resolveMatchupFast(a, b, config, overrides, site);

  // 10 decimal places — these should be bit-for-bit identical since
  // they call the same functions with the same inputs
  expect(fast, label).toBeCloseTo(full.winProbabilityA, 10);
}

/**
 * Build an EngineConfig with a single lever cranked to a high weight.
 * All other levers stay at default values.
 */
function configWithLever(
  leverKey: keyof GlobalLevers,
  value: number
): EngineConfig {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    levers: {
      ...DEFAULT_ENGINE_CONFIG.levers,
      [leverKey]: value,
    },
  };
}

// ---------------------------------------------------------------------------
// Per-lever parity tests
// ---------------------------------------------------------------------------

describe("matchup ↔ matchup-fast parity: per-lever isolation", () => {
  it("experienceWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("experienceWeight", 5));
  });

  it("continuityWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("continuityWeight", 5));
  });

  it("coachExperienceWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("coachExperienceWeight", 5));
  });

  it("opponentAdjustWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("opponentAdjustWeight", 5));
  });

  it("benchDepthWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("benchDepthWeight", 5));
  });

  it("paceAdjustWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("paceAdjustWeight", 5));
  });

  it("siteProximityWeight cranked to 5x (with site coordinates)", () => {
    assertParity(
      teamA,
      teamB,
      configWithLever("siteProximityWeight", 5),
      undefined,
      siteNearA
    );
  });

  it("sosWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("sosWeight", 5));
  });

  it("luckRegressionWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("luckRegressionWeight", 5));
  });

  it("tempoVarianceWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("tempoVarianceWeight", 5));
  });

  it("threePtVarianceWeight cranked to 5x", () => {
    assertParity(teamA, teamB, configWithLever("threePtVarianceWeight", 5));
  });

  it("fourFactors weights all cranked to 5x", () => {
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        fourFactors: {
          efgPctOffense: 5,
          efgPctDefense: 5,
          toPctOffense: 5,
          toPctDefense: 5,
          orbPctOffense: 5,
          orbPctDefense: 5,
          ftRateOffense: 5,
          ftRateDefense: 5,
        },
      },
    };
    assertParity(teamA, teamB, config);
  });

  it("compositeWeights shifted (all kenpom)", () => {
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        compositeWeights: { kenpom: 1.0, torvik: 0, evanmiya: 0 },
      },
    };
    assertParity(teamA, teamB, config);
  });

  it("compositeWeights shifted (all evanmiya)", () => {
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        compositeWeights: { kenpom: 0, torvik: 0, evanmiya: 1.0 },
      },
    };
    assertParity(teamA, teamB, config);
  });
});

// ---------------------------------------------------------------------------
// Combined lever parity tests
// ---------------------------------------------------------------------------

describe("matchup ↔ matchup-fast parity: combined scenarios", () => {
  it("all levers cranked to maximum simultaneously", () => {
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      logisticK: 0.2,
      baseVariance: 15,
      levers: {
        compositeWeights: { kenpom: 0.5, torvik: 0.3, evanmiya: 0.2 },
        fourFactors: {
          efgPctOffense: 5,
          efgPctDefense: 5,
          toPctOffense: 5,
          toPctDefense: 5,
          orbPctOffense: 5,
          orbPctDefense: 5,
          ftRateOffense: 5,
          ftRateDefense: 5,
        },
        experienceWeight: 5,
        continuityWeight: 5,
        coachExperienceWeight: 5,
        opponentAdjustWeight: 5,
        benchDepthWeight: 5,
        paceAdjustWeight: 5,
        siteProximityWeight: 5,
        sosWeight: 5,
        luckRegressionWeight: 5,
        tempoVarianceWeight: 5,
        threePtVarianceWeight: 5,
      },
    };

    assertParity(teamA, teamB, config, undefined, siteNearA);
  });

  it("all matchup overrides populated", () => {
    const overrides: MatchupOverrides = {
      injuryAdjustmentA: -5,
      injuryAdjustmentB: -3,
      recentFormA: 4,
      recentFormB: -2,
      restAdjustmentA: 2,
      restAdjustmentB: -1,
      twoFoulParticipationA: 0.8,
      twoFoulParticipationB: 0.3,
    };

    assertParity(teamA, teamB, DEFAULT_ENGINE_CONFIG, overrides);
  });

  it("per-matchup lever overrides (leverOverrides field)", () => {
    const overrides: MatchupOverrides = {
      injuryAdjustmentA: -2,
      leverOverrides: {
        experienceWeight: 5,
        continuityWeight: 0,
        coachExperienceWeight: 3,
        compositeWeights: { kenpom: 0.8, torvik: 0.1, evanmiya: 0.1 },
      },
    };

    assertParity(teamA, teamB, DEFAULT_ENGINE_CONFIG, overrides);
  });

  it("all overrides + all levers cranked + site coordinates", () => {
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      logisticK: 0.15,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        experienceWeight: 3,
        coachExperienceWeight: 4,
        sosWeight: 3,
        luckRegressionWeight: 2,
        siteProximityWeight: 3,
        tempoVarianceWeight: 3,
        threePtVarianceWeight: 3,
      },
    };

    const overrides: MatchupOverrides = {
      injuryAdjustmentA: -4,
      injuryAdjustmentB: -1,
      recentFormA: 3,
      recentFormB: -3,
      restAdjustmentA: 1,
      restAdjustmentB: -2,
    };

    assertParity(teamA, teamB, config, overrides, siteNearA);
  });

  it("mid vs weak with custom config", () => {
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        experienceWeight: 4,
        benchDepthWeight: 3,
        paceAdjustWeight: 2,
      },
    };

    assertParity(midTeam, teamB, config);
  });

  it("reversed team order produces complementary probabilities", () => {
    const config = configWithLever("experienceWeight", 5);

    const fullAB = resolveMatchup(teamA, teamB, config);
    const fastAB = resolveMatchupFast(teamA, teamB, config);
    const fullBA = resolveMatchup(teamB, teamA, config);
    const fastBA = resolveMatchupFast(teamB, teamA, config);

    expect(fastAB).toBeCloseTo(fullAB.winProbabilityA, 10);
    expect(fastBA).toBeCloseTo(fullBA.winProbabilityA, 10);
    expect(fastAB + fastBA).toBeCloseTo(1.0, 10);
  });
});

// ---------------------------------------------------------------------------
// Structural parity: both files import the same lever functions
// ---------------------------------------------------------------------------

describe("matchup ↔ matchup-fast structural parity", () => {
  it("both files import the same lever calculation functions", () => {
    const matchupSrc = fs.readFileSync(
      path.resolve(__dirname, "matchup.ts"),
      "utf-8"
    );
    const fastSrc = fs.readFileSync(
      path.resolve(__dirname, "matchup-fast.ts"),
      "utf-8"
    );

    // Extract all calculateXxx function names (camelCase — starts with uppercase after "calculate")
    // This avoids matching prose like "calculates" in comments.
    const leverFnPattern = /calculate[A-Z][A-Za-z]+/g;
    const matchupLeverFns = new Set(matchupSrc.match(leverFnPattern) || []);
    const fastLeverFns = new Set(fastSrc.match(leverFnPattern) || []);

    // Both files should reference exactly the same set of lever functions
    const inMatchupOnly = [...matchupLeverFns].filter(
      (fn) => !fastLeverFns.has(fn)
    );
    const inFastOnly = [...fastLeverFns].filter(
      (fn) => !matchupLeverFns.has(fn)
    );

    expect(inMatchupOnly, "Lever functions in matchup.ts but NOT in matchup-fast.ts").toEqual([]);
    expect(inFastOnly, "Lever functions in matchup-fast.ts but NOT in matchup.ts").toEqual([]);
  });

  it("both files import applyMatchupOverrides and mergeLevers", () => {
    const matchupSrc = fs.readFileSync(
      path.resolve(__dirname, "matchup.ts"),
      "utf-8"
    );
    const fastSrc = fs.readFileSync(
      path.resolve(__dirname, "matchup-fast.ts"),
      "utf-8"
    );

    for (const fn of ["applyMatchupOverrides", "mergeLevers"]) {
      expect(matchupSrc, `matchup.ts should import ${fn}`).toContain(fn);
      expect(fastSrc, `matchup-fast.ts should import ${fn}`).toContain(fn);
    }
  });
});
