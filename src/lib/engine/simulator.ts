/**
 * Monte Carlo bracket simulation engine.
 *
 * The core simulation loop that runs thousands of full-bracket simulations
 * to produce win path probabilities for every team. Each simulation plays
 * out all 63 games from R64 through the National Championship, using the
 * probability engine's `resolveMatchupFast` function for win probabilities
 * and the sampler for random outcome draws.
 *
 * Performance optimizations:
 * - **Matchup cache**: Caches (teamA, teamB) → winProbability so repeated
 *   pairings across simulations are resolved via Map lookup instead of
 *   full recomputation. With 64 teams, at most ~2,016 unique pairings.
 * - **Fast path**: resolveMatchupFast returns only the probability number,
 *   skipping all ProbabilityBreakdown diagnostic object construction.
 * - **Streaming aggregator**: O(64) memory regardless of simulation count.
 *
 * Targets < 5 seconds for 50K simulations on a modern server.
 *
 * All heavy computation is pure and synchronous. The caller (API route)
 * is responsible for async scheduling if needed.
 */

import type { TeamSeason } from "@/types/team";
import type { EngineConfig, MatchupOverrides } from "@/types/engine";
import type {
  BracketMatchup,
  BracketSlot,
  SimulatedBracket,
  SimulationConfig,
  SimulationResult,
} from "@/types/simulation";
import type { SiteMap } from "@/lib/engine/site-mapping";
import type { MatchupCache } from "@/lib/engine/simulation-cache";

import { resolveMatchupFast } from "@/lib/engine/matchup-fast";
import { sampleGameOutcome, createSeededRandom } from "@/lib/engine/sampler";
import { buildBracketMatchups, buildBracketSlots } from "@/lib/engine/bracket";
import { createStreamingAggregator } from "@/lib/engine/aggregator";
import { createMatchupCache } from "@/lib/engine/simulation-cache";

// ---------------------------------------------------------------------------
// Progress callback type
// ---------------------------------------------------------------------------

/**
 * Callback fired periodically during simulation to report progress.
 */
export type SimulationProgressCallback = (progress: {
  /** Number of simulations completed so far */
  completed: number;
  /** Total number of simulations to run */
  total: number;
  /** Elapsed time in milliseconds since simulation started */
  elapsedMs: number;
}) => void;

// ---------------------------------------------------------------------------
// Single bracket simulation
// ---------------------------------------------------------------------------

/**
 * Simulates one complete 63-game bracket from R64 through the National Championship.
 *
 * The simulation processes games in order (R64, R32, S16, E8, F4, NCG). For each game:
 * 1. Resolve the two teams: look up from bracket slots (R64) or from previous game winners
 * 2. Look up both teams' full TeamSeason data
 * 3. Check the matchup cache for a previously computed probability
 * 4. If not cached, call `resolveMatchupFast` and store the result
 * 5. Call `sampleGameOutcome` with the random function to determine the winner
 * 6. Record the winner in gameResults
 *
 * The matchups array must be in topological order (feeder games before their consumers),
 * which `buildBracketMatchups()` guarantees.
 *
 * @param teams - Map of teamId to TeamSeason data for all 64 teams
 * @param matchups - The 63-game bracket matchup tree (from `buildBracketMatchups`)
 * @param slots - Record of slot IDs to BracketSlot (from `buildBracketSlots`)
 * @param config - Engine configuration (levers, logistic K, base variance)
 * @param overrides - Optional per-matchup overrides keyed by gameId
 * @param random - Optional random number generator (defaults to Math.random)
 * @param siteMap - Optional pre-computed game-to-venue coordinate map for site proximity lever
 * @param cache - Optional matchup probability cache (shared across simulation iterations)
 * @returns A SimulatedBracket with all 63 game results and the champion
 */
export function simulateBracket(
  teams: Map<string, TeamSeason>,
  matchups: BracketMatchup[],
  slots: Map<string, BracketSlot>,
  config: EngineConfig,
  overrides?: Record<string, MatchupOverrides>,
  random?: () => number,
  siteMap?: SiteMap,
  cache?: MatchupCache,
  picks?: Record<string, string>
): SimulatedBracket {
  const gameResults: Record<string, string> = {};
  const rng = random ?? Math.random;

  for (const matchup of matchups) {
    // Resolve team A
    const teamAId = resolveTeamId(matchup.teamASource, slots, gameResults);
    // Resolve team B
    const teamBId = resolveTeamId(matchup.teamBSource, slots, gameResults);

    // Check if the user has a pick for this game — locked-in picks skip
    // all probability computation and sampling for a performance win
    const pickedWinner = picks?.[matchup.gameId];
    if (pickedWinner && (pickedWinner === teamAId || pickedWinner === teamBId)) {
      gameResults[matchup.gameId] = pickedWinner;
      continue;
    }

    // Check cache first
    let winProbA: number | undefined;
    if (cache) {
      winProbA = cache.get(teamAId, teamBId);
    }

    if (winProbA === undefined) {
      // Look up full team data
      const teamA = teams.get(teamAId);
      const teamB = teams.get(teamBId);

      if (!teamA) {
        throw new Error(
          `Team data not found for teamId "${teamAId}" in game "${matchup.gameId}"`
        );
      }
      if (!teamB) {
        throw new Error(
          `Team data not found for teamId "${teamBId}" in game "${matchup.gameId}"`
        );
      }

      // Get win probability from the fast matchup resolver
      const matchupOverrides = overrides?.[matchup.gameId];
      const siteCoordinates = siteMap?.get(matchup.gameId);
      winProbA = resolveMatchupFast(
        teamA,
        teamB,
        config,
        matchupOverrides,
        siteCoordinates
      );

      // Cache the result (only for games without per-matchup overrides,
      // since overrides make the probability game-specific)
      if (cache && !matchupOverrides) {
        cache.set(teamAId, teamBId, winProbA);
      }
    }

    // Sample the outcome
    const outcome = sampleGameOutcome(winProbA, rng);
    const winnerId = outcome === "A" ? teamAId : teamBId;

    gameResults[matchup.gameId] = winnerId;
  }

  // The champion is the winner of the NCG
  const champion = gameResults["NCG"];

  return {
    gameResults,
    champion,
  };
}

