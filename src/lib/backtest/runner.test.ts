/**
 * Tests for the backtest runner.
 *
 * Validates:
 * 1. Team lookup construction
 * 2. Per-game evaluation (model vs baseline)
 * 3. Single-year backtest orchestration
 * 4. Multi-year aggregation
 * 5. Missing team fallback to baseline
 * 6. Anomalous year flagging
 * 7. Train/test split labeling
 */

import { describe, it, expect } from "vitest";
import {
  buildTeamLookup,
  evaluateGame,
  runBacktestYear,
  runBacktestMultiYear,
} from "./runner";
import type { TeamSeason } from "@/types/team";
import type { EngineConfig } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type {
  HistoricalGameResult,
  TournamentResults,
} from "@/types/backtest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTeamSeason(
  overrides: Partial<TeamSeason> & { name: string; shortName?: string }
): TeamSeason {
  const name = overrides.name;
  const shortName = overrides.shortName ?? name;
  return {
    id: `ts-${name.toLowerCase().replace(/\s/g, "-")}`,
    teamId: `t-${name.toLowerCase().replace(/\s/g, "-")}`,
    season: overrides.season ?? 2024,
    team: {
      id: `t-${name.toLowerCase().replace(/\s/g, "-")}`,
      name,
      shortName,
      conference: "Big 12",
      campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
    },
    ratings: {
      torvik: {
        source: "torvik",
        adjOE: 110,
        adjDE: 95,
        adjEM: 15,
        ...(overrides.ratings?.torvik ?? {}),
      },
    },
    fourFactorsOffense: { efgPct: 52, toPct: 18, orbPct: 30, ftRate: 35 },
    fourFactorsDefense: { efgPct: 48, toPct: 20, orbPct: 27, ftRate: 30 },
    shootingOffense: { threePtPct: 35, threePtRate: 36, ftPct: 75 },
    shootingDefense: { threePtPct: 32, threePtRate: 34, ftPct: 72 },
    adjTempo: 68,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 16.0,
    benchMinutesPct: 0.3,
    experience: 2.0,
    minutesContinuity: 0.5,
    avgHeight: 76,
    twoFoulParticipation: 0.7,
    sosNetRating: 0,
    sosOffRating: 0,
    sosDefRating: 0,
    luck: 0,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
    coach: {
      name: "Coach Test",
      tournamentGames: 10,
      tournamentWins: 6,
      finalFours: 1,
      championships: 0,
      yearsHeadCoach: 5,
    },
    updatedAt: "2024-01-01",
    dataSources: ["torvik"],
  } as TeamSeason;
}

function makeGame(overrides: Partial<HistoricalGameResult> = {}): HistoricalGameResult {
  return {
    season: 2024,
    round: "R64",
    region: "East",
    winnerName: "Duke",
    winnerSeed: 1,
    loserName: "Vermont",
    loserSeed: 16,
    ...overrides,
  };
}

function makeTournamentResults(
  overrides: Partial<TournamentResults> = {}
): TournamentResults {
  return {
    season: 2024,
    anomalous: false,
    games: [
      makeGame(),
      makeGame({
        winnerName: "Kentucky",
        winnerSeed: 2,
        loserName: "Colgate",
        loserSeed: 15,
        round: "R64",
        region: "South",
      }),
    ],
    ...overrides,
  };
}

const config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };

// ---------------------------------------------------------------------------
// buildTeamLookup
// ---------------------------------------------------------------------------

