/**
 * Domain types for user-owned data.
 *
 * These types represent the application-level shape of user data,
 * decoupled from the database schema. They use camelCase naming
 * and typed JSONB fields.
 */

import type { GlobalLevers, MatchupOverrides } from "./engine";

// ---------------------------------------------------------------------------
// Pool size buckets
// ---------------------------------------------------------------------------

export type PoolSizeBucket = "small" | "medium" | "large" | "very_large";

export const POOL_SIZE_LABELS: Record<PoolSizeBucket, string> = {
  small: "Small (\u226420 people)",
  medium: "Medium (50\u2013200 people)",
  large: "Large (500+ people)",
  very_large: "Very Large (100,000+ people)",
};

// ---------------------------------------------------------------------------
// User Bracket
// ---------------------------------------------------------------------------

/** A user's saved bracket with picks and optional simulation results. */
export interface UserBracket {
  id: string;
  userId: string;
  name: string;
  season: number;
  /** Map of matchup/game ID -> team ID that the user picked to advance. */
  picks: Record<string, string>;
  /** Snapshot of the last simulation run against this bracket. */
  simulationSnapshot: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// User Lever Config
// ---------------------------------------------------------------------------

/** A user's saved lever configuration (global levers + per-matchup overrides). */
export interface UserLeverConfig {
  id: string;
  userId: string;
  name: string;
  season: number;
  globalLevers: Partial<GlobalLevers>;
  matchupOverrides: Record<string, Partial<MatchupOverrides>>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------

/** User-level preferences and configuration. */
export interface UserSettings {
  id: string;
  userId: string;
  poolSizeBucket: PoolSizeBucket;
  simulationCount: number;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
