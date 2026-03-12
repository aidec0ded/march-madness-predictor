/**
 * Types for the AI Matchup Narrative system (Phase 9).
 *
 * These types support the Claude-powered narrative analysis that
 * appears in the matchup detail view. The narrative synthesizes
 * structured team data, probability breakdowns, and pool context
 * into a plain-language matchup analysis.
 */

import type { TournamentRound } from "./team";
import type { ProbabilityBreakdown, MatchupOverrides } from "./engine";
import type { PoolSizeBucket } from "./game-theory";

// ---------------------------------------------------------------------------
// Narrative Request (client → server)
// ---------------------------------------------------------------------------

/**
 * Request body sent to POST /api/narrative.
 *
 * Contains all the data needed to build the Claude prompt:
 * team data, matchup context, pool context, and overrides.
 */
export interface NarrativeRequest {
  /** Game identifier */
  gameId: string;
  /** Tournament round */
  round: TournamentRound;

  // --- Team data (serialized TeamSeason fields) ---
  /** Team A data block (pre-formatted by the client) */
  teamAData: NarrativeTeamData;
  /** Team B data block */
  teamBData: NarrativeTeamData;

  // --- Matchup context ---
  /** Win probability for Team A (0-1) */
  probA: number;
  /** Estimated point spread (positive = A favored) */
  spread: number;
  /** Full probability breakdown */
  breakdown: ProbabilityBreakdown;
  /** Per-matchup overrides applied (if any) */
  overrides?: MatchupOverrides;

  // --- Pool context ---
  /** Pool size bucket */
  poolSizeBucket: PoolSizeBucket;
  /** Ownership % for Team A in this round */
  ownershipA: number;
  /** Ownership % for Team B in this round */
  ownershipB: number;
  /** Leverage score for Team A */
  leverageA: number;
  /** Leverage score for Team B */
  leverageB: number;
  /** Pool strategy description */
  poolDescription: string;
}

// ---------------------------------------------------------------------------
// Serialized Team Data
// ---------------------------------------------------------------------------

/**
 * Serialized team data included in the narrative request.
 * This is a subset of TeamSeason fields formatted for the prompt.
 */
export interface NarrativeTeamData {
  /** Team short name */
  name: string;
  /** Tournament seed */
  seed: number;
  /** Region */
  region: string;
  /** Conference */
  conference: string;

  // Efficiency ratings
  kenpomAdjOE?: number;
  kenpomAdjDE?: number;
  kenpomAdjEM?: number;
  torvikAdjOE?: number;
  torvikAdjDE?: number;
  torvikAdjEM?: number;
  miyaBPR?: number;

  // Four Factors (offense)
  offEfgPct: number;
  offToPct: number;
  offOrbPct: number;
  offFtRate: number;

  // Four Factors (defense)
  defEfgPct: number;
  defToPct: number;
  defOrbPct: number;
  defFtRate: number;

  // Shooting
  offThreePtPct: number;
  offThreePtRate: number;
  offFtPct: number;
  defThreePtPct: number;
  defThreePtRate: number;

  // Tempo
  adjTempo: number;
  avgPossLengthOff: number;
  avgPossLengthDef: number;

  // Roster
  experience: number;
  minutesContinuity: number;
  benchMinutesPct: number;
  avgHeight: number;

  // Style
  twoFoulParticipation: number;

  // Schedule & Luck
  sosNetRating?: number;
  luck?: number;

  // Evan Miya metrics
  evanmiyaOpponentAdjust?: number;
  evanmiyaPaceAdjust?: number;
  evanmiyaKillShotsPerGame?: number;
  evanmiyaKillShotsAllowedPerGame?: number;
  evanmiyaKillShotsMargin?: number;

  // Coach
  coachName: string;
  coachTournamentWins: number;
  coachTournamentGames: number;
  coachFinalFours: number;
  coachChampionships: number;
  coachYearsHC: number;
}

// ---------------------------------------------------------------------------
// Narrative State (client-side)
// ---------------------------------------------------------------------------

/** Status of the narrative generation */
export type NarrativeStatus = "idle" | "generating" | "complete" | "error";

/** Client-side state for the narrative panel */
export interface NarrativeState {
  /** Current status */
  status: NarrativeStatus;
  /** Accumulated narrative text (streams in during generation) */
  text: string;
  /** Error message if status is "error" */
  error?: string;
}

/** Cache entry for a completed narrative */
export interface NarrativeCacheEntry {
  /** The input data hash this narrative was generated from */
  hash: string;
  /** The generated narrative text */
  text: string;
  /** Timestamp when generated */
  generatedAt: number;
}
