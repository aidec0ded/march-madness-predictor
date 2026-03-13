/**
 * Shared bracket resolution utilities.
 *
 * Extracts `resolveSlotTeam()` and `resolveMatchupTeams()` from
 * RegionBracket.tsx so they can be reused by the useMatchupAnalysis
 * hook and any other consumer that needs to resolve bracket matchup teams.
 *
 * Also provides `processTournamentField()` for splitting 68-team
 * tournament fields into main bracket teams + play-in configuration.
 *
 * All functions are pure (no side effects).
 */

import type { TeamSeason } from "@/types/team";
import type { BracketMatchup, PlayInConfig } from "@/types/simulation";
import { detectPlayInPairs } from "@/lib/engine/bracket";
import { parseGameId } from "@/lib/bracket-layout";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Play-in field processing
// ---------------------------------------------------------------------------

/**
 * Processes a tournament field (64 or 68 teams) into bracket-ready data.
 *
 * If the field has play-in pairs (any region-seed slot with 2 teams),
 * returns all teams and a PlayInConfig describing the play-in matchups.
 * If the field has exactly one team per slot (64 teams), returns null
 * playInConfig for backward compatibility.
 *
 * @param teams - All tournament teams (64 or 68)
 * @returns Object with all teams and optional play-in config
 */
export function processTournamentField(teams: TeamSeason[]): {
  teams: TeamSeason[];
  playInConfig: PlayInConfig | null;
} {
  const playInConfig = detectPlayInPairs(teams);
  return { teams, playInConfig };
}

// ---------------------------------------------------------------------------
// Play-in deduplication (backward compatible — used by backtest module)
// ---------------------------------------------------------------------------

/**
 * Filters a list of tournament teams to exactly 64 main bracket entries.
 *
 * The NCAA tournament has 68 teams: 64 in the main bracket plus 4 First Four
 * play-in games (2 between 16-seeds, 2 between 11-seeds). Seeds 11 and 16
 * may have 2 entries sharing the same region+seed in the database.
 *
 * This function deduplicates by `{region}-{seed}`, keeping the higher-rated
 * team when a play-in pair exists (using KenPom adjEM, falling back to
 * Torvik, then Evan Miya).
 *
 * @param teams - All tournament teams (may include 68 with play-in duplicates)
 * @returns Exactly one team per bracket slot (up to 64)
 */
export function filterToMainBracket(teams: TeamSeason[]): TeamSeason[] {
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

  const result: TeamSeason[] = [];
  for (const [slot, slotTeams] of slotMap) {
    if (slotTeams.length === 1) {
      result.push(slotTeams[0]);
    } else {
      // Play-in pair: pick the higher-rated team
      slotTeams.sort((a, b) => getTeamRating(b) - getTeamRating(a));
      result.push(slotTeams[0]);
      logger.info(
        `Play-in slot ${slot}: keeping ${slotTeams[0].team.shortName} ` +
        `(rating ${getTeamRating(slotTeams[0]).toFixed(1)}) over ` +
        `${slotTeams.slice(1).map(t => t.team.shortName).join(", ")}`
      );
    }
  }

  return result;
}

/**
 * Gets a team's composite efficiency rating for comparison.
 * Prefers KenPom adjEM, falls back to Torvik, then Evan Miya, then 0.
 */
function getTeamRating(team: TeamSeason): number {
  return (
    team.ratings.kenpom?.adjEM ??
    team.ratings.torvik?.adjEM ??
    team.ratings.evanmiya?.adjEM ??
    0
  );
}

// ---------------------------------------------------------------------------
// Slot resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a bracket slot ID to a TeamSeason.
 *
 * Handles two slot ID formats:
 * - Standard slots: "{Region}-{Seed}" (e.g., "East-1", "West-16")
 * - FF play-in slots: "FF-{Region}-{Seed}-{A|B}" (e.g., "FF-East-16-A")
 *
 * For standard slots, iterates the teams map looking for a team whose
 * tournamentEntry produces a matching slot ID.
 *
 * For FF slots, uses the play-in config to find the correct team by
 * matching region, seed, and position within the play-in pair.
 *
 * @param slotId - Slot identifier
 * @param teams - All tournament teams keyed by teamId
 * @param playInConfig - Optional play-in configuration for resolving FF slots
 * @returns The matching TeamSeason, or null if not found
 */
