/**
 * UI-specific types for bracket state management.
 *
 * These types define the shape of the bracket UI state (picks, levers,
 * simulation results) and the actions that modify it via useReducer.
 * They bridge the engine/simulation types with the React component tree.
 */

import type { TeamSeason, Region, TournamentRound } from "./team";
import type { GlobalLevers, MatchupOverrides } from "./engine";
import type { SimulationResult, BracketMatchup } from "./simulation";
import type { PoolSizeBucket } from "./game-theory";
import type { SiteMap } from "@/lib/engine/site-mapping";

// ---------------------------------------------------------------------------
// Simulation Progress
// ---------------------------------------------------------------------------

/**
 * Real-time progress snapshot during a streaming simulation.
 * Dispatched by the SSE stream consumer as simulations complete.
 */
export interface SimulationProgress {
  /** Number of simulations completed so far */
  completed: number;
  /** Total number of simulations to run */
  total: number;
  /** Elapsed time in milliseconds since simulation started */
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Bracket State
// ---------------------------------------------------------------------------

/**
 * The full client-side bracket state managed by BracketProvider.
 *
 * Contains the user's picks, lever configuration, simulation results,
 * and metadata about the bracket itself.
 */
export interface BracketState {
  /** All 64 teams keyed by teamId for O(1) lookup */
  teams: Map<string, TeamSeason>;

  /** User's picks: gameId -> winning teamId */
  picks: Record<string, string>;

  /** Current global lever configuration */
  globalLevers: GlobalLevers;

  /** Per-matchup overrides keyed by gameId */
  matchupOverrides: Record<string, MatchupOverrides>;

  /** Latest simulation result (null if no simulation has been run) */
  simulationResult: SimulationResult | null;

  /** Whether a simulation is currently running */
  isSimulating: boolean;

  /** Real-time progress during a streaming simulation (null when idle or non-streaming) */
  simulationProgress: SimulationProgress | null;

  /** Hash of simulation inputs (picks + levers + overrides) at time of last run. Null if never simulated. */
  simulationInputHash: string | null;

  /** Whether simulation results are stale (inputs changed since last simulation). */
  isSimulationStale: boolean;

  /** Saved bracket ID (null if not yet saved) */
  bracketId: string | null;

  /** User-assigned bracket name */
  bracketName: string;

  /** Whether the bracket has unsaved changes */
  isDirty: boolean;

  /** Pool size bucket for game theory recommendations */
  poolSizeBucket: PoolSizeBucket;

  /** Pre-computed game-to-venue coordinate map for site proximity lever (null if not loaded) */
  tournamentSiteMap: SiteMap | null;
}

// ---------------------------------------------------------------------------
// Bracket Actions
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all actions that can modify BracketState.
 * Dispatched via the BracketProvider's useReducer.
 */
export type BracketAction =
  | { type: "ADVANCE_TEAM"; gameId: string; teamId: string }
  | { type: "RESET_PICK"; gameId: string }
  | { type: "SET_GLOBAL_LEVERS"; levers: Partial<GlobalLevers> }
  | { type: "SET_MATCHUP_OVERRIDE"; gameId: string; overrides: MatchupOverrides }
  | { type: "REMOVE_MATCHUP_OVERRIDE"; gameId: string }
  | { type: "SET_SIMULATION_RESULT"; result: SimulationResult }
  | { type: "SET_SIMULATING"; isSimulating: boolean }
  | { type: "SET_SIMULATION_PROGRESS"; progress: SimulationProgress }
  | { type: "LOAD_BRACKET"; bracket: SavedBracketData }
  | { type: "CLEAR_BRACKET" }
  | { type: "MARK_SAVED"; bracketId: string }
  | { type: "SET_POOL_SIZE"; poolSizeBucket: PoolSizeBucket }
  | { type: "SET_TOURNAMENT_SITE_MAP"; siteMap: SiteMap };

// ---------------------------------------------------------------------------
// Matchup Display Data
// ---------------------------------------------------------------------------

/**
 * Pre-resolved matchup data ready for rendering.
 * Combines bracket structure with resolved team references and probabilities.
 */
export interface MatchupDisplayData {
  /** Unique game identifier (e.g., "R64-East-1") */
  gameId: string;

  /** Tournament round */
  round: TournamentRound;

  /** Region (undefined for F4/NCG) */
  region?: Region;

  /** Team A in this matchup (null if feeder game not yet decided) */
  teamA: TeamSeason | null;

  /** Team B in this matchup (null if feeder game not yet decided) */
  teamB: TeamSeason | null;

  /** ID of the winning team (null if no pick made) */
  winner: string | null;

  /** Win probability for team A (null if simulation not run) */
  winProbabilityA: number | null;

  /** Win probability for team B (null if simulation not run) */
  winProbabilityB: number | null;

  /** Whether per-matchup overrides have been applied */
  hasOverrides: boolean;
}

// ---------------------------------------------------------------------------
// Saved Bracket Data
// ---------------------------------------------------------------------------

/**
 * Serializable bracket data for persistence (save/load).
 * Excludes the teams Map which is loaded separately from the database.
 */
export interface SavedBracketData {
  /** Unique bracket identifier */
  bracketId: string;

  /** User-assigned bracket name */
  name: string;

  /** User's picks: gameId -> winning teamId */
  picks: Record<string, string>;

  /** Global lever configuration at time of save */
  globalLevers: GlobalLevers;

  /** Per-matchup overrides at time of save */
  matchupOverrides: Record<string, MatchupOverrides>;

  /** Simulation snapshot at time of save (null if never simulated) */
  simulationSnapshot: SimulationResult | null;
}
