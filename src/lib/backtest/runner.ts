/**
 * Backtest runner — orchestrates per-game probability evaluation
 * against historical tournament results.
 *
 * For each game that actually occurred in a historical tournament:
 * 1. Look up both teams' TeamSeason data
 * 2. Call resolveMatchup() to get the predicted win probability
 * 3. Compare against actual outcome via Brier Score
 * 4. Compare against the seed baseline model
 *
 * This approach evaluates probabilities directly (no Monte Carlo needed)
 * since we're comparing per-game predictions to per-game outcomes.
 */

import type { TeamSeason } from "@/types/team";
import type { TournamentRound } from "@/types/team";
import type { EngineConfig } from "@/types/engine";
import type {
  HistoricalGameResult,
  TournamentResults,
  BrierGameScore,
  BrierScoreResult,
  BacktestYearResult,
  BacktestResult,
  CalibrationBin,
} from "@/types/backtest";
import { ANOMALOUS_SEASONS, TRAIN_SEASONS, TEST_SEASONS } from "@/types/backtest";

import { resolveMatchup } from "@/lib/engine/matchup";
import { createBrierGameScore, calculateBrierScore } from "./brier-score";
import { getSeedBaselineProbability } from "./seed-baseline";
import { buildCalibrationBins } from "./calibration";

// ---------------------------------------------------------------------------
// Team Lookup
// ---------------------------------------------------------------------------

/**
 * Builds a team name → TeamSeason lookup map.
 * Uses the team's full name (team.name) and short name (team.shortName) as keys.
 */
export function buildTeamLookup(
  teams: TeamSeason[]
): Map<string, TeamSeason> {
  const lookup = new Map<string, TeamSeason>();

  for (const team of teams) {
    lookup.set(team.team.name, team);
    lookup.set(team.team.shortName, team);
  }

  return lookup;
}

// ---------------------------------------------------------------------------
// Per-Game Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a single historical game result against the model.
 *
 * @param game - Historical game result
 * @param teamLookup - Name → TeamSeason map for the relevant season
 * @param config - Engine configuration (levers + model parameters)
 * @returns Model and baseline Brier game scores, or null if both teams unresolvable
 */
export function evaluateGame(
  game: HistoricalGameResult,
  teamLookup: Map<string, TeamSeason>,
  config: EngineConfig
): {
  modelScore: BrierGameScore;
  baselineScore: BrierGameScore;
} | null {
  const round = game.round as TournamentRound;

  // Try to resolve both teams from the lookup
  const teamA = teamLookup.get(game.winnerName);
  const teamB = teamLookup.get(game.loserName);

  let predictedProbA: number;
  let usedBaseline = false;

  if (teamA && teamB) {
    // Both teams found — use the full probability engine
    const result = resolveMatchup(teamA, teamB, config);
    predictedProbA = result.winProbabilityA;
  } else {
    // One or both teams missing — fall back to seed baseline
    predictedProbA = getSeedBaselineProbability(
      game.winnerSeed,
      game.loserSeed,
      round
    );
    usedBaseline = true;
  }

  // Team A is the winner (actualOutcome = 1 means Team A won)
  const modelScore = createBrierGameScore({
    season: game.season,
    round,
    teamAName: game.winnerName,
    teamASeed: game.winnerSeed,
    teamBName: game.loserName,
    teamBSeed: game.loserSeed,
    predictedProbA,
    teamAWon: true,
    usedBaseline,
  });

  // Baseline always uses seed-based probability
  const baselineProbA = getSeedBaselineProbability(
    game.winnerSeed,
    game.loserSeed,
    round
  );

  const baselineScore = createBrierGameScore({
    season: game.season,
    round,
    teamAName: game.winnerName,
    teamASeed: game.winnerSeed,
    teamBName: game.loserName,
    teamBSeed: game.loserSeed,
    predictedProbA: baselineProbA,
    teamAWon: true,
    usedBaseline: true,
  });

  return { modelScore, baselineScore };
}

// ---------------------------------------------------------------------------
// Per-Season Backtest
// ---------------------------------------------------------------------------

