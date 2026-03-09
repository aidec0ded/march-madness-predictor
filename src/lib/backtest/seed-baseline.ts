/**
 * Seed Baseline Probability Model
 *
 * Provides a naive win probability estimate based solely on team seeds.
 * This serves as the comparison baseline for the model's Brier Score
 * in the backtesting module — any useful model should outperform this.
 *
 * Strategy:
 * - Round of 64: use historical seed-matchup win rates (1985–2024 data)
 * - Later rounds (R32+): use a logistic model based on seed differential
 */

import type { TournamentRound } from "@/types/team";
import { SEED_MATCHUP_WIN_RATES } from "@/types/backtest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Logistic steepness parameter for later-round seed differential model.
 * Calibrated to approximate historical later-round outcomes where the
 * standard R64 matchup lookup doesn't apply (seeds don't follow the
 * expected bracket pairings after the first round).
 */
const LOGISTIC_K = 0.15;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the probability that the team with `seedA` beats the team with
 * `seedB` in the given tournament round.
 *
 * @param seedA - Seed of the first team (1–16)
 * @param seedB - Seed of the second team (1–16)
 * @param round - Tournament round identifier
 * @returns Win probability for seedA (0–1)
 */
export function getSeedBaselineProbability(
  seedA: number,
  seedB: number,
  round: TournamentRound
): number {
  // Equal seeds are a coin flip in any round
  if (seedA === seedB) {
    return 0.5;
  }

  if (round === "R64") {
    return getR64Probability(seedA, seedB);
  }

  return getLaterRoundProbability(seedA, seedB);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Round of 64 probability using historical win rates.
 * Keys in SEED_MATCHUP_WIN_RATES are formatted as "higherSeed-lowerSeed"
 * (lower number first), so we normalize the lookup accordingly.
 */
function getR64Probability(seedA: number, seedB: number): number {
  const higherSeed = Math.min(seedA, seedB);
  const lowerSeed = Math.max(seedA, seedB);
  const key = `${higherSeed}-${lowerSeed}`;

  const winRate = SEED_MATCHUP_WIN_RATES[key];

  if (winRate === undefined) {
    // Fallback to logistic model if the matchup isn't in the lookup table
    // (e.g., non-standard R64 matchup due to play-in games)
    return getLaterRoundProbability(seedA, seedB);
  }

  // winRate is the probability that the higher seed (lower number) wins.
  // If seedA is the higher seed, return winRate directly.
  // If seedA is the lower seed (higher number), return 1 - winRate.
  return seedA === higherSeed ? winRate : 1 - winRate;
}

/**
 * Later-round probability using a logistic model based on seed differential.
 *
 *   P(A wins) = 1 / (1 + exp(-k * (seedB - seedA)))
 *
 * When seedB > seedA (A is the higher seed / lower number), the exponent
 * is positive, yielding P > 0.5. This correctly models the higher seed's
 * advantage.
 */
function getLaterRoundProbability(seedA: number, seedB: number): number {
  const exponent = -LOGISTIC_K * (seedB - seedA);
  return 1 / (1 + Math.exp(exponent));
}
