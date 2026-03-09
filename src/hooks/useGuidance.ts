"use client";

/**
 * useGuidance Hook
 *
 * Memoized hook that builds a GuidanceContext from the current BracketState
 * and evaluates all guidance rules. Returns an array of GuidanceMessages
 * sorted by severity.
 *
 * Recomputes only when picks, levers, overrides, or simulation results change.
 */

import { useMemo } from "react";
import { useBracket } from "@/hooks/useBracket";
import { evaluateGuidance } from "@/lib/guidance/evaluator";
import type { GuidanceContext, GuidanceMessage } from "@/types/guidance";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGuidance(): GuidanceMessage[] {
  const { state } = useBracket();

  const messages = useMemo(() => {
    const context: GuidanceContext = {
      picks: state.picks,
      teams: state.teams,
      globalLevers: state.globalLevers,
      matchupOverrides: state.matchupOverrides,
      simulationResult: state.simulationResult,
    };

    return evaluateGuidance(context);
  }, [
    state.picks,
    state.teams,
    state.globalLevers,
    state.matchupOverrides,
    state.simulationResult,
  ]);

  return messages;
}
