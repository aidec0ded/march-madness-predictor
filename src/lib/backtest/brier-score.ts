/**
 * Brier Score calculator for the backtesting module.
 *
 * Brier Score measures the accuracy of probabilistic predictions.
 * For a single prediction: BS = (predicted_probability - actual_outcome)²
 *
 * A perfect prediction scores 0.0, the worst possible prediction scores 1.0,
 * and a coin-flip prediction (0.5) scores 0.25.
 *
 * Lower Brier Scores indicate better-calibrated probability estimates.
 */

import type { BrierGameScore, BrierScoreResult } from "@/types/backtest";
import type { TournamentRound } from "@/types/team";

// All tournament rounds in order
const ALL_ROUNDS: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

/**
 * Parameters for creating a single-game Brier Score.
 */
export interface CreateBrierGameScoreParams {
  /** Season year */
  season: number;
  /** Tournament round */
  round: TournamentRound;
  /** Team A name */
  teamAName: string;
  /** Team A seed */
  teamASeed: number;
  /** Team B name */
  teamBName: string;
  /** Team B seed */
  teamBSeed: number;
  /** Predicted probability that Team A wins (0–1) */
  predictedProbA: number;
  /** Whether Team A won */
  teamAWon: boolean;
  /** Whether this prediction used the seed baseline fallback */
  usedBaseline: boolean;
}

/**
 * Creates a BrierGameScore for a single game.
 *
 * The Brier Score is computed as: (predictedProbA - actualOutcome)²
 * where actualOutcome is 1 if Team A won, 0 if Team B won.
 *
 * @param params - Game parameters including prediction and outcome
 * @returns A BrierGameScore object with the computed score
 * @throws Error if predictedProbA is outside the [0, 1] range
 */
export function createBrierGameScore(
  params: CreateBrierGameScoreParams
): BrierGameScore {
  const {
    season,
    round,
    teamAName,
    teamASeed,
    teamBName,
    teamBSeed,
    predictedProbA,
    teamAWon,
    usedBaseline,
  } = params;

  if (predictedProbA < 0 || predictedProbA > 1) {
    throw new Error(
      `predictedProbA must be between 0 and 1, got ${predictedProbA}`
    );
  }

  const actualOutcome = teamAWon ? 1 : 0;
  const brierScore = (predictedProbA - actualOutcome) ** 2;

  return {
    season,
    round,
    teamAName,
    teamASeed,
    teamBName,
    teamBSeed,
    predictedProbA,
    actualOutcome,
    brierScore,
    usedBaseline,
  };
}

/**
 * Calculates aggregated Brier Score results from an array of game scores.
 *
 * Returns the overall average Brier Score, per-round breakdowns, and the
 * original game scores. For an empty input array, returns overallBrier = 0
 * and gameCount = 0 with zeroed-out round entries.
 *
 * @param gameScores - Array of individual game Brier Scores
 * @returns Aggregated Brier Score result with per-round breakdown
 */
export function calculateBrierScore(
  gameScores: BrierGameScore[]
): BrierScoreResult {
  // Initialize per-round accumulators
  const byRound = {} as Record<
    TournamentRound,
    { brier: number; count: number }
  >;
  for (const round of ALL_ROUNDS) {
    byRound[round] = { brier: 0, count: 0 };
  }

  if (gameScores.length === 0) {
    return {
      overallBrier: 0,
      gameCount: 0,
      byRound,
      gameScores,
    };
  }

  // Accumulate per-round totals
  let totalBrier = 0;
  for (const game of gameScores) {
    totalBrier += game.brierScore;
    const roundEntry = byRound[game.round];
    roundEntry.brier += game.brierScore;
    roundEntry.count += 1;
  }

  // Compute per-round averages
  for (const round of ALL_ROUNDS) {
    const entry = byRound[round];
    if (entry.count > 0) {
      entry.brier = entry.brier / entry.count;
    }
  }

  return {
    overallBrier: totalBrier / gameScores.length,
    gameCount: gameScores.length,
    byRound,
    gameScores,
  };
}
