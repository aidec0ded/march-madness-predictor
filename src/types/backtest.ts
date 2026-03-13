/**
 * Types for the backtesting module (Phase 10).
 *
 * The backtesting system evaluates model calibration by replaying historical
 * tournaments (2008–2024) against actual results. For each game that occurred,
 * the model predicts a win probability using resolveMatchup(), and the
 * prediction is scored using Brier Score: (predicted - actual)².
 *
 * Results are compared against a naive seed-based baseline to measure
 * the model's added value beyond simple seed matchup heuristics.
 */

import type { TournamentRound } from "./team";
import type { EngineConfig } from "./engine";

// ---------------------------------------------------------------------------
// Historical Results Data
// ---------------------------------------------------------------------------

/**
 * A single historical tournament game result.
 * Represents who won and who lost, identified by team name and seed.
 */
export interface HistoricalGameResult {
  /** Season year (e.g., 2024 for the 2023-24 tournament) */
  season: number;
  /** Tournament round */
  round: TournamentRound;
  /** Bracket region (undefined for Final Four and Championship) */
  region?: string;
  /** Name of the winning team (Torvik naming convention) */
  winnerName: string;
  /** Seed of the winning team */
  winnerSeed: number;
  /** Name of the losing team (Torvik naming convention) */
  loserName: string;
  /** Seed of the losing team */
  loserSeed: number;
}

/**
 * All tournament results for a single season.
 */
export interface TournamentResults {
  /** Season year */
  season: number;
  /** Whether this season had anomalous conditions */
  anomalous: boolean;
  /** Description of anomalous conditions (e.g., "COVID bubble") */
  anomalyNote?: string;
  /** All 63 games in the tournament */
  games: HistoricalGameResult[];
}

// ---------------------------------------------------------------------------
// Brier Score Types
// ---------------------------------------------------------------------------

/**
 * Brier Score result for a single game.
 * BS = (predicted_probability - actual_outcome)²
 * where actual_outcome is 1 if the higher-predicted team won, 0 otherwise.
 */
export interface BrierGameScore {
  /** Season year */
  season: number;
  /** Tournament round */
  round: TournamentRound;
  /** Team A name (the team whose probability we track) */
  teamAName: string;
  /** Team A seed */
  teamASeed: number;
  /** Team B name */
  teamBName: string;
  /** Team B seed */
  teamBSeed: number;
  /** Model's predicted probability that Team A wins (0–1) */
  predictedProbA: number;
  /** Actual outcome: 1 if Team A won, 0 if Team B won */
  actualOutcome: number;
  /** Brier Score for this game: (predicted - actual)² */
  brierScore: number;
  /** Whether the team was resolved from DB data or fell back to seed baseline */
  usedBaseline: boolean;
}

/**
 * Aggregated Brier Score results.
 */
export interface BrierScoreResult {
  /** Overall Brier Score (average across all games) */
  overallBrier: number;
  /** Number of games scored */
  gameCount: number;
  /** Per-round Brier Scores */
  byRound: Record<TournamentRound, { brier: number; count: number }>;
  /** Individual game scores */
  gameScores: BrierGameScore[];
}

// ---------------------------------------------------------------------------
// Backtest Results
// ---------------------------------------------------------------------------

/**
 * Backtest results for a single season.
 */
export interface BacktestYearResult {
  /** Season year */
  season: number;
  /** Whether this season was flagged as anomalous */
  anomalous: boolean;
  /** Anomaly description */
  anomalyNote?: string;
  /** Model Brier Score results */
  modelScore: BrierScoreResult;
  /** Seed baseline Brier Score results */
  baselineScore: BrierScoreResult;
  /** Model improvement over baseline (positive = better) */
  improvement: number;
  /** Number of teams that could not be resolved from DB (used baseline) */
  unresolvedTeams: number;
  /** Total games evaluated */
  gamesEvaluated: number;
  /** Whether this season is in the training set or test set */
  splitLabel: "train" | "test";
}

/**
 * Aggregated backtest results across multiple seasons.
 */
export interface BacktestResult {
  /** Per-season results */
  years: BacktestYearResult[];
  /** Overall model Brier Score across all seasons */
  overallModelBrier: number;
  /** Overall baseline Brier Score across all seasons */
  overallBaselineBrier: number;
  /** Overall improvement percentage */
  overallImprovement: number;
  /** Train-set model Brier Score */
  trainModelBrier: number;
  /** Test-set model Brier Score */
  testModelBrier: number;
  /** Total games scored */
  totalGames: number;
  /** Calibration data for visualization */
  calibration: CalibrationBin[];
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/**
 * A single calibration bin — groups predictions by probability range
 * and compares predicted vs actual win rates.
 */
export interface CalibrationBin {
  /** Lower bound of the bin (inclusive), e.g., 0.5 */
  binStart: number;
  /** Upper bound of the bin (exclusive), e.g., 0.6 */
  binEnd: number;
  /** Midpoint of the bin for plotting */
  midpoint: number;
  /** Average predicted probability within this bin */
  avgPredicted: number;
  /** Actual win rate within this bin */
  actualWinRate: number;
  /** Number of predictions in this bin */
  count: number;
}

// ---------------------------------------------------------------------------
// Train/Test Split
// ---------------------------------------------------------------------------

/** Default training years (pre-COVID) */
export const TRAIN_SEASONS = [
  2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
] as const;

/** Default test years (post-COVID) */
export const TEST_SEASONS = [2021, 2022, 2023, 2024, 2025] as const;

/** All available seasons (2020 excluded — cancelled) */
export const ALL_SEASONS = [...TRAIN_SEASONS, ...TEST_SEASONS] as const;

/** Anomalous seasons with known confounding factors */
export const ANOMALOUS_SEASONS: Record<number, string> = {
  2021: "COVID bubble — all games in Indianapolis",
};

// ---------------------------------------------------------------------------
// API Request / Response
// ---------------------------------------------------------------------------

/**
 * Request body for POST /api/backtest.
 */
export interface BacktestRequest {
  /** Seasons to evaluate */
  seasons: number[];
  /** Engine configuration (levers + model parameters) */
  engineConfig?: Partial<EngineConfig>;
}

/**
 * Response from POST /api/backtest.
 */
export interface BacktestResponse {
  success: boolean;
  result?: BacktestResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Seed Baseline Constants
// ---------------------------------------------------------------------------

/**
 * Historical win rates by seed matchup (Round of 64 only).
 * Based on 1985–2024 tournament data.
 * Key format: "higherSeed-lowerSeed" (e.g., "1-16" means 1-seed vs 16-seed).
 */
export const SEED_MATCHUP_WIN_RATES: Record<string, number> = {
  "1-16": 0.993,
  "2-15": 0.944,
  "3-14": 0.851,
  "4-13": 0.793,
  "5-12": 0.649,
  "6-11": 0.628,
  "7-10": 0.609,
  "8-9": 0.511,
};

/**
 * Round labels for display purposes.
 */
export const ROUND_LABELS: Record<TournamentRound, string> = {
  FF: "First Four",
  R64: "Round of 64",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8: "Elite 8",
  F4: "Final Four",
  NCG: "Championship",
};
