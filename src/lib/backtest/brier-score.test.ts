import { describe, it, expect } from "vitest";
import { createBrierGameScore, calculateBrierScore } from "./brier-score";
import type { BrierGameScore } from "@/types/backtest";
import type { TournamentRound } from "@/types/team";

// ---------------------------------------------------------------------------
// Helper to build a BrierGameScore quickly for calculateBrierScore tests
// ---------------------------------------------------------------------------
function makeGameScore(
  overrides: Partial<BrierGameScore> & {
    predictedProbA: number;
    actualOutcome: number;
    brierScore: number;
    round: TournamentRound;
  }
): BrierGameScore {
  return {
    season: 2024,
    round: overrides.round,
    teamAName: overrides.teamAName ?? "Team A",
    teamASeed: overrides.teamASeed ?? 1,
    teamBName: overrides.teamBName ?? "Team B",
    teamBSeed: overrides.teamBSeed ?? 16,
    predictedProbA: overrides.predictedProbA,
    actualOutcome: overrides.actualOutcome,
    brierScore: overrides.brierScore,
    usedBaseline: overrides.usedBaseline ?? false,
  };
}

// ---------------------------------------------------------------------------
// createBrierGameScore
// ---------------------------------------------------------------------------
describe("createBrierGameScore", () => {
  it("returns Brier Score of 0 for a perfect prediction (predict 1.0, team wins)", () => {
    const result = createBrierGameScore({
      season: 2024,
      round: "R64",
      teamAName: "Duke",
      teamASeed: 1,
      teamBName: "FGCU",
      teamBSeed: 16,
      predictedProbA: 1.0,
      teamAWon: true,
      usedBaseline: false,
    });

    expect(result.brierScore).toBe(0);
    expect(result.actualOutcome).toBe(1);
    expect(result.predictedProbA).toBe(1.0);
  });

  it("returns Brier Score of 1.0 for the worst prediction (predict 1.0, team loses)", () => {
    const result = createBrierGameScore({
      season: 2024,
      round: "R64",
      teamAName: "Virginia",
      teamASeed: 1,
      teamBName: "UMBC",
      teamBSeed: 16,
      predictedProbA: 1.0,
      teamAWon: false,
      usedBaseline: false,
    });

    expect(result.brierScore).toBe(1.0);
    expect(result.actualOutcome).toBe(0);
  });

  it("returns Brier Score of 0.25 for a coin-flip prediction (predict 0.5)", () => {
    const resultWin = createBrierGameScore({
      season: 2024,
      round: "R64",
      teamAName: "Memphis",
      teamASeed: 8,
      teamBName: "FAU",
      teamBSeed: 9,
      predictedProbA: 0.5,
      teamAWon: true,
      usedBaseline: false,
    });

    expect(resultWin.brierScore).toBe(0.25);

    const resultLoss = createBrierGameScore({
      season: 2024,
      round: "R64",
      teamAName: "Memphis",
      teamASeed: 8,
      teamBName: "FAU",
      teamBSeed: 9,
      predictedProbA: 0.5,
      teamAWon: false,
      usedBaseline: false,
    });

    expect(resultLoss.brierScore).toBe(0.25);
  });

  it("returns correct Brier Score for a typical prediction (predict 0.75, team wins)", () => {
    const result = createBrierGameScore({
      season: 2024,
      round: "R32",
      teamAName: "Purdue",
      teamASeed: 1,
      teamBName: "Utah St",
      teamBSeed: 8,
      predictedProbA: 0.75,
      teamAWon: true,
      usedBaseline: false,
    });

    expect(result.brierScore).toBeCloseTo(0.0625, 10);
  });

  it("returns correct Brier Score for a typical prediction when team loses (predict 0.75, team loses)", () => {
    const result = createBrierGameScore({
      season: 2024,
      round: "R32",
      teamAName: "Purdue",
      teamASeed: 1,
      teamBName: "Utah St",
      teamBSeed: 8,
      predictedProbA: 0.75,
      teamAWon: false,
      usedBaseline: false,
    });

    // (0.75 - 0)^2 = 0.5625
    expect(result.brierScore).toBeCloseTo(0.5625, 10);
  });

  it("correctly sets all fields on the returned BrierGameScore", () => {
    const result = createBrierGameScore({
      season: 2023,
      round: "S16",
      teamAName: "UConn",
      teamASeed: 4,
      teamBName: "Arkansas",
      teamBSeed: 8,
      predictedProbA: 0.62,
      teamAWon: true,
      usedBaseline: true,
    });

    expect(result.season).toBe(2023);
    expect(result.round).toBe("S16");
    expect(result.teamAName).toBe("UConn");
    expect(result.teamASeed).toBe(4);
    expect(result.teamBName).toBe("Arkansas");
    expect(result.teamBSeed).toBe(8);
    expect(result.predictedProbA).toBe(0.62);
    expect(result.actualOutcome).toBe(1);
    expect(result.usedBaseline).toBe(true);
    expect(result.brierScore).toBeCloseTo((0.62 - 1) ** 2, 10);
  });

  it("throws an error if predictedProbA is greater than 1", () => {
    expect(() =>
      createBrierGameScore({
        season: 2024,
        round: "R64",
        teamAName: "A",
        teamASeed: 1,
        teamBName: "B",
        teamBSeed: 16,
        predictedProbA: 1.1,
        teamAWon: true,
        usedBaseline: false,
      })
    ).toThrow("predictedProbA must be between 0 and 1");
  });

  it("throws an error if predictedProbA is less than 0", () => {
    expect(() =>
      createBrierGameScore({
        season: 2024,
        round: "R64",
        teamAName: "A",
        teamASeed: 1,
        teamBName: "B",
        teamBSeed: 16,
        predictedProbA: -0.1,
        teamAWon: true,
        usedBaseline: false,
      })
    ).toThrow("predictedProbA must be between 0 and 1");
  });
});

