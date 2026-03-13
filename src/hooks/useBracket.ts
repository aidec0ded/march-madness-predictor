"use client";

import { useContext } from "react";
import {
  BracketContext,
  SimulationProgressContext,
  type BracketContextValue,
  type SimulationProgressContextValue,
} from "@/components/bracket/BracketProvider";

/**
 * Hook to access the bracket state, dispatch, and pre-computed matchups.
 *
 * Must be used within a BracketProvider.
 *
 * @returns The current bracket state, dispatch function, and allMatchups array.
 * @throws {Error} If used outside of a BracketProvider.
 */
export function useBracket(): BracketContextValue {
  const context = useContext(BracketContext);
  if (!context) {
    throw new Error("useBracket must be used within a BracketProvider");
  }
  return context;
}

/**
 * Hook to access simulation progress state.
 *
 * Separated from the main bracket context so that frequent progress updates
 * during streaming simulations only re-render the components that actually
 * display progress (e.g., SimulationButton), not the entire bracket tree.
 *
 * Must be used within a BracketProvider.
 *
 * @returns The current simulation progress and a setter function.
 * @throws {Error} If used outside of a BracketProvider.
 */
export function useSimulationProgress(): SimulationProgressContextValue {
  const context = useContext(SimulationProgressContext);
  if (!context) {
    throw new Error("useSimulationProgress must be used within a BracketProvider");
  }
  return context;
}
