/**
 * Probability model and Monte Carlo simulation engine.
 *
 * This module contains:
 * - Composite rating calculator (KenPom/Torvik/Miya blend)
 * - Log5 logistic model for pairwise win probability
 * - Lever system (global + per-matchup) — TODO
 * - Monte Carlo bracket simulator — TODO
 *
 * Built out in Phase 2 (Probability Engine) and Phase 3 (Simulation).
 */

export {
  calculateCompositeRating,
  normalizeWeights,
  type CompositeRating,
  type CompositeSource,
} from "./composite-rating";

export {
  calculateWinProbability,
  ratingDiffToSpread,
  clampProbability,
} from "./win-probability";
