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
 * Bidirectional alias map for team name normalization.
 *
 * The scraper (scrape-tournament-results.ts) normalizes sports-reference names
 * to Torvik format via NAME_FIXES, while the DB stores names from the Torvik
 * API directly. These don't always agree, so we register both directions.
 *
 * Each key maps to an array of known aliases for that team.
 * When building the team lookup, all aliases for a matched team are registered.
 */
const TEAM_NAME_ALIASES: Record<string, string[]> = {
  // Full name ↔ common abbreviation
  Connecticut: ["UConn"],
  "North Carolina": ["UNC"],
  "North Carolina St.": ["NC State", "N.C. State"],
  "Southern California": ["USC"],
  "Brigham Young": ["BYU"],
  "Texas Christian": ["TCU"],
  "Virginia Commonwealth": ["VCU"],
  "College of Charleston": ["Charleston"],
  "Loyola Chicago": ["Loyola-Chi", "Loyola (IL)"],
  "Loyola MD": ["Loyola (MD)"],
  "Saint Mary's": ["St. Mary's"],
  "Saint Joseph's": ["St. Joe's", "St. Joseph's"],
  "Saint Peter's": ["St. Peter's"],
  "Saint Bonaventure": ["St. Bonaventure"],
  "St. John's": ["Saint John's"],
  "Miami FL": ["Miami", "Miami (FL)"],
  "Miami OH": ["Miami (OH)"],
  "Florida Gulf Coast": ["FGCU"],
  "Middle Tennessee": ["MTSU"],
  "Stephen F. Austin": ["SFA"],
  "Fairleigh Dickinson": ["FDU"],
  Massachusetts: ["UMass"],
  "South Florida": ["USF"],
  "Central Florida": ["UCF"],
  UAB: ["Alabama-Birmingham"],
  // McNeese: Torvik may use "McNeese St." or "McNeese"
  McNeese: ["McNeese St."],
  "McNeese St.": ["McNeese"],
  // State suffix variants (Torvik uses "St." abbreviation)
  "Sam Houston St.": ["Sam Houston", "Sam Houston State"],
  "Grambling St.": ["Grambling", "Grambling State"],
  "Kennesaw St.": ["Kennesaw State"],
  "Sacramento St.": ["Sacramento State"],
  "Cal St. Fullerton": ["Cal State Fullerton"],
  "Cal St. Bakersfield": ["Cal State Bakersfield"],
  "Southeast Missouri St.": ["Southeast Missouri State"],
  "Texas A&M Corpus Christi": [
    "Texas A&M-Corpus Christi",
    "Texas A&M–Corpus Christi",
  ],
};

/**
 * Builds a flattened alias lookup: given any name variant, returns an array of
 * all aliases (including the name itself).
 */
function buildAliasLookup(): Map<string, string[]> {
  const aliasMap = new Map<string, string[]>();

  for (const [canonical, aliases] of Object.entries(TEAM_NAME_ALIASES)) {
    const allNames = [canonical, ...aliases];
    for (const name of allNames) {
      aliasMap.set(name, allNames);
    }
  }

  return aliasMap;
}

const ALIAS_LOOKUP = buildAliasLookup();

/**
 * Builds a team name → TeamSeason lookup map.
 *
 * Indexes each team by:
 * 1. Full name (team.name)
 * 2. Short name (team.shortName)
 * 3. All known aliases from the TEAM_NAME_ALIASES table
 *
 * This ensures historical result names (from the scraper's NAME_FIXES) match
 * DB names (from the Torvik API) even when they differ slightly.
 */
export function buildTeamLookup(
  teams: TeamSeason[]
): Map<string, TeamSeason> {
  const lookup = new Map<string, TeamSeason>();

  for (const team of teams) {
    // Register primary names
    lookup.set(team.team.name, team);
    lookup.set(team.team.shortName, team);

    // Register all known aliases for this team
    for (const primaryName of [team.team.name, team.team.shortName]) {
      const aliases = ALIAS_LOOKUP.get(primaryName);
      if (aliases) {
        for (const alias of aliases) {
          if (!lookup.has(alias)) {
            lookup.set(alias, team);
          }
        }
      }
    }
  }

  return lookup;
}

// ---------------------------------------------------------------------------
// Per-Game Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a single historical game result against the model.
 *
 * Team A is always the higher-seeded team (lower seed number = better seed).
 * This ensures calibration bins contain a mix of wins (favorites winning)
 * and losses (upsets), rather than always showing actualOutcome = 1.
 *
 * The Brier Score math is symmetric: (p-1)² = ((1-p)-0)², so the average
 * Brier Score is identical regardless of team assignment order.
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

  // Assign Team A = higher seed (lower number = better seed).
  // When seeds are equal, keep the winner as team A (doesn't affect calibration).
  const higherSeedIsWinner = game.winnerSeed <= game.loserSeed;

  const teamAName = higherSeedIsWinner ? game.winnerName : game.loserName;
  const teamASeed = higherSeedIsWinner ? game.winnerSeed : game.loserSeed;
  const teamBName = higherSeedIsWinner ? game.loserName : game.winnerName;
  const teamBSeed = higherSeedIsWinner ? game.loserSeed : game.winnerSeed;
  const teamAWon = higherSeedIsWinner; // false when an upset occurs

  // Try to resolve both teams from the lookup
  const teamA = teamLookup.get(teamAName);
  const teamB = teamLookup.get(teamBName);

  let predictedProbA: number;
  let usedBaseline = false;

  if (teamA && teamB) {
    // Both teams found — use the full probability engine
    const result = resolveMatchup(teamA, teamB, config);
    predictedProbA = result.winProbabilityA;
  } else {
    // One or both teams missing — fall back to seed baseline
    predictedProbA = getSeedBaselineProbability(teamASeed, teamBSeed, round);
    usedBaseline = true;
  }

  const modelScore = createBrierGameScore({
    season: game.season,
    round,
    teamAName,
    teamASeed,
    teamBName,
    teamBSeed,
    predictedProbA,
    teamAWon,
    usedBaseline,
  });

  // Baseline always uses seed-based probability
  const baselineProbA = getSeedBaselineProbability(teamASeed, teamBSeed, round);

  const baselineScore = createBrierGameScore({
    season: game.season,
    round,
    teamAName,
    teamASeed,
    teamBName,
    teamBSeed,
    predictedProbA: baselineProbA,
    teamAWon,
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