// ---------------------------------------------------------------------------
// calculateBrierScore
// ---------------------------------------------------------------------------
describe("calculateBrierScore", () => {
  it("returns zeroed result for an empty array", () => {
    const result = calculateBrierScore([]);

    expect(result.overallBrier).toBe(0);
    expect(result.gameCount).toBe(0);
    expect(result.gameScores).toHaveLength(0);

    // All rounds should be present with zero counts
    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    for (const round of rounds) {
      expect(result.byRound[round]).toEqual({ brier: 0, count: 0 });
    }
  });

  it("calculates correctly for a single game", () => {
    const game = makeGameScore({
      round: "R64",
      predictedProbA: 0.8,
      actualOutcome: 1,
      brierScore: (0.8 - 1) ** 2, // 0.04
    });

    const result = calculateBrierScore([game]);

    expect(result.overallBrier).toBeCloseTo(0.04, 10);
    expect(result.gameCount).toBe(1);
    expect(result.byRound["R64"].brier).toBeCloseTo(0.04, 10);
    expect(result.byRound["R64"].count).toBe(1);
    expect(result.byRound["R32"].count).toBe(0);
  });

  it("averages Brier Scores across multiple games in the same round", () => {
    const games: BrierGameScore[] = [
      // Perfect prediction: BS = 0
      makeGameScore({
        round: "R64",
        predictedProbA: 1.0,
        actualOutcome: 1,
        brierScore: 0,
      }),
      // Coin-flip: BS = 0.25
      makeGameScore({
        round: "R64",
        predictedProbA: 0.5,
        actualOutcome: 1,
        brierScore: 0.25,
      }),
      // Worst prediction: BS = 1.0
      makeGameScore({
        round: "R64",
        predictedProbA: 1.0,
        actualOutcome: 0,
        brierScore: 1.0,
      }),
    ];

    const result = calculateBrierScore(games);

    // Overall: (0 + 0.25 + 1.0) / 3 = 0.41667
    expect(result.overallBrier).toBeCloseTo(1.25 / 3, 10);
    expect(result.gameCount).toBe(3);
    expect(result.byRound["R64"].brier).toBeCloseTo(1.25 / 3, 10);
    expect(result.byRound["R64"].count).toBe(3);
  });

  it("aggregates per-round correctly across multiple rounds", () => {
    const games: BrierGameScore[] = [
      // R64 games: BS = 0.04 and 0.09 → avg = 0.065
      makeGameScore({
        round: "R64",
        predictedProbA: 0.8,
        actualOutcome: 1,
        brierScore: 0.04,
      }),
      makeGameScore({
        round: "R64",
        predictedProbA: 0.7,
        actualOutcome: 1,
        brierScore: 0.09,
      }),
      // R32 game: BS = 0.25
      makeGameScore({
        round: "R32",
        predictedProbA: 0.5,
        actualOutcome: 0,
        brierScore: 0.25,
      }),
      // S16 game: BS = 0.0625
      makeGameScore({
        round: "S16",
        predictedProbA: 0.75,
        actualOutcome: 1,
        brierScore: 0.0625,
      }),
      // NCG game: BS = 0.16
      makeGameScore({
        round: "NCG",
        predictedProbA: 0.6,
        actualOutcome: 1,
        brierScore: 0.16,
      }),
    ];

    const result = calculateBrierScore(games);

    // R64 avg: (0.04 + 0.09) / 2 = 0.065
    expect(result.byRound["R64"].brier).toBeCloseTo(0.065, 10);
    expect(result.byRound["R64"].count).toBe(2);

    // R32 avg: 0.25 / 1 = 0.25
    expect(result.byRound["R32"].brier).toBeCloseTo(0.25, 10);
    expect(result.byRound["R32"].count).toBe(1);

    // S16 avg: 0.0625 / 1 = 0.0625
    expect(result.byRound["S16"].brier).toBeCloseTo(0.0625, 10);
    expect(result.byRound["S16"].count).toBe(1);

    // E8 and F4 should be untouched
    expect(result.byRound["E8"]).toEqual({ brier: 0, count: 0 });
    expect(result.byRound["F4"]).toEqual({ brier: 0, count: 0 });

    // NCG
    expect(result.byRound["NCG"].brier).toBeCloseTo(0.16, 10);
    expect(result.byRound["NCG"].count).toBe(1);

    // Overall: (0.04 + 0.09 + 0.25 + 0.0625 + 0.16) / 5 = 0.1205
    const expectedOverall = (0.04 + 0.09 + 0.25 + 0.0625 + 0.16) / 5;
    expect(result.overallBrier).toBeCloseTo(expectedOverall, 10);
    expect(result.gameCount).toBe(5);
  });

  it("handles mixed results (wins and losses with varying predictions)", () => {
    const games: BrierGameScore[] = [
      // Confident correct: predict 0.9, wins → BS = 0.01
      makeGameScore({
        round: "E8",
        predictedProbA: 0.9,
        actualOutcome: 1,
        brierScore: 0.01,
      }),
      // Confident wrong: predict 0.9, loses → BS = 0.81
      makeGameScore({
        round: "E8",
        predictedProbA: 0.9,
        actualOutcome: 0,
        brierScore: 0.81,
      }),
      // Low confidence correct: predict 0.3, loses (correct for B) → BS = 0.09
      makeGameScore({
        round: "F4",
        predictedProbA: 0.3,
        actualOutcome: 0,
        brierScore: 0.09,
      }),
      // Low confidence wrong: predict 0.3, wins → BS = 0.49
      makeGameScore({
        round: "F4",
        predictedProbA: 0.3,
        actualOutcome: 1,
        brierScore: 0.49,
      }),
    ];

    const result = calculateBrierScore(games);

    // E8 avg: (0.01 + 0.81) / 2 = 0.41
    expect(result.byRound["E8"].brier).toBeCloseTo(0.41, 10);
    expect(result.byRound["E8"].count).toBe(2);

    // F4 avg: (0.09 + 0.49) / 2 = 0.29
    expect(result.byRound["F4"].brier).toBeCloseTo(0.29, 10);
    expect(result.byRound["F4"].count).toBe(2);

    // Overall: (0.01 + 0.81 + 0.09 + 0.49) / 4 = 0.35
    expect(result.overallBrier).toBeCloseTo(0.35, 10);
    expect(result.gameCount).toBe(4);
  });

  it("preserves the original gameScores array in the result", () => {
    const games: BrierGameScore[] = [
      makeGameScore({
        round: "NCG",
        teamAName: "UConn",
        teamBName: "Purdue",
        predictedProbA: 0.55,
        actualOutcome: 1,
        brierScore: 0.2025,
      }),
    ];

    const result = calculateBrierScore(games);

    expect(result.gameScores).toBe(games); // same reference
    expect(result.gameScores[0].teamAName).toBe("UConn");
    expect(result.gameScores[0].teamBName).toBe("Purdue");
  });

  it("handles all six rounds populated simultaneously", () => {
    const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    const games: BrierGameScore[] = rounds.map((round, i) =>
      makeGameScore({
        round,
        predictedProbA: 0.6 + i * 0.05, // 0.60, 0.65, 0.70, 0.75, 0.80, 0.85
        actualOutcome: 1,
        brierScore: (0.6 + i * 0.05 - 1) ** 2,
      })
    );

    const result = calculateBrierScore(games);

    expect(result.gameCount).toBe(6);

    for (const round of rounds) {
      expect(result.byRound[round].count).toBe(1);
    }

    // Verify specific round
    // R64: (0.60 - 1)^2 = 0.16
    expect(result.byRound["R64"].brier).toBeCloseTo(0.16, 10);
    // NCG: (0.85 - 1)^2 = 0.0225
    expect(result.byRound["NCG"].brier).toBeCloseTo(0.0225, 10);
  });
});
