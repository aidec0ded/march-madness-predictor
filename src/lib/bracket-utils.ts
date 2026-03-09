/**
 * Shared bracket resolution utilities.
 *
 * Extracts `resolveSlotTeam()` and `resolveMatchupTeams()` from
 * RegionBracket.tsx so they can be reused by the useMatchupAnalysis
 * hook and any other consumer that needs to resolve bracket matchup teams.
 *
 * All functions are pure (no side effects).
 */

import type { TeamSeason } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import { parseGameId } from "@/lib/bracket-layout";

// ---------------------------------------------------------------------------
// Slot resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a bracket slot ID (e.g., "East-1") to a TeamSeason.
 *
 * Iterates the teams map looking for a team whose tournamentEntry
 * produces a matching slot ID in the form "{Region}-{Seed}".
 *
 * @param slotId - Slot identifier, e.g. "East-1", "West-16"
 * @param teams - All tournament teams keyed by teamId
 * @returns The matching TeamSeason, or null if not found
 */
export function resolveSlotTeam(
  slotId: string,
  teams: Map<string, TeamSeason>
): TeamSeason | null {
  for (const team of teams.values()) {
    if (!team.tournamentEntry) continue;
    const teamSlot = `${team.tournamentEntry.region}-${team.tournamentEntry.seed}`;
    if (teamSlot === slotId) return team;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matchup team resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the two teams in a bracket matchup.
 *
 * - R64 games: looks up from slot IDs (e.g., "East-1" -> seed 1 in East)
 * - Later rounds: looks up the winner of the feeder game from the picks map
 * - F4/NCG games: same as later rounds (feeder gameIds like "E8-East", "F4-1")
 *
 * @param matchup - The bracket matchup definition
 * @param teams - All tournament teams keyed by teamId
 * @param picks - User picks: gameId -> winning teamId
 * @returns An object with teamA and teamB (either may be null if not yet decided)
 */
export function resolveMatchupTeams(
  matchup: BracketMatchup,
  teams: Map<string, TeamSeason>,
  picks: Record<string, string>
): { teamA: TeamSeason | null; teamB: TeamSeason | null } {
  const parsed = parseGameId(matchup.gameId);

  if (parsed.round === "R64") {
    // R64 sources are slot IDs like "East-1", "East-16"
    return {
      teamA: resolveSlotTeam(matchup.teamASource, teams),
      teamB: resolveSlotTeam(matchup.teamBSource, teams),
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
