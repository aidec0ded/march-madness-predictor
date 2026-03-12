"use client";

import { useCallback } from "react";
import { useBracket } from "./useBracket";
import type { SimulationResult } from "@/types/simulation";

/**
 * Hook for triggering Monte Carlo bracket simulations.
 *
 * Calls POST /api/simulate with the current global levers and matchup overrides,
 * dispatches loading state and results into BracketContext.
 *
 * Must be used within a BracketProvider.
 */
export function useBracketSimulation() {
  const { state, dispatch } = useBracket();

  const simulate = useCallback(
    async (options?: { numSimulations?: number }) => {
      dispatch({ type: "SET_SIMULATING", isSimulating: true });
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            season: 2026, // Current season
            numSimulations: options?.numSimulations ?? 10000,
            engineConfig: {
              levers: state.globalLevers,
            },
            matchupOverrides:
              Object.keys(state.matchupOverrides).length > 0
                ? state.matchupOverrides
                : undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.result) {
          dispatch({
            type: "SET_SIMULATION_RESULT",
            result: data.result as SimulationResult,
          });
          return data.result as SimulationResult;
        } else {
          throw new Error(data.error || "Simulation failed");
        }
      } catch (error) {
        throw error;
      } finally {
        dispatch({ type: "SET_SIMULATING", isSimulating: false });
      }
    },
    [state.globalLevers, state.matchupOverrides, dispatch]
  );

  return {
    simulate,
    isSimulating: state.isSimulating,
    simulationResult: state.simulationResult,
    isSimulationStale: state.isSimulationStale,
  };
}
