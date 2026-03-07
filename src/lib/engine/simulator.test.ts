/**
 * Tests for the full Monte Carlo bracket simulator.
 *
 * Validates the complete simulation pipeline:
 * - simulateBracket produces valid single-bracket results
 * - runSimulation aggregates multiple brackets into correct statistics
 * - Probability constraints are satisfied (monotonicity, summation, bounds)
 * - Deterministic behavior with seeded random number generators
 * - Performance benchmarks for simulation throughput
 *
 * Uses the real resolveMatchup and engine functions -- no mocking.
 * Small simulation counts (100-1000) keep tests fast.
 */

import { describe, it, expect } from "vitest";

import { simulateBracket, runSimulation } from "@/lib/engine/simulator";
import { buildBracketMatchups, buildBracketSlots } from "@/lib/engine/bracket";
import { createSeededRandom } from "@/lib/engine/sampler";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { SimulationConfig, SimulatedBracket } from "@/types/simulation";
import type { TeamSeason, TournamentRound } from "@/types/team";
import { create64TeamField } from "@/lib/engine/test-helpers-bracket";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** Standard 64-team field for simulation tests */
const teamsArray = create64TeamField();

/** Teams as a Map keyed by teamId (as expected by simulateBracket / runSimulation) */
const teamsMap = new Map<string, TeamSeason>(
  teamsArray.map((t) => [t.teamId, t])
);

/** Pre-built bracket matchups */
const matchups = buildBracketMatchups();

/** Pre-built bracket slots (Map<slotId, BracketSlot>) */
const slots = buildBracketSlots(teamsArray);

/** Default simulation config with small simulation count for fast tests */
const defaultConfig: SimulationConfig = {
  numSimulations: 100,
  engineConfig: { ...DEFAULT_ENGINE_CONFIG },
  randomSeed: 42,
};

/** All tournament rounds in order */
const ALL_ROUNDS: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

// ---------------------------------------------------------------------------
// simulateBracket
// ---------------------------------------------------------------------------

