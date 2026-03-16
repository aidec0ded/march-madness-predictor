/**
 * Bracket structure and matchup tree builder for the NCAA tournament.
 *
 * Supports both the standard 64-team bracket (63 games) and the full
 * 68-team bracket with First Four play-in games (67 games). The bracket
 * tree is represented as an array of BracketMatchup objects, where
 * later-round matchups reference feeder games by gameId.
 *
 * When a PlayInConfig is provided, 4 First Four games are prepended
 * to the matchup array, and the consuming R64 games reference the
 * FF gameIds instead of slot IDs. This maintains topological ordering
 * so the simulation loop processes FF games before their consumers.
 *
 * All functions are pure (no side effects).
 */

import type { Region, TeamSeason, TournamentRound } from "@/types/team";
import type {
  BracketMatchup,
  BracketSlot,
  PlayInConfig,
  PlayInMatchup,
} from "@/types/simulation";

// Re-export play-in types from their canonical location in types/simulation
export type { PlayInConfig, PlayInMatchup };

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
 * Standard NCAA bracket positions for seeds within a region.
 *
 * These determine the initial R64 matchup pairings:
 * Position 1 vs 2 (seed 1 vs 16), 3 vs 4 (seed 8 vs 9), etc.
 *
 * Used by the admin tournament-entries API to auto-calculate
 * bracket_position from seed.
 */
export const SEED_TO_BRACKET_POSITION: Record<number, number> = {
  1: 1,
  16: 2,
  8: 3,
  9: 4,
  5: 5,
  12: 6,
  4: 7,
  13: 8,
  6: 9,
  11: 10,
  3: 11,
  14: 12,
  7: 13,
  10: 14,
  2: 15,
  15: 16,
};

/**
 * Standard Final Four pairing: East vs South, West vs Midwest.
 * Each tuple is [regionA, regionB] for the two semifinal games.
 */
const FINAL_FOUR_PAIRINGS: [Region, Region][] = [
  ["East", "South"],
  ["West", "Midwest"],
];

/**
 * Maps a tournament round to its index in the getRoundOrder() array.
 * Used by the aggregator to compute next-round advancement:
 * rounds[getRoundIndex(round) + 1] gives the next round.
 */
const ROUND_ORDER: Record<TournamentRound, number> = {
  FF: 0,
  R64: 1,
  R32: 2,
  S16: 3,
  E8: 4,
  F4: 5,
  NCG: 6,
};

// ---------------------------------------------------------------------------
// Play-In Detection
// ---------------------------------------------------------------------------

/**
 * Detects First Four play-in pairs from tournament team data.
 *
 * Groups teams by (region, seed) and identifies slots with 2 teams.
 * When play-in pairs exist, returns a PlayInConfig describing them.
 * If all slots have exactly 1 team (64-team field), returns null.
 *
 * @param teams - All tournament teams (64 or 68)
 * @returns PlayInConfig if play-in pairs exist, null otherwise
 */
export function detectPlayInPairs(teams: TeamSeason[]): PlayInConfig | null {
  // Group by region-seed
  const slotMap = new Map<string, TeamSeason[]>();
  for (const team of teams) {
    if (!team.tournamentEntry) continue;
    const key = `${team.tournamentEntry.region}-${team.tournamentEntry.seed}`;
    const existing = slotMap.get(key);
    if (existing) {
      existing.push(team);
    } else {
      slotMap.set(key, [team]);
    }
  }

  const matchups: PlayInMatchup[] = [];
  for (const [_key, slotTeams] of slotMap) {
    if (slotTeams.length === 2) {
      const entry = slotTeams[0].tournamentEntry!;
      matchups.push({
        region: entry.region,
        seed: entry.seed,
        teamAId: slotTeams[0].teamId,
        teamBId: slotTeams[1].teamId,
      });
    }
  }

  return matchups.length > 0 ? { matchups } : null;
}

// ---------------------------------------------------------------------------
// Bracket matchup builder
// ---------------------------------------------------------------------------

/**
 * Builds the complete matchup tree for the NCAA tournament.
 *
 * Without a PlayInConfig, returns the standard 63-game bracket (R64–NCG).
 * With a PlayInConfig, prepends First Four games and rewires the consuming
 * R64 games to reference FF gameIds, returning a 67-game bracket.
 *
 * Game ID formats:
 * - FF:  "FF-{Region}-{Seed}" (e.g., "FF-East-16")
 * - R64: "R64-{Region}-{GameNum}" (e.g., "R64-East-1")
 * - R32: "R32-{Region}-{GameNum}"
 * - S16: "S16-{Region}-{GameNum}"
 * - E8:  "E8-{Region}"
 * - F4:  "F4-{GameNum}"
 * - NCG: "NCG"
 *
 * @param playInConfig - Optional play-in configuration for First Four games
 * @returns Array of BracketMatchup objects in topological order (FF before R64 before R32 ...)
 */
