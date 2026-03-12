/**
 * Tests for the game probability computation logic used by useGameProbabilities.
 *
 * Since the hook is a thin memoized wrapper around resolveMatchup + bracket utilities,
 * these tests verify the core computation: given resolved teams, the correct per-game
 * head-to-head probabilities are produced and keyed by gameId.
 */

import { describe, it, expect } from "vitest";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import { resolveMatchupTeams } from "@/lib/bracket-utils";
import { resolveMatchup } from "@/lib/engine/matchup";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { EngineConfig } from "@/types/engine";
import type { TeamSeason } from "@/types/team";
import type { GameProbabilities } from "@/hooks/useGameProbabilities";
import {
  createStrongTeam,
  createWeakTeam,
  createMidTeam,
  createMockTeamSeason,
} from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Test fixtures: 4 teams for a partial R64 bracket
// ---------------------------------------------------------------------------

const team1Seed = createStrongTeam({
  id: "team-duke-2025",
  teamId: "duke",
  team: {
    id: "duke",
    name: "Duke Blue Devils",
    shortName: "Duke",
    conference: "ACC",
    campus: { city: "Durham", state: "NC", latitude: 36, longitude: -79 },
  },
  tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
});

const team16Seed = createWeakTeam({
  id: "team-fdu-2025",
  teamId: "fdu",
  team: {
    id: "fdu",
    name: "Fairleigh Dickinson Knights",
    shortName: "FDU",
    conference: "NEC",
    campus: { city: "Teaneck", state: "NJ", latitude: 40, longitude: -74 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

const team8Seed = createMidTeam({
  id: "team-marq-2025",
  teamId: "marquette",
  team: {
    id: "marquette",
    name: "Marquette Golden Eagles",
    shortName: "MARQ",
    conference: "Big East",
    campus: { city: "Milwaukee", state: "WI", latitude: 43, longitude: -88 },
  },
  tournamentEntry: { seed: 8, region: "East", bracketPosition: 8 },
});

const team9Seed = createMockTeamSeason({
  id: "team-usc-2025",
  teamId: "usc",
  team: {
    id: "usc",
    name: "USC Trojans",
    shortName: "USC",
    conference: "Pac-12",
    campus: { city: "Los Angeles", state: "CA", latitude: 34, longitude: -118 },
  },
  tournamentEntry: { seed: 9, region: "East", bracketPosition: 9 },
});

// ---------------------------------------------------------------------------
// Helper: compute game probabilities like the hook does
// ---------------------------------------------------------------------------

function computeGameProbabilities(
  teams: Map<string, TeamSeason>,
  picks: Record<string, string>,
  config: EngineConfig
): GameProbabilities {
  const allMatchups = buildBracketMatchups();
  const probs: GameProbabilities = {};

  for (const matchup of allMatchups) {
    const { teamA, teamB } = resolveMatchupTeams(matchup, teams, picks);
    if (!teamA || !teamB) continue;

    const result = resolveMatchup(teamA, teamB, config);
    probs[matchup.gameId] = {
      probA: result.winProbabilityA,
      probB: result.winProbabilityB,
    };
  }

  return probs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("game probability computation (useGameProbabilities logic)", () => {
  const teams = new Map<string, TeamSeason>([
    ["duke", team1Seed],
    ["fdu", team16Seed],
    ["marquette", team8Seed],
    ["usc", team9Seed],
  ]);
  const config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };

  it("computes probabilities for R64 matchups where both teams are known", () => {
    const probs = computeGameProbabilities(teams, {}, config);

    // R64-East-1 is game #1: 1 vs 16 seed = duke vs fdu
    const r64East1 = probs["R64-East-1"];
    expect(r64East1).toBeDefined();
    expect(r64East1.probA).toBeGreaterThan(0);
    expect(r64East1.probB).toBeGreaterThan(0);

    // R64-East-2 is game #2: 8 vs 9 seed = marquette vs usc
    // (games are numbered by matchup order, not seed)
    const r64East2 = probs["R64-East-2"];
    expect(r64East2).toBeDefined();
  });

  it("probabilities sum to approximately 1.0 for each matchup", () => {
    const probs = computeGameProbabilities(teams, {}, config);

    for (const [gameId, prob] of Object.entries(probs)) {
      expect(prob.probA + prob.probB).toBeCloseTo(1.0, 4);
    }
  });

  it("strong team has higher probability than weak team in 1v16 matchup", () => {
    const probs = computeGameProbabilities(teams, {}, config);
    const r64East1 = probs["R64-East-1"];

    // 1-seed should heavily favor duke
    expect(r64East1.probA).toBeGreaterThan(0.85);
    expect(r64East1.probB).toBeLessThan(0.15);
  });

  it("8v9 matchup is more competitive than 1v16", () => {
    const probs = computeGameProbabilities(teams, {}, config);
    const r64East1 = probs["R64-East-1"]; // 1v16
    const r64East2 = probs["R64-East-2"]; // 8v9

    // 8v9 should be much more competitive than 1v16
    // (midTeam adjEM ~13 vs avgTeam adjEM ~5 → favors 8-seed but not blowout)
    expect(r64East2.probA).toBeGreaterThan(0.3);
    expect(r64East2.probA).toBeLessThan(0.85);
    // And it should be closer to 0.5 than the 1v16
    expect(Math.abs(r64East2.probA - 0.5)).toBeLessThan(
      Math.abs(r64East1.probA - 0.5)
    );
  });

  it("does not produce probabilities for later rounds without picks", () => {
    const probs = computeGameProbabilities(teams, {}, config);

    // R32-East-1 requires R64-East-1 and R64-East-2 winners
    // Without picks, later round games should not have probabilities
    expect(probs["R32-East-1"]).toBeUndefined();
  });

  it("produces probabilities for R32 when R64 picks are made", () => {
    // R32-East-1 feeds from R64-East-1 (1v16) and R64-East-2 (8v9)
    const picks = {
      "R64-East-1": "duke",
      "R64-East-2": "marquette",
    };
    const probs = computeGameProbabilities(teams, picks, config);

    // Now R32-East-1 should have a probability (duke vs marquette)
    const r32 = probs["R32-East-1"];
    expect(r32).toBeDefined();
    expect(r32.probA).toBeGreaterThan(0);
    expect(r32.probB).toBeGreaterThan(0);
    expect(r32.probA + r32.probB).toBeCloseTo(1.0, 4);
  });

  it("returns empty object when no teams are loaded", () => {
    const emptyTeams = new Map<string, TeamSeason>();
    const probs = computeGameProbabilities(emptyTeams, {}, config);
    expect(Object.keys(probs)).toHaveLength(0);
  });

  it("only includes matchups where both teams can be resolved", () => {
    // With only 4 teams loaded (East region seeds 1, 16, 8, 9),
    // only 2 R64 games should have probs:
    //   R64-East-1 (1v16) and R64-East-2 (8v9)
    const probs = computeGameProbabilities(teams, {}, config);
    const gameIds = Object.keys(probs);

    // Should have exactly 2 R64 matchups resolved
    const r64Games = gameIds.filter((id) => id.startsWith("R64-East-"));
    expect(r64Games).toHaveLength(2);
    expect(r64Games).toContain("R64-East-1");
    expect(r64Games).toContain("R64-East-2");
  });
});