describe("simulateBracket", () => {
  it("produces a SimulatedBracket with exactly 63 game results", () => {
    const rng = createSeededRandom(42);
    const result = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng
    );

    expect(Object.keys(result.gameResults)).toHaveLength(63);
  });

  it("always produces a champion", () => {
    const rng = createSeededRandom(42);
    const result = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng
    );

    expect(result.champion).toBeDefined();
    expect(typeof result.champion).toBe("string");
    expect(result.champion.length).toBeGreaterThan(0);
  });

  it("champion is one of the 64 input teams", () => {
    const rng = createSeededRandom(42);
    const result = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng
    );

    const teamIds = teamsArray.map((t) => t.teamId);
    expect(teamIds).toContain(result.champion);
  });

  it("every game result is a valid team ID", () => {
    const rng = createSeededRandom(42);
    const result = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng
    );

    const teamIds = new Set(teamsArray.map((t) => t.teamId));
    for (const [_gameId, winnerId] of Object.entries(result.gameResults)) {
      expect(teamIds.has(winnerId)).toBe(true);
    }
  });

  it("all 63 game IDs from the bracket are present in results", () => {
    const rng = createSeededRandom(42);
    const result = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng
    );

    const matchupGameIds = matchups.map((m) => m.gameId);
    const resultGameIds = Object.keys(result.gameResults);

    for (const gameId of matchupGameIds) {
      expect(resultGameIds).toContain(gameId);
    }
  });

  it("is deterministic with the same seeded random", () => {
    const rng1 = createSeededRandom(42);
    const result1 = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng1
    );

    const rng2 = createSeededRandom(42);
    const result2 = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng2
    );

    expect(result1.champion).toBe(result2.champion);
    expect(result1.gameResults).toEqual(result2.gameResults);
  });

  it("produces different results with different seeds", () => {
    // Run multiple simulations with different seeds to verify variance
    const results: SimulatedBracket[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createSeededRandom(seed);
      results.push(
        simulateBracket(
          teamsMap,
          matchups,
          slots,
          DEFAULT_ENGINE_CONFIG,
          undefined,
          rng
        )
      );
    }

    // With 20 different seeds, we should see at least 2 different champions
    // (extremely unlikely that the same team wins all 20 random brackets)
    const uniqueChampions = new Set(results.map((r) => r.champion));
    expect(uniqueChampions.size).toBeGreaterThan(1);
  });

  it("the NCG winner matches the champion field", () => {
    const rng = createSeededRandom(42);
    const result = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng
    );

    // Find the NCG game
    const ncgGame = matchups.find((m) => m.round === "NCG");
    expect(ncgGame).toBeDefined();

    const ncgWinner = result.gameResults[ncgGame!.gameId];
    expect(ncgWinner).toBe(result.champion);
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

describe("runSimulation", () => {
  it("returns the correct number of simulation results", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    expect(result.numSimulations).toBe(defaultConfig.numSimulations);
  });

  it("team results cover all 64 teams", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    expect(result.teamResults).toHaveLength(64);

    const resultTeamIds = new Set(result.teamResults.map((r) => r.teamId));
    const inputTeamIds = new Set(teamsArray.map((t) => t.teamId));

    for (const teamId of inputTeamIds) {
      expect(resultTeamIds.has(teamId)).toBe(true);
    }
  });

  it("all round probabilities are between 0 and 1", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      for (const round of ALL_ROUNDS) {
        const prob = teamResult.roundProbabilities[round];
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
    }
  });

  it("round probabilities are monotonically decreasing (R64 >= R32 >= S16 >= ...)", () => {
    // Use more simulations for smoother probabilities
    const config: SimulationConfig = {
      numSimulations: 500,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };
    const result = runSimulation(teamsMap, config);

    for (const teamResult of result.teamResults) {
      for (let i = 0; i < ALL_ROUNDS.length - 1; i++) {
        const currentRound = ALL_ROUNDS[i];
        const nextRound = ALL_ROUNDS[i + 1];
        const currentProb = teamResult.roundProbabilities[currentRound];
        const nextProb = teamResult.roundProbabilities[nextRound];

        // Each team's probability of reaching round N+1 can't exceed
        // their probability of reaching round N
        expect(nextProb).toBeLessThanOrEqual(currentProb + 0.001); // small epsilon for float precision
      }
    }
  });

  it("R64 probabilities are all 1.0 (every team plays in the first round)", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      expect(teamResult.roundProbabilities["R64"]).toBe(1.0);
    }
  });

  it("championship probabilities sum to approximately 1.0", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    const totalChampionshipProb = result.teamResults.reduce(
      (sum, r) => sum + r.championshipProbability,
      0
    );

    // Should sum to 1.0 (within floating point tolerance)
    expect(totalChampionshipProb).toBeCloseTo(1.0, 2);
  });

  it("NCG round probabilities sum to approximately 2.0 (two teams reach the final)", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    const totalNCGProb = result.teamResults.reduce(
      (sum, r) => sum + r.roundProbabilities["NCG"],
      0
    );

    // Two teams reach the championship game in each simulation
    expect(totalNCGProb).toBeCloseTo(2.0, 1);
  });

  it("F4 round probabilities sum to approximately 4.0", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    const totalF4Prob = result.teamResults.reduce(
      (sum, r) => sum + r.roundProbabilities["F4"],
      0
    );

    expect(totalF4Prob).toBeCloseTo(4.0, 1);
  });

  it("E8 round probabilities sum to approximately 8.0", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    const totalE8Prob = result.teamResults.reduce(
      (sum, r) => sum + r.roundProbabilities["E8"],
      0
    );

    expect(totalE8Prob).toBeCloseTo(8.0, 1);
  });

  it("expected wins are between 0 and 6 for all teams", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      expect(teamResult.expectedWins).toBeGreaterThanOrEqual(0);
      expect(teamResult.expectedWins).toBeLessThanOrEqual(6);
    }
  });

  it("expected wins sum to approximately 63 across all teams", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    const totalExpectedWins = result.teamResults.reduce(
      (sum, r) => sum + r.expectedWins,
      0
    );

    // 63 games total in the tournament = 63 wins distributed among teams
    expect(totalExpectedWins).toBeCloseTo(63, 0);
  });

  it("higher seeds generally have higher championship probabilities", () => {
    // Use more simulations for statistical stability
    const config: SimulationConfig = {
      numSimulations: 1000,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };
    const result = runSimulation(teamsMap, config);

    // Compare average championship probability by seed
    const seedProbs: Record<number, number[]> = {};
    for (const teamResult of result.teamResults) {
      if (!seedProbs[teamResult.seed]) {
        seedProbs[teamResult.seed] = [];
      }
      seedProbs[teamResult.seed].push(teamResult.championshipProbability);
    }

    // Average championship probability per seed
    const avgProbs: Record<number, number> = {};
    for (const [seed, probs] of Object.entries(seedProbs)) {
      avgProbs[Number(seed)] =
        probs.reduce((sum, p) => sum + p, 0) / probs.length;
    }

    // 1-seeds should have higher average championship probability than 16-seeds
    expect(avgProbs[1]).toBeGreaterThan(avgProbs[16]);
    // 1-seeds should have higher than 8-seeds
    expect(avgProbs[1]).toBeGreaterThan(avgProbs[8]);
  });

  it("mostLikelyChampion is the team with the highest championship probability", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    const maxChampProb = Math.max(
      ...result.teamResults.map((r) => r.championshipProbability)
    );
    const teamWithMaxProb = result.teamResults.find(
      (r) => r.championshipProbability === maxChampProb
    );

    expect(result.mostLikelyChampion.teamId).toBe(teamWithMaxProb!.teamId);
    expect(result.mostLikelyChampion.probability).toBe(maxChampProb);
  });

  it("mostLikelyChampion probability is greater than 0", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    expect(result.mostLikelyChampion.probability).toBeGreaterThan(0);
  });

  it("topChampions are sorted by probability in descending order", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    expect(result.topChampions.length).toBeGreaterThan(0);
    expect(result.topChampions.length).toBeLessThanOrEqual(10);

    for (let i = 0; i < result.topChampions.length - 1; i++) {
      expect(result.topChampions[i].probability).toBeGreaterThanOrEqual(
        result.topChampions[i + 1].probability
      );
    }
  });

  it("topChampions[0] matches mostLikelyChampion", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    expect(result.topChampions[0].teamId).toBe(
      result.mostLikelyChampion.teamId
    );
    expect(result.topChampions[0].probability).toBe(
      result.mostLikelyChampion.probability
    );
  });

  it("upsetRates are between 0 and 1 for all rounds", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    for (const round of ALL_ROUNDS) {
      const rate = result.upsetRates[round];
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it("executionTimeMs is a positive number", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    expect(result.executionTimeMs).toBeGreaterThan(0);
    expect(Number.isFinite(result.executionTimeMs)).toBe(true);
  });

  it("is reproducible with the same random seed", () => {
    const config: SimulationConfig = {
      numSimulations: 100,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };

    const result1 = runSimulation(teamsMap, config);
    const result2 = runSimulation(teamsMap, config);

    // Same seed should produce identical results
    expect(result1.mostLikelyChampion.teamId).toBe(
      result2.mostLikelyChampion.teamId
    );
    expect(result1.mostLikelyChampion.probability).toBe(
      result2.mostLikelyChampion.probability
    );

    // All team probabilities should match
    for (let i = 0; i < result1.teamResults.length; i++) {
      expect(result1.teamResults[i].teamId).toBe(result2.teamResults[i].teamId);
      expect(result1.teamResults[i].championshipProbability).toBe(
        result2.teamResults[i].championshipProbability
      );
      expect(result1.teamResults[i].expectedWins).toBe(
        result2.teamResults[i].expectedWins
      );
    }
  });

  it("produces different results with different seeds", () => {
    const config1: SimulationConfig = {
      numSimulations: 200,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };
    const config2: SimulationConfig = {
      numSimulations: 200,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 999,
    };

    const result1 = runSimulation(teamsMap, config1);
    const result2 = runSimulation(teamsMap, config2);

    // The exact probabilities should differ (even if the most likely champion is the same)
    let anyDifference = false;
    for (let i = 0; i < result1.teamResults.length; i++) {
      if (
        result1.teamResults[i].championshipProbability !==
        result2.teamResults[i].championshipProbability
      ) {
        anyDifference = true;
        break;
      }
    }
    expect(anyDifference).toBe(true);
  });

  it("handles matchup overrides in the config", () => {
    // Create a config with an override on the first R64 game
    const firstR64Game = matchups.find((m) => m.round === "R64");
    expect(firstR64Game).toBeDefined();

    const config: SimulationConfig = {
      numSimulations: 100,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      matchupOverrides: {
        [firstR64Game!.gameId]: {
          injuryAdjustmentA: -5.0, // Heavy injury penalty for team A
        },
      },
      randomSeed: 42,
    };

    // Should run without error
    const result = runSimulation(teamsMap, config);
    expect(result.numSimulations).toBe(100);
    expect(result.teamResults).toHaveLength(64);
  });

  it("each team result has correct seed and region from input", () => {
    const result = runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      const inputTeam = teamsArray.find((t) => t.teamId === teamResult.teamId);
      expect(inputTeam).toBeDefined();
      expect(teamResult.seed).toBe(inputTeam!.tournamentEntry!.seed);
      expect(teamResult.region).toBe(inputTeam!.tournamentEntry!.region);
    }
  });
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe("simulation performance", () => {
  it("1000 simulations complete in under 5 seconds", () => {
    const config: SimulationConfig = {
      numSimulations: 1000,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };

    const startTime = performance.now();
    const result = runSimulation(teamsMap, config);
    const elapsed = performance.now() - startTime;

    expect(result.numSimulations).toBe(1000);
    expect(elapsed).toBeLessThan(5000);
  });
});
