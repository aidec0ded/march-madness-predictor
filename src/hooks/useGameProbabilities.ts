"use client";

/**
 * Hook that computes per-game head-to-head win probabilities for all
 * bracket matchups where both teams are resolved.
 *
 * Uses `resolveMatchup()` from the probability engine to compute
 * deterministic per-game probabilities. These are displayed on TeamCards
 * in the bracket view and always sum to ~100% for a matchup pair.
 *
 * Unlike simulation path probabilities (which require running Monte Carlo),
 * these are available immediately whenever both teams in a matchup are known.
 */

import { useMemo } from "react";
import { useBracket } from "@/hooks/useBracket";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import { resolveMatchupTeams } from "@/lib/bracket-utils";
import { resolveMatchup } from "@/lib/engine/matchup";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { EngineConfig } from "@/types/engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-game probability pair: team A and team B win probabilities */
export interface GameProbability {
  probA: number;
  probB: number;
}

/** Map from gameId to per-game probability pair */
export type GameProbabilities = Record<string, GameProbability>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Computes per-game head-to-head probabilities for all resolved matchups.
 *
 * For each matchup in the 63-game bracket where both teams are known
 * (R64 teams are always known; later rounds require user picks), calls
 * `resolveMatchup()` to get the deterministic win probability.
 *
 * Memoized on bracket picks, levers, overrides, and site map.
 *
 * @returns Record of gameId → { probA, probB } for all resolved matchups
 */
export function useGameProbabilities(): GameProbabilities {
  const { state } = useBracket();

  // Static 63-game bracket structure (never changes)
  const allMatchups = useMemo(() => buildBracketMatchups(), []);

  return useMemo(() => {
    const probs: GameProbabilities = {};

    // Build engine config from user's global levers
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: state.globalLevers,
    };

    for (const matchup of allMatchups) {
      const { teamA, teamB } = resolveMatchupTeams(
        matchup,
        state.teams,
        state.picks
      );

      // Only compute when both teams are known
      if (!teamA || !teamB) continue;

      // Get per-matchup overrides and site coordinates
      const overrides = state.matchupOverrides[matchup.gameId];
      const siteCoords = state.tournamentSiteMap?.get(matchup.gameId);

      const result = resolveMatchup(
        teamA,
        teamB,
        config,
        overrides,
        siteCoords
      );

      probs[matchup.gameId] = {
        probA: result.winProbabilityA,
        probB: result.winProbabilityB,
      };
    }

    return probs;
  }, [
    allMatchups,
    state.teams,
    state.picks,
    state.globalLevers,
    state.matchupOverrides,
    state.tournamentSiteMap,
  ]);
}
