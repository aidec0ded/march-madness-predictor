/**
 * Types for the matchup detail view ("film room").
 *
 * These types power the full-screen matchup overlay that shows
 * team profiles, side-by-side comparisons, probability breakdowns,
 * and Monte Carlo distribution histograms.
 */

import type { TournamentRound } from "./team";
import type { ProbabilityBreakdown } from "./engine";

// ---------------------------------------------------------------------------
// Distribution Chart Types
// ---------------------------------------------------------------------------

/** A histogram bin for the distribution chart */
export interface DistributionBin {
  /** Center value of the bin (margin of victory) */
  margin: number;
  /** Number of simulations landing in this bin */
  count: number;
  /** Which team wins at this margin ("A" or "B") */
  winner: "A" | "B";
}

// ---------------------------------------------------------------------------
// Matchup Analysis
// ---------------------------------------------------------------------------

/** Full matchup analysis data */
export interface MatchupAnalysis {
  /** Game identifier */
  gameId: string;
  /** Tournament round */
  round: TournamentRound;
  /** Team A win probability with current overrides */
  probA: number;
  /** Team B win probability with current overrides */
  probB: number;
  /** Team A win probability without overrides (baseline) */
  baseProbA: number;
  /** Team B win probability without overrides (baseline) */
  baseProbB: number;
  /** Estimated point spread (positive = Team A favored) */
  spread: number;
  /** Probability breakdown components */
  breakdown: ProbabilityBreakdownDisplay[];
  /** Histogram bins for distribution chart */
  distribution: DistributionBin[];
  /** Raw probability breakdown from the engine (used by narrative prompt) */
  rawBreakdown: ProbabilityBreakdown;
}

// ---------------------------------------------------------------------------
// Probability Breakdown Display
// ---------------------------------------------------------------------------

/** A single line item in the probability breakdown */
export interface ProbabilityBreakdownDisplay {
  /** Label for this component */
  label: string;
  /** Value (can be positive or negative adjustment) */
  value: number;
  /** Format type for display */
  format: "probability" | "adjustment" | "multiplier";
}

// ---------------------------------------------------------------------------
// Stat Comparison
// ---------------------------------------------------------------------------

/** Stat category for side-by-side comparison */
export interface StatCategory {
  /** Display label */
  label: string;
  /** Team A value */
  valueA: number | null;
  /** Team B value */
  valueB: number | null;
  /** Higher is better (affects coloring) */
  higherIsBetter: boolean;
  /** Format string for display */
  format: "pct" | "decimal" | "integer";
  /** Group this stat belongs to */
  group: "efficiency" | "four_factors" | "shooting" | "other";
  /** Team A rank in the tournament field (1-indexed, null if unavailable) */
  rankA?: number | null;
  /** Team B rank in the tournament field (1-indexed, null if unavailable) */
  rankB?: number | null;
}
