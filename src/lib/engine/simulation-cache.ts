/**
 * Matchup probability cache for Monte Carlo simulation.
 *
 * Caches the deterministic win probability for each (teamA, teamB) pair
 * to avoid redundant resolveMatchup calls across simulations. With 64
 * teams there are at most 2,016 unique ordered pairings. The cache
 * converts 3.15M matchup computations (50K sims × 63 games) into
 * ~300-400 unique computations + fast Map lookups.
 *
 * The cache is valid for a single simulation run because the config,
 * levers, and overrides are constant across all simulations in a run.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchupCache {
  /** Look up cached win probability for team A vs team B. */
  get(teamAId: string, teamBId: string): number | undefined;
  /** Store a computed win probability. */
  set(teamAId: string, teamBId: string, prob: number): void;
  /** Number of cached entries. */
  size(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new matchup probability cache.
 *
 * Keys are ordered as `"teamAId:teamBId"` — the order matters because
 * win probability is asymmetric (P(A beats B) ≠ P(B beats A)).
 */
export function createMatchupCache(): MatchupCache {
  const cache = new Map<string, number>();

  return {
    get(teamAId: string, teamBId: string): number | undefined {
      return cache.get(`${teamAId}:${teamBId}`);
    },
    set(teamAId: string, teamBId: string, prob: number): void {
      cache.set(`${teamAId}:${teamBId}`, prob);
    },
    size(): number {
      return cache.size;
    },
  };
}
