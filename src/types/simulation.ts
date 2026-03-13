/**
 * Types for the Monte Carlo bracket simulation engine.
 *
 * The simulator takes 64 TeamSeason records + an EngineConfig,
 * runs N full-bracket simulations, and produces path probabilities
 * for every team in every round.
 */

import type { EngineConfig, MatchupOverrides } from "./engine";
import type { Region, TournamentRound } from "./team";

// ---------------------------------------------------------------------------
// Bracket Structure
// ---------------------------------------------------------------------------

/**
 * A single slot in the bracket, representing a team's position.
 * The 64-team bracket has 4 regions × 16 teams.
 * Standard NCAA bracket seeding order within a region:
 * Game 1: 1 vs 16, Game 2: 8 vs 9, Game 3: 5 vs 12, Game 4: 4 vs 13,
 * Game 5: 6 vs 11, Game 6: 3 vs 14, Game 7: 7 vs 10, Game 8: 2 vs 15
 */
export interface BracketSlot {
  /** Team's unique ID (references TeamSeason.teamId) */
  teamId: string;
  /** Tournament seed (1–16) */
  seed: number;
  /** Bracket region */
  region: Region;
}

/** A single matchup in the bracket */
export interface BracketMatchup {
  /** Unique game identifier (e.g., "R64-East-1" for East region, first R64 game) */
  gameId: string;
  /** Tournament round */
  round: TournamentRound;
  /** Region (undefined for Final Four and Championship) */
  region?: Region;
  /** Slot index of team A in the bracket (or gameId of feeder game) */
  teamASource: string;
  /** Slot index of team B in the bracket (or gameId of feeder game) */
  teamBSource: string;
  /** Optional per-matchup overrides */
  overrides?: MatchupOverrides;
}

// ---------------------------------------------------------------------------
// Play-In (First Four) Types
// ---------------------------------------------------------------------------

/**
 * A detected First Four play-in matchup.
 * Two teams share the same region and seed — they must play a
 * play-in game before entering the main bracket.
 */
export interface PlayInMatchup {
  /** Bracket region where the winner enters */
  region: Region;
  /** Seed number (typically 11 or 16) */
  seed: number;
  /** Team A's unique ID */
  teamAId: string;
  /** Team B's unique ID */
  teamBId: string;
}

/**
 * Configuration for First Four play-in games.
 * Contains 0–4 play-in matchups detected from the tournament field.
 */
export interface PlayInConfig {
  /** The play-in matchups (typically 4: two 11-seed pairs, two 16-seed pairs) */
  matchups: PlayInMatchup[];
}

// ---------------------------------------------------------------------------
// Simulation Configuration
// ---------------------------------------------------------------------------

/** Configuration for a simulation run */
export interface SimulationConfig {
  /** Number of simulations to run (10000, 25000, 50000, 100000) */
  numSimulations: number;
  /** Engine configuration (levers, model parameters) */
  engineConfig: EngineConfig;
  /** Per-matchup overrides keyed by gameId */
  matchupOverrides?: Record<string, MatchupOverrides>;
  /** User bracket picks keyed by gameId → winning teamId. Locked-in picks skip probability computation. */
  picks?: Record<string, string>;
  /** Optional play-in configuration for First Four games */
  playInConfig?: PlayInConfig;
  /** Random seed for reproducible results (optional) */
  randomSeed?: number;
}

/** Default simulation counts available to users */
export const SIMULATION_COUNT_OPTIONS = [10000, 25000, 50000, 100000] as const;
export type SimulationCount = (typeof SIMULATION_COUNT_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Simulation Results
// ---------------------------------------------------------------------------

/** Per-team simulation results */
export interface TeamSimulationResult {
  /** Team ID */
  teamId: string;
  /** Team seed */
  seed: number;
  /** Region */
  region: Region;
  /** Probability of reaching each round (0–1) */
  roundProbabilities: Record<TournamentRound, number>;
  /** Probability of winning the championship */
  championshipProbability: number;
  /** Expected number of wins (weighted average across simulations) */
  expectedWins: number;
}

/** A single simulated bracket (one complete run) */
export interface SimulatedBracket {
  /** Winner of each game, keyed by gameId */
  gameResults: Record<string, string>;
  /** The champion's team ID */
  champion: string;
}

/** Aggregated simulation results across all runs */
export interface SimulationResult {
  /** Per-team aggregated results */
  teamResults: TeamSimulationResult[];
  /** Number of simulations completed */
  numSimulations: number;
  /** Most likely champion (team with highest championship probability) */
  mostLikelyChampion: {
    teamId: string;
    probability: number;
  };
  /** Top 10 most likely champions */
  topChampions: { teamId: string; probability: number }[];
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Per-round upset rates (% of games won by lower seed) */
  upsetRates: Record<TournamentRound, number>;
}

// ---------------------------------------------------------------------------
// API Request / Response
// ---------------------------------------------------------------------------

/** Request body for POST /api/simulate */
export interface SimulationRequest {
  /** Season year */
  season: number;
  /** Simulation configuration */
  config: SimulationConfig;
  /** Team IDs to include (64 teams, in bracket order) */
  teamIds: string[];
}

/** Response from POST /api/simulate */
export interface SimulationResponse {
  success: boolean;
  result?: SimulationResult;
  error?: string;
}
