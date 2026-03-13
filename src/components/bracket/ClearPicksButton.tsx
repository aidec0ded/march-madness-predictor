"use client";

import { useState, useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useMediaQuery, MOBILE_QUERY } from "@/hooks/useMediaQuery";

/**
 * Clear Picks button rendered inside BracketProvider.
 *
 * Resets all bracket picks while preserving lever settings, matchup overrides,
 * pool size, and bracket name. Shows a confirmation prompt before clearing.
 * Disabled when no picks have been made.
 */
export function ClearPicksButton() {
  const { state, dispatch } = useBracket();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [confirming, setConfirming] = useState(false);

  const pickCount = Object.keys(state.picks).length;
  const isEmpty = pickCount === 0;

  const handleClick = useCallback(() => {
    if (isEmpty) return;
    setConfirming(true);
  }, [isEmpty]);

  const handleConfirm = useCallback(() => {
    dispatch({ type: "CLEAR_PICKS" });
    setConfirming(false);
  }, [dispatch]);

  const handleCancel = useCallback(() => {
    setConfirming(false);
  }, []);

  if (confirming) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span
          style={{
            fontSize: isMobile ? "0.7rem" : "0.75rem",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          Clear {pickCount} pick{pickCount !== 1 ? "s" : ""}?
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            padding: isMobile ? "4px 8px" : "6px 10px",
            fontSize: isMobile ? "0.7rem" : "0.75rem",
            fontWeight: 600,
            color: "var(--bg-primary)",
            backgroundColor: "var(--accent-danger)",
            border: "1px solid var(--accent-danger)",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "opacity 0.15s ease",
          }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            padding: isMobile ? "4px 8px" : "6px 10px",
            fontSize: isMobile ? "0.7rem" : "0.75rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            backgroundColor: "transparent",
            border: "1px solid var(--border-primary)",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "opacity 0.15s ease",
          }}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isEmpty}
      title={isEmpty ? "No picks to clear" : `Clear all ${pickCount} picks`}
      style={{
        padding: isMobile ? "6px 10px" : "8px 14px",
        fontSize: isMobile ? "0.75rem" : "0.8125rem",
        fontWeight: 600,
        color: isEmpty ? "var(--text-muted)" : "var(--text-secondary)",
        backgroundColor: "transparent",
        border: "1px solid var(--border-primary)",
        borderRadius: "6px",
        cursor: isEmpty ? "not-allowed" : "pointer",
        opacity: isEmpty ? 0.5 : 1,
        transition: "all 0.15s ease",
      }}
    >
      {isMobile ? "Clear" : "Clear Picks"}
    </button>
  );
}
