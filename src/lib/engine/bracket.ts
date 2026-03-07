/**
 * Bracket structure and matchup tree builder for the 64-team NCAA tournament.
 *
 * Defines the standard bracket layout: 4 regions of 16 teams, with games
 * progressing from the Round of 64 through the National Championship Game.
 * The bracket tree is represented as an array of BracketMatchup objects,
 * where later-round matchups reference feeder games by gameId.
 *
 * All functions are pure (no side effects).
 */

import type { Region, TeamSeason, TournamentRound } from "@/types/team";
import type { BracketMatchup, BracketSlot } from "@/types/simulation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The four NCAA tournament regions in standard bracket order. */
export const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

/**
 * Standard R64 seed pairings within a region.
 * Each tuple is [higher seed, lower seed].
 * The order determines the bracket path: winners of adjacent games meet
 * in the R32, and so on through the regional bracket.
 */
export const BRACKET_SEED_MATCHUPS: [number, number][] = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

/**
 * Standard Final Four pairing: East vs West, South vs Midwest.
 * Each tuple is [regionA, regionB] for the two semifinal games.
 */
const FINAL_FOUR_PAIRINGS: [Region, Region][] = [
  ["East", "West"],
  ["South", "Midwest"],
];

/**
 * Maps a tournament round to its zero-indexed round number.
 * Used for counting wins and ordering progression.
 */
const ROUND_ORDER: Record<TournamentRound, number> = {
  R64: 0,
  R32: 1,
  S16: 2,
  E8: 3,
  F4: 4,
  NCG: 5,
};

// ---------------------------------------------------------------------------
// Bracket matchup builder
// ---------------------------------------------------------------------------

/**
 * Builds the complete 63-game matchup tree for a standard 64-team NCAA bracket.
 *
 * The bracket consists of:
 * - R64: 32 games (8 per region) with seed pairings 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
 * - R32: 16 games (4 per region) pairing adjacent R64 winners
 * - S16: 8 games (2 per region) pairing adjacent R32 winners
 * - E8:  4 games (1 per region) pairing S16 winners
 * - F4:  2 games (East vs West, South vs Midwest)
 * - NCG: 1 game (F4 winners)
 *
 * For R64 games, teamASource/teamBSource are slot IDs (e.g., "East-1", "East-16").
 * For all later rounds, they are gameIds of the feeder games.
 *
 * @returns An array of 63 BracketMatchup objects representing the full tournament tree
 */
export function buildBracketMatchups(): BracketMatchup[] {
  const matchups: BracketMatchup[] = [];

  // --- Round of 64 ---
  for (const region of REGIONS) {
    for (let i = 0; i < BRACKET_SEED_MATCHUPS.length; i++) {
      const [seedA, seedB] = BRACKET_SEED_MATCHUPS[i];
      const gameNum = i + 1;
      matchups.push({
        gameId: `R64-${region}-${gameNum}`,
        round: "R64",
        region,
        teamASource: `${region}-${seedA}`,
        teamBSource: `${region}-${seedB}`,
      });
    }
  }

  // --- Round of 32 ---
  // Winners of R64 games 1&2 meet, 3&4 meet, 5&6 meet, 7&8 meet
  for (const region of REGIONS) {
    for (let i = 0; i < 4; i++) {
      const gameNum = i + 1;
      const feederA = `R64-${region}-${i * 2 + 1}`;
      const feederB = `R64-${region}-${i * 2 + 2}`;
      matchups.push({
        gameId: `R32-${region}-${gameNum}`,
        round: "R32",
        region,
        teamASource: feederA,
        teamBSource: feederB,
      });
    }
  }

  // --- Sweet 16 ---
  // Winners of R32 games 1&2 meet, 3&4 meet
  for (const region of REGIONS) {
    for (let i = 0; i < 2; i++) {
      const gameNum = i + 1;
      const feederA = `R32-${region}-${i * 2 + 1}`;
      const feederB = `R32-${region}-${i * 2 + 2}`;
      matchups.push({
        gameId: `S16-${region}-${gameNum}`,
        round: "S16",
        region,
        teamASource: feederA,
        teamBSource: feederB,
      });
    }
  }

  // --- Elite 8 ---
  // Winners of S16 games 1&2 meet
  for (const region of REGIONS) {
    const feederA = `S16-${region}-1`;
    const feederB = `S16-${region}-2`;
    matchups.push({
      gameId: `E8-${region}`,
      round: "E8",
      region,
      teamASource: feederA,
      teamBSource: feederB,
    });
  }

  // --- Final Four ---
  for (let i = 0; i < FINAL_FOUR_PAIRINGS.length; i++) {
    const [regionA, regionB] = FINAL_FOUR_PAIRINGS[i];
    const gameNum = i + 1;
    matchups.push({
      gameId: `F4-${gameNum}`,
      round: "F4",
      region: undefined,
      teamASource: `E8-${regionA}`,
      teamBSource: `E8-${regionB}`,
    });
  }

  // --- National Championship Game ---
  matchups.push({
    gameId: "NCG",
    round: "NCG",
    region: undefined,
    teamASource: "F4-1",
    teamBSource: "F4-2",
  });

  return matchups;
}

