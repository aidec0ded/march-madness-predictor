"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/providers/AuthProvider";
import type { AuthContextValue } from "@/components/providers/AuthProvider";

/**
 * Hook to access the current authentication state.
 *
 * Must be used within an AuthProvider.
 *
 * @returns The current user, loading state, and signOut function.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
