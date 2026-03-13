/**
 * Tests for resolveMatchupFast — the fast matchup resolver.
 *
 * Verifies that the fast path produces identical results to the full
 * resolveMatchup() function for various team pairings and configurations.
 */

import { describe, it, expect } from "vitest";

import { resolveMatchupFast } from "@/lib/engine/matchup-fast";
import { resolveMatchup } from "@/lib/engine/matchup";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { EngineConfig, MatchupOverrides } from "@/types/engine";
import { createStrongTeam, createMidTeam, createWeakTeam } from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const strongTeam = createStrongTeam({
  teamId: "strong",
  team: {
    id: "strong",
    name: "Strong Team",
    shortName: "Strong",
    conference: "ACC",
    campus: { city: "Durham", state: "NC", latitude: 36, longitude: -79 },
  },
  tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
});

const midTeam = createMidTeam({
  teamId: "mid",
  team: {
    id: "mid",
    name: "Mid Team",
    shortName: "Mid",
    conference: "MWC",
    campus: { city: "Denver", state: "CO", latitude: 40, longitude: -105 },
  },
  tournamentEntry: { seed: 8, region: "East", bracketPosition: 8 },
});

const weakTeam = createWeakTeam({
  teamId: "weak",
  team: {
    id: "weak",
    name: "Weak Team",
    shortName: "Weak",
    conference: "SWAC",
    campus: { city: "Jackson", state: "MS", latitude: 32, longitude: -90 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveMatchupFast", () => {
  it("returns the same probability as resolveMatchup for strong vs weak", () => {
    const full = resolveMatchup(strongTeam, weakTeam, DEFAULT_ENGINE_CONFIG);
    const fast = resolveMatchupFast(strongTeam, weakTeam, DEFAULT_ENGINE_CONFIG);

    expect(fast).toBeCloseTo(full.winProbabilityA, 10);
  });

  it("returns the same probability as resolveMatchup for mid vs strong", () => {
    const full = resolveMatchup(midTeam, strongTeam, DEFAULT_ENGINE_CONFIG);
    const fast = resolveMatchupFast(midTeam, strongTeam, DEFAULT_ENGINE_CONFIG);

    expect(fast).toBeCloseTo(full.winProbabilityA, 10);
  });

  it("returns the same probability as resolveMatchup for weak vs mid", () => {
    const full = resolveMatchup(weakTeam, midTeam, DEFAULT_ENGINE_CONFIG);
    const fast = resolveMatchupFast(weakTeam, midTeam, DEFAULT_ENGINE_CONFIG);

    expect(fast).toBeCloseTo(full.winProbabilityA, 10);
  });

  it("returns the same probability with custom engine config", () => {
    const customConfig: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      logisticK: 0.2,
      levers: {
        ...DEFAULT_ENGINE_CONFIG.levers,
        experienceWeight: 2.0,
        continuityWeight: 1.5,
      },
    };

    const full = resolveMatchup(strongTeam, midTeam, customConfig);
    const fast = resolveMatchupFast(strongTeam, midTeam, customConfig);

    expect(fast).toBeCloseTo(full.winProbabilityA, 10);
  });

  it("returns the same probability with matchup overrides", () => {
    const overrides: MatchupOverrides = {
      injuryAdjustmentA: -2.5,
      recentFormB: 1.5,
      restAdjustmentA: -1.0,
    };

    const full = resolveMatchup(
      strongTeam,
      weakTeam,
      DEFAULT_ENGINE_CONFIG,
      overrides
    );
    const fast = resolveMatchupFast(
      strongTeam,
      weakTeam,
      DEFAULT_ENGINE_CONFIG,
      overrides
    );

    expect(fast).toBeCloseTo(full.winProbabilityA, 10);
  });

  it("returns the same probability with site coordinates", () => {
    const siteCoords = { latitude: 36, longitude: -79 }; // Near strong team

    const full = resolveMatchup(
      strongTeam,
      weakTeam,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      siteCoords
    );
    const fast = resolveMatchupFast(
      strongTeam,
      weakTeam,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      siteCoords
    );

    expect(fast).toBeCloseTo(full.winProbabilityA, 10);
  });

  it("returns a number between 0 and 1", () => {
    const fast = resolveMatchupFast(strongTeam, weakTeam, DEFAULT_ENGINE_CONFIG);

    expect(fast).toBeGreaterThanOrEqual(0);
    expect(fast).toBeLessThanOrEqual(1);
  });

  it("strong team has higher win probability than weak team", () => {
    const prob = resolveMatchupFast(strongTeam, weakTeam, DEFAULT_ENGINE_CONFIG);

    expect(prob).toBeGreaterThan(0.5);
  });

  it("is symmetric (P(A beats B) + P(B beats A) ≈ 1)", () => {
    const probAB = resolveMatchupFast(strongTeam, midTeam, DEFAULT_ENGINE_CONFIG);
    const probBA = resolveMatchupFast(midTeam, strongTeam, DEFAULT_ENGINE_CONFIG);

    expect(probAB + probBA).toBeCloseTo(1.0, 5);
  });
});
