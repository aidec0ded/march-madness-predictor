/**
 * Tests for the ownership model.
 *
 * Verifies that the heuristic ownership model produces reasonable
 * estimates across seeds, rounds, and conferences.
 */

import { describe, it, expect } from "vitest";
import {
  calculateOwnership,
  buildFullOwnershipModel,
  SEED_BASELINES,
  ROUND_DECAY,
} from "./ownership";
import type { TeamSeason, Seed, TournamentRound } from "@/types/team";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal TeamSeason for testing ownership calculations.
 */
function makeTeam(overrides: {
  seed: Seed;
  conference?: string;
  adjEM?: number;
  teamId?: string;
}): TeamSeason {
  const {
    seed,
    conference = "Big Ten",
    adjEM = 28 - (seed - 1) * 2.53, // default = expected margin for seed
    teamId = `team-${seed}`,
  } = overrides;

  return {
    id: teamId,
    teamId,
    season: 2026,
    team: {
      id: teamId,
      name: `Team Seed ${seed}`,
      shortName: `T${seed}`,
      conference,
      campus: { city: "Test", state: "TS", latitude: 40, longitude: -80 },
    },
    ratings: {
      kenpom: { source: "kenpom", adjOE: 115, adjDE: 115 - adjEM, adjEM },
    },
    fourFactorsOffense: { efgPct: 0.52, toPct: 0.18, orbPct: 0.30, ftRate: 0.35 },
    fourFactorsDefense: { efgPct: 0.48, toPct: 0.20, orbPct: 0.27, ftRate: 0.30 },
    shootingOffense: { threePtPct: 0.35, threePtRate: 0.36, ftPct: 0.74 },
    shootingDefense: { threePtPct: 0.33, threePtRate: 0.34, ftPct: 0.72 },
    adjTempo: 68,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 16.8,
    benchMinutesPct: 0.30,
    experience: 2.0,
    minutesContinuity: 0.55,
    avgHeight: 77,
    twoFoulParticipation: 0.50,
    coach: {
      name: "Coach Test",
      tournamentGames: 20,
      tournamentWins: 12,
      finalFours: 1,
      championships: 0,
      yearsHeadCoach: 10,
    },
    tournamentEntry: {
      seed,
      region: "East",
      bracketPosition: seed,
    },
    updatedAt: new Date().toISOString(),
    dataSources: ["kenpom"],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateOwnership", () => {
  it("1-seed has highest R64 ownership", () => {
    const team1 = makeTeam({ seed: 1 });
    const team2 = makeTeam({ seed: 2 });
    const team16 = makeTeam({ seed: 16 });

    const own1 = calculateOwnership(team1, "R64");
    const own2 = calculateOwnership(team2, "R64");
    const own16 = calculateOwnership(team16, "R64");

    expect(own1).toBeGreaterThan(own2);
    expect(own1).toBeGreaterThan(90);
    expect(own16).toBeLessThan(own1);
  });

  it("16-seed has lowest R64 ownership", () => {
    const team16 = makeTeam({ seed: 16 });
    const team15 = makeTeam({ seed: 15 });

    const own16 = calculateOwnership(team16, "R64");
    const own15 = calculateOwnership(team15, "R64");

    expect(own16).toBeLessThan(own15);
    expect(own16).toBeLessThan(15);
  });

  it("ownership decays by round", () => {
    const team = makeTeam({ seed: 1 });

    const r64 = calculateOwnership(team, "R64");
    const r32 = calculateOwnership(team, "R32");
    const s16 = calculateOwnership(team, "S16");
    const e8 = calculateOwnership(team, "E8");
    const f4 = calculateOwnership(team, "F4");
    const ncg = calculateOwnership(team, "NCG");

    expect(r64).toBeGreaterThan(r32);
    expect(r32).toBeGreaterThan(s16);
    expect(s16).toBeGreaterThan(e8);
    expect(e8).toBeGreaterThan(f4);
    expect(f4).toBeGreaterThan(ncg);
  });

  it("power conference teams get an ownership boost", () => {
    const powerTeam = makeTeam({ seed: 5, conference: "Big Ten" });
    const midTeam = makeTeam({ seed: 5, conference: "MVC" });

    const powerOwn = calculateOwnership(powerTeam, "R64");
    const midOwn = calculateOwnership(midTeam, "R64");

    expect(powerOwn).toBeGreaterThan(midOwn);
  });

  it("teams rated above seed expectation get ownership bump", () => {
    // A 5-seed with 1-seed-level ratings should have higher ownership
    const strongTeam = makeTeam({ seed: 5, adjEM: 28 }); // 1-seed level margin
    const normalTeam = makeTeam({ seed: 5, adjEM: 28 - (5 - 1) * 2.53 }); // expected for 5-seed

    const strongOwn = calculateOwnership(strongTeam, "R64");
    const normalOwn = calculateOwnership(normalTeam, "R64");

    expect(strongOwn).toBeGreaterThan(normalOwn);
  });

  it("ownership is clamped between 0 and 100", () => {
    // Even an extreme team shouldn't exceed 100
    const extremeTeam = makeTeam({ seed: 1, conference: "Big Ten", adjEM: 40 });
    const ownR64 = calculateOwnership(extremeTeam, "R64");
    expect(ownR64).toBeLessThanOrEqual(100);
    expect(ownR64).toBeGreaterThanOrEqual(0);

    // Even a very weak team shouldn't go below 0
    const weakTeam = makeTeam({ seed: 16, conference: "MEAC", adjEM: -15 });
    const ownNCG = calculateOwnership(weakTeam, "NCG");
    expect(ownNCG).toBeGreaterThanOrEqual(0);
    expect(ownNCG).toBeLessThanOrEqual(100);
  });
});

describe("buildFullOwnershipModel", () => {
  it("builds estimates for all teams across all rounds", () => {
    const teams = [makeTeam({ seed: 1, teamId: "t1" }), makeTeam({ seed: 16, teamId: "t16" })];
    const model = buildFullOwnershipModel(teams);

    // 2 teams × 6 rounds = 12 estimates
    expect(model.estimates.size).toBe(12);

    // getOwnership works
    const own = model.getOwnership("t1", "R64");
    expect(own).toBeGreaterThan(0);
  });

  it("getOwnership returns 0 for unknown teams", () => {
    const teams = [makeTeam({ seed: 1, teamId: "t1" })];
    const model = buildFullOwnershipModel(teams);

    expect(model.getOwnership("unknown-team", "R64")).toBe(0);
  });

  it("1-seed ownership is higher than 16-seed in every round", () => {
    const teams = [makeTeam({ seed: 1, teamId: "t1" }), makeTeam({ seed: 16, teamId: "t16" })];
    const model = buildFullOwnershipModel(teams);

    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    for (const round of rounds) {
      const own1 = model.getOwnership("t1", round);
      const own16 = model.getOwnership("t16", round);
      expect(own1).toBeGreaterThan(own16);
    }
  });
});