export function resolveSlotTeam(
  slotId: string,
  teams: Map<string, TeamSeason>,
  playInConfig?: PlayInConfig | null
): TeamSeason | null {
  // FF slot: "FF-East-16-A" → find the play-in team
  if (slotId.startsWith("FF-") && playInConfig) {
    const parts = slotId.split("-");
    // FF-{Region}-{Seed}-{Position} → parts = ["FF", region, seed, position]
    if (parts.length === 4) {
      const region = parts[1];
      const seed = parseInt(parts[2], 10);
      const position = parts[3]; // "A" or "B"

      // Find the play-in matchup for this region and seed
      const pi = playInConfig.matchups.find(
        (m) => m.region === region && m.seed === seed
      );
      if (pi) {
        const teamId = position === "A" ? pi.teamAId : pi.teamBId;
        return teams.get(teamId) ?? null;
      }
    }
    return null;
  }

  // Standard slot: "{Region}-{Seed}"
  for (const team of teams.values()) {
    if (!team.tournamentEntry) continue;
    const teamSlot = `${team.tournamentEntry.region}-${team.tournamentEntry.seed}`;
    if (teamSlot === slotId) return team;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Game ID detection
// ---------------------------------------------------------------------------

/**
 * Check if a source string is a game ID (starts with round prefix) vs a slot ID.
 * Exported for use by BracketProvider and other consumers.
 */
export function isGameId(source: string): boolean {
  return (
    source.startsWith("FF-") ||
    source.startsWith("R64-") ||
    source.startsWith("R32-") ||
    source.startsWith("S16-") ||
    source.startsWith("E8-") ||
    source.startsWith("F4-") ||
    source === "NCG"
  );
}

// ---------------------------------------------------------------------------
// Matchup team resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the two teams in a bracket matchup.
 *
 * - FF games: looks up from FF slot IDs (e.g., "FF-East-16-A")
 * - R64 games: looks up from slot IDs (e.g., "East-1") or from picks
 *   if the slot is fed by a First Four game (e.g., "FF-East-16")
 * - Later rounds: looks up the winner of the feeder game from the picks map
 *
 * @param matchup - The bracket matchup definition
 * @param teams - All tournament teams keyed by teamId
 * @param picks - User picks: gameId -> winning teamId
 * @param playInConfig - Optional play-in configuration for resolving FF slots
 * @returns An object with teamA and teamB (either may be null if not yet decided)
 */
export function resolveMatchupTeams(
  matchup: BracketMatchup,
  teams: Map<string, TeamSeason>,
  picks: Record<string, string>,
  playInConfig?: PlayInConfig | null
): { teamA: TeamSeason | null; teamB: TeamSeason | null } {
  const parsed = parseGameId(matchup.gameId);

  if (parsed.round === "FF") {
    // FF sources are FF slot IDs like "FF-East-16-A"
    return {
      teamA: resolveSlotTeam(matchup.teamASource, teams, playInConfig),
      teamB: resolveSlotTeam(matchup.teamBSource, teams, playInConfig),
    };
  }

  if (parsed.round === "R64") {
    // R64 sources may be slot IDs ("East-1") or FF gameIds ("FF-East-16")
    const resolveSource = (source: string): TeamSeason | null => {
      if (isGameId(source)) {
        // This slot is fed by a First Four game — resolve from picks
        const winnerId = picks[source];
        return winnerId ? teams.get(winnerId) ?? null : null;
      }
      return resolveSlotTeam(source, teams, playInConfig);
    };

    return {
      teamA: resolveSource(matchup.teamASource),
      teamB: resolveSource(matchup.teamBSource),
    };
  }

  // Later rounds: sources are gameIds of feeder games
  const winnerAId = picks[matchup.teamASource];
  const winnerBId = picks[matchup.teamBSource];

  return {
    teamA: winnerAId ? teams.get(winnerAId) ?? null : null,
    teamB: winnerBId ? teams.get(winnerBId) ?? null : null,
  };
}
