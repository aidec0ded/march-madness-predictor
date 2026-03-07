/**
 * Win Probability Model
 *
 * Implements a log5-style logistic model for computing pairwise win probabilities
 * from adjusted efficiency margin differentials. This is the core probability
 * primitive that the full engine and Monte Carlo simulator build upon.
 *
 * The logistic model maps a continuous rating differential (in efficiency points
 * per 100 possessions) to a probability between 0 and 1:
 *
 *   P(A wins) = 1 / (1 + exp(-k * ratingDiff))
 *
 * where:
 *   - ratingDiff = compositeAdjEM(A) - compositeAdjEM(B)
 *   - k is a scaling factor calibrated from historical tournament data (default 0.0325)
 *
 * Properties of this model:
 *   - When ratingDiff = 0, P(A) = 0.5 (perfectly even matchup)
 *   - The function is symmetric: P(A | diff=d) + P(A | diff=-d) = 1
 *   - Larger |k| makes the curve steeper (more deterministic outcomes)
 *   - Smaller |k| makes the curve flatter (more upsets)
 *
 * @module win-probability
 */

import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Average possessions per team in a typical D-1 college basketball game.
 * Used to convert efficiency margin differential to approximate point spread.
 *
 * Historical average hovers around 67-69; we use 68 as a round estimate.
 */
const AVG_POSSESSIONS = 68;

/**
 * Minimum clamped probability. No team has a true 0% chance of winning
 * any single game -- upsets can always happen.
 */
const MIN_PROBABILITY = 0.001;

/**
 * Maximum clamped probability. No team has a true 100% chance of winning
 * any single game -- even the biggest favorites can lose.
 */
const MAX_PROBABILITY = 0.999;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Computes the win probability for team A given the rating differential
 * between team A and team B using a logistic (log5-style) model.
 *
 * The formula is:
 *
 *   P(A) = 1 / (1 + exp(-k * ratingDiff))
 *
 * where ratingDiff = adjEM(A) - adjEM(B) and k is the logistic scaling factor.
 *
 * The result is clamped to [0.001, 0.999] to prevent degenerate probabilities.
 *
 * @param ratingDiff - The adjusted efficiency margin differential (team A - team B)
 *                     in points per 100 possessions. Positive means A is stronger.
 * @param k - The logistic scaling factor. Controls curve steepness.
 *            Default: 0.0325 (from DEFAULT_ENGINE_CONFIG.logisticK).
 *            Higher k = steeper curve = more decisive outcomes.
 *            Lower k = flatter curve = more upsets.
 * @returns The probability that team A wins, clamped to [0.001, 0.999].
 *
 * @example
 * ```ts
 * // Even matchup
 * calculateWinProbability(0); // 0.5
 *
 * // 1-seed vs 16-seed (~20 point EM diff)
 * calculateWinProbability(20); // ~0.96
 *
 * // 5-seed vs 12-seed (~5 point EM diff)
 * calculateWinProbability(5); // ~0.60
 * ```
 */
export function calculateWinProbability(
  ratingDiff: number,
  k: number = DEFAULT_ENGINE_CONFIG.logisticK
): number {
  const rawProbability = 1 / (1 + Math.exp(-k * ratingDiff));
  return clampProbability(rawProbability);
}

/**
 * Converts an efficiency margin differential to an approximate point spread.
 *
 * The conversion uses:
 *
 *   spread = ratingDiff * avgPossessions / 100
 *
 * Because efficiency ratings are per 100 possessions, we scale by the typical
 * number of possessions in a game to get an expected scoring margin.
 *
 * By convention, a negative spread means team A is favored (e.g., -6.5 means
 * "team A favored by 6.5 points"). This follows the sports betting convention
 * where the favored team has a negative line.
 *
 * @param ratingDiff - The adjusted efficiency margin differential (A - B),
 *                     in points per 100 possessions. Positive means A is stronger.
 * @param avgPossessions - Average possessions per game. Default: 68 (typical D-1 game).
 * @returns The approximate point spread. Negative if team A is favored,
 *          positive if team B is favored.
 *
 * @example
 * ```ts
 * // Team A is 10 points per 100 possessions better
 * ratingDiffToSpread(10); // -6.8 (A favored by ~7 points)
 *
 * // Even matchup
 * ratingDiffToSpread(0); // 0 (pick 'em)
 *
 * // Team B is better (negative ratingDiff)
 * ratingDiffToSpread(-15); // 10.2 (B favored by ~10 points)
 * ```
 */
export function ratingDiffToSpread(
  ratingDiff: number,
  avgPossessions: number = AVG_POSSESSIONS
): number {
  // Negate so that a positive ratingDiff (A stronger) yields a negative spread (A favored)
  return -(ratingDiff * avgPossessions) / 100;
}

/**
 * Clamps a probability value to the range [0.001, 0.999].
 *
 * This ensures no team is assigned a 0% or 100% win probability,
 * reflecting the inherent uncertainty in any single basketball game.
 * Even the most extreme mismatches carry a small but nonzero chance
 * of an upset.
 *
 * @param p - Raw probability value (may be outside [0, 1] due to numerical issues,
 *            or at 0/1 due to extreme differentials).
 * @returns The clamped probability in [0.001, 0.999].
 *
 * @example
 * ```ts
 * clampProbability(0.0);     // 0.001
 * clampProbability(1.0);     // 0.999
 * clampProbability(0.65);    // 0.65 (unchanged)
 * clampProbability(-0.1);    // 0.001 (guards numerical edge cases)
 * clampProbability(1.05);    // 0.999 (guards numerical edge cases)
 * ```
 */
export function clampProbability(p: number): number {
  return Math.min(MAX_PROBABILITY, Math.max(MIN_PROBABILITY, p));
}
