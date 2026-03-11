/**
 * Matchup resolver — the central orchestrator of the probability engine.
 *
 * Takes two TeamSeason objects, an EngineConfig, and optional per-matchup
 * overrides, then runs the full calculation pipeline:
 *
 * 1. Merge levers (global + per-matchup overrides)
 * 2. Calculate composite ratings for both teams
 * 3. Calculate base win probability from rating differential
 * 4. Calculate all mean adjustments (Four Factors, experience, continuity, coach, site proximity)
 * 5. Apply per-matchup overrides (injury, form, rest)
 * 6. Sum mean adjustments and adjust the rating differential
 * 7. Calculate variance multipliers (tempo, 3PT rate)
 * 8. Apply variance to the probability via effective logistic K
 * 9. Clamp final probability
 * 10. Build full ProbabilityBreakdown and return MatchupResult
 *
 * All functions are pure (no side effects).
 */

import type { TeamSeason } from "@/types/team";
import type {
  EngineConfig,
  GameSiteCoordinates,
  MatchupOverrides,
  MatchupResult,
  ProbabilityBreakdown,
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
  calculateTempoVarianceMultiplier,
  calculateThreePtVarianceMultiplier,
} from "@/lib/engine/levers";
import { applyMatchupOverrides, mergeLevers } from "@/lib/engine/overrides";

// ---------------------------------------------------------------------------
// Main matchup resolver
// ---------------------------------------------------------------------------

/**
 * Resolves a head-to-head matchup between two teams, producing a full
 * probability breakdown with all lever adjustments applied.
 *
 * The pipeline:
 * 1. Merges global levers with any per-matchup overrides
 * 2. Calculates composite ratings from weighted source blends
 * 3. Computes base probability from the raw rating differential
 * 4. Applies mean-adjusting levers (Four Factors, experience, continuity, coach, site proximity)
 * 5. Applies per-matchup overrides (injury, recent form, rest)
 * 6. Calculates variance multipliers (tempo, 3PT rate)
 * 7. Recalculates final probability using the effective logistic K
 * 8. Returns a full MatchupResult with diagnostic breakdown
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param config - Engine configuration (global levers + model parameters)
 * @param overrides - Optional per-matchup overrides
 * @param siteCoordinates - Optional game venue coordinates for site proximity lever
 * @returns Full matchup result with win probabilities and diagnostic breakdown
 */
export function resolveMatchup(
  teamA: TeamSeason,
  teamB: TeamSeason,
  config: EngineConfig,
  overrides?: MatchupOverrides,
  siteCoordinates?: GameSiteCoordinates
): MatchupResult {
  // Step 1: Merge levers (global + per-matchup overrides)
  const effectiveLevers = mergeLevers(config.levers, overrides);

  // Step 2: Calculate composite ratings
  const compositeA = calculateCompositeRating(
    teamA.ratings,
    effectiveLevers.compositeWeights
  );
  const compositeB = calculateCompositeRating(
    teamB.ratings,
    effectiveLevers.compositeWeights
  );

  // Step 3: Base rating differential and win probability
  const ratingDifferential = compositeA.adjEM - compositeB.adjEM;
  const baseProbability = calculateWinProbability(
    ratingDifferential,
    config.logisticK
  );

  // Step 4: Mean-adjusting levers
  const fourFactorsAdjustment = calculateFourFactorsAdjustment(
    teamA,
    teamB,
    effectiveLevers.fourFactors
  );
  const experienceAdjustment = calculateExperienceAdjustment(
    teamA,
    teamB,
    effectiveLevers.experienceWeight
  );
  const continuityAdjustment = calculateContinuityAdjustment(
    teamA,
    teamB,
    effectiveLevers.continuityWeight
  );
  const coachAdjustment = calculateCoachAdjustment(
    teamA,
    teamB,
    effectiveLevers.coachExperienceWeight
  );
  const opponentAdjustAdjustment = calculateOpponentAdjustment(
    teamA,
    teamB,
    effectiveLevers.opponentAdjustWeight
  );
  const benchDepthAdjustment = calculateBenchDepthAdjustment(
    teamA,
    teamB,
    effectiveLevers.benchDepthWeight
  );
  const paceAdjustAdjustment = calculatePaceAdjustAdjustment(
    teamA,
    teamB,
    effectiveLevers.paceAdjustWeight
  );
  const siteProximityAdjustment = calculateSiteProximityAdjustment(
    teamA,
    teamB,
    effectiveLevers.siteProximityWeight,
    siteCoordinates
  );

  const totalMeanAdjustment =
    fourFactorsAdjustment +
    experienceAdjustment +
    continuityAdjustment +
    coachAdjustment +
    opponentAdjustAdjustment +
    benchDepthAdjustment +
    paceAdjustAdjustment +
    siteProximityAdjustment;

  // Step 5: Per-matchup override adjustments
  const overrideAdjustments = applyMatchupOverrides(overrides, teamA, teamB);

  // Step 6: Adjusted rating differential
  const adjustedDiff =
    ratingDifferential + totalMeanAdjustment + overrideAdjustments.total;

  // Step 7: Variance multipliers
  const tempoVarianceMultiplier = calculateTempoVarianceMultiplier(
    teamA,
    teamB,
    effectiveLevers.tempoVarianceWeight
  );
  const threePtVarianceMultiplier = calculateThreePtVarianceMultiplier(
    teamA,
    teamB,
    effectiveLevers.threePtVarianceWeight
  );
  const combinedVarianceMultiplier =
    tempoVarianceMultiplier * threePtVarianceMultiplier;

  // Step 8: Apply variance effect via effective logistic K
  // Higher variance → lower effective K → flatter curve → probabilities closer to 0.5
  // Lower variance → higher effective K → steeper curve → more extreme probabilities
  const effectiveK = config.logisticK / combinedVarianceMultiplier;
  const rawFinalProbability = calculateWinProbability(adjustedDiff, effectiveK);

  // Step 9: Clamp final probability
  const finalProbability = clampProbability(rawFinalProbability);

  // Step 10: Build breakdown and result
  const breakdown: ProbabilityBreakdown = {
    baseProbability,
    compositeRatingA: {
      adjOE: compositeA.adjOE,
      adjDE: compositeA.adjDE,
      adjEM: compositeA.adjEM,
      sources: compositeA.sources,
    },
    compositeRatingB: {
      adjOE: compositeB.adjOE,
      adjDE: compositeB.adjDE,
      adjEM: compositeB.adjEM,
      sources: compositeB.sources,
    },
    ratingDifferential,
    fourFactorsAdjustment,
    experienceAdjustment,
    continuityAdjustment,
    coachAdjustment,
    opponentAdjustAdjustment,
    benchDepthAdjustment,
    paceAdjustAdjustment,
    siteProximityAdjustment,
    totalMeanAdjustment,
    overrideAdjustments,
    tempoVarianceMultiplier,
    threePtVarianceMultiplier,
    combinedVarianceMultiplier,
    finalProbability,
  };

  return {
    teamAId: teamA.id,
    teamBId: teamB.id,
    winProbabilityA: finalProbability,
    winProbabilityB: 1 - finalProbability,
    breakdown,
  };
}
