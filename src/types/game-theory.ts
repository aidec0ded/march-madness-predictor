/**
 * Types for the Game Theory / Contest Mode system.
 *
 * Defines ownership estimation, strategy recommendations, and pool size
 * configuration used to surface game-theory-aware guidance throughout
 * the bracket UI.
 */

import type { TournamentRound } from "./team";

// ---------------------------------------------------------------------------
// Pool Size
// ---------------------------------------------------------------------------

/** Pool size buckets for strategy recommendations */
export type PoolSizeBucket = "small" | "medium" | "large" | "very_large";

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/** Strategy recommendation type */
export type RecommendationType =
  | "max_probability"
  | "slight_contrarian"
  | "contrarian_value"
  | "avoid"
  | "neutral";

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/** Ownership estimate for a team in a specific round */
export interface OwnershipEstimate {
  /** Team ID */
  teamId: string;
  /** Tournament round */
  round: TournamentRound;
  /** Estimated public ownership percentage (0-100) */
  ownershipPct: number;
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

/** Strategy recommendation for a specific pick */
export interface StrategyRecommendation {
  /** Team ID */
  teamId: string;
  /** Game ID */
  gameId: string;
  /** Round this recommendation applies to */
  round: TournamentRound;
  /** Recommendation type */
  type: RecommendationType;
  /** Leverage score: winProb / (ownership/100) */
  leverageScore: number;
  /** Brief explanation */
  reason: string;
}

// ---------------------------------------------------------------------------
// Pool Strategy Configuration
// ---------------------------------------------------------------------------

/** Configuration for a pool size tier */
export interface PoolStrategyConfig {
  /** Pool size bucket */
  bucket: PoolSizeBucket;
  /** Display label */
  label: string;
  /** How much ownership factors into recommendations (0-1) */
  ownershipFactor: number;
  /** Leverage score threshold for "contrarian value" */
  contrarianThreshold: number;
  /** Leverage score threshold for "avoid" */
  avoidThreshold: number;
  /** Description of strategy approach */
  description: string;
}

// ---------------------------------------------------------------------------
// Ownership Model
// ---------------------------------------------------------------------------

/** Full ownership model for all teams across all rounds */
export interface OwnershipModel {
  /** Ownership estimates indexed by `${teamId}-${round}` */
  estimates: Map<string, OwnershipEstimate>;
  /** Get ownership for a specific team and round */
  getOwnership: (teamId: string, round: TournamentRound) => number;
}
