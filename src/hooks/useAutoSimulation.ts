"use client";

/**
 * useAutoSimulation — auto-triggers a Monte Carlo simulation on first load.
 *
 * When the bracket has teams loaded but no simulation result (fresh visit or
 * no saved bracket with a simulation snapshot), this hook fires a background
 * simulation so the user immediately sees path probabilities, championship
 * odds, and a fully populated bracket.
 *
 * The simulation runs once and silently. The SimulationButton reflects the
 * loading state automatically via the shared BracketContext. Errors are
 * swallowed — the user can always trigger simulation manually.
 *
 * Must be used within a BracketProvider.
 */

import { useEffect, useRef } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useBracketSimulation } from "@/hooks/useBracketSimulation";

export function useAutoSimulation(): void {
  const { state } = useBracket();
  const { simulate, isSimulating } = useBracketSimulation();
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Only trigger once per mount
    if (hasTriggered.current) return;

    // Don't auto-sim if no teams loaded
    if (state.teams.size === 0) return;

    // Don't auto-sim if simulation results already exist (saved bracket or previous run)
    if (state.simulationResult !== null) return;

    // Don't auto-sim if already in progress
    if (isSimulating) return;

    hasTriggered.current = true;

    // Fire and forget — errors are handled by SimulationButton's state machine
    simulate().catch(() => {
      // Silently swallow errors; user can manually re-trigger via the button
    });
  }, [state.teams.size, state.simulationResult, isSimulating, simulate]);
}
