"use client";

/**
 * Hook that combines the ownership model with the strategy engine.
 *
 * Reads the current bracket state (teams, pool size) from BracketContext,
 * builds ownership estimates, and exposes convenience functions for getting
 * ownership and strategy recommendations throughout the UI.
 *
 * Memoized on state changes to avoid rebuilding the ownership model
 * on every render.
 */

import { useMemo, useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { buildFullOwnershipModel } from "@/lib/game-theory/ownership";
import {
  getStrategyRecommendation,
  POOL_STRATEGY_CONFIGS,
} from "@/lib/game-theory/strategy";
import type { TournamentRound, TeamSeason } from "@/types/team";
import type {
  OwnershipModel,
  PoolSizeBucket,
  PoolStrategyConfig,
  StrategyRecommendation,
} from "@/types/game-theory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContestStrategyResult {
  /** The computed ownership model */
  ownershipModel: OwnershipModel;
  /** The active pool strategy config */
  poolConfig: PoolStrategyConfig;
  /** Current pool size bucket */
  poolSizeBucket: PoolSizeBucket;
  /** Get ownership percentage for a team in a round */
  getOwnership: (teamId: string, round: TournamentRound) => number;
  /** Get strategy recommendation for a pick */
  getRecommendation: (
    winProbability: number,
    ownershipPct: number
  ) => { type: string; leverageScore: number; reason: string };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Provides ownership and strategy data derived from the current bracket state.
 *
 * Usage:
 * ```tsx
 * const { getOwnership, getRecommendation, poolConfig } = useContestStrategy();
 * const ownership = getOwnership(teamId, "R64");
 * const rec = getRecommendation(0.65, ownership);
 * ```
 */
export function useContestStrategy(): ContestStrategyResult {
  const { state } = useBracket();

  // Build ownership model from teams (memoized on teams reference)
  const ownershipModel = useMemo(() => {
    const teamArray = Array.from(state.teams.values());
    return buildFullOwnershipModel(teamArray);
  }, [state.teams]);

  // Get the pool config (memoized on pool size bucket)
  const poolSizeBucket: PoolSizeBucket = state.poolSizeBucket ?? "medium";
  const poolConfig = useMemo(
    () => POOL_STRATEGY_CONFIGS[poolSizeBucket],
    [poolSizeBucket]
  );

  // Stable getOwnership function
  const getOwnership = useCallback(
    (teamId: string, round: TournamentRound): number => {
      return ownershipModel.getOwnership(teamId, round);
    },
    [ownershipModel]
  );

  // Stable getRecommendation function
  const getRecommendation = useCallback(
    (winProbability: number, ownershipPct: number) => {
      return getStrategyRecommendation(winProbability, ownershipPct, poolConfig);
    },
    [poolConfig]
  );

  return {
    ownershipModel,
    poolConfig,
    poolSizeBucket,
    getOwnership,
    getRecommendation,
  };
}