// ---------------------------------------------------------------------------
// Bracket slot builder
// ---------------------------------------------------------------------------

/**
 * Maps 64 TeamSeason records to bracket slots keyed by slot ID.
 *
 * Each team must have a tournamentEntry with a seed and region. The slot ID
 * format is "{Region}-{Seed}" (e.g., "East-1", "West-12"). This function
 * validates that exactly 64 teams are provided, each has a tournament entry,
 * and the bracket is complete (exactly 16 teams per region, one per seed).
 *
 * @param teamSeasons - Array of exactly 64 TeamSeason records, each with a tournamentEntry
 * @returns A Map keyed by slot ID (e.g., "East-1") to BracketSlot
 * @throws {Error} If any team is missing a tournamentEntry, or the bracket
 *   is not complete (not exactly 64 teams, not 16 per region, duplicate seed/region)
 */
export function buildBracketSlots(
  teamSeasons: TeamSeason[]
): Map<string, BracketSlot> {
  if (teamSeasons.length !== 64) {
    throw new Error(
      `Expected exactly 64 teams, received ${teamSeasons.length}`
    );
  }

  const slots = new Map<string, BracketSlot>();
  const regionCounts: Record<string, number> = {};

  for (const ts of teamSeasons) {
    if (!ts.tournamentEntry) {
      throw new Error(
        `Team "${ts.team.name}" (${ts.teamId}) is missing a tournamentEntry`
      );
    }

    const { seed, region } = ts.tournamentEntry;
    const slotId = `${region}-${seed}`;

    if (slots.has(slotId)) {
      throw new Error(
        `Duplicate slot "${slotId}": team "${ts.team.name}" conflicts with an existing entry`
      );
    }

    slots.set(slotId, {
      teamId: ts.teamId,
      seed,
      region,
    });

    regionCounts[region] = (regionCounts[region] ?? 0) + 1;
  }

  // Validate 16 teams per region
  for (const region of REGIONS) {
    const count = regionCounts[region] ?? 0;
    if (count !== 16) {
      throw new Error(`Region "${region}" has ${count} teams, expected 16`);
    }
  }

  return slots;
}

/**
 * Returns the ordered list of tournament rounds from earliest to latest.
 *
 * @returns Array of TournamentRound values in chronological order
 */
export function getRoundOrder(): TournamentRound[] {
  return ["R64", "R32", "S16", "E8", "F4", "NCG"];
}

/**
 * Returns the zero-indexed round number for a given tournament round.
 * R64 = 0, R32 = 1, S16 = 2, E8 = 3, F4 = 4, NCG = 5.
 *
 * @param round - The tournament round
 * @returns The zero-indexed round number
 */
export function getRoundIndex(round: TournamentRound): number {
  return ROUND_ORDER[round];
}
