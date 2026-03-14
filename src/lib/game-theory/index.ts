/**
 * Game Theory module — ownership model and strategy engine.
 *
 * Re-exports everything needed by consumers (hooks, components, API routes).
 */

export {
  calculateOwnership,
  calculateMatchupOwnership,
  buildFullOwnershipModel,
  SEED_POPULARITY,
  CHALK_MULTIPLIER,
  PUBLIC_GROUP,
} from "./ownership";

export {
  calculateLeverageScore,
  getStrategyRecommendation,
  buildStrategyRecommendation,
  POOL_STRATEGY_CONFIGS,
} from "./strategy";
