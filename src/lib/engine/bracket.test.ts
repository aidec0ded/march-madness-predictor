/**
 * Tests for the bracket structure builder.
 *
 * Validates that buildBracketMatchups creates the correct 63-game tournament
 * bracket with proper seed pairings, round counts, region assignments, and
 * feeder game references. Also validates that buildBracketSlots correctly
 * maps 64 teams into their bracket positions.
 */

import { describe, it, expect } from "vitest";

import { buildBracketMatchups, buildBracketSlots } from "@/lib/engine/bracket";
import type { TournamentRound, Region } from "@/types/team";
import {
  create64TeamField,
  create64TeamFieldMinimal,
} from "@/lib/engine/test-helpers-bracket";
import { createMockTeamSeason } from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// buildBracketMatchups
// ---------------------------------------------------------------------------

describe("buildBracketMatchups", () => {
  const matchups = buildBracketMatchups();

  it("returns exactly 63 matchups (64-team single-elimination bracket)", () => {
    expect(matchups).toHaveLength(63);
  });

  it("has 32 games in the Round of 64", () => {
    const r64Games = matchups.filter((m) => m.round === "R64");
    expect(r64Games).toHaveLength(32);
  });

  it("has 16 games in the Round of 32", () => {
    const r32Games = matchups.filter((m) => m.round === "R32");
    expect(r32Games).toHaveLength(16);
  });

  it("has 8 games in the Sweet 16", () => {
    const s16Games = matchups.filter((m) => m.round === "S16");
    expect(s16Games).toHaveLength(8);
  });

  it("has 4 games in the Elite 8", () => {
    const e8Games = matchups.filter((m) => m.round === "E8");
    expect(e8Games).toHaveLength(4);
  });

  it("has 2 games in the Final Four", () => {
    const f4Games = matchups.filter((m) => m.round === "F4");
    expect(f4Games).toHaveLength(2);
  });

  it("has 1 game in the National Championship", () => {
    const ncgGames = matchups.filter((m) => m.round === "NCG");
    expect(ncgGames).toHaveLength(1);
  });

  it("round game counts sum to 63", () => {
    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    const totalGames = rounds.reduce(
      (sum, round) => sum + matchups.filter((m) => m.round === round).length,
      0
    );
    expect(totalGames).toBe(63);
  });

  it("has all 4 regions represented in regional rounds", () => {
    const regions: Region[] = ["East", "West", "South", "Midwest"];
    const regionalRounds: TournamentRound[] = ["R64", "R32", "S16", "E8"];

    for (const round of regionalRounds) {
      const gamesInRound = matchups.filter((m) => m.round === round);
      const regionsInRound = new Set(gamesInRound.map((m) => m.region));

      for (const region of regions) {
        expect(regionsInRound.has(region)).toBe(true);
      }
    }
  });

  it("each region has 8 R64 games", () => {
    const regions: Region[] = ["East", "West", "South", "Midwest"];

    for (const region of regions) {
      const r64InRegion = matchups.filter(
        (m) => m.round === "R64" && m.region === region
      );
      expect(r64InRegion).toHaveLength(8);
    }
  });

  it("each region has 4 R32 games", () => {
    const regions: Region[] = ["East", "West", "South", "Midwest"];

    for (const region of regions) {
      const r32InRegion = matchups.filter(
        (m) => m.round === "R32" && m.region === region
      );
      expect(r32InRegion).toHaveLength(4);
    }
  });

  it("each region has 2 S16 games", () => {
    const regions: Region[] = ["East", "West", "South", "Midwest"];

    for (const region of regions) {
      const s16InRegion = matchups.filter(
        (m) => m.round === "S16" && m.region === region
      );
      expect(s16InRegion).toHaveLength(2);
    }
  });

  it("each region has 1 E8 game", () => {
    const regions: Region[] = ["East", "West", "South", "Midwest"];

    for (const region of regions) {
      const e8InRegion = matchups.filter(
        (m) => m.round === "E8" && m.region === region
      );
      expect(e8InRegion).toHaveLength(1);
    }
  });

  it("Final Four and NCG games have no region assigned", () => {
    const lateRoundGames = matchups.filter(
      (m) => m.round === "F4" || m.round === "NCG"
    );
    expect(lateRoundGames.length).toBe(3);

    for (const game of lateRoundGames) {
      expect(game.region).toBeUndefined();
    }
  });

  it("R64 games reference valid slot IDs as sources (not feeder games)", () => {
    const r64Games = matchups.filter((m) => m.round === "R64");
    const allGameIds = new Set(matchups.map((m) => m.gameId));

    for (const game of r64Games) {
      // R64 sources should be slot IDs like "East-1", "East-16" — NOT game IDs
      expect(allGameIds.has(game.teamASource)).toBe(false);
      expect(allGameIds.has(game.teamBSource)).toBe(false);
      expect(game.teamASource).toBeDefined();
      expect(game.teamBSource).toBeDefined();
      expect(game.teamASource).not.toBe(game.teamBSource);
    }
  });

  it("R64 games have correct standard seed pairings (1v16, 8v9, 5v12, etc.)", () => {
    // Standard NCAA bracket seed pairings within each region:
    // 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
    const expectedPairings: [number, number][] = [
      [1, 16],
      [8, 9],
      [5, 12],
      [4, 13],
      [6, 11],
      [3, 14],
      [7, 10],
      [2, 15],
    ];

    const regions: Region[] = ["East", "West", "South", "Midwest"];

    for (const region of regions) {
      const regionR64 = matchups.filter(
        (m) => m.round === "R64" && m.region === region
      );
      expect(regionR64).toHaveLength(8);

      // Extract seed pairings from slot IDs (format: "Region-Seed")
      const observedPairings = regionR64.map((game) => {
        const seedA = parseInt(game.teamASource.split("-")[1], 10);
        const seedB = parseInt(game.teamBSource.split("-")[1], 10);
        return [seedA, seedB] as [number, number];
      });

      // Sort both expected and observed for comparison
      const sortedExpected = expectedPairings
        .map(([a, b]) => [Math.min(a, b), Math.max(a, b)])
        .sort((x, y) => x[0] - y[0]);
      const sortedObserved = observedPairings
        .map(([a, b]) => [Math.min(a, b), Math.max(a, b)])
        .sort((x, y) => x[0] - y[0]);

      expect(sortedObserved).toEqual(sortedExpected);
    }
  });

  it("every game has a unique gameId", () => {
    const gameIds = matchups.map((m) => m.gameId);
    const uniqueIds = new Set(gameIds);
    expect(uniqueIds.size).toBe(63);
  });

  it("downstream games reference valid feeder game IDs", () => {
    const allGameIds = new Set(matchups.map((m) => m.gameId));

    // For rounds after R64, teamASource and teamBSource should reference
    // game IDs from the prior round
    const laterRounds: TournamentRound[] = ["R32", "S16", "E8", "F4", "NCG"];

    for (const round of laterRounds) {
      const gamesInRound = matchups.filter((m) => m.round === round);

      for (const game of gamesInRound) {
        // Both sources should be valid game IDs from an earlier round
        expect(allGameIds.has(game.teamASource)).toBe(true);
        expect(allGameIds.has(game.teamBSource)).toBe(true);

        // Sources should be from different games
        expect(game.teamASource).not.toBe(game.teamBSource);
      }
    }
  });

  it("R32 games feed from pairs of R64 games", () => {
    const r32Games = matchups.filter((m) => m.round === "R32");
    const r64GameIds = new Set(
      matchups.filter((m) => m.round === "R64").map((m) => m.gameId)
    );

    for (const game of r32Games) {
      expect(r64GameIds.has(game.teamASource)).toBe(true);
      expect(r64GameIds.has(game.teamBSource)).toBe(true);
    }
  });

  it("S16 games feed from pairs of R32 games", () => {
    const s16Games = matchups.filter((m) => m.round === "S16");
    const r32GameIds = new Set(
      matchups.filter((m) => m.round === "R32").map((m) => m.gameId)
    );

    for (const game of s16Games) {
      expect(r32GameIds.has(game.teamASource)).toBe(true);
      expect(r32GameIds.has(game.teamBSource)).toBe(true);
    }
  });

  it("E8 games feed from pairs of S16 games", () => {
    const e8Games = matchups.filter((m) => m.round === "E8");
    const s16GameIds = new Set(
      matchups.filter((m) => m.round === "S16").map((m) => m.gameId)
    );

    for (const game of e8Games) {
      expect(s16GameIds.has(game.teamASource)).toBe(true);
      expect(s16GameIds.has(game.teamBSource)).toBe(true);
    }
  });

  it("F4 games feed from pairs of E8 games", () => {
    const f4Games = matchups.filter((m) => m.round === "F4");
    const e8GameIds = new Set(
      matchups.filter((m) => m.round === "E8").map((m) => m.gameId)
    );

    for (const game of f4Games) {
      expect(e8GameIds.has(game.teamASource)).toBe(true);
      expect(e8GameIds.has(game.teamBSource)).toBe(true);
    }
  });

  it("NCG feeds from the two F4 games", () => {
    const ncgGames = matchups.filter((m) => m.round === "NCG");
    const f4GameIds = new Set(
      matchups.filter((m) => m.round === "F4").map((m) => m.gameId)
    );

    expect(ncgGames).toHaveLength(1);
    const ncg = ncgGames[0];
    expect(f4GameIds.has(ncg.teamASource)).toBe(true);
    expect(f4GameIds.has(ncg.teamBSource)).toBe(true);
  });

  it("no game references itself as a feeder", () => {
    for (const game of matchups) {
      expect(game.teamASource).not.toBe(game.gameId);
      expect(game.teamBSource).not.toBe(game.gameId);
    }
  });
});

