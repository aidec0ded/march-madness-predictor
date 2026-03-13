/**
 * Simulation result aggregator for the Monte Carlo bracket engine.
 *
 * Aggregates results across many simulated brackets to produce per-team
 * round probabilities, championship probabilities, expected wins, and
 * per-round upset rates.
 *
 * Supports two modes:
 * - **Batch mode** (`aggregateSimulations`): Takes an array of completed
 *   SimulatedBracket objects. Useful for testing and small runs.
 * - **Streaming mode** (`createStreamingAggregator`): Maintains running
 *   counters updated after each bracket, avoiding the need to hold all
 *   brackets in memory. Used by the main `runSimulation` function for
 *   large (50K+) simulation runs.
 *
 * All functions are pure or clearly stateful (streaming aggregator).
 */

import type { Region, TournamentRound } from "@/types/team";
import type {
  BracketMatchup,
  BracketSlot,
  SimulatedBracket,
  SimulationResult,
  TeamSimulationResult,
} from "@/types/simulation";
import { getRoundOrder, getRoundIndex } from "@/lib/engine/bracket";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Per-team running counters during aggregation */
interface TeamCounters {
  teamId: string;
  seed: number;
  region: Region;
  /** Count of simulations where this team reached each round */
  roundCounts: Record<TournamentRound, number>;
  /** Count of simulations where this team won the championship */
  championCount: number;
}

/** Per-round upset tracking counters */
interface UpsetCounters {
  /** Number of games where the lower-seeded team won, per round */
  upsetCount: Record<TournamentRound, number>;
  /** Total games played per round (across all simulations) */
  gameCount: Record<TournamentRound, number>;
}

// ---------------------------------------------------------------------------
// Streaming aggregator
// ---------------------------------------------------------------------------

/**
 * A streaming aggregator that accumulates results one bracket at a time.
 *
 * This avoids holding all SimulatedBracket objects in memory for large
 * simulation runs. Call `addBracket()` after each simulation, then
 * call `getResult()` to produce the final SimulationResult.
 */
export interface StreamingAggregator {
  /** Incorporate one simulated bracket into the running aggregation. */
  addBracket(bracket: SimulatedBracket): void;
  /** Produce the final SimulationResult from all accumulated brackets. */
  getResult(executionTimeMs: number): SimulationResult;
}

/**
 * Creates a streaming aggregator for accumulating simulation results.
 *
 * Initializes running counters for each team and each round. After all
 * brackets have been added via `addBracket()`, call `getResult()` to
 * compute final probabilities and statistics.
 *
 * @param slots - Record of slot IDs to BracketSlot objects (defines all 64 teams)
 * @param matchups - The 63-game bracket matchup tree
 * @param numSimulations - Total number of simulations that will be run
 * @returns A StreamingAggregator instance
 */
