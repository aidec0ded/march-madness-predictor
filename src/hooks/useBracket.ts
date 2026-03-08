"use client";

import { useContext } from "react";
import {
  BracketContext,
  type BracketContextValue,
} from "@/components/bracket/BracketProvider";

/**
 * Hook to access the bracket state and dispatch.
 *
 * Must be used within a BracketProvider.
 *
 * @returns The current bracket state and dispatch function.
 * @throws {Error} If used outside of a BracketProvider.
 */
export function useBracket(): BracketContextValue {
  const context = useContext(BracketContext);
  if (!context) {
    throw new Error("useBracket must be used within a BracketProvider");
  }
  return context;
}
