/**
 * Types for the Contextual Guidance System (Phase 8).
 *
 * Guidance rules analyze the user's bracket state and produce
 * informational messages that help improve decision-making without
 * restricting choices. Each rule is a pure function that receives
 * a GuidanceContext and returns zero or more GuidanceMessages.
 */

import type { TeamSeason } from "./team";
import type { GlobalLevers, MatchupOverrides } from "./engine";
import type { SimulationResult } from "./simulation";

// ---------------------------------------------------------------------------
// Severity & Category
// ---------------------------------------------------------------------------

/** Severity level for guidance messages */
export type GuidanceSeverity = "danger" | "warning" | "info";

/** Category for organizing guidance messages */
export type GuidanceCategory =
  | "upset_volume"
  | "chalk_concentration"
  | "variance_mismatch"
  | "lever_conflict"
  | "recency_divergence"
  | "tempo_explanation";

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

/** A single guidance message */
export interface GuidanceMessage {
  /** Unique identifier for deduplication */
  id: string;
  /** Display title */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Severity level */
  severity: GuidanceSeverity;
  /** Category for grouping */
  category: GuidanceCategory;
  /** Optional game ID this guidance relates to */
  gameId?: string;
  /** Optional team IDs this guidance relates to */
  teamIds?: string[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Context object passed to all guidance rules */
export interface GuidanceContext {
  /** User's bracket picks: gameId -> winning teamId */
  picks: Record<string, string>;
  /** All teams in the tournament keyed by teamId */
  teams: Map<string, TeamSeason>;
  /** Current global lever settings */
  globalLevers: GlobalLevers;
  /** Per-matchup overrides keyed by gameId */
  matchupOverrides: Record<string, MatchupOverrides>;
  /** Simulation results (null if not yet run) */
  simulationResult: SimulationResult | null;
}

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/** A guidance rule function: pure, deterministic, side-effect-free */
export type GuidanceRule = (context: GuidanceContext) => GuidanceMessage[];