/**
 * Runs a backtest for a single season.
 *
 * @param seasonData - Historical tournament results for this season
 * @param teams - All TeamSeason records for this season
 * @param config - Engine configuration
 * @returns BacktestYearResult with model and baseline scores
 */
export function runBacktestYear(
  seasonData: TournamentResults,
  teams: TeamSeason[],
  config: EngineConfig
): BacktestYearResult {
  const teamLookup = buildTeamLookup(teams);

  const modelScores: BrierGameScore[] = [];
  const baselineScores: BrierGameScore[] = [];
  let unresolvedTeams = 0;

  for (const game of seasonData.games) {
    const result = evaluateGame(game, teamLookup, config);

    if (!result) continue;

    modelScores.push(result.modelScore);
    baselineScores.push(result.baselineScore);

    if (result.modelScore.usedBaseline) {
      unresolvedTeams++;
    }
  }

  const modelResult = calculateBrierScore(modelScores);
  const baselineResult = calculateBrierScore(baselineScores);

  // Calculate improvement (positive = model is better, i.e., lower Brier)
  const improvement =
    baselineResult.overallBrier > 0
      ? (baselineResult.overallBrier - modelResult.overallBrier) /
        baselineResult.overallBrier
      : 0;

  // Determine train/test split
  const isTrain = (TRAIN_SEASONS as readonly number[]).includes(
    seasonData.season
  );
  const isTest = (TEST_SEASONS as readonly number[]).includes(
    seasonData.season
  );
  const splitLabel: "train" | "test" = isTest ? "test" : "train";

  return {
    season: seasonData.season,
    anomalous: seasonData.anomalous,
    anomalyNote: seasonData.anomalyNote,
    modelScore: modelResult,
    baselineScore: baselineResult,
    improvement,
    unresolvedTeams,
    gamesEvaluated: modelScores.length,
    splitLabel,
  };
}

// ---------------------------------------------------------------------------
// Multi-Season Backtest
// ---------------------------------------------------------------------------

/**
 * Runs backtests across multiple seasons and aggregates results.
 *
 * @param seasonResults - Array of tournament results to evaluate
 * @param teamsBySeason - Map from season year → TeamSeason array
 * @param config - Engine configuration
 * @returns Full BacktestResult with per-year and aggregate data
 */
export function runBacktestMultiYear(
  seasonResults: TournamentResults[],
  teamsBySeason: Map<number, TeamSeason[]>,
  config: EngineConfig
): BacktestResult {
  const years: BacktestYearResult[] = [];

  for (const seasonData of seasonResults) {
    const teams = teamsBySeason.get(seasonData.season) ?? [];
    const yearResult = runBacktestYear(seasonData, teams, config);
    years.push(yearResult);
  }

  // Aggregate scores across all years
  const allModelScores = years.flatMap((y) => y.modelScore.gameScores);
  const allBaselineScores = years.flatMap((y) => y.baselineScore.gameScores);

  const overallModelResult = calculateBrierScore(allModelScores);
  const overallBaselineResult = calculateBrierScore(allBaselineScores);

  const overallImprovement =
    overallBaselineResult.overallBrier > 0
      ? (overallBaselineResult.overallBrier - overallModelResult.overallBrier) /
        overallBaselineResult.overallBrier
      : 0;

  // Calculate train/test splits
  const trainYears = years.filter((y) => y.splitLabel === "train");
  const testYears = years.filter((y) => y.splitLabel === "test");

  const trainModelScores = trainYears.flatMap((y) => y.modelScore.gameScores);
  const testModelScores = testYears.flatMap((y) => y.modelScore.gameScores);

  const trainModelResult = calculateBrierScore(trainModelScores);
  const testModelResult = calculateBrierScore(testModelScores);

  // Build calibration bins from all model predictions
  const calibration = buildCalibrationBins(allModelScores);

  const totalGames = years.reduce((sum, y) => sum + y.gamesEvaluated, 0);

  return {
    years,
    overallModelBrier: overallModelResult.overallBrier,
    overallBaselineBrier: overallBaselineResult.overallBrier,
    overallImprovement,
    trainModelBrier: trainModelResult.overallBrier,
    testModelBrier: testModelResult.overallBrier,
    totalGames,
    calibration,
  };
}