describe("buildTeamLookup", () => {
  it("indexes teams by full name", () => {
    const teams = [makeTeamSeason({ name: "Duke", shortName: "Duke" })];
    const lookup = buildTeamLookup(teams);
    expect(lookup.get("Duke")).toBeDefined();
  });

  it("indexes teams by short name", () => {
    const teams = [
      makeTeamSeason({ name: "Connecticut", shortName: "UConn" }),
    ];
    const lookup = buildTeamLookup(teams);
    expect(lookup.get("UConn")).toBeDefined();
    expect(lookup.get("Connecticut")).toBeDefined();
  });

  it("handles multiple teams", () => {
    const teams = [
      makeTeamSeason({ name: "Duke" }),
      makeTeamSeason({ name: "Kentucky" }),
    ];
    const lookup = buildTeamLookup(teams);
    expect(lookup.size).toBeGreaterThanOrEqual(2);
  });

  it("registers team name aliases for known variants", () => {
    const teams = [
      makeTeamSeason({ name: "North Carolina St.", shortName: "NC State" }),
    ];
    const lookup = buildTeamLookup(teams);
    // Primary names
    expect(lookup.get("North Carolina St.")).toBeDefined();
    expect(lookup.get("NC State")).toBeDefined();
    // Alias from TEAM_NAME_ALIASES
    expect(lookup.get("N.C. State")).toBeDefined();
  });

  it("registers aliases from short name too", () => {
    const teams = [
      makeTeamSeason({ name: "Connecticut", shortName: "UConn" }),
    ];
    const lookup = buildTeamLookup(teams);
    expect(lookup.get("Connecticut")).toBeDefined();
    expect(lookup.get("UConn")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateGame
// ---------------------------------------------------------------------------

describe("evaluateGame", () => {
  it("uses resolveMatchup when both teams are found", () => {
    const teams = [
      makeTeamSeason({
        name: "Duke",
        ratings: { torvik: { source: "torvik", adjOE: 120, adjDE: 92, adjEM: 28 } },
      }),
      makeTeamSeason({
        name: "Vermont",
        ratings: { torvik: { source: "torvik", adjOE: 100, adjDE: 105, adjEM: -5 } },
      }),
    ];
    const lookup = buildTeamLookup(teams);

    const result = evaluateGame(makeGame(), lookup, config);

    expect(result).not.toBeNull();
    expect(result!.modelScore.usedBaseline).toBe(false);
    // Duke (1-seed, higher seed) is Team A; should have high predicted probability
    expect(result!.modelScore.predictedProbA).toBeGreaterThan(0.7);
    // Duke (1-seed, Team A) won, so actualOutcome = 1
    expect(result!.modelScore.actualOutcome).toBe(1);
    // Brier should be relatively low (good prediction)
    expect(result!.modelScore.brierScore).toBeLessThan(0.15);
  });

  it("falls back to seed baseline when team is missing", () => {
    // Only Duke in lookup, Vermont missing
    const teams = [makeTeamSeason({ name: "Duke" })];
    const lookup = buildTeamLookup(teams);

    const result = evaluateGame(makeGame(), lookup, config);

    expect(result).not.toBeNull();
    expect(result!.modelScore.usedBaseline).toBe(true);
    // 1v16 seed baseline ≈ 0.993 (Team A is Duke, the 1-seed)
    expect(result!.modelScore.predictedProbA).toBeCloseTo(0.993, 2);
  });

  it("always computes baseline score using seed probabilities", () => {
    const teams = [
      makeTeamSeason({ name: "Duke" }),
      makeTeamSeason({ name: "Vermont" }),
    ];
    const lookup = buildTeamLookup(teams);

    const result = evaluateGame(makeGame(), lookup, config);

    expect(result!.baselineScore.usedBaseline).toBe(true);
    // 1v16 baseline (Team A = 1-seed Duke)
    expect(result!.baselineScore.predictedProbA).toBeCloseTo(0.993, 2);
  });

  it("assigns higher seed as Team A for balanced calibration", () => {
    const teams = [
      makeTeamSeason({ name: "Duke" }),
      makeTeamSeason({ name: "Vermont" }),
    ];
    const lookup = buildTeamLookup(teams);

    // Standard game: Duke (1) beats Vermont (16)
    const result = evaluateGame(makeGame(), lookup, config);
    expect(result!.modelScore.teamAName).toBe("Duke"); // 1-seed = Team A
    expect(result!.modelScore.teamBName).toBe("Vermont"); // 16-seed = Team B
    expect(result!.modelScore.actualOutcome).toBe(1); // Higher seed won
    expect(result!.baselineScore.actualOutcome).toBe(1);
  });

  it("marks actualOutcome as 0 when an upset occurs", () => {
    const teams = [
      makeTeamSeason({ name: "Duke" }),
      makeTeamSeason({ name: "Vermont" }),
    ];
    const lookup = buildTeamLookup(teams);

    // Upset: Vermont (16) beats Duke (1)
    const upsetGame = makeGame({
      winnerName: "Vermont",
      winnerSeed: 16,
      loserName: "Duke",
      loserSeed: 1,
    });
    const result = evaluateGame(upsetGame, lookup, config);
    expect(result!.modelScore.teamAName).toBe("Duke"); // 1-seed still Team A
    expect(result!.modelScore.teamBName).toBe("Vermont"); // 16-seed still Team B
    expect(result!.modelScore.actualOutcome).toBe(0); // Higher seed lost (upset)
    expect(result!.baselineScore.actualOutcome).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runBacktestYear
// ---------------------------------------------------------------------------

describe("runBacktestYear", () => {
  it("evaluates all games in a season", () => {
    const teams = [
      makeTeamSeason({ name: "Duke" }),
      makeTeamSeason({ name: "Vermont" }),
      makeTeamSeason({ name: "Kentucky" }),
      makeTeamSeason({ name: "Colgate" }),
    ];

    const result = runBacktestYear(makeTournamentResults(), teams, config);

    expect(result.gamesEvaluated).toBe(2);
    expect(result.season).toBe(2024);
    expect(result.modelScore.gameCount).toBe(2);
    expect(result.baselineScore.gameCount).toBe(2);
  });

  it("tracks unresolved teams", () => {
    // Only Duke resolved — Vermont, Kentucky, Colgate missing
    const teams = [makeTeamSeason({ name: "Duke" })];

    const result = runBacktestYear(makeTournamentResults(), teams, config);

    // Both games should fall back to baseline (missing at least one team)
    expect(result.unresolvedTeams).toBe(2);
  });

  it("calculates improvement over baseline", () => {
    const teams = [
      makeTeamSeason({
        name: "Duke",
        ratings: { torvik: { source: "torvik", adjOE: 120, adjDE: 90, adjEM: 30 } },
      }),
      makeTeamSeason({
        name: "Vermont",
        ratings: { torvik: { source: "torvik", adjOE: 95, adjDE: 108, adjEM: -13 } },
      }),
      makeTeamSeason({
        name: "Kentucky",
        ratings: { torvik: { source: "torvik", adjOE: 118, adjDE: 93, adjEM: 25 } },
      }),
      makeTeamSeason({
        name: "Colgate",
        ratings: { torvik: { source: "torvik", adjOE: 98, adjDE: 105, adjEM: -7 } },
      }),
    ];

    const result = runBacktestYear(makeTournamentResults(), teams, config);

    // Model uses actual efficiency data, should be comparable to or better than seed baseline
    expect(result.improvement).toBeDefined();
    expect(typeof result.improvement).toBe("number");
  });

  it("flags anomalous seasons", () => {
    const seasonData = makeTournamentResults({
      season: 2021,
      anomalous: true,
      anomalyNote: "COVID bubble",
    });

    const result = runBacktestYear(seasonData, [], config);

    expect(result.anomalous).toBe(true);
    expect(result.anomalyNote).toBe("COVID bubble");
  });

  it("assigns train label for pre-2020 seasons", () => {
    const seasonData = makeTournamentResults({ season: 2019 });
    const result = runBacktestYear(seasonData, [], config);
    expect(result.splitLabel).toBe("train");
  });

  it("assigns test label for post-2020 seasons", () => {
    const seasonData = makeTournamentResults({ season: 2022 });
    const result = runBacktestYear(seasonData, [], config);
    expect(result.splitLabel).toBe("test");
  });

  it("handles empty team data gracefully", () => {
    const result = runBacktestYear(makeTournamentResults(), [], config);

    // All games should fall back to baseline
    expect(result.unresolvedTeams).toBe(2);
    expect(result.gamesEvaluated).toBe(2);
    expect(result.modelScore.overallBrier).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// runBacktestMultiYear
// ---------------------------------------------------------------------------

describe("runBacktestMultiYear", () => {
  it("aggregates results across multiple seasons", () => {
    const season2023 = makeTournamentResults({ season: 2023 });
    const season2024 = makeTournamentResults({ season: 2024 });

    const teamsBySeason = new Map<number, TeamSeason[]>();
    teamsBySeason.set(2023, [
      makeTeamSeason({ name: "Duke", season: 2023 }),
      makeTeamSeason({ name: "Vermont", season: 2023 }),
      makeTeamSeason({ name: "Kentucky", season: 2023 }),
      makeTeamSeason({ name: "Colgate", season: 2023 }),
    ]);
    teamsBySeason.set(2024, [
      makeTeamSeason({ name: "Duke", season: 2024 }),
      makeTeamSeason({ name: "Vermont", season: 2024 }),
      makeTeamSeason({ name: "Kentucky", season: 2024 }),
      makeTeamSeason({ name: "Colgate", season: 2024 }),
    ]);

    const result = runBacktestMultiYear(
      [season2023, season2024],
      teamsBySeason,
      config
    );

    expect(result.years).toHaveLength(2);
    expect(result.totalGames).toBe(4);
    expect(result.overallModelBrier).toBeGreaterThan(0);
    expect(result.overallBaselineBrier).toBeGreaterThan(0);
  });

  it("calculates separate train and test Brier scores", () => {
    const trainSeason = makeTournamentResults({ season: 2019 });
    const testSeason = makeTournamentResults({ season: 2023 });

    const teamsBySeason = new Map<number, TeamSeason[]>();

    const result = runBacktestMultiYear(
      [trainSeason, testSeason],
      teamsBySeason,
      config
    );

    expect(result.trainModelBrier).toBeGreaterThan(0);
    expect(result.testModelBrier).toBeGreaterThan(0);
  });

  it("produces calibration bins", () => {
    const seasonData = makeTournamentResults();
    const teamsBySeason = new Map<number, TeamSeason[]>();

    const result = runBacktestMultiYear(
      [seasonData],
      teamsBySeason,
      config
    );

    expect(result.calibration).toHaveLength(10);
    // At least one bin should have predictions
    const nonEmptyBins = result.calibration.filter((b) => b.count > 0);
    expect(nonEmptyBins.length).toBeGreaterThan(0);
  });

  it("handles missing season data gracefully", () => {
    const seasonData = makeTournamentResults({ season: 2024 });
    const teamsBySeason = new Map<number, TeamSeason[]>();
    // No data for 2024

    const result = runBacktestMultiYear(
      [seasonData],
      teamsBySeason,
      config
    );

    // Should still produce results (using baseline)
    expect(result.years).toHaveLength(1);
    expect(result.totalGames).toBe(2);
  });

  it("calculates overall improvement", () => {
    const seasonData = makeTournamentResults();
    const teamsBySeason = new Map<number, TeamSeason[]>();

    const result = runBacktestMultiYear(
      [seasonData],
      teamsBySeason,
      config
    );

    expect(typeof result.overallImprovement).toBe("number");
  });
});
