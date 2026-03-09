/**
 * Chalk Concentration Rule
 *
 * Measures the percentage of picks that match the higher seed (chalk).
 * A bracket with >80% chalk picks is flagged as heavily correlated with
 * the consensus, which limits differentiation in large contest pools.
 */

import type { GuidanceMessage, GuidanceContext } from "@/types/guidance";
import { parseGameId } from "@/lib/bracket-layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Percentage threshold for warning (0–1 scale) */
const WARNING_THRESHOLD = 0.8;

/** Percentage threshold for danger (0–1 scale) */
const DANGER_THRESHOLD = 0.9;

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function chalkConcentrationRule(
  context: GuidanceContext
): GuidanceMessage[] {
  const { picks, teams } = context;
  const messages: GuidanceMessage[] = [];

  let totalPicks = 0;
  let chalkPicks = 0;

  for (const [gameId, winnerId] of Object.entries(picks)) {
    let parsed: ReturnType<typeof parseGameId>;
    try {
      parsed = parseGameId(gameId);
    } catch {
      continue;
    }

    // Only count games within regions (R64 through E8) where seed comparison is clear
    if (!parsed.region) continue;

    const winner = teams.get(winnerId);
    if (!winner?.tournamentEntry) continue;

    totalPicks++;

    // To know if this is chalk, we need to know both teams.
    // We can infer: in any bracket game, if the winner has a lower seed number,
    // they are the higher-seeded (favored) team. But in later rounds we don't
    // always know the expected opponent. A simpler heuristic: for each pick,
    // scan all other teams that could appear in this game from earlier picks.
    //
    // Simplified approach: for any matchup, if we look at the winning team's seed,
    // we consider it "chalk" if the winner is the lower seed among the two
    // teams that could have played. We need to look at both potential teams.
    //
    // For R64, seeds are known (complement = 17 - seed).
    // For later rounds, we need to identify who was picked in the feeder games.
    // Let's use a pragmatic heuristic: check which team has the lower seed number
    // among the two teams that were available (if both are known from picks or structure).

    // For R64: chalk = winner seed <= 8 (they are the higher-seeded team)
    if (parsed.round === "R64") {
      const winnerSeed = winner.tournamentEntry.seed;
      const opponentSeed = 17 - winnerSeed;
      if (winnerSeed <= opponentSeed) {
        chalkPicks++;
      }
      continue;
    }

    // For later rounds, determine if the winner has the better seed.
    // Find the game's feeder picks to identify both potential teams.
    // We build this by looking at what teams could be in this spot.
    // If the feeder game has a pick, that's one team. The winner of this game
    // is the other. If the winner has a lower seed number, it's chalk.
    const winnerSeed = winner.tournamentEntry.seed;

    // Look for the "opponent" — the team the winner beat.
    // For any game beyond R64, both teams come from prior-round picks.
    // We need to infer who the other team was. Check all teams in the same
    // region with picks that could route to this game.
    //
    // Simplified: just check if winner has the lower seed in the matchup.
    // We can find the opponent by checking all teams with picks in prior games
    // that feed into this one. But that's complex.
    //
    // Most practical approach: assume chalk if winnerSeed <= 4 in S16+, <= 2 in E8+.
    // But that's too coarse.
    //
    // Better: for non-R64 games, find the "other" team by scanning picks.
    // Actually, we can check by round/region/gameNum convention to find feeder games.

    // Use a simpler heuristic: mark as chalk if the seed is in the top half
    // of seeds that would typically reach this round.
    // R32: seeds 1-8 expected, chalk if seed <= 8 (essentially always chalk)
    // S16: seeds 1-4 expected, chalk if seed <= 4
    // E8: seeds 1-2 expected, chalk if seed <= 2

    // Even better: find the opponent from picks in the feeder game.
    // For R32-Region-N, the feeders are R64-Region-(2N-1) and R64-Region-(2N).
    // For S16-Region-N, the feeders are R32-Region-(2N-1) and R32-Region-(2N).
    // For E8-Region, the feeders are S16-Region-1 and S16-Region-2.

    const opponentId = findOpponentFromPicks(
      gameId,
      winnerId,
      parsed,
      picks
    );

    if (opponentId) {
      const opponent = teams.get(opponentId);
      if (opponent?.tournamentEntry) {
        if (winnerSeed <= opponent.tournamentEntry.seed) {
          chalkPicks++;
        }
      }
    } else {
      // If we can't determine the opponent, assume chalk if winner
      // has a seed that would typically reach this round.
      chalkPicks++;
    }
  }

  if (totalPicks < 4) return messages; // Not enough picks to evaluate

  const chalkRate = chalkPicks / totalPicks;

  if (chalkRate >= WARNING_THRESHOLD) {
    const pct = Math.round(chalkRate * 100);
    const severity = chalkRate >= DANGER_THRESHOLD ? "danger" : "warning";

    messages.push({
      id: `chalk-concentration-${pct}`,
      title: `${pct}% chalk bracket`,
      description:
        `${pct}% of your picks match the higher seed. ` +
        `A heavily chalky bracket is likely to be duplicated by many other ` +
        `entries in your contest pool, limiting your ceiling even if the ` +
        `picks are individually sound. Consider 1-2 strategic upsets ` +
        `in spots where the data supports a competitive underdog.`,
      severity,
      category: "chalk_concentration",
    });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to find the opponent teamId in a matchup by tracing feeder games.
 * Returns undefined if the opponent cannot be determined.
 */
function findOpponentFromPicks(
  gameId: string,
  winnerId: string,
  parsed: ReturnType<typeof parseGameId>,
  picks: Record<string, string>
): string | undefined {
  const { round, region, gameNum } = parsed;

  if (!region) return undefined;

  let feederA: string | undefined;
  let feederB: string | undefined;

  if (round === "R32" && gameNum !== undefined) {
    feederA = `R64-${region}-${2 * gameNum - 1}`;
    feederB = `R64-${region}-${2 * gameNum}`;
  } else if (round === "S16" && gameNum !== undefined) {
    feederA = `R32-${region}-${2 * gameNum - 1}`;
    feederB = `R32-${region}-${2 * gameNum}`;
  } else if (round === "E8") {
    feederA = `S16-${region}-1`;
    feederB = `S16-${region}-2`;
  }

  if (!feederA || !feederB) return undefined;

  const teamFromA = picks[feederA];
  const teamFromB = picks[feederB];

  if (teamFromA && teamFromA !== winnerId) return teamFromA;
  if (teamFromB && teamFromB !== winnerId) return teamFromB;

  return undefined;
}