// ---------------------------------------------------------------------------
// Main simulation entry point
// ---------------------------------------------------------------------------

/**
 * Runs the full Monte Carlo bracket simulation.
 *
 * This is the main entry point for the simulation engine. It:
 * 1. Builds the bracket structure (matchups and slots)
 * 2. Creates a seeded PRNG if a random seed is provided
 * 3. Creates a matchup probability cache for deduplication
 * 4. Initializes a streaming aggregator to avoid memory bloat
 * 5. Runs N bracket simulations, feeding each into the aggregator
 * 6. Returns the aggregated SimulationResult with timing information
 *
 * Uses the streaming aggregation approach internally: each simulated bracket
 * is processed immediately and not retained in memory, allowing efficient
 * handling of 50K-100K simulations.
 *
 * @param teams - Map of teamId to TeamSeason data for all 64 tournament teams
 * @param config - Simulation configuration including number of simulations,
 *   engine config, per-matchup overrides, and optional random seed
 * @param siteMap - Optional pre-computed game-to-venue coordinate map for
 *   site proximity lever. Computed once before the simulation loop for efficiency.
 * @param onProgress - Optional callback fired every `progressInterval` simulations
 * @param progressInterval - How often to fire the progress callback (default: 1000)
 * @returns Aggregated SimulationResult with per-team probabilities, champion
 *   predictions, upset rates, and execution timing
 *
 * @example
 * ```ts
 * const teamsMap = new Map(teamsArray.map(t => [t.teamId, t]));
 *
 * const config: SimulationConfig = {
 *   numSimulations: 50000,
 *   engineConfig: DEFAULT_ENGINE_CONFIG,
 *   randomSeed: 42, // optional, for reproducibility
 * };
 *
 * const result = runSimulation(teamsMap, config);
 * console.log(result.mostLikelyChampion);
 * console.log(result.executionTimeMs);
 * ```
 */
export function runSimulation(
  teams: Map<string, TeamSeason>,
  config: SimulationConfig,
  siteMap?: SiteMap,
  onProgress?: SimulationProgressCallback,
  progressInterval?: number
): SimulationResult {
  const startTime = performance.now();
  const interval = progressInterval ?? 1000;

  // Build bracket structure from the team data, with optional play-in games
  const teamArray = Array.from(teams.values());
  const playInConfig = config.playInConfig;
  const matchups = buildBracketMatchups(playInConfig);
  const slots = buildBracketSlots(teamArray, playInConfig);

  // Create random number generator
  const rng =
    config.randomSeed !== undefined
      ? createSeededRandom(config.randomSeed)
      : Math.random;

  // Create matchup probability cache
  const cache = createMatchupCache();

  // Create streaming aggregator
  const aggregator = createStreamingAggregator(
    slots,
    matchups,
    config.numSimulations
  );

  // Run simulations with streaming aggregation
  for (let i = 0; i < config.numSimulations; i++) {
    const bracket = simulateBracket(
      teams,
      matchups,
      slots,
      config.engineConfig,
      config.matchupOverrides,
      rng,
      siteMap,
      cache,
      config.picks
    );
    aggregator.addBracket(bracket);

    // Report progress at configured intervals
    if (onProgress && (i + 1) % interval === 0) {
      onProgress({
        completed: i + 1,
        total: config.numSimulations,
        elapsedMs: performance.now() - startTime,
      });
    }
  }

  const executionTimeMs = performance.now() - startTime;

  return aggregator.getResult(executionTimeMs);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a team source to a team ID.
 *
 * For R64 games, the source is a slot ID (e.g., "East-1") which maps to a
 * BracketSlot containing the teamId. For later rounds, the source is a
 * feeder game's gameId, and the teamId is looked up from gameResults.
 *
 * @param source - Either a slot ID or a feeder gameId
 * @param slots - Record of slot IDs to BracketSlot
 * @param gameResults - Record of gameId to winner teamId from current simulation
 * @returns The team ID
 * @throws {Error} If the source cannot be resolved
 */
function resolveTeamId(
  source: string,
  slots: Map<string, BracketSlot>,
  gameResults: Record<string, string>
): string {
  // Try slot lookup first (for R64 games)
  const slot = slots.get(source);
  if (slot) return slot.teamId;

  // Try game result lookup (for later rounds)
  const winnerId = gameResults[source];
  if (winnerId) return winnerId;

  throw new Error(
    `Cannot resolve team source "${source}": not found in slots or game results`
  );
}
