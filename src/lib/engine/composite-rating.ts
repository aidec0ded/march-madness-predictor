/**
 * Composite Rating Calculator
 *
 * Calculates a weighted composite efficiency rating from multiple data sources
 * (KenPom, Torvik, Evan Miya). The composite adjEM is computed as a weighted
 * average of each source's stored adjEM. For adjOE/adjDE, only sources on a
 * compatible per-100-possessions scale (KenPom, Torvik) are blended; Evan Miya's
 * OE/DE are on a fundamentally different scale and cannot be mixed.
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
// Constants
// ---------------------------------------------------------------------------

/**
 * Sources whose adjOE/adjDE use the per-100-possessions scale.
 * Evan Miya's OE/DE are on a completely different scale (~0-20 range
 * vs ~80-130 for KenPom/Torvik) and cannot be blended for adjOE/adjDE.
 * Additionally, Evan Miya's BPR is ADDITIVE (OE + DE = BPR), unlike
 * KenPom/Torvik which are DIFFERENTIAL (AdjOE - AdjDE = AdjEM).
 * Despite the different construction, BPR IS on a comparable efficiency
 * margin scale and contributes to the composite adjEM.
 */
const PER_100_SOURCES: ReadonlySet<DataSource> = new Set([
  "kenpom",
  "torvik",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single source's contribution to the composite rating */
export interface CompositeSource {
  /** Which data source this comes from */
  source: DataSource;
  /** The renormalized weight assigned to this source (sums to 1 across all sources) */
  weight: number;
  /** The source's adjusted efficiency margin (stored adjEM, e.g. BPR for Evan Miya) */
  adjEM: number;
}

/** The result of a composite rating calculation */
export interface CompositeRating {
  /**
   * Weighted composite adjusted offensive efficiency (points per 100 possessions).
   * Blended only from sources on the per-100-possessions scale (KenPom, Torvik).
   * When only Evan Miya is available, estimated from a D1 baseline + adjEM.
   */
  adjOE: number;
  /**
   * Weighted composite adjusted defensive efficiency (points per 100 possessions).
   * Blended only from sources on the per-100-possessions scale (KenPom, Torvik).
   * When only Evan Miya is available, estimated from a D1 baseline + adjEM.
   */
  adjDE: number;
  /**
   * Weighted composite adjusted efficiency margin.
   * Computed as a direct weighted average of each source's stored adjEM
   * (BPR for Evan Miya, AdjEM for KenPom/Torvik). This is the value used
   * in the probability calculation.
   */
  adjEM: number;
  /** Breakdown of each source's contribution */
  sources: CompositeSource[];
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * D1 average offensive efficiency baseline (points per 100 possessions).
 * Used to derive estimated adjOE/adjDE when only non-per-100 sources
 * (Evan Miya) are available. The exact value doesn't matter much since
 * only adjEM is used in probability calculations.
 */
const D1_BASELINE_OE = 105.0;

/**
 * Calculates a weighted composite efficiency rating from available data sources.
 *
 * The composite is built by:
 * 1. Collecting all available source ratings from the `ratings` object.
 * 2. Renormalizing the requested weights so that only available sources contribute
 *    and their weights sum to 1.0.
 * 3. Computing a weighted average of each source's **stored adjEM** value.
 *    For Evan Miya this is the BPR; for KenPom/Torvik this is AdjOE - AdjDE.
 * 4. Computing weighted averages of adjOE and adjDE from per-100-possessions
 *    sources only (KenPom, Torvik). Evan Miya's OE/DE are on an incompatible
 *    scale and are excluded from the OE/DE blend.
 * 5. If no per-100 sources are available, adjOE and adjDE are estimated from
 *    a D1 baseline and the composite adjEM for display purposes.
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

  // -----------------------------------------------------------------------
  // Compute composite adjEM from ALL sources using stored adjEM
  // -----------------------------------------------------------------------
  let compositeAdjEM = 0;
  const sources: CompositeSource[] = [];

  for (const { rating, normalizedWeight } of normalized) {
    // Use the source's STORED adjEM — this is BPR for Evan Miya
    // (OE + DE, additive), and AdjOE - AdjDE for KenPom/Torvik (differential).
    compositeAdjEM += rating.adjEM * normalizedWeight;

    sources.push({
      source: rating.source,
      weight: normalizedWeight,
      adjEM: rating.adjEM,
    });
  }

  // -----------------------------------------------------------------------
  // Compute composite adjOE/adjDE from per-100-possessions sources only
  // -----------------------------------------------------------------------
  // Evan Miya's OE/DE are on a ~0-20 scale (not per-100-possessions) and
  // cannot be blended with KenPom/Torvik's ~80-130 scale values.
  const per100Sources = normalized.filter((s) =>
    PER_100_SOURCES.has(s.rating.source)
  );

  let compositeAdjOE: number;
  let compositeAdjDE: number;

  if (per100Sources.length > 0) {
    // Renormalize weights among per-100 sources for OE/DE blend
    const totalPer100Weight = per100Sources.reduce(
      (sum, s) => sum + s.normalizedWeight,
      0
    );
    compositeAdjOE = 0;
    compositeAdjDE = 0;
    for (const { rating, normalizedWeight } of per100Sources) {
      const renormWeight = normalizedWeight / totalPer100Weight;
      compositeAdjOE += rating.adjOE * renormWeight;
      compositeAdjDE += rating.adjDE * renormWeight;
    }
  } else {
    // No per-100 sources available (only Evan Miya).
    // Estimate adjOE/adjDE from the D1 baseline and composite adjEM.
    // These values are for display only — adjEM is what matters for probability.
    compositeAdjOE = D1_BASELINE_OE + compositeAdjEM / 2;
    compositeAdjDE = D1_BASELINE_OE - compositeAdjEM / 2;
  }

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
