/**
 * Calibration bin builder for the backtesting module.
 *
 * Groups model predictions into probability bins and compares predicted
 * vs actual win rates. This data powers calibration plots — a perfectly
 * calibrated model would show avgPredicted ≈ actualWinRate in every bin.
 *
 * Example: if a bin contains predictions averaging 0.72 and the actual
 * win rate in that bin is 0.70, the model is well-calibrated for that
 * probability range.
 */

import type { BrierGameScore, CalibrationBin } from "@/types/backtest";

/**
 * Builds calibration bins from an array of scored game predictions.
 *
 * Predictions are grouped by their `predictedProbA` value into equally-spaced
 * bins across [0, 1]. For each bin, the average predicted probability and
 * actual win rate are computed.
 *
 * Bin boundaries follow the convention:
 *   binStart <= predictedProbA < binEnd
 * except for the last bin, which uses:
 *   binStart <= predictedProbA <= binEnd
 *
 * Empty bins are included in the output with count = 0, avgPredicted = midpoint,
 * and actualWinRate = 0.
 *
 * @param gameScores - Array of BrierGameScore objects to bin
 * @param numBins - Number of equally-spaced bins (default: 10)
 * @returns Array of CalibrationBin objects, one per bin, in ascending order
 * @throws Error if numBins is less than 1
 */
export function buildCalibrationBins(
  gameScores: BrierGameScore[],
  numBins: number = 10
): CalibrationBin[] {
  if (numBins < 1) {
    throw new Error(`numBins must be at least 1, got ${numBins}`);
  }

  const binWidth = 1 / numBins;

  // Initialize bins
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < numBins; i++) {
    const binStart = i * binWidth;
    const binEnd = (i + 1) * binWidth;
    const midpoint = (binStart + binEnd) / 2;

    bins.push({
      binStart,
      binEnd,
      midpoint,
      avgPredicted: midpoint,
      actualWinRate: 0,
      count: 0,
    });
  }

  // Assign each game score to a bin and accumulate sums
  const predSums = new Array<number>(numBins).fill(0);
  const outcomeSums = new Array<number>(numBins).fill(0);

  for (const game of gameScores) {
    const binIndex = getBinIndex(game.predictedProbA, numBins);
    bins[binIndex].count += 1;
    predSums[binIndex] += game.predictedProbA;
    outcomeSums[binIndex] += game.actualOutcome;
  }

  // Compute averages for non-empty bins
  for (let i = 0; i < numBins; i++) {
    if (bins[i].count > 0) {
      bins[i].avgPredicted = predSums[i] / bins[i].count;
      bins[i].actualWinRate = outcomeSums[i] / bins[i].count;
    }
  }

  return bins;
}

/**
 * Determines which bin index a prediction falls into.
 *
 * Multiplies by numBins and rounds to 10 decimal places before flooring
 * to avoid IEEE 754 floating-point errors at bin boundaries (e.g.,
 * 0.3 / 0.1 = 2.9999... instead of 3, or 0.8 * 10 = 7.9999... instead of 8).
 *
 * The result is clamped to [0, numBins - 1] so that a prediction of exactly
 * 1.0 falls in the last bin (inclusive upper bound).
 */
function getBinIndex(predictedProbA: number, numBins: number): number {
  // Round to 10 decimal places to eliminate floating-point noise at boundaries
  const scaled = Math.round(predictedProbA * numBins * 1e10) / 1e10;
  const index = Math.floor(scaled);
  // Clamp to [0, numBins - 1] for the inclusive upper bound on the last bin
  return Math.max(0, Math.min(index, numBins - 1));
}
