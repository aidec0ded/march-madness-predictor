/**
 * Per-matchup override system for the March Madness probability engine.
 *
 * Handles matchup-specific adjustments that supplement or override global levers.
 * These include injury/availability, recent form, and rest adjustments.
 * Also provides lever merging to combine global levers with per-matchup
 * lever overrides.
 *
 * Note: Site proximity was moved from per-matchup overrides to a global lever
 * (see calculateSiteProximityAdjustment in levers.ts).
 *
 * All functions are pure (no side effects).
 */

import type { TeamSeason } from "@/types/team";
import type { GlobalLevers, MatchupOverrides } from "@/types/engine";

// ---------------------------------------------------------------------------
// Override adjustment result
// ---------------------------------------------------------------------------

/** Breakdown of per-matchup override efficiency point adjustments */
export interface OverrideAdjustments {
  /** Injury/availability adjustment (positive favors team A) */
  injury: number;
  /** Recent form adjustment (positive favors team A) */
  recentForm: number;
  /** Rest/schedule density adjustment (positive favors team A) */
  rest: number;
  /** Total of all override adjustments */
  total: number;
}

// ---------------------------------------------------------------------------
// Apply matchup overrides
// ---------------------------------------------------------------------------

/**
 * Computes per-matchup override efficiency point adjustments.
 *
 * Each adjustment is expressed in efficiency points with positive values
 * favoring team A. The function computes three components:
 *
 * - **Injury**: Team A's opponent being injured helps A; A being injured hurts A.
 * - **Recent form**: Direct form adjustments (A minus B).
 * - **Rest**: Direct rest adjustments (A minus B).
 *
 * Note: Site proximity is now handled as a global lever (see levers.ts).
 *
 * @param overrides - Per-matchup overrides (may be undefined for no overrides)
 * @param _teamA - First team's season data (reserved for future use)
 * @param _teamB - Second team's season data (reserved for future use)
 * @returns Breakdown of override adjustments in efficiency points
 */
export function applyMatchupOverrides(
  overrides: MatchupOverrides | undefined,
  _teamA: TeamSeason,
  _teamB: TeamSeason
): OverrideAdjustments {
  if (!overrides) {
    return { injury: 0, recentForm: 0, rest: 0, total: 0 };
  }

  // Injury: A's injury (negative value) hurts A, B's injury (negative value) helps A
  // injuryAdjustmentA = -5 means A loses 5 efficiency points → net = -5 for A
  // injuryAdjustmentB = -3 means B loses 3 efficiency points → net = +3 for A
  const injury =
    (overrides.injuryAdjustmentA ?? 0) - (overrides.injuryAdjustmentB ?? 0);

  // Recent form
  const recentForm =
    (overrides.recentFormA ?? 0) - (overrides.recentFormB ?? 0);

  // Rest / schedule density
  const rest =
    (overrides.restAdjustmentA ?? 0) - (overrides.restAdjustmentB ?? 0);

  const total = injury + recentForm + rest;

  return { injury, recentForm, rest, total };
}

// ---------------------------------------------------------------------------
// Lever merging
// ---------------------------------------------------------------------------

/**
 * Merges per-matchup lever overrides with global levers.
 *
 * If overrides contain a `leverOverrides` field, the provided partial lever
 * values are deep-merged on top of the global defaults. Fields not present
 * in the override object retain their global values.
 *
 * @param globalLevers - The bracket-wide global lever configuration
 * @param overrides - Per-matchup overrides (may be undefined)
 * @returns Effective GlobalLevers for this matchup
 */
export function mergeLevers(
  globalLevers: GlobalLevers,
  overrides?: MatchupOverrides
): GlobalLevers {
  if (!overrides?.leverOverrides) {
    return globalLevers;
  }

  const merged: GlobalLevers = { ...globalLevers };
  const lo = overrides.leverOverrides;

  // Composite weights
  if (lo.compositeWeights) {
    merged.compositeWeights = {
      ...globalLevers.compositeWeights,
      ...lo.compositeWeights,
    };
  }

  // Four Factors weights
  if (lo.fourFactors) {
    merged.fourFactors = { ...globalLevers.fourFactors, ...lo.fourFactors };
  }

  // Scalar levers
  if (lo.experienceWeight !== undefined) {
    merged.experienceWeight = lo.experienceWeight;
  }
  if (lo.continuityWeight !== undefined) {
    merged.continuityWeight = lo.continuityWeight;
  }
  if (lo.coachExperienceWeight !== undefined) {
    merged.coachExperienceWeight = lo.coachExperienceWeight;
  }
  if (lo.opponentAdjustWeight !== undefined) {
    merged.opponentAdjustWeight = lo.opponentAdjustWeight;
  }
  if (lo.benchDepthWeight !== undefined) {
    merged.benchDepthWeight = lo.benchDepthWeight;
  }
  if (lo.paceAdjustWeight !== undefined) {
    merged.paceAdjustWeight = lo.paceAdjustWeight;
  }
  if (lo.tempoVarianceWeight !== undefined) {
    merged.tempoVarianceWeight = lo.tempoVarianceWeight;
  }
  if (lo.threePtVarianceWeight !== undefined) {
    merged.threePtVarianceWeight = lo.threePtVarianceWeight;
  }
  if (lo.siteProximityWeight !== undefined) {
    merged.siteProximityWeight = lo.siteProximityWeight;
  }
  if (lo.sosWeight !== undefined) {
    merged.sosWeight = lo.sosWeight;
  }
  if (lo.luckRegressionWeight !== undefined) {
    merged.luckRegressionWeight = lo.luckRegressionWeight;
  }

  return merged;
}