export function buildBracketMatchups(
  playInConfig?: PlayInConfig | null
): BracketMatchup[] {
  const matchups: BracketMatchup[] = [];

  // Track which (region, seed) slots are fed by First Four games
  const playInSlots = new Set<string>();
  if (playInConfig) {
    for (const pi of playInConfig.matchups) {
      const ffGameId = `FF-${pi.region}-${pi.seed}`;
      matchups.push({
        gameId: ffGameId,
        round: "FF",
        region: pi.region,
        teamASource: `FF-${pi.region}-${pi.seed}-A`,
        teamBSource: `FF-${pi.region}-${pi.seed}-B`,
      });
      playInSlots.add(`${pi.region}-${pi.seed}`);
    }
  }

  // --- Round of 64 ---
  for (const region of REGIONS) {
    for (let i = 0; i < BRACKET_SEED_MATCHUPS.length; i++) {
      const [seedA, seedB] = BRACKET_SEED_MATCHUPS[i];
      const gameNum = i + 1;

      // If a seed has a play-in game, reference the FF gameId instead of the slot
      const slotA = `${region}-${seedA}`;
      const slotB = `${region}-${seedB}`;

      matchups.push({
        gameId: `R64-${region}-${gameNum}`,
        round: "R64",
        region,
        teamASource: playInSlots.has(slotA) ? `FF-${region}-${seedA}` : slotA,
        teamBSource: playInSlots.has(slotB) ? `FF-${region}-${seedB}` : slotB,
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
 * Maps TeamSeason records to bracket slots keyed by slot ID.
 *
 * Without a PlayInConfig, expects exactly 64 teams with one per (region, seed).
 * With a PlayInConfig, expects 68 teams — play-in teams are mapped to special
 * FF slot IDs (e.g., "FF-East-16-A", "FF-East-16-B") so both can coexist.
 *
 * @param teamSeasons - Array of TeamSeason records (64 or 68), each with a tournamentEntry
 * @param playInConfig - Optional play-in configuration
 * @returns A Map keyed by slot ID to BracketSlot
 * @throws {Error} If teams don't match expected count or structure
 */
export function buildBracketSlots(
  teamSeasons: TeamSeason[],
  playInConfig?: PlayInConfig | null
): Map<string, BracketSlot> {
  const expectedCount = playInConfig ? 68 : 64;
  if (teamSeasons.length !== expectedCount) {
    throw new Error(
      `Expected exactly ${expectedCount} teams, received ${teamSeasons.length}`
    );
  }

  // Build a set of play-in slot keys and a map to team assignments
  const playInSlotSet = new Set<string>();
  const playInTeamMap = new Map<string, { teamAId: string; teamBId: string }>();
  if (playInConfig) {
    for (const pi of playInConfig.matchups) {
      const key = `${pi.region}-${pi.seed}`;
      playInSlotSet.add(key);
      playInTeamMap.set(key, { teamAId: pi.teamAId, teamBId: pi.teamBId });
    }
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
    const slotKey = `${region}-${seed}`;

    if (playInSlotSet.has(slotKey)) {
      // Play-in team: assign to FF-Region-Seed-A or FF-Region-Seed-B
      const pair = playInTeamMap.get(slotKey)!;
      const position = pair.teamAId === ts.teamId ? "A" : "B";
      const ffSlotId = `FF-${region}-${seed}-${position}`;

      if (slots.has(ffSlotId)) {
        throw new Error(
          `Duplicate FF slot "${ffSlotId}": team "${ts.team.name}" conflicts with an existing entry`
        );
      }

      slots.set(ffSlotId, {
        teamId: ts.teamId,
        seed,
        region,
      });
    } else {
      // Normal slot
      const slotId = slotKey;
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
    }

    regionCounts[region] = (regionCounts[region] ?? 0) + 1;
  }

  // Validate teams per region (16 without play-ins, up to 18 with)
  const expectedPerRegion = playInConfig ? undefined : 16;
  if (expectedPerRegion) {
    for (const regionName of REGIONS) {
      const count = regionCounts[regionName] ?? 0;
      if (count !== expectedPerRegion) {
        throw new Error(
          `Region "${regionName}" has ${count} teams, expected ${expectedPerRegion}`
        );
      }
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Round ordering utilities
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of tournament rounds from earliest to latest.
 *
 * @returns Array of TournamentRound values in chronological order
 */
export function getRoundOrder(): TournamentRound[] {
  return ["FF", "R64", "R32", "S16", "E8", "F4", "NCG"];
}

/**
 * Returns the array index of a round in getRoundOrder().
 * FF = 0, R64 = 1, R32 = 2, S16 = 3, E8 = 4, F4 = 5, NCG = 6.
 *
 * @param round - The tournament round
 * @returns The round index in the getRoundOrder() array
 */
export function getRoundIndex(round: TournamentRound): number {
  return ROUND_ORDER[round];
}
