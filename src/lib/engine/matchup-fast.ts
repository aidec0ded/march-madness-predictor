/**
 * Fast matchup resolver for the simulation hot path.
 *
 * Returns only the win probability number (0-1), skipping all
 * ProbabilityBreakdown diagnostic object construction. This avoids
 * allocating 20+ field objects 3.15M times during a 50K simulation.
 *
 * The math is identical to resolveMatchup() in matchup.ts — same
 * pipeline, same lever adjustments, same result. The full
 * resolveMatchup() remains unchanged for the UI matchup view where
 * diagnostic breakdowns are needed.
 *
 * All functions are pure (no side effects).
 */

import type { TeamSeason } from "@/types/team";
import type {
  EngineConfig,
  GameSiteCoordinates,
  MatchupOverrides,
} from "@/types/engine";

import { calculateCompositeRating } from "@/lib/engine/composite-rating";
import {
  calculateWinProbability,
  clampProbability,
} from "@/lib/engine/win-probability";
import {
  calculateFourFactorsAdjustment,
  calculateExperienceAdjustment,
  calculateContinuityAdjustment,
  calculateCoachAdjustment,
  calculateOpponentAdjustment,
  calculateBenchDepthAdjustment,
  calculatePaceAdjustAdjustment,
  calculateSiteProximityAdjustment,
  calculateSosAdjustment,
  calculateLuckRegressionAdjustment,
  calculateTempoVarianceMultiplier,
  calculateThreePtVarianceMultiplier,
} from "@/lib/engine/levers";
import { applyMatchupOverrides, mergeLevers } from "@/lib/engine/overrides";

// ---------------------------------------------------------------------------
// Fast matchup resolver
// ---------------------------------------------------------------------------

/**
 * Resolves a head-to-head matchup returning only the win probability
 * for team A. Identical math to resolveMatchup() but avoids all
 * diagnostic object allocation.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param config - Engine configuration (global levers + model parameters)
 * @param overrides - Optional per-matchup overrides
 * @param siteCoordinates - Optional game venue coordinates
 * @returns Win probability for team A (0-1)
 */
export function resolveMatchupFast(
  teamA: TeamSeason,
  teamB: TeamSeason,
  config: EngineConfig,
  overrides?: MatchupOverrides,
  siteCoordinates?: GameSiteCoordinates
): number {
  // Step 1: Merge levers
  const effectiveLevers = mergeLevers(config.levers, overrides);

  // Step 2: Composite ratings (only need adjEM)
  const compositeA = calculateCompositeRating(
    teamA.ratings,
    effectiveLevers.compositeWeights
  );
  const compositeB = calculateCompositeRating(
    teamB.ratings,
    effectiveLevers.compositeWeights
  );

  // Step 3: Base rating differential
  const ratingDifferential = compositeA.adjEM - compositeB.adjEM;

  // Step 4: Mean-adjusting levers (sum directly, no intermediate storage)
  const totalMeanAdjustment =
    calculateFourFactorsAdjustment(teamA, teamB, effectiveLevers.fourFactors) +
    calculateExperienceAdjustment(teamA, teamB, effectiveLevers.experienceWeight) +
    calculateContinuityAdjustment(teamA, teamB, effectiveLevers.continuityWeight) +
    calculateCoachAdjustment(teamA, teamB, effectiveLevers.coachExperienceWeight) +
    calculateOpponentAdjustment(teamA, teamB, effectiveLevers.opponentAdjustWeight) +
    calculateBenchDepthAdjustment(teamA, teamB, effectiveLevers.benchDepthWeight) +
    calculatePaceAdjustAdjustment(teamA, teamB, effectiveLevers.paceAdjustWeight) +
    calculateSiteProximityAdjustment(teamA, teamB, effectiveLevers.siteProximityWeight, siteCoordinates) +
    calculateSosAdjustment(teamA, teamB, effectiveLevers.sosWeight) +
    calculateLuckRegressionAdjustment(teamA, teamB, effectiveLevers.luckRegressionWeight);

  // Step 5: Per-matchup override adjustments
  const overrideAdjustments = applyMatchupOverrides(overrides, teamA, teamB);

  // Step 6: Adjusted rating differential
  const adjustedDiff =
    ratingDifferential + totalMeanAdjustment + overrideAdjustments.total;

  // Step 7: Variance multipliers
  const combinedVarianceMultiplier =
    calculateTempoVarianceMultiplier(teamA, teamB, effectiveLevers.tempoVarianceWeight) *
    calculateThreePtVarianceMultiplier(teamA, teamB, effectiveLevers.threePtVarianceWeight);

  // Step 8: Final probability via effective K
  const effectiveK = config.logisticK / combinedVarianceMultiplier;
  const rawFinalProbability = calculateWinProbability(adjustedDiff, effectiveK);

  // Step 9: Clamp and return
  return clampProbability(rawFinalProbability);
}
