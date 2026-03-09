/**
 * Matchup distribution generator for the histogram chart.
 *
 * Runs a mini Monte Carlo simulation (1,000 samples) of a single
 * matchup to produce a histogram of margin-of-victory outcomes.
 * Uses normal noise around the adjusted spread, binned into 2-point
 * buckets from -30 to +30.
 *
 * All functions are pure (deterministic when given a seeded PRNG).
 */

import type { DistributionBin } from "@/types/matchup-view";
import { createSeededRandom } from "@/lib/engine/sampler";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of samples for the mini Monte Carlo */
const SAMPLE_COUNT = 1000;

/** Bin width in points */
const BIN_WIDTH = 2;

/** Minimum margin (left edge of histogram) */
const MIN_MARGIN = -30;

/** Maximum margin (right edge of histogram) */
const MAX_MARGIN = 30;

/** Number of bins */
const NUM_BINS = (MAX_MARGIN - MIN_MARGIN) / BIN_WIDTH;

// ---------------------------------------------------------------------------
// Box-Muller transform
// ---------------------------------------------------------------------------

/**
 * Generates a standard normal random variate using the Box-Muller transform.
 *
 * Takes two uniform random values in (0, 1) and produces a single
 * normally distributed value with mean 0 and standard deviation 1.
 *
 * @param u1 - First uniform random value in (0, 1)
 * @param u2 - Second uniform random value in (0, 1)
 * @returns A standard normal random variate
 */
function boxMuller(u1: number, u2: number): number {
  // Avoid log(0) by clamping u1 away from zero
  const safeU1 = Math.max(u1, 1e-10);
  return Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------------
// Distribution generator
// ---------------------------------------------------------------------------

/**
 * Generates a histogram of margin-of-victory outcomes for a matchup.
 *
 * Runs `SAMPLE_COUNT` (1,000) simulations of the matchup using normal
 * noise around the expected margin (spread). Each sample is:
 *
 *   margin = spread + noise * stdDev
 *
 * where `noise` is drawn from a standard normal distribution and
 * `stdDev` is the game standard deviation (typically ~11 efficiency points
 * scaled to actual points via possessions/100).
 *
 * Positive margins mean Team A wins by that amount.
 * Negative margins mean Team B wins by that amount.
 *
 * Results are binned into 2-point buckets from -30 to +30.
 *
 * @param spread - Expected point margin. Positive = Team A favored.
 *   This should already be converted from efficiency margin to point spread.
 * @param stdDev - Standard deviation of the outcome distribution in points.
 *   Typical value: ~7.5 (11 efficiency pts * 68 possessions / 100).
 * @param seed - Random seed for reproducibility. Defaults to 42.
 * @returns Array of DistributionBin objects for the histogram chart
 */
export function generateMatchupDistribution(
  spread: number,
  stdDev: number = 7.5,
  seed: number = 42
): DistributionBin[] {
  const rng = createSeededRandom(seed);

  // Initialize bin counts
  const binCounts = new Array(NUM_BINS).fill(0) as number[];

  // Run samples
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const u1 = rng();
    const u2 = rng();
    const noise = boxMuller(u1, u2);
    const margin = spread + noise * stdDev;

    // Determine bin index
    const clampedMargin = Math.max(MIN_MARGIN, Math.min(MAX_MARGIN - 0.001, margin));
    const binIndex = Math.floor((clampedMargin - MIN_MARGIN) / BIN_WIDTH);

    if (binIndex >= 0 && binIndex < NUM_BINS) {
      binCounts[binIndex]++;
    }
  }

  // Convert to DistributionBin objects
  const bins: DistributionBin[] = [];
  for (let i = 0; i < NUM_BINS; i++) {
    const binStart = MIN_MARGIN + i * BIN_WIDTH;
    const margin = binStart + BIN_WIDTH / 2; // Center of bin
    bins.push({
      margin,
      count: binCounts[i],
      winner: margin >= 0 ? "A" : "B",
    });
  }

  return bins;
}

/**
 * Returns the total sample count used by the distribution generator.
 * Useful for tests that need to verify bin sums.
 */
export function getDistributionSampleCount(): number {
  return SAMPLE_COUNT;
}