// ---------------------------------------------------------------------------
// buildBracketSlots
// ---------------------------------------------------------------------------

describe("buildBracketSlots", () => {
  it("correctly maps 64 teams to bracket slots", () => {
    const teams = create64TeamField();
    const slots = buildBracketSlots(teams);

    expect(slots.size).toBe(64);
  });

  it("each slot has the correct teamId, seed, and region", () => {
    const teams = create64TeamField();
    const slots = buildBracketSlots(teams);

    for (const team of teams) {
      const entry = team.tournamentEntry!;
      // Find the slot that matches this team
      const matchingSlots = Array.from(slots.values()).filter(
        (s) => s.teamId === team.teamId
      );
      expect(matchingSlots).toHaveLength(1);

      const slot = matchingSlots[0];
      expect(slot.seed).toBe(entry.seed);
      expect(slot.region).toBe(entry.region);
    }
  });

  it("has exactly 16 teams per region", () => {
    const teams = create64TeamField();
    const slots = buildBracketSlots(teams);
    const slotValues = Array.from(slots.values());

    const regions: Region[] = ["East", "West", "South", "Midwest"];
    for (const region of regions) {
      const regionSlots = slotValues.filter((s) => s.region === region);
      expect(regionSlots).toHaveLength(16);
    }
  });

  it("has seeds 1-16 in each region", () => {
    const teams = create64TeamField();
    const slots = buildBracketSlots(teams);
    const slotValues = Array.from(slots.values());

    const regions: Region[] = ["East", "West", "South", "Midwest"];
    for (const region of regions) {
      const regionSlots = slotValues.filter((s) => s.region === region);
      const seeds = regionSlots.map((s) => s.seed).sort((a, b) => a - b);
      expect(seeds).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
      ]);
    }
  });

  it("slot keys follow the Region-Seed format", () => {
    const teams = create64TeamField();
    const slots = buildBracketSlots(teams);

    for (const [key, slot] of slots.entries()) {
      expect(key).toBe(`${slot.region}-${slot.seed}`);
    }
  });

  it("works with the minimal 64-team field", () => {
    const teams = create64TeamFieldMinimal();
    const slots = buildBracketSlots(teams);

    expect(slots.size).toBe(64);
  });

  it("throws if a team is missing tournamentEntry", () => {
    const teams = create64TeamField();
    // Remove tournament entry from one team
    const modifiedTeams = [...teams];
    modifiedTeams[0] = {
      ...modifiedTeams[0],
      tournamentEntry: undefined,
    };

    expect(() => buildBracketSlots(modifiedTeams)).toThrow();
  });

  it("throws if fewer than 64 teams are provided", () => {
    const teams = create64TeamField().slice(0, 63);
    expect(() => buildBracketSlots(teams)).toThrow();
  });

  it("throws if more than 64 teams are provided", () => {
    const teams = create64TeamField();
    const extraTeam = createMockTeamSeason({
      id: "extra-2025",
      teamId: "extra",
      team: {
        id: "extra",
        name: "Extra University",
        shortName: "EXTRA",
        conference: "Big 12",
        campus: { city: "Test", state: "TX", latitude: 30, longitude: -90 },
      },
      tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
    });
    const overSizedField = [...teams, extraTeam];

    expect(() => buildBracketSlots(overSizedField)).toThrow();
  });

  it("throws if there are duplicate seed/region combinations", () => {
    const teams = create64TeamField();
    // Make two teams have the same seed and region (duplicate slot)
    const modifiedTeams = [...teams];
    modifiedTeams[1] = {
      ...modifiedTeams[1],
      teamId: "duplicate-team",
      team: { ...modifiedTeams[1].team, id: "duplicate-team" },
      tournamentEntry: { ...modifiedTeams[0].tournamentEntry! },
    };

    expect(() => buildBracketSlots(modifiedTeams)).toThrow();
  });
});
