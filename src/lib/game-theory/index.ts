/**
 * Game Theory module — ownership model and strategy engine.
 *
 * Re-exports everything needed by consumers (hooks, components, API routes).
 */

export {
  calculateOwnership,
  buildFullOwnershipModel,
  SEED_BASELINES,
  ROUND_DECAY,
} from "./ownership";

export {
  calculateLeverageScore,
  getStrategyRecommendation,
  buildStrategyRecommendation,
  POOL_STRATEGY_CONFIGS,
} from "./strategy";