export function createStreamingAggregator(
  slots: Map<string, BracketSlot>,
  matchups: BracketMatchup[],
  numSimulations: number
): StreamingAggregator {
  const rounds = getRoundOrder();

  // Initialize per-team counters
  const teamCounters = new Map<string, TeamCounters>();
  for (const slot of slots.values()) {
    const emptyRoundCounts: Record<TournamentRound, number> = {
      FF: 0,
      R64: 0,
      R32: 0,
      S16: 0,
      E8: 0,
      F4: 0,
      NCG: 0,
    };
    teamCounters.set(slot.teamId, {
      teamId: slot.teamId,
      seed: slot.seed,
      region: slot.region,
      roundCounts: emptyRoundCounts,
      championCount: 0,
    });
  }

  // Initialize upset counters
  const upsetCounters: UpsetCounters = {
    upsetCount: { FF: 0, R64: 0, R32: 0, S16: 0, E8: 0, F4: 0, NCG: 0 },
    gameCount: { FF: 0, R64: 0, R32: 0, S16: 0, E8: 0, F4: 0, NCG: 0 },
  };

  // Build a quick lookup: teamId -> seed (using slots)
  const teamSeedMap = new Map<string, number>();
  for (const slot of slots.values()) {
    teamSeedMap.set(slot.teamId, slot.seed);
  }

  let bracketsProcessed = 0;

  return {
    addBracket(bracket: SimulatedBracket): void {
      bracketsProcessed++;

      // Non-play-in teams are in R64 automatically.
      // Play-in teams (FF slots) only reach R64 if they win their FF game.
      for (const [slotId, slot] of slots) {
        if (slotId.startsWith("FF-")) {
          // Play-in team: count FF appearance, NOT R64
          const counters = teamCounters.get(slot.teamId);
          if (counters) counters.roundCounts.FF++;
        } else {
          // Non-play-in team: automatically in R64
          const counters = teamCounters.get(slot.teamId);
          if (counters) counters.roundCounts.R64++;
        }
      }

      // For each game, the winner advances to the next round
      for (const matchup of matchups) {
        const winnerId = bracket.gameResults[matchup.gameId];
        if (!winnerId) continue;

        const roundIndex = getRoundIndex(matchup.round);
        const nextRound = rounds[roundIndex + 1];

        if (nextRound) {
          const counters = teamCounters.get(winnerId);
          if (counters) {
            counters.roundCounts[nextRound]++;
          }
        }

        // Track championship
        if (matchup.round === "NCG") {
          const counters = teamCounters.get(winnerId);
          if (counters) {
            counters.championCount++;
          }
        }

        // Track upsets: determine who played this game
        const matchupTeams = findMatchupTeams(
          matchup,
          bracket.gameResults,
          slots
        );
        if (matchupTeams) {
          const [teamAId, teamBId] = matchupTeams;
          const seedA = teamSeedMap.get(teamAId);
          const seedB = teamSeedMap.get(teamBId);

          upsetCounters.gameCount[matchup.round]++;

          if (seedA !== undefined && seedB !== undefined && seedA !== seedB) {
            // The higher-seeded team (lower number) is the favorite.
            // An upset = the lower-seeded team (higher number) wins.
            const favoriteId = seedA < seedB ? teamAId : teamBId;
            if (winnerId !== favoriteId) {
              upsetCounters.upsetCount[matchup.round]++;
            }
          }
        }
      }
    },

    getResult(executionTimeMs: number): SimulationResult {
      return buildResult(
        teamCounters,
        upsetCounters,
        bracketsProcessed,
        executionTimeMs
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Batch aggregation (for testing and small runs)
// ---------------------------------------------------------------------------

/**
 * Aggregates an array of simulated brackets into a final SimulationResult.
 *
 * This is the batch version — it processes all brackets at once. For large
 * simulation runs, prefer the streaming approach via `createStreamingAggregator`.
 *
 * @param brackets - Array of completed SimulatedBracket objects
 * @param slots - Record of slot IDs to BracketSlot objects
 * @param matchups - The 63-game bracket matchup tree
 * @param numSimulations - Total number of simulations run
 * @returns Aggregated SimulationResult with all team probabilities and statistics
 */
export function aggregateSimulations(
  brackets: SimulatedBracket[],
  slots: Map<string, BracketSlot>,
  matchups: BracketMatchup[],
  numSimulations: number
): SimulationResult {
  const aggregator = createStreamingAggregator(slots, matchups, numSimulations);
  for (const bracket of brackets) {
    aggregator.addBracket(bracket);
  }
  return aggregator.getResult(0);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Finds the two team IDs that played in a given matchup within a simulated bracket.
 *
 * For R64 games, looks up teams directly from bracket slots. For later rounds,
 * traces back through feeder game results.
 *
 * @param matchup - The bracket matchup
 * @param gameResults - Record of gameId to winner teamId from one simulation
 * @param slots - Record of slot IDs to BracketSlot
 * @returns Tuple of [teamAId, teamBId] or null if teams cannot be determined
 */
function findMatchupTeams(
  matchup: BracketMatchup,
  gameResults: Record<string, string>,
  slots: Map<string, BracketSlot>
): [string, string] | null {
  const teamAId = resolveTeamSource(matchup.teamASource, gameResults, slots);
  const teamBId = resolveTeamSource(matchup.teamBSource, gameResults, slots);

  if (!teamAId || !teamBId) return null;
  return [teamAId, teamBId];
}

/**
 * Resolves a team source (either a slot ID for R64 or a feeder gameId) to a team ID.
 *
 * @param source - Either a slot ID (e.g., "East-1") or a gameId (e.g., "R64-East-1")
 * @param gameResults - Record of gameId to winner teamId
 * @param slots - Record of slot IDs to BracketSlot
 * @returns The team ID or null if not found
 */
function resolveTeamSource(
  source: string,
  gameResults: Record<string, string>,
  slots: Map<string, BracketSlot>
): string | null {
  // If it's a slot ID (e.g., "East-1")
  const slot = slots.get(source);
  if (slot) return slot.teamId;

  // Otherwise it's a feeder game — look up the winner
  return gameResults[source] ?? null;
}

/**
 * Builds the final SimulationResult from accumulated counters.
 *
 * Converts raw counts into probabilities and computes summary statistics
 * like most likely champion, top champions, and per-round upset rates.
 *
 * @param teamCounters - Per-team running counters
 * @param upsetCounters - Per-round upset counters
 * @param numSimulations - Total simulations run
 * @param executionTimeMs - Total execution time in milliseconds
 * @returns The final SimulationResult
 */
function buildResult(
  teamCounters: Map<string, TeamCounters>,
  upsetCounters: UpsetCounters,
  numSimulations: number,
  executionTimeMs: number
): SimulationResult {
  const rounds = getRoundOrder();

  // Build per-team results
  const teamResults: TeamSimulationResult[] = [];

  for (const counters of teamCounters.values()) {
    const roundProbabilities: Record<TournamentRound, number> = {
      FF: 0,
      R64: 0,
      R32: 0,
      S16: 0,
      E8: 0,
      F4: 0,
      NCG: 0,
    };

    for (const round of rounds) {
      roundProbabilities[round] = counters.roundCounts[round] / numSimulations;
    }

    const championshipProbability = counters.championCount / numSimulations;

    // Expected wins: each advancement past the starting round is one win.
    //
    // Non-play-in teams start at R64 (index 1 in round order). Their first
    // win is reaching R32 (index 2). Expected wins = P(R32) + P(S16) + ... + P(champion).
    //
    // Play-in teams start at FF (index 0). Their first win is reaching R64
    // (winning the FF game). Expected wins = P(R64) + P(R32) + ... + P(champion).
    const isPlayInTeam = counters.roundCounts.FF > 0;
    const startIndex = isPlayInTeam ? 1 : 2; // R64 (index 1) or R32 (index 2)
    let expectedWins = 0;
    for (let i = startIndex; i < rounds.length; i++) {
      expectedWins += roundProbabilities[rounds[i]];
    }
    expectedWins += championshipProbability;

    teamResults.push({
      teamId: counters.teamId,
      seed: counters.seed,
      region: counters.region,
      roundProbabilities,
      championshipProbability,
      expectedWins,
    });
  }

  // Sort by championship probability descending for easy consumption
  teamResults.sort(
    (a, b) => b.championshipProbability - a.championshipProbability
  );

  // Most likely champion
  const topTeam = teamResults[0];
  const mostLikelyChampion = {
    teamId: topTeam.teamId,
    probability: topTeam.championshipProbability,
  };

  // Top 10 champions
  const topChampions = teamResults.slice(0, 10).map((t) => ({
    teamId: t.teamId,
    probability: t.championshipProbability,
  }));

  // Per-round upset rates
  const upsetRates: Record<TournamentRound, number> = {
    FF: 0,
    R64: 0,
    R32: 0,
    S16: 0,
    E8: 0,
    F4: 0,
    NCG: 0,
  };
  for (const round of rounds) {
    const games = upsetCounters.gameCount[round];
    upsetRates[round] = games > 0 ? upsetCounters.upsetCount[round] / games : 0;
  }

  return {
    teamResults,
    numSimulations,
    mostLikelyChampion,
    topChampions,
    executionTimeMs,
    upsetRates,
  };
}
