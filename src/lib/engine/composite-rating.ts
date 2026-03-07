/**
 * Composite Rating Calculator
 *
 * Calculates a weighted composite efficiency rating from multiple data sources
 * (KenPom, Torvik, Evan Miya). The composite blends adjusted offensive efficiency
 * (adjOE), adjusted defensive efficiency (adjDE), and derives the adjusted
 * efficiency margin (adjEM) as adjOE - adjDE.
 *
 * When fewer than 3 sources are available, the weights are renormalized
 * proportionally among the available sources so the composite is always
 * computed on a consistent scale.
 *
 * @module composite-rating
 */

import type { EfficiencyRatings, DataSource } from "@/types/team";
import type { CompositeWeights } from "@/types/engine";
import { DEFAULT_COMPOSITE_WEIGHTS } from "@/types/engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single source's contribution to the composite rating */
export interface CompositeSource {
  /** Which data source this comes from */
  source: DataSource;
  /** The renormalized weight assigned to this source (sums to 1 across all sources) */
  weight: number;
  /** The source's adjusted efficiency margin (adjOE - adjDE) */
  adjEM: number;
}

/** The result of a composite rating calculation */
export interface CompositeRating {
  /** Weighted composite adjusted offensive efficiency (points per 100 possessions) */
  adjOE: number;
  /** Weighted composite adjusted defensive efficiency (points per 100 possessions) */
  adjDE: number;
  /**
   * Weighted composite adjusted efficiency margin.
   * Always computed as adjOE - adjDE (not as a weighted average of source adjEMs).
   * This ensures internal consistency when sources use different scales
   * (e.g., Evan Miya BPR vs. KenPom AdjEM).
   */
  adjEM: number;
  /** Breakdown of each source's contribution */
  sources: CompositeSource[];
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Calculates a weighted composite efficiency rating from available data sources.
 *
 * The composite is built by:
 * 1. Collecting all available source ratings from the `ratings` object.
 * 2. Renormalizing the requested weights so that only available sources contribute
 *    and their weights sum to 1.0.
 * 3. Computing weighted averages of adjOE and adjDE independently.
 * 4. Deriving adjEM = adjOE - adjDE (not as a direct weighted average of adjEMs).
 *
 * This approach ensures that the composite margin is always consistent with
 * the composite offensive and defensive efficiencies, even when sources
 * define their margins differently (e.g., Evan Miya's BPR).
 *
 * **Weight renormalization examples:**
 * - All 3 sources: weights used as-is (after normalizing to sum to 1).
 * - 2 of 3 sources: weights renormalized among the 2 available sources.
 * - 1 source: that source gets 100% weight.
 * - 0 sources: throws an error.
 *
 * @param ratings - The TeamSeason.ratings object containing optional kenpom, torvik, evanmiya fields.
 * @param weights - The desired blending weights. Defaults to 40% KenPom, 35% Torvik, 25% Evan Miya.
 *                  Weights do not need to sum to 1.0 -- they are always normalized internally.
 * @returns The composite rating with adjOE, adjDE, adjEM, and per-source breakdown.
 * @throws {Error} If no data sources are available (all fields are undefined).
 *
 * @example
 * ```ts
 * const composite = calculateCompositeRating(teamSeason.ratings);
 * console.log(composite.adjEM); // e.g., 25.3
 * console.log(composite.sources); // [{ source: 'kenpom', weight: 0.4, adjEM: 26.1 }, ...]
 * ```
 */
export function calculateCompositeRating(
  ratings: {
    kenpom?: EfficiencyRatings;
    torvik?: EfficiencyRatings;
    evanmiya?: EfficiencyRatings;
  },
  weights: CompositeWeights = DEFAULT_COMPOSITE_WEIGHTS
): CompositeRating {
  // Collect available sources with their requested weights
  const available: { rating: EfficiencyRatings; requestedWeight: number }[] =
    [];

  if (ratings.kenpom) {
    available.push({ rating: ratings.kenpom, requestedWeight: weights.kenpom });
  }
  if (ratings.torvik) {
    available.push({ rating: ratings.torvik, requestedWeight: weights.torvik });
  }
  if (ratings.evanmiya) {
    available.push({
      rating: ratings.evanmiya,
      requestedWeight: weights.evanmiya,
    });
  }

  if (available.length === 0) {
    throw new Error(
      "Cannot calculate composite rating: no data sources available. " +
        "At least one of kenpom, torvik, or evanmiya must be provided."
    );
  }

  // Renormalize weights so they sum to 1.0 among available sources
  const totalRequestedWeight = available.reduce(
    (sum, s) => sum + s.requestedWeight,
    0
  );
  const normalized = available.map((s) => ({
    ...s,
    normalizedWeight: s.requestedWeight / totalRequestedWeight,
  }));

  // Compute weighted averages of adjOE and adjDE independently
  let compositeAdjOE = 0;
  let compositeAdjDE = 0;
  const sources: CompositeSource[] = [];

  for (const { rating, normalizedWeight } of normalized) {
    compositeAdjOE += rating.adjOE * normalizedWeight;
    compositeAdjDE += rating.adjDE * normalizedWeight;

    sources.push({
      source: rating.source,
      weight: normalizedWeight,
      adjEM: rating.adjOE - rating.adjDE,
    });
  }

  // Derive adjEM from the composite components (NOT averaged adjEMs)
  const compositeAdjEM = compositeAdjOE - compositeAdjDE;

  return {
    adjOE: compositeAdjOE,
    adjDE: compositeAdjDE,
    adjEM: compositeAdjEM,
    sources,
  };
}

/**
 * Normalizes composite weights so they sum to 1.0.
 *
 * Useful when the UI produces weights that don't sum to exactly 1.
 *
 * @param weights - Raw weights (any positive values).
 * @returns Normalized weights that sum to 1.0.
 * @throws {Error} If all weights are zero or negative.
 *
 * @example
 * ```ts
 * normalizeWeights({ kenpom: 2, torvik: 2, evanmiya: 1 });
 * // → { kenpom: 0.4, torvik: 0.4, evanmiya: 0.2 }
 * ```
 */
export function normalizeWeights(weights: CompositeWeights): CompositeWeights {
  const total = weights.kenpom + weights.torvik + weights.evanmiya;

  if (total <= 0) {
    throw new Error("Cannot normalize weights: total weight must be positive.");
  }

  return {
    kenpom: weights.kenpom / total,
    torvik: weights.torvik / total,
    evanmiya: weights.evanmiya / total,
  };
}
