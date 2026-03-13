"use client";

import { useCallback } from "react";
import { useBracket } from "./useBracket";
import { useAuth } from "./useAuth";
import type { SavedBracketData } from "@/types/bracket-ui";
import type { SimulationResult } from "@/types/simulation";
import type { GlobalLevers, MatchupOverrides } from "@/types/engine";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";
import { deserializeGlobalLevers } from "@/lib/engine/lever-serialization";

/**
 * Hook for saving and loading brackets via the /api/brackets endpoints.
 *
 * Persists the user's picks and simulation snapshot to Supabase.
 * Requires authentication — saveBracket throws if user is not signed in.
 *
 * Must be used within both a BracketProvider and an AuthProvider.
 */
export function useBracketPersistence() {
  const { state, dispatch } = useBracket();
  const { user } = useAuth();

  const saveBracket = useCallback(async () => {
    if (!user) throw new Error("Must be signed in to save");

    const bracketData = {
      name: state.bracketName,
      season: 2026,
      picks: state.picks,
      global_levers: state.globalLevers,
      matchup_overrides: state.matchupOverrides,
      simulation_snapshot: state.simulationResult,
    };

    if (state.bracketId) {
      // Update existing bracket
      const res = await fetch(`/api/brackets/${state.bracketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bracketData),
      });
      if (!res.ok) throw new Error("Failed to save bracket");
      dispatch({ type: "MARK_SAVED", bracketId: state.bracketId });
    } else {
      // Create new bracket
      const res = await fetch("/api/brackets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bracketData),
      });
      if (!res.ok) throw new Error("Failed to create bracket");
      const data = await res.json();
      dispatch({ type: "MARK_SAVED", bracketId: data.bracket.id });
    }
  }, [
    user,
    state.bracketId,
    state.bracketName,
    state.picks,
    state.globalLevers,
    state.matchupOverrides,
    state.simulationResult,
    dispatch,
  ]);

  const loadBracket = useCallback(
    async (bracketId: string) => {
      const res = await fetch(`/api/brackets/${bracketId}`);
      if (!res.ok) throw new Error("Failed to load bracket");
      const data = await res.json();
      const bracket = data.bracket;
      // Restore saved lever state, falling back to defaults for old brackets
      const savedLevers = bracket.global_levers
        ? deserializeGlobalLevers(bracket.global_levers as Record<string, unknown>)
        : { ...DEFAULT_GLOBAL_LEVERS };
      const savedOverrides = (bracket.matchup_overrides || {}) as Record<string, MatchupOverrides>;

      dispatch({
        type: "LOAD_BRACKET",
        bracket: {
          bracketId: bracket.id,
          name: bracket.name,
          picks: (bracket.picks || {}) as Record<string, string>,
          globalLevers: savedLevers,
          matchupOverrides: savedOverrides,
          simulationSnapshot:
            (bracket.simulation_snapshot as SimulationResult | null) ?? null,
        } as SavedBracketData,
      });
    },
    [dispatch]
  );

  return {
    saveBracket,
    loadBracket,
    isDirty: state.isDirty,
    bracketId: state.bracketId,
    isAuthenticated: !!user,
  };
}
