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

describe("simulateBracket", async () => {
  it("produces a SimulatedBracket with exactly 63 game results", async () => {
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

  it("always produces a champion", async () => {
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

  it("champion is one of the 64 input teams", async () => {
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

  it("every game result is a valid team ID", async () => {
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

  it("all 63 game IDs from the bracket are present in results", async () => {
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

  it("is deterministic with the same seeded random", async () => {
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

  it("produces different results with different seeds", async () => {
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

  it("the NCG winner matches the champion field", async () => {
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

describe("runSimulation", async () => {
  it("returns the correct number of simulation results", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    expect(result.numSimulations).toBe(defaultConfig.numSimulations);
  });

  it("team results cover all 64 teams", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    expect(result.teamResults).toHaveLength(64);

    const resultTeamIds = new Set(result.teamResults.map((r) => r.teamId));
    const inputTeamIds = new Set(teamsArray.map((t) => t.teamId));

    for (const teamId of inputTeamIds) {
      expect(resultTeamIds.has(teamId)).toBe(true);
    }
  });

  it("all round probabilities are between 0 and 1", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      for (const round of ALL_ROUNDS) {
        const prob = teamResult.roundProbabilities[round];
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
    }
  });

  it("round probabilities are monotonically decreasing (R64 >= R32 >= S16 >= ...)", async () => {
    // Use more simulations for smoother probabilities
    const config: SimulationConfig = {
      numSimulations: 500,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };
    const result = await runSimulation(teamsMap, config);

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

  it("R64 probabilities are all 1.0 (every team plays in the first round)", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      expect(teamResult.roundProbabilities["R64"]).toBe(1.0);
    }
  });

  it("championship probabilities sum to approximately 1.0", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    const totalChampionshipProb = result.teamResults.reduce(
      (sum, r) => sum + r.championshipProbability,
      0
    );

    // Should sum to 1.0 (within floating point tolerance)
    expect(totalChampionshipProb).toBeCloseTo(1.0, 2);
  });

  it("NCG round probabilities sum to approximately 2.0 (two teams reach the final)", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    const totalNCGProb = result.teamResults.reduce(
      (sum, r) => sum + r.roundProbabilities["NCG"],
      0
    );

    // Two teams reach the championship game in each simulation
    expect(totalNCGProb).toBeCloseTo(2.0, 1);
  });

  it("F4 round probabilities sum to approximately 4.0", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    const totalF4Prob = result.teamResults.reduce(
      (sum, r) => sum + r.roundProbabilities["F4"],
      0
    );

    expect(totalF4Prob).toBeCloseTo(4.0, 1);
  });

  it("E8 round probabilities sum to approximately 8.0", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    const totalE8Prob = result.teamResults.reduce(
      (sum, r) => sum + r.roundProbabilities["E8"],
      0
    );

    expect(totalE8Prob).toBeCloseTo(8.0, 1);
  });

  it("expected wins are between 0 and 6 for all teams", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      expect(teamResult.expectedWins).toBeGreaterThanOrEqual(0);
      expect(teamResult.expectedWins).toBeLessThanOrEqual(6);
    }
  });

  it("expected wins sum to approximately 63 across all teams", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    const totalExpectedWins = result.teamResults.reduce(
      (sum, r) => sum + r.expectedWins,
      0
    );

    // 63 games total in the tournament = 63 wins distributed among teams
    expect(totalExpectedWins).toBeCloseTo(63, 0);
  });

  it("higher seeds generally have higher championship probabilities", async () => {
    // Use more simulations for statistical stability
    const config: SimulationConfig = {
      numSimulations: 1000,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };
    const result = await runSimulation(teamsMap, config);

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

  it("mostLikelyChampion is the team with the highest championship probability", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    const maxChampProb = Math.max(
      ...result.teamResults.map((r) => r.championshipProbability)
    );
    const teamWithMaxProb = result.teamResults.find(
      (r) => r.championshipProbability === maxChampProb
    );

    expect(result.mostLikelyChampion.teamId).toBe(teamWithMaxProb!.teamId);
    expect(result.mostLikelyChampion.probability).toBe(maxChampProb);
  });

  it("mostLikelyChampion probability is greater than 0", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    expect(result.mostLikelyChampion.probability).toBeGreaterThan(0);
  });

  it("topChampions are sorted by probability in descending order", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    expect(result.topChampions.length).toBeGreaterThan(0);
    expect(result.topChampions.length).toBeLessThanOrEqual(10);

    for (let i = 0; i < result.topChampions.length - 1; i++) {
      expect(result.topChampions[i].probability).toBeGreaterThanOrEqual(
        result.topChampions[i + 1].probability
      );
    }
  });

  it("topChampions[0] matches mostLikelyChampion", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    expect(result.topChampions[0].teamId).toBe(
      result.mostLikelyChampion.teamId
    );
    expect(result.topChampions[0].probability).toBe(
      result.mostLikelyChampion.probability
    );
  });

  it("upsetRates are between 0 and 1 for all rounds", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    for (const round of ALL_ROUNDS) {
      const rate = result.upsetRates[round];
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it("executionTimeMs is a positive number", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    expect(result.executionTimeMs).toBeGreaterThan(0);
    expect(Number.isFinite(result.executionTimeMs)).toBe(true);
  });

  it("is reproducible with the same random seed", async () => {
    const config: SimulationConfig = {
      numSimulations: 100,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };

    const result1 = await runSimulation(teamsMap, config);
    const result2 = await runSimulation(teamsMap, config);

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

  it("produces different results with different seeds", async () => {
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

    const result1 = await runSimulation(teamsMap, config1);
    const result2 = await runSimulation(teamsMap, config2);

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

  it("handles matchup overrides in the config", async () => {
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
    const result = await runSimulation(teamsMap, config);
    expect(result.numSimulations).toBe(100);
    expect(result.teamResults).toHaveLength(64);
  });

  it("each team result has correct seed and region from input", async () => {
    const result = await runSimulation(teamsMap, defaultConfig);

    for (const teamResult of result.teamResults) {
      const inputTeam = teamsArray.find((t) => t.teamId === teamResult.teamId);
      expect(inputTeam).toBeDefined();
      expect(teamResult.seed).toBe(inputTeam!.tournamentEntry!.seed);
      expect(teamResult.region).toBe(inputTeam!.tournamentEntry!.region);
    }
  });
});

// ---------------------------------------------------------------------------
// Picks-constrained simulation
// ---------------------------------------------------------------------------

describe("picks-constrained simulation", async () => {
  it("picks lock in game outcomes across all simulations", async () => {
    // Pick team-east-1 (1-seed) to win the R64-East-1 game (1 vs 16)
    const picks: Record<string, string> = {
      "R64-East-1": "team-east-1",
    };

    const config: SimulationConfig = {
      numSimulations: 100,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      picks,
      randomSeed: 42,
    };

    const result = await runSimulation(teamsMap, config);

    // The picked team should advance through R64 with 100% probability
    // (since every simulation locks in that outcome)
    const eastOneSeed = result.teamResults.find(
      (r) => r.teamId === "team-east-1"
    );
    expect(eastOneSeed).toBeDefined();
    // R32 probability should be 1.0 — the pick guarantees advancing past R64
    expect(eastOneSeed!.roundProbabilities["R32"]).toBe(1.0);
  });

  it("unpicked games are still probabilistic", async () => {
    // Only pick the East 1-seed game, leave everything else unconstrained
    const picks: Record<string, string> = {
      "R64-East-1": "team-east-1",
    };

    const config: SimulationConfig = {
      numSimulations: 200,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      picks,
      randomSeed: 42,
    };

    const result = await runSimulation(teamsMap, config);

    // A different game (West region) should still have probabilistic outcomes.
    // The West 1-seed should NOT have exactly 1.0 R32 probability (no pick for that game).
    const westOneSeed = result.teamResults.find(
      (r) => r.teamId === "team-west-1"
    );
    expect(westOneSeed).toBeDefined();
    // With 200 sims, the 1-seed should win most R64 games but not all (p < 1.0)
    expect(westOneSeed!.roundProbabilities["R32"]).toBeGreaterThan(0);
    expect(westOneSeed!.roundProbabilities["R32"]).toBeLessThan(1.0);
  });

  it("invalid pick (wrong team) is ignored and game is sampled normally", async () => {
    // Pick a team that doesn't belong in this game
    const picks: Record<string, string> = {
      "R64-East-1": "team-west-5", // This team is NOT in the East 1v16 game
    };

    const config: SimulationConfig = {
      numSimulations: 200,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      picks,
      randomSeed: 42,
    };

    // Should run without error (invalid pick silently ignored)
    const result = await runSimulation(teamsMap, config);
    expect(result.numSimulations).toBe(200);
    expect(result.teamResults).toHaveLength(64);

    // The East 1-seed should still have probabilistic results (not locked in)
    const eastOneSeed = result.teamResults.find(
      (r) => r.teamId === "team-east-1"
    );
    expect(eastOneSeed).toBeDefined();
    // Should be high but not necessarily 1.0 since the pick was invalid
    expect(eastOneSeed!.roundProbabilities["R32"]).toBeGreaterThan(0);
  });

  it("picks propagate downstream — picked team appears in next round", async () => {
    // Pick the 16-seed upset over the 1-seed in East R64
    const picks: Record<string, string> = {
      "R64-East-1": "team-east-16", // 16-seed upsets 1-seed
    };

    const config: SimulationConfig = {
      numSimulations: 100,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      picks,
      randomSeed: 42,
    };

    const result = await runSimulation(teamsMap, config);

    // The 16-seed should have 100% R32 probability (they always win R64)
    const east16Seed = result.teamResults.find(
      (r) => r.teamId === "team-east-16"
    );
    expect(east16Seed).toBeDefined();
    expect(east16Seed!.roundProbabilities["R32"]).toBe(1.0);

    // The 1-seed should have 0% R32 probability (they always lose R64)
    const east1Seed = result.teamResults.find(
      (r) => r.teamId === "team-east-1"
    );
    expect(east1Seed).toBeDefined();
    expect(east1Seed!.roundProbabilities["R32"]).toBe(0);
  });

  it("full bracket picks yield deterministic champion with 100% probability", async () => {
    // Pick East 1-seed to win every game through the championship.
    // R64-East-1 (1 vs 16): pick 1-seed
    // R32-East-1 (winner of R64-East-1 vs R64-East-2): pick 1-seed
    // S16-East-1 (winner of R32-East-1 vs R32-East-2): pick 1-seed
    // E8-East (winner of S16-East-1 vs S16-East-2): pick 1-seed
    // F4-1 (East vs West): pick East 1-seed
    // NCG: pick East 1-seed
    //
    // Also need to pick winners for the other branch so all games resolve:
    // R64-East-2 (8 vs 9): pick 8-seed so R32-East-1 has both teams resolved
    const eastChampion = "team-east-1";
    const picks: Record<string, string> = {
      "R64-East-1": eastChampion,
      "R64-East-2": "team-east-8", // need this for R32-East-1
      "R32-East-1": eastChampion,
      "R64-East-3": "team-east-5", // need for R32-East-2
      "R64-East-4": "team-east-4", // need for R32-East-2
      "R32-East-2": "team-east-5", // need for S16-East-1
      "S16-East-1": eastChampion,
      // Need to fill in the bottom half of East for E8
      "R64-East-5": "team-east-6",
      "R64-East-6": "team-east-3",
      "R32-East-3": "team-east-3",
      "R64-East-7": "team-east-7",
      "R64-East-8": "team-east-2",
      "R32-East-4": "team-east-2",
      "S16-East-2": "team-east-2",
      "E8-East": eastChampion,
      // Need West champion for F4-1
      "R64-West-1": "team-west-1",
      "R64-West-2": "team-west-8",
      "R32-West-1": "team-west-1",
      "R64-West-3": "team-west-5",
      "R64-West-4": "team-west-4",
      "R32-West-2": "team-west-4",
      "S16-West-1": "team-west-1",
      "R64-West-5": "team-west-6",
      "R64-West-6": "team-west-3",
      "R32-West-3": "team-west-3",
      "R64-West-7": "team-west-7",
      "R64-West-8": "team-west-2",
      "R32-West-4": "team-west-2",
      "S16-West-2": "team-west-2",
      "E8-West": "team-west-1",
      "F4-1": eastChampion,
      // Need South champion for F4-2
      "R64-South-1": "team-south-1",
      "R64-South-2": "team-south-8",
      "R32-South-1": "team-south-1",
      "R64-South-3": "team-south-5",
      "R64-South-4": "team-south-4",
      "R32-South-2": "team-south-4",
      "S16-South-1": "team-south-1",
      "R64-South-5": "team-south-6",
      "R64-South-6": "team-south-3",
      "R32-South-3": "team-south-3",
      "R64-South-7": "team-south-7",
      "R64-South-8": "team-south-2",
      "R32-South-4": "team-south-2",
      "S16-South-2": "team-south-2",
      "E8-South": "team-south-1",
      // Need Midwest champion for F4-2
      "R64-Midwest-1": "team-midwest-1",
      "R64-Midwest-2": "team-midwest-8",
      "R32-Midwest-1": "team-midwest-1",
      "R64-Midwest-3": "team-midwest-5",
      "R64-Midwest-4": "team-midwest-4",
      "R32-Midwest-2": "team-midwest-4",
      "S16-Midwest-1": "team-midwest-1",
      "R64-Midwest-5": "team-midwest-6",
      "R64-Midwest-6": "team-midwest-3",
      "R32-Midwest-3": "team-midwest-3",
      "R64-Midwest-7": "team-midwest-7",
      "R64-Midwest-8": "team-midwest-2",
      "R32-Midwest-4": "team-midwest-2",
      "S16-Midwest-2": "team-midwest-2",
      "E8-Midwest": "team-midwest-1",
      "F4-2": "team-south-1",
      NCG: eastChampion,
    };

    const config: SimulationConfig = {
      numSimulations: 50,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      picks,
      randomSeed: 42,
    };

    const result = await runSimulation(teamsMap, config);

    // The champion should be the East 1-seed with 100% probability
    expect(result.mostLikelyChampion.teamId).toBe(eastChampion);
    expect(result.mostLikelyChampion.probability).toBe(1.0);
  });

  it("without picks, simulateBracket behaves identically to before (backwards compatible)", async () => {
    // Verify that omitting picks produces the same results as explicitly passing undefined
    const rng1 = createSeededRandom(42);
    const result1 = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng1,
      undefined,
      undefined,
      undefined // explicit undefined picks
    );

    const rng2 = createSeededRandom(42);
    const result2 = simulateBracket(
      teamsMap,
      matchups,
      slots,
      DEFAULT_ENGINE_CONFIG,
      undefined,
      rng2
      // picks omitted entirely
    );

    expect(result1.champion).toBe(result2.champion);
    expect(result1.gameResults).toEqual(result2.gameResults);
  });
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe("simulation performance", async () => {
  it("1000 simulations complete in under 5 seconds", async () => {
    const config: SimulationConfig = {
      numSimulations: 1000,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42,
    };

    const startTime = performance.now();
    const result = await runSimulation(teamsMap, config);
    const elapsed = performance.now() - startTime;

    expect(result.numSimulations).toBe(1000);
    expect(elapsed).toBeLessThan(5000);
  });
});
