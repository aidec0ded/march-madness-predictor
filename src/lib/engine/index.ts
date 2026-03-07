/**
 * Probability model and Monte Carlo simulation engine.
 *
 * This module contains:
 * - Composite rating calculator (KenPom/Torvik/Miya blend)
 * - Log5 logistic model for pairwise win probability
 * - Lever system (global + per-matchup adjustments)
 * - Matchup resolver (full probability pipeline)
 * - Monte Carlo bracket simulator
 * - Bracket structure and matchup tree builder
 * - Simulation result aggregator
 *
 * Built out in Phase 2 (Probability Engine) and Phase 3 (Simulation).
 */

// --- Composite rating ---
export {
  calculateCompositeRating,
  normalizeWeights,
  type CompositeRating,
  type CompositeSource,
} from "./composite-rating";

// --- Win probability ---
export {
  calculateWinProbability,
  ratingDiffToSpread,
  clampProbability,
} from "./win-probability";

// --- Lever system ---
export {
  calculateFourFactorsAdjustment,
  calculateExperienceAdjustment,
  calculateContinuityAdjustment,
  calculateCoachAdjustment,
  calculateTempoVarianceMultiplier,
  calculateThreePtVarianceMultiplier,
} from "./levers";

// --- Per-matchup overrides ---
export {
  applyMatchupOverrides,
  mergeLevers,
  type OverrideAdjustments,
} from "./overrides";

// --- Matchup resolver ---
export { resolveMatchup } from "./matchup";

// --- Bracket structure ---
export {
  buildBracketMatchups,
  buildBracketSlots,
  getRoundOrder,
  getRoundIndex,
  REGIONS,
  BRACKET_SEED_MATCHUPS,
} from "./bracket";

// --- Sampler ---
export { sampleGameOutcome, createSeededRandom } from "./sampler";

// --- Simulator ---
export { simulateBracket, runSimulation } from "./simulator";

// --- Aggregator ---
export {
  aggregateSimulations,
  createStreamingAggregator,
  type StreamingAggregator,
} from "./aggregator";
