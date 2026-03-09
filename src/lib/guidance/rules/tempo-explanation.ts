/**
 * Tempo Explanation Rule
 *
 * Provides a contextual note when slow-paced teams (< 64 possessions per game)
 * are involved in upset picks. Slower pace compresses the outcome distribution,
 * meaning fewer possessions for the better team to assert dominance, which
 * mechanically increases the probability of an upset.
 */

import type { GuidanceMessage, GuidanceContext } from "@/types/guidance";
import { parseGameId } from "@/lib/bracket-layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tempo threshold below which a team is considered "slow" */
const SLOW_TEMPO_THRESHOLD = 64;

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function tempoExplanationRule(
  context: GuidanceContext
): GuidanceMessage[] {
  const { picks, teams } = context;
  const messages: GuidanceMessage[] = [];
  const flaggedGames = new Set<string>();

  for (const [gameId, winnerId] of Object.entries(picks)) {
    if (flaggedGames.has(gameId)) continue;

    let parsed: ReturnType<typeof parseGameId>;
    try {
      parsed = parseGameId(gameId);
    } catch {
      continue;
    }

    // Only flag for R64 upsets where tempo matters most
    if (parsed.round !== "R64") continue;

    const winner = teams.get(winnerId);
    if (!winner?.tournamentEntry) continue;

    const winnerSeed = winner.tournamentEntry.seed;
    const opponentSeed = 17 - winnerSeed;

    // Only relevant for upsets (higher seed number wins)
    if (winnerSeed <= opponentSeed) continue;

    // Check if either team is slow-paced
    const winnerTempo = winner.adjTempo;

    // Find the opponent (the higher-seeded team that lost)
    // They should be in the same region with complementary seed
    let opponentTempo: number | null = null;
    let opponentName: string | null = null;

    for (const team of teams.values()) {
      if (
        team.tournamentEntry &&
        team.tournamentEntry.region === winner.tournamentEntry.region &&
        team.tournamentEntry.seed === opponentSeed
      ) {
        opponentTempo = team.adjTempo;
        opponentName = team.team.shortName;
        break;
      }
    }

    const slowTeams: string[] = [];
    if (winnerTempo < SLOW_TEMPO_THRESHOLD) {
      slowTeams.push(winner.team.shortName);
    }
    if (opponentTempo !== null && opponentTempo < SLOW_TEMPO_THRESHOLD) {
      slowTeams.push(opponentName ?? "opponent");
    }

    if (slowTeams.length === 0) continue;

    flaggedGames.add(gameId);

    const bothSlow = slowTeams.length === 2;

    messages.push({
      id: `tempo-explanation-${gameId}`,
      title: `Slow pace factor in ${winner.team.shortName} upset`,
      description: bothSlow
        ? `Both ${slowTeams[0]} and ${slowTeams[1]} play at a slow pace ` +
          `(< ${SLOW_TEMPO_THRESHOLD} possessions/game). Fewer possessions per game ` +
          `reduces the sample size for the better team to assert dominance, ` +
          `compressing the outcome distribution and making this upset more ` +
          `plausible than the raw ratings might suggest.`
        : `${slowTeams[0]} plays at a slow pace (< ${SLOW_TEMPO_THRESHOLD} ` +
          `possessions/game). This compresses the outcome distribution — fewer ` +
          `possessions means fewer chances for the favorite to pull away, ` +
          `which mechanically boosts the underdog's upset probability.`,
      severity: "info",
      category: "tempo_explanation",
      gameId,
      teamIds: [winnerId],
    });
  }

  return messages;
}
