/**
 * Upset Volume Rule
 *
 * Counts R64 upsets (lower seed beating higher seed) in the user's picks.
 * Historical average is approximately 4 first-round upsets per tournament.
 * Warns if the count exceeds 6 and flags as danger above 8.
 */

import type { GuidanceMessage, GuidanceContext } from "@/types/guidance";
import { parseGameId } from "@/lib/bracket-layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Average number of R64 upsets historically */
const HISTORICAL_AVERAGE = 4;

/** Threshold for warning severity */
const WARNING_THRESHOLD = 6;

/** Threshold for danger severity */
const DANGER_THRESHOLD = 8;

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function upsetVolumeRule(context: GuidanceContext): GuidanceMessage[] {
  const { picks, teams } = context;
  const messages: GuidanceMessage[] = [];

  let upsetCount = 0;

  for (const [gameId, winnerId] of Object.entries(picks)) {
    let parsed: ReturnType<typeof parseGameId>;
    try {
      parsed = parseGameId(gameId);
    } catch {
      continue;
    }

    if (parsed.round !== "R64") continue;

    const winner = teams.get(winnerId);
    if (!winner?.tournamentEntry) continue;

    // Find the opponent: scan for the other team in this game
    // In R64 games the two teams are seeded complements (1v16, 2v15, etc.)
    // The "upset" is when the higher-numbered seed wins
    const winnerSeed = winner.tournamentEntry.seed;

    // An upset means the winner has a seed > 8 (they are the lower-ranked team)
    // More precisely, in standard bracket, 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
    // The higher seed (lower number) is the favorite.
    // The complement seed for a given seed s in a 1-16 matchup is 17 - s.
    const opponentSeed = 17 - winnerSeed;

    // Upset = winner's seed number is higher than opponent's seed number
    if (winnerSeed > opponentSeed) {
      upsetCount++;
    }
  }

  if (upsetCount > WARNING_THRESHOLD) {
    const severity = upsetCount >= DANGER_THRESHOLD ? "danger" : "warning";

    messages.push({
      id: `upset-volume-${upsetCount}`,
      title: `${upsetCount} first-round upsets selected`,
      description:
        `You have ${upsetCount} first-round upsets in your bracket. ` +
        `The historical average is roughly ${HISTORICAL_AVERAGE} per tournament. ` +
        `Each additional upset compounds the risk of early-round bracket damage, ` +
        `since upsets in later rounds depend on those teams surviving round one.`,
      severity,
      category: "upset_volume",
    });
  }

  return messages;
}
