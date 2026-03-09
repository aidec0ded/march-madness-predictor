/**
 * Variance Mismatch Rule
 *
 * Flags teams with a high three-point attempt rate that are picked to
 * advance deep into the tournament (Sweet 16 or later). High 3PT reliance
 * introduces boom/bust variance — great for single-game upsets but fragile
 * over multiple rounds.
 */

import type { GuidanceMessage, GuidanceContext } from "@/types/guidance";
import { parseGameId } from "@/lib/bracket-layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Three-point rate threshold (3PA/FGA) above which a team is flagged */
const HIGH_THREE_PT_RATE = 0.38;

/** Rounds considered "deep" for this rule */
const DEEP_ROUNDS = new Set(["S16", "E8", "F4", "NCG"]);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function varianceMismatchRule(
  context: GuidanceContext
): GuidanceMessage[] {
  const { picks, teams } = context;
  const messages: GuidanceMessage[] = [];

  // Track which teams we've already flagged to avoid duplicates
  const flaggedTeams = new Set<string>();

  for (const [gameId, winnerId] of Object.entries(picks)) {
    let parsed: ReturnType<typeof parseGameId>;
    try {
      parsed = parseGameId(gameId);
    } catch {
      continue;
    }

    if (!DEEP_ROUNDS.has(parsed.round)) continue;
    if (flaggedTeams.has(winnerId)) continue;

    const team = teams.get(winnerId);
    if (!team) continue;

    const threePtRate = team.shootingOffense.threePtRate;

    if (threePtRate >= HIGH_THREE_PT_RATE) {
      flaggedTeams.add(winnerId);

      const pct = Math.round(threePtRate * 100);
      const roundLabel = roundDisplayName(parsed.round);

      messages.push({
        id: `variance-mismatch-${winnerId}`,
        title: `${team.team.shortName}: high 3PT reliance in ${roundLabel}`,
        description:
          `${team.team.shortName} has a three-point attempt rate of ${pct}%, ` +
          `which is above the ${Math.round(HIGH_THREE_PT_RATE * 100)}% threshold. ` +
          `Teams heavily reliant on three-point shooting have wider outcome ` +
          `distributions — they can beat anyone on a hot night but are also ` +
          `more likely to go cold. This volatility compounds over multiple rounds, ` +
          `making deep runs fragile.`,
        severity: "warning",
        category: "variance_mismatch",
        gameId,
        teamIds: [winnerId],
      });
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundDisplayName(round: string): string {
  switch (round) {
    case "S16":
      return "the Sweet 16";
    case "E8":
      return "the Elite 8";
    case "F4":
      return "the Final Four";
    case "NCG":
      return "the Championship";
    default:
      return round;
  }
}
