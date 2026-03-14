/**
 * Tests for the game-level ownership model.
 *
 * Verifies that the ownership model produces correct estimates based on
 * NCAA.com historical pick rates, modifiers, chalk multiplier, and
 * the invariant that each matchup always sums to 100%.
 */

import { describe, it, expect } from "vitest";
import { CURRENT_SEASON } from "@/lib/constants";
import {
  calculateMatchupOwnership,
  calculateOwnership,
  buildFullOwnershipModel,
  SEED_POPULARITY,
  CHALK_MULTIPLIER,
} from "./ownership";
import type { TeamSeason, Seed, TournamentRound, Conference } from "@/types/team";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal TeamSeason for testing ownership calculations.
 */
function makeTeam(overrides: {
  seed: Seed;
  conference?: Conference;
  adjEM?: number;
  teamId?: string;
  teamName?: string;
}): TeamSeason {
  const {
    seed,
    conference = "Big Ten" as Conference,
    adjEM = 28 - (seed - 1) * 2.53, // default = expected margin for seed
    teamId = `team-${seed}`,
    teamName = `Team Seed ${seed}`,
  } = overrides;

  return {
    id: teamId,
    teamId,
    season: CURRENT_SEASON,
    team: {
      id: teamId,
      name: teamName,
      shortName: `T${seed}`,
      conference,
      campus: { city: "Test", state: "TS", latitude: 40, longitude: -80 },
    },
    ratings: {
      kenpom: { source: "kenpom", adjOE: 115, adjDE: 115 - adjEM, adjEM },
    },
    fourFactorsOffense: { efgPct: 0.52, toPct: 0.18, orbPct: 0.3, ftRate: 0.35 },
    fourFactorsDefense: { efgPct: 0.48, toPct: 0.2, orbPct: 0.27, ftRate: 0.3 },
    shootingOffense: { threePtPct: 0.35, threePtRate: 0.36, ftPct: 0.74 },
    shootingDefense: { threePtPct: 0.33, threePtRate: 0.34, ftPct: 0.72 },
    adjTempo: 68,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 16.8,
    benchMinutesPct: 0.3,
    experience: 2.0,
    minutesContinuity: 0.55,
    avgHeight: 77,
    twoFoulParticipation: 0.5,
    sosNetRating: 0,
    sosOffRating: 0,
    sosDefRating: 0,
    luck: 0,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
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
// Tests — calculateMatchupOwnership
// ---------------------------------------------------------------------------

describe("calculateMatchupOwnership", () => {
  it("always sums to 100% for any seed pairing", () => {
    const seeds: Seed[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

    for (const round of rounds) {
      for (const seedA of seeds) {
        for (const seedB of seeds) {
          // Use same conference and matching adjEM to isolate seed baseline
          const teamA = makeTeam({ seed: seedA, conference: "Big Ten", adjEM: 20, teamId: `a-${seedA}` });
          const teamB = makeTeam({ seed: seedB, conference: "Big Ten", adjEM: 20, teamId: `b-${seedB}` });
          const [ownA, ownB] = calculateMatchupOwnership(teamA, teamB, round);
          expect(ownA + ownB).toBeCloseTo(100, 5);
          expect(ownA).toBeGreaterThanOrEqual(1);
          expect(ownA).toBeLessThanOrEqual(99);
          expect(ownB).toBeGreaterThanOrEqual(1);
          expect(ownB).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it("reproduces NCAA.com R64 baselines for standard seed pairs (no modifiers)", () => {
    // Same conference + same adjEM = no modifiers, so we get pure seed baseline
    const testCases: Array<{ seedA: Seed; seedB: Seed; expectedA: number }> = [
      // Standard R64 pairs: higher seed is favored
      { seedA: 1, seedB: 16, expectedA: 98.5 },
      { seedA: 2, seedB: 15, expectedA: 93 },
      { seedA: 3, seedB: 14, expectedA: 85 },
      { seedA: 4, seedB: 13, expectedA: 80 },
      { seedA: 5, seedB: 12, expectedA: 64 },
      { seedA: 6, seedB: 11, expectedA: 61 },
      { seedA: 7, seedB: 10, expectedA: 55 },
      { seedA: 8, seedB: 9, expectedA: 50 },
    ];

    for (const { seedA, seedB, expectedA } of testCases) {
      const teamA = makeTeam({ seed: seedA, conference: "Big Ten", adjEM: 20, teamId: `a-${seedA}` });
      const teamB = makeTeam({ seed: seedB, conference: "Big Ten", adjEM: 20, teamId: `b-${seedB}` });
      const [ownA, ownB] = calculateMatchupOwnership(teamA, teamB, "R64");

      // Expected is the proportional split: popA / (popA + popB) * 100
      const popA = SEED_POPULARITY[seedA] ?? 50;
      const popB = SEED_POPULARITY[seedB] ?? 50;
      const expectedPropA = (popA / (popA + popB)) * 100;

      expect(ownA).toBeCloseTo(expectedPropA, 1);
      expect(ownA + ownB).toBeCloseTo(100, 5);
    }
  });

  it("First Four starts at 50/50 before modifiers", () => {
    // Same seed, same conference, same adjEM
    const teamA = makeTeam({ seed: 16, conference: "MEAC", adjEM: -5, teamId: "ff-a" });
    const teamB = makeTeam({ seed: 16, conference: "MEAC", adjEM: -5, teamId: "ff-b" });
    const [ownA, ownB] = calculateMatchupOwnership(teamA, teamB, "FF");

    expect(ownA).toBeCloseTo(50, 1);
    expect(ownB).toBeCloseTo(50, 1);
  });

  it("power conference modifier shifts ownership toward power conf team", () => {
    // Same seed, same adjEM → only conference modifier applies
    const powerTeam = makeTeam({ seed: 12, conference: "SEC", adjEM: 10, teamId: "power" });
    const midTeam = makeTeam({ seed: 12, conference: "MVC", adjEM: 10, teamId: "mid" });

    const [ownPower, ownMid] = calculateMatchupOwnership(powerTeam, midTeam, "R64");

    // Same seed → base is 50/50, then +4pp for power conf
    expect(ownPower).toBeGreaterThan(50);
    expect(ownMid).toBeLessThan(50);
    expect(ownPower - ownMid).toBeCloseTo(8, 0); // +4 for power, -4 for mid = 8pp gap
  });

  it("power conf modifier does not apply when both teams are power conf", () => {
    const teamA = makeTeam({ seed: 5, conference: "SEC", adjEM: 20, teamId: "a" });
    const teamB = makeTeam({ seed: 5, conference: "Big Ten", adjEM: 20, teamId: "b" });

    const [ownA, ownB] = calculateMatchupOwnership(teamA, teamB, "R64");

    // Same seed, same conf tier, same adjEM → should be 50/50
    expect(ownA).toBeCloseTo(50, 1);
    expect(ownB).toBeCloseTo(50, 1);
  });

  it("PUBLIC_GROUP modifier shifts ownership toward recognized programs", () => {
    // Both same seed, same conference, same adjEM
    const duke = makeTeam({ seed: 5, conference: "ACC", adjEM: 20, teamId: "duke", teamName: "Duke" });
    const midTeam = makeTeam({ seed: 5, conference: "ACC", adjEM: 20, teamId: "other", teamName: "Wake Forest" });

    const [ownDuke, ownOther] = calculateMatchupOwnership(duke, midTeam, "R64");

    expect(ownDuke).toBeGreaterThan(ownOther);
    // +2pp for PUBLIC_GROUP (no conference differential since both ACC)
    expect(ownDuke - ownOther).toBeCloseTo(4, 0); // 2pp shift = 4pp gap
  });

  it("PUBLIC_GROUP modifier does not apply between two PUBLIC_GROUP teams", () => {
    const duke = makeTeam({ seed: 1, conference: "ACC", adjEM: 25, teamId: "duke", teamName: "Duke" });
    const unc = makeTeam({ seed: 1, conference: "ACC", adjEM: 25, teamId: "unc", teamName: "North Carolina" });

    const [ownDuke, ownUNC] = calculateMatchupOwnership(duke, unc, "R64");

    // Same seed, same conf, same adjEM, both PUBLIC_GROUP → 50/50
    expect(ownDuke).toBeCloseTo(50, 1);
    expect(ownUNC).toBeCloseTo(50, 1);
  });

  it("KenPom AdjEM modifier shifts ownership toward stronger team", () => {
    // Same seed, same conference, but different adjEM
    const strongTeam = makeTeam({ seed: 8, conference: "Big Ten", adjEM: 30, teamId: "strong" });
    const weakTeam = makeTeam({ seed: 8, conference: "Big Ten", adjEM: 20, teamId: "weak" });

    const [ownStrong, ownWeak] = calculateMatchupOwnership(strongTeam, weakTeam, "R64");

    // AdjEM diff = 10, so modifier = 10/2 = +5pp toward strong team
    expect(ownStrong).toBeGreaterThan(ownWeak);
    expect(ownStrong - ownWeak).toBeCloseTo(10, 0); // 5pp shift = 10pp gap
  });

  it("chalk multiplier increases favorite's share in later rounds", () => {
    const team1 = makeTeam({ seed: 1, conference: "Big Ten", adjEM: 20, teamId: "a" });
    const team4 = makeTeam({ seed: 4, conference: "Big Ten", adjEM: 20, teamId: "b" });

    const [r64A] = calculateMatchupOwnership(team1, team4, "R64");
    const [e8A] = calculateMatchupOwnership(team1, team4, "E8");

    // The 1-seed should have higher ownership in E8 than R64 (chalk multiplier)
    expect(e8A).toBeGreaterThan(r64A);
  });

  it("chalk multiplier boosts the correct team (lower seed is favorite)", () => {
    // When teamA is the underdog (higher seed)
    const team12 = makeTeam({ seed: 12, conference: "Big Ten", adjEM: 15, teamId: "dog" });
    const team5 = makeTeam({ seed: 5, conference: "Big Ten", adjEM: 15, teamId: "fav" });

    const [r64Dog] = calculateMatchupOwnership(team12, team5, "R64");
    const [r32Dog] = calculateMatchupOwnership(team12, team5, "R32");

    // Underdog's share should decrease in later rounds (chalk boost helps favorite)
    expect(r32Dog).toBeLessThan(r64Dog);
  });

  it("handles non-standard later-round seed pairings", () => {
    // 1-seed vs 4-seed (E8 matchup)
    const team1 = makeTeam({ seed: 1, conference: "SEC", adjEM: 20, teamId: "a" });
    const team4 = makeTeam({ seed: 4, conference: "SEC", adjEM: 20, teamId: "b" });

    const [own1, own4] = calculateMatchupOwnership(team1, team4, "E8");

    // 1-seed should be favored but not overwhelmingly
    expect(own1).toBeGreaterThan(own4);
    expect(own1).toBeLessThan(85); // Not as extreme as 1 vs 16
    expect(own1 + own4).toBeCloseTo(100, 5);
  });

  it("modifiers stack correctly", () => {
    // Power conf (+4pp) + PUBLIC_GROUP (+2pp) + AdjEM advantage (+5pp for 10pt diff)
    const duke = makeTeam({
      seed: 5, conference: "ACC", adjEM: 25, teamId: "duke", teamName: "Duke",
    });
    const midMajor = makeTeam({
      seed: 5, conference: "MVC", adjEM: 15, teamId: "mid", teamName: "Small School",
    });

    const [ownDuke, ownMid] = calculateMatchupOwnership(duke, midMajor, "R64");

    // Base: 50/50 (same seed)
    // Power conf: +4pp
    // PUBLIC_GROUP: +2pp
    // AdjEM: (25-15)/2 = +5pp
    // Total modifier: +11pp → Duke ≈ 61, Mid ≈ 39
    expect(ownDuke).toBeGreaterThan(55);
    expect(ownDuke).toBeLessThan(70);
    expect(ownDuke + ownMid).toBeCloseTo(100, 5);
  });

  it("clamps to [1, 99] range", () => {
    // Extreme case: massive rating difference
    const godTeam = makeTeam({ seed: 1, conference: "SEC", adjEM: 50, teamId: "god", teamName: "Duke" });
    const weakTeam = makeTeam({ seed: 16, conference: "SWAC", adjEM: -20, teamId: "weak" });

    const [ownGod, ownWeak] = calculateMatchupOwnership(godTeam, weakTeam, "NCG");

    expect(ownGod).toBeLessThanOrEqual(99);
    expect(ownWeak).toBeGreaterThanOrEqual(1);
    expect(ownGod + ownWeak).toBeCloseTo(100, 5);
  });
});

// ---------------------------------------------------------------------------
// Tests — calculateOwnership (standalone, backward compat)
// ---------------------------------------------------------------------------

describe("calculateOwnership", () => {
  it("returns seed-based standalone estimate without opponent context", () => {
    const team1 = makeTeam({ seed: 1 });
    const team16 = makeTeam({ seed: 16 });

    const own1 = calculateOwnership(team1, "R64");
    const own16 = calculateOwnership(team16, "R64");

    expect(own1).toBeGreaterThan(own16);
    expect(own1).toBeGreaterThan(90);
    expect(own16).toBeLessThan(10);
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

  it("is clamped between 1 and 99", () => {
    const team = makeTeam({ seed: 1 });
    const own = calculateOwnership(team, "R64");
    expect(own).toBeGreaterThanOrEqual(1);
    expect(own).toBeLessThanOrEqual(99);
  });
});

// ---------------------------------------------------------------------------
// Tests — buildFullOwnershipModel
// ---------------------------------------------------------------------------

describe("buildFullOwnershipModel", () => {
  it("builds estimates for all teams across all rounds", () => {
    const teams = [
      makeTeam({ seed: 1, teamId: "t1" }),
      makeTeam({ seed: 16, teamId: "t16" }),
    ];
    const model = buildFullOwnershipModel(teams);

    // 2 teams × 6 rounds = 12 standalone estimates
    expect(model.estimates.size).toBe(12);

    // getOwnership works
    const own = model.getOwnership("t1", "R64");
    expect(own).toBeGreaterThan(0);
  });

  it("getMatchupOwnership returns game-level ownership summing to 100%", () => {
    const teams = [
      makeTeam({ seed: 1, conference: "SEC", adjEM: 25, teamId: "t1" }),
      makeTeam({ seed: 16, conference: "MEAC", adjEM: -5, teamId: "t16" }),
    ];
    const model = buildFullOwnershipModel(teams);

    const [own1, own16] = model.getMatchupOwnership("t1", "t16", "R64");

    expect(own1 + own16).toBeCloseTo(100, 5);
    expect(own1).toBeGreaterThan(90);
    expect(own16).toBeLessThan(10);
  });

  it("getMatchupOwnership returns [50, 50] for unknown teams", () => {
    const teams = [makeTeam({ seed: 1, teamId: "t1" })];
    const model = buildFullOwnershipModel(teams);

    const [ownA, ownB] = model.getMatchupOwnership("unknown-a", "unknown-b", "R64");
    expect(ownA).toBe(50);
    expect(ownB).toBe(50);
  });

  it("getOwnership returns 0 for unknown teams", () => {
    const teams = [makeTeam({ seed: 1, teamId: "t1" })];
    const model = buildFullOwnershipModel(teams);

    expect(model.getOwnership("unknown-team", "R64")).toBe(0);
  });

  it("1-seed ownership is higher than 16-seed in every round (standalone)", () => {
    const teams = [
      makeTeam({ seed: 1, teamId: "t1" }),
      makeTeam({ seed: 16, teamId: "t16" }),
    ];
    const model = buildFullOwnershipModel(teams);

    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    for (const round of rounds) {
      const own1 = model.getOwnership("t1", round);
      const own16 = model.getOwnership("t16", round);
      expect(own1).toBeGreaterThan(own16);
    }
  });

  it("game-level ownership favors higher seed in every round", () => {
    const teams = [
      makeTeam({ seed: 1, conference: "Big Ten", adjEM: 20, teamId: "t1" }),
      makeTeam({ seed: 16, conference: "Big Ten", adjEM: 20, teamId: "t16" }),
    ];
    const model = buildFullOwnershipModel(teams);

    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    for (const round of rounds) {
      const [own1, own16] = model.getMatchupOwnership("t1", "t16", round);
      expect(own1).toBeGreaterThan(own16);
    }
  });
});
